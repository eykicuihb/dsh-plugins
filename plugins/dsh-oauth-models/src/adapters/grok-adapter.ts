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

export class GrokAdapter extends LlmAdapter {
  private readonly tokenStore: TokenStore
  private readonly quotaService?: QuotaService
  private readonly customBaseURL?: string

  private readonly knownModels: readonly LlmModelInfo[] = [
    { id: 'grok-3', name: 'Grok-3 (Reasoning)', description: 'xAI flagship model with strong math, coding, and real-time reasoning' },
    { id: 'grok-3-mini', name: 'Grok-3 Mini', description: 'Fast, lightweight thinking model' },
    { id: 'grok-2-vision', name: 'Grok-2 Vision', description: 'Multimodal vision and diagram comprehension' },
    { id: 'grok-beta', name: 'Grok Beta', description: 'Standard high-speed Grok chat model' },
  ]

  constructor(tokenStore: TokenStore, quotaService?: QuotaService, customBaseURL?: string) {
    super()
    this.tokenStore = tokenStore
    this.quotaService = quotaService
    this.customBaseURL = customBaseURL
  }

  public override providerInfo(_provider: string): LlmProviderInfo {
    return {
      id: 'grok',
      name: 'xAI Grok (OAuth)',
      description: 'xAI Grok models authenticated via SuperGrok / xAI OAuth',
    }
  }

  public override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve(this.knownModels.map(m => ({ ...m, provider })))
  }

  public override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const isGrok3 = model.includes('grok-3')
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      context: isGrok3 ? 131072 : 65536,
      defaultMaxTokens: 32768,
      reasoning: isGrok3
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
    const accessToken = await this.tokenStore.getValidToken('grok')
    const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://api.x.ai/v1'
    const endpoint = `${baseURL.replace(/\/+$/, '')}/chat/completions`

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
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 16384,
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
      throw new LlmError(`[GrokAdapter] Network connection failed: ${(err as Error).message}`, 'NETWORK')
    }

    if (this.quotaService && response.headers) {
      this.quotaService.updateFromHeaders('grok', response.headers)
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      if (response.status === 429) {
        throw new LlmError(`xAI Grok rate limit exceeded: ${errText}`, 'RATE_LIMIT')
      }
      if (response.status === 401) {
        throw new LlmError(`xAI Grok OAuth token expired: ${errText}`, 'AUTH')
      }
      throw new LlmError(`xAI Grok API error (${response.status}): ${errText}`, 'PROVIDER_ERROR')
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

              // Handle Grok reasoning/thinking delta
              if (delta?.reasoning_content || delta?.thought) {
                const thought = delta.reasoning_content || delta.thought
                if (activeBlockType !== 'reasoning') {
                  if (activeBlockType) {
                    yield { type: 'block-end', index: activeBlockIndex }
                    activeBlockIndex++
                  }
                  yield { type: 'block-start', index: activeBlockIndex, block: { type: 'reasoning', text: '' } }
                  activeBlockType = 'reasoning'
                }
                yield { type: 'reasoning-delta', index: activeBlockIndex, delta: thought }
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
              // Ignore partial chunk parsing error
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
