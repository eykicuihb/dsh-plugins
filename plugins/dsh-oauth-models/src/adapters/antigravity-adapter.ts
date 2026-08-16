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

export class AntigravityAdapter extends LlmAdapter {
  private readonly tokenStore: TokenStore
  private readonly quotaService?: QuotaService
  private readonly customBaseURL?: string

  private readonly knownModels: readonly LlmModelInfo[] = [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Thinking)', description: 'Advanced reasoning, deep coding, and multimodal understanding' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Ultra-fast low latency multimodal model' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Next generation fast multimodal agent model' },
    { id: 'gemini-exp', name: 'Gemini Experimental', description: 'Cutting-edge frontier experimental checkpoint' },
  ]

  constructor(tokenStore: TokenStore, quotaService?: QuotaService, customBaseURL?: string) {
    super()
    this.tokenStore = tokenStore
    this.quotaService = quotaService
    this.customBaseURL = customBaseURL
  }

  public override providerInfo(_provider: string): LlmProviderInfo {
    return {
      id: 'antigravity',
      name: 'Google Antigravity (OAuth)',
      description: 'Google Gemini models authenticated via Antigravity CloudCode PA OAuth',
    }
  }

  public override listModels(_provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve(this.knownModels)
  }

  public override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const isPro = model.includes('pro') || model.includes('exp')
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      context: isPro ? 1000000 : 500000,
      defaultMaxTokens: 65536,
      reasoning: {
        efforts: [
          { id: 'low', name: 'Low' },
          { id: 'medium', name: 'Medium' },
          { id: 'high', name: 'High' },
        ],
        defaultEffort: 'medium',
      },
    })
  }

  public override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const accessToken = await this.tokenStore.getValidToken('antigravity')
    const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://daily-cloudcode-pa.googleapis.com'
    const endpoint = `${baseURL.replace(/\/+$/, '')}/v1internal:streamGenerateContent?alt=sse`

    // Convert messages to Gemini format
    const contents = options.messages.map((msg) => {
      let text = ''
      for (const block of msg.content) {
        if (block.type === 'text') {
          text += block.text
        }
      }
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text }],
      }
    })

    const payload: Record<string, unknown> = {
      model: options.model,
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 16384,
        thinkingConfig: {
          thinkingBudget: options.reasoningEffort === 'high' ? 16384 : (options.reasoningEffort === 'low' ? 2048 : 8192),
        },
      },
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
      throw new LlmError(`[AntigravityAdapter] Connection failed: ${(err as Error).message}`, 'NETWORK')
    }

    if (this.quotaService && response.headers) {
      this.quotaService.updateFromHeaders('antigravity', response.headers)
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      if (response.status === 429) {
        throw new LlmError(`Google CloudCode quota / rate limit exceeded: ${errText}`, 'RATE_LIMIT')
      }
      if (response.status === 401) {
        throw new LlmError(`Google OAuth token expired: ${errText}`, 'AUTH')
      }
      throw new LlmError(`Google CloudCode error (${response.status}): ${errText}`, 'PROVIDER_ERROR')
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

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6)
            try {
              const parsed = JSON.parse(dataStr)
              const candidate = parsed.candidates?.[0]
              const parts = candidate?.content?.parts || []

              for (const part of parts) {
                // Handle Google Gemini thinking / thought parts
                if (part.thought || part.thinking) {
                  const thoughtText = part.thought || part.thinking
                  if (activeBlockType !== 'reasoning') {
                    if (activeBlockType) {
                      yield { type: 'block-end', index: activeBlockIndex }
                      activeBlockIndex++
                    }
                    yield { type: 'block-start', index: activeBlockIndex, block: { type: 'reasoning', text: '' } }
                    activeBlockType = 'reasoning'
                  }
                  yield { type: 'reasoning-delta', index: activeBlockIndex, delta: thoughtText }
                }

                // Handle text parts
                if (part.text) {
                  if (activeBlockType !== 'text') {
                    if (activeBlockType) {
                      yield { type: 'block-end', index: activeBlockIndex }
                      activeBlockIndex++
                    }
                    yield { type: 'block-start', index: activeBlockIndex, block: { type: 'text', text: '' } }
                    activeBlockType = 'text'
                  }
                  yield { type: 'text-delta', index: activeBlockIndex, delta: part.text }
                }
              }

              if (parsed.usageMetadata) {
                yield {
                  type: 'usage',
                  usage: {
                    inputTokens: parsed.usageMetadata.promptTokenCount || 0,
                    outputTokens: parsed.usageMetadata.candidatesTokenCount || 0,
                  },
                }
              }

              if (candidate?.finishReason) {
                if (activeBlockType) {
                  yield { type: 'block-end', index: activeBlockIndex }
                  activeBlockType = null
                }
                const reason = candidate.finishReason === 'MAX_TOKENS' ? 'length' : 'stop'
                yield { type: 'finish', reason }
                return
              }
            } catch {
              // Ignore partial chunk parse error
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
