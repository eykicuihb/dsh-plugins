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
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Thinking)', description: 'Deep reasoning, coding, and multi-modal long-context analysis' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Thinking)', description: 'Ultra-fast low latency hybrid reasoning model' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Next-generation fast multimodal agent model' },
    { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking Exp', description: 'Thinking process visualization and complex logic' },
    { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro Exp', description: 'Frontier experimental model for advanced coding' },
    { id: 'gemini-exp-1206', name: 'Gemini Exp 1206', description: 'Experimental high-intelligence checkpoint' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '2M token ultra-long context multimodal reasoning' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast long context multimodal model' },
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

  public override listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return Promise.resolve(this.knownModels.map(m => ({ ...m, provider })))
  }

  public override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const isPro = model.includes('pro') || model.includes('exp')
    const isThinking = model.includes('2.5') || model.includes('thinking')
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      context: {
        contextWindow: model.includes('1.5-pro') ? 2000000 : 1000000,
      },
      defaultMaxTokens: isPro ? 65536 : 8192,
      reasoning: isThinking
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
    const accessToken = await this.tokenStore.getValidToken('antigravity')
    const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://daily-cloudcode-pa.googleapis.com/v1internal'

    // Map system and user messages into Gemini format
    let systemInstruction = ''
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = []

    for (const msg of options.messages) {
      if (msg.role === 'system') {
        for (const block of msg.content) {
          if (block.type === 'text') {
            systemInstruction += (systemInstruction ? '\n\n' : '') + block.text
          }
        }
      } else {
        const parts: Array<{ text: string }> = []
        for (const block of msg.content) {
          if (block.type === 'text') {
            parts.push({ text: block.text })
          }
        }
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts,
        })
      }
    }

    const payload: Record<string, unknown> = {
      model: options.model,
      contents,
      generationConfig: {
        maxOutputTokens: options.maxTokens,
        temperature: options.temperature,
      },
    }

    if (systemInstruction) {
      payload.systemInstruction = {
        parts: [{ text: systemInstruction }],
      }
    }

    const endpoint = `${baseURL.replace(/\/+$/, '')}:streamGenerateContent?alt=sse`

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

    // Update QuotaService with live headers
    if (this.quotaService && response.headers) {
      this.quotaService.updateFromHeaders('antigravity', response.headers)
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      if (response.status === 429) {
        throw new LlmError(`Google CloudCode PA quota exhausted: ${errText}`, 'RATE_LIMIT')
      }
      if (response.status === 401 || response.status === 403) {
        throw new LlmError(`Google Antigravity OAuth unauthorized: ${errText}`, 'AUTH')
      }
      throw new LlmError(`Google Antigravity API error (${response.status}): ${errText}`, 'PROVIDER_ERROR')
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
                if (part.thought) {
                  if (activeBlockType !== 'reasoning') {
                    if (activeBlockType) {
                      yield { type: 'block-end', index: activeBlockIndex }
                      activeBlockIndex++
                    }
                    yield { type: 'block-start', index: activeBlockIndex, block: { type: 'reasoning', text: '' } }
                    activeBlockType = 'reasoning'
                  }
                  yield { type: 'reasoning-delta', index: activeBlockIndex, delta: part.text || '' }
                } else if (part.text) {
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
