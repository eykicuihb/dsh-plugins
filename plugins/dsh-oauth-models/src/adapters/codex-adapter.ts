import type {
  GenerateOptions,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import { LlmAdapter, LlmError } from '@deepseek-ai/dsh-llm'
import type { TokenStore } from '../auth/token-store.ts'
import type { QuotaService } from '../quota/quota-service.ts'

export class CodexAdapter extends LlmAdapter {
  private readonly tokenStore: TokenStore
  private readonly quotaService?: QuotaService
  private readonly customBaseURL?: string

  private readonly knownModels: readonly LlmModelInfo[] = [
    { id: 'gpt-4o', name: 'GPT-4o (Omni)', description: 'Flagship multimodal flagship model' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast, cost-effective vision and text model' },
    { id: 'o1', name: 'OpenAI o1', description: 'Deep reasoning and complex problem solving' },
    { id: 'o3-mini', name: 'OpenAI o3-mini', description: 'High-speed reasoning model' },
    { id: 'gpt-4.5-preview', name: 'GPT-4.5 Preview', description: 'Next-generation frontier model' },
    { id: 'codex', name: 'OpenAI Codex', description: 'Code-specialized reasoning agent model' },
  ]

  constructor(tokenStore: TokenStore, quotaService?: QuotaService, customBaseURL?: string) {
    super()
    this.tokenStore = tokenStore
    this.quotaService = quotaService
    this.customBaseURL = customBaseURL
  }

  public override providerInfo(_provider: string): LlmProviderInfo {
    return {
      id: 'codex',
      name: 'OpenAI Codex (OAuth)',
      description: 'OpenAI models authenticated via Codex OAuth subscription',
    }
  }

  public override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve(this.knownModels.map(m => ({ ...m, provider })))
  }

  public override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const isReasoning = model.startsWith('o1') || model.startsWith('o3')
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      context: isReasoning ? 200000 : 128000,
      defaultMaxTokens: isReasoning ? 65536 : 16384,
      reasoning: isReasoning
        ? {
            efforts: [
              { id: 'low', name: 'Low' },
              { id: 'medium', name: 'Medium' },
              { id: 'high', name: 'High' },
            ],
            defaultEffort: 'medium',
          }
        : undefined,
    })
  }

  public override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const accessToken = await this.tokenStore.getValidToken('codex')
    const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://api.openai.com/v1'
    const endpoint = `${baseURL.replace(/\/+$/, '')}/chat/completions`

    // Convert messages to OpenAI payload
    const messages = options.messages.map((msg) => {
      let content = ''
      for (const block of msg.content) {
        if (block.type === 'text') {
          content += block.text
        }
      }
      return {
        role: msg.role,
        content,
      }
    })

    const payload: Record<string, unknown> = {
      model: options.model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    }

    if (options.temperature !== undefined && !options.model.startsWith('o1') && !options.model.startsWith('o3')) {
      payload.temperature = options.temperature
    }
    if (options.maxTokens !== undefined) {
      if (options.model.startsWith('o1') || options.model.startsWith('o3')) {
        payload.max_completion_tokens = options.maxTokens
      } else {
        payload.max_tokens = options.maxTokens
      }
    }
    if (options.reasoningEffort) {
      payload.reasoning_effort = options.reasoningEffort
    }

    let response: Response
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
        signal: options.signal,
      })
    } catch (err) {
      if (options.signal?.aborted) {
        yield { type: 'finish', reason: 'aborted' }
        return
      }
      throw new LlmError(`[CodexAdapter] Network connection failed: ${(err as Error).message}`, 'NETWORK')
    }

    // Update QuotaService with live rate-limit response headers
    if (this.quotaService && response.headers) {
      this.quotaService.updateFromHeaders('codex', response.headers)
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      if (response.status === 429) {
        throw new LlmError(`OpenAI rate limit / quota exceeded: ${errText}`, 'RATE_LIMIT')
      }
      if (response.status === 401) {
        throw new LlmError(`OpenAI OAuth token expired or invalid: ${errText}`, 'AUTH')
      }
      throw new LlmError(`OpenAI API error (${response.status}): ${errText}`, 'PROVIDER_ERROR')
    }

    if (!response.body) {
      yield { type: 'finish', reason: 'error', failure: { code: 'EMPTY_RESPONSE', message: 'Empty stream body' } }
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let activeBlockIndex = 0
    let activeBlockType: 'text' | 'reasoning' | null = null

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith(':')) continue
          if (trimmed === 'data: [DONE]') {
            if (activeBlockType) {
              yield { type: 'block-end', index: activeBlockIndex }
              activeBlockType = null
            }
            yield { type: 'finish', reason: 'stop' }
            return
          }

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6)
            try {
              const parsed = JSON.parse(dataStr)
              const choice = parsed.choices?.[0]
              const delta = choice?.delta

              // Handle reasoning delta (e.g. o1/o3 reasoning tokens)
              if (delta?.reasoning_content || delta?.thought) {
                const thoughtChunk = delta.reasoning_content || delta.thought
                if (activeBlockType !== 'reasoning') {
                  if (activeBlockType) {
                    yield { type: 'block-end', index: activeBlockIndex }
                    activeBlockIndex++
                  }
                  yield { type: 'block-start', index: activeBlockIndex, block: { type: 'reasoning', text: '' } }
                  activeBlockType = 'reasoning'
                }
                yield { type: 'reasoning-delta', index: activeBlockIndex, delta: thoughtChunk }
              }

              // Handle normal text content delta
              if (delta?.content) {
                if (activeBlockType !== 'text') {
                  if (activeBlockType) {
                    yield { type: 'block-end', index: activeBlockIndex }
                    activeBlockIndex++
                  }
                  yield { type: 'block-start', index: activeBlockIndex, block: { type: 'text', text: '' } }
                  activeBlockType = 'text'
                }
                yield { type: 'text-delta', index: activeBlockIndex, delta: delta.content }
              }

              // Handle token usage reporting
              if (parsed.usage) {
                yield {
                  type: 'usage',
                  usage: {
                    inputTokens: parsed.usage.prompt_tokens || 0,
                    outputTokens: parsed.usage.completion_tokens || 0,
                  },
                }
              }

              if (choice?.finish_reason) {
                if (activeBlockType) {
                  yield { type: 'block-end', index: activeBlockIndex }
                  activeBlockType = null
                }
                const reason = choice.finish_reason === 'length' ? 'length' : 'stop'
                yield { type: 'finish', reason }
                return
              }
            } catch {
              // Ignore partial JSON parse errors
            }
          }
        }
      }

      if (activeBlockType) {
        yield { type: 'block-end', index: activeBlockIndex }
      }
      yield { type: 'finish', reason: 'stop' }
    } finally {
      reader.releaseLock()
    }
  }
}
