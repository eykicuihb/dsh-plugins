/**
 * Google Antigravity (Gemini) OAuth Adapter
 * Connects to Google Gemini models using CloudCode / Antigravity OAuth tokens or API keys.
 * Dynamically queries the remote Gemini /models API endpoint when connected.
 */

import { LlmAdapter } from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  StreamChunk,
} from '@deepseek-ai/dsh-llm'
import type { TokenStore } from '../auth/token-store.ts'
import type { QuotaService } from '../quota/quota-service.ts'

interface RemoteGeminiModelMeta {
  name: string
  displayName?: string
  description?: string
  inputTokenLimit?: number
  outputTokenLimit?: number
  supportedGenerationMethods?: string[]
}

const OFFICIAL_GEMINI_MODELS: readonly LlmModelInfo[] = [
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Next-generation multimodal model with low latency and native tool use' },
  { id: 'gemini-2.0-flash-thinking-exp-01-21', name: 'Gemini 2.0 Flash Thinking Exp', description: 'Experimental model featuring real-time thinking and reasoning process' },
  { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro Exp', description: 'Frontier experimental model optimized for coding and complex reasoning' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '2M token ultra-long context multimodal reasoning model' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Lightweight, fast multimodal model with 1M context window' },
]

export class AntigravityAdapter extends LlmAdapter {
  private readonly tokenStore: TokenStore
  private readonly quotaService?: QuotaService
  private readonly customBaseURL?: string
  private readonly modelMetaCache = new Map<string, RemoteGeminiModelMeta>()

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
      description: 'Google Gemini models authenticated via Antigravity OAuth',
    }
  }

  public override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const modelsMap = new Map<string, LlmModelInfo>()

    // 1. Dynamic live query to remote Google Gemini /models API
    try {
      const token = this.tokenStore.loadToken('antigravity')
      const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://generativelanguage.googleapis.com/v1beta'
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)

      const url = token?.accessToken
        ? `${baseURL.replace(/\/+$/, '')}/models?key=${token.accessToken}`
        : `${baseURL.replace(/\/+$/, '')}/models`

      const headers: Record<string, string> = {}
      if (token?.accessToken && !url.includes('key=')) {
        headers['Authorization'] = `Bearer ${token.accessToken}`
      }

      const res = await fetch(url, {
        headers,
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.ok) {
        const data = (await res.json()) as { models?: RemoteGeminiModelMeta[] }
        const list = data?.models || []
        for (const item of list) {
          const id = item.name.replace(/^models\//, '')
          if (
            item.supportedGenerationMethods?.includes('generateContent')
            || id.startsWith('gemini')
          ) {
            this.modelMetaCache.set(id, item)
            modelsMap.set(id, {
              provider,
              id,
              name: item.displayName || id,
              description: item.description || `Google ${id}`,
            })
          }
        }
      }
    } catch {
      // Ignore network errors
    }

    // 2. If remote returns models dynamically, return them directly
    if (modelsMap.size > 0) {
      return Array.from(modelsMap.values())
    }

    // 3. Fallback to official Gemini model catalog
    return OFFICIAL_GEMINI_MODELS.map(m => ({ ...m, provider }))
  }

  public override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const meta = this.modelMetaCache.get(model)
    const isThinking = model.includes('thinking')

    const contextWindow = meta?.inputTokenLimit || (model.includes('1.5-pro') ? 2000000 : 1000000)
    const maxTokens = meta?.outputTokenLimit || (model.includes('flash') && !isThinking ? 8192 : 65536)

    return Promise.resolve({
      provider,
      id: model,
      name: meta?.displayName || OFFICIAL_GEMINI_MODELS.find(m => m.id === model)?.name || model,
      context: {
        contextWindow: Number.isInteger(contextWindow) && contextWindow > 0 ? contextWindow : 1000000,
      },
      defaultMaxTokens: Number.isInteger(maxTokens) && maxTokens > 0 ? maxTokens : 8192,
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

  public override async *stream(
    _provider: string,
    model: string,
    options: GenerateOptions,
  ): AsyncIterableIterator<StreamChunk> {
    const token = this.tokenStore.loadToken('antigravity')
    if (!token?.accessToken) {
      throw new Error('Google Antigravity OAuth token not found or expired. Please authorize via OAuth first.')
    }

    const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://generativelanguage.googleapis.com/v1beta'
    const endpoint = `${baseURL.replace(/\/+$/, '')}/models/${model}:streamGenerateContent?alt=sse&key=${token.accessToken}`

    const contents = options.messages.map((m) => {
      const role = m.role === 'assistant' ? 'model' : 'user'
      if (typeof m.content === 'string') {
        return { role, parts: [{ text: m.content }] }
      }
      const parts = (m.content || []).map((p: any) => {
        if (p.type === 'text') return { text: p.text }
        if (p.type === 'image' && p.image) {
          return {
            inline_data: {
              mime_type: p.image.mediaType,
              data: p.image.data,
            },
          }
        }
        return p
      })
      return { role, parts }
    })

    const body: Record<string, any> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens,
      },
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Google Antigravity API error (${response.status}): ${errText}`)
    }

    if (!response.body) {
      throw new Error('No response body received from Antigravity API.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

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
              if (!candidate) continue

              const parts = candidate.content?.parts || []
              for (const part of parts) {
                if (part.thought) {
                  yield { type: 'reasoning', text: part.thought }
                } else if (part.text) {
                  yield { type: 'text', text: part.text }
                }
              }
            } catch {
              // Ignore partial JSON parse errors
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
