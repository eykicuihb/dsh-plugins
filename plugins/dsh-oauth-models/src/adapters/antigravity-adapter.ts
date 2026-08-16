/**
 * Google Antigravity (Gemini) OAuth Adapter
 * Connects to Google Gemini models using CloudCode/Antigravity OAuth tokens or API keys.
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

export class AntigravityAdapter extends LlmAdapter {
  private readonly tokenStore: TokenStore
  private readonly quotaService?: QuotaService
  private readonly customBaseURL?: string

  private readonly knownModels: readonly LlmModelInfo[] = [
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Thinking)', description: 'Flagship hybrid reasoning, coding, and 2M multi-modal context' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Thinking)', description: 'Ultra-fast low-latency frontier hybrid reasoning model' },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Next-generation fast multimodal agent and coding model' },
    { id: 'gemini-2.0-flash-thinking-exp', name: 'Gemini 2.0 Flash Thinking Exp', description: 'Real-time thinking visualization and complex logic' },
    { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro Exp', description: 'Frontier experimental model specialized in advanced coding' },
    { id: 'gemini-exp-1206', name: 'Gemini Exp 1206', description: 'High-intelligence experimental reasoning checkpoint' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: '2M token ultra-long context multimodal reasoning model' },
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
      description: 'Google Gemini frontier models authenticated via Antigravity OAuth',
    }
  }

  public override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const modelsMap = new Map<string, LlmModelInfo>()

    // 1. Preload curated frontier Gemini 2.5 / 2.0 models (ensuring optimal display order)
    for (const m of this.knownModels) {
      modelsMap.set(m.id, { ...m, provider })
    }

    // 2. Synchronize dynamically if connected
    try {
      const token = this.tokenStore.loadToken('antigravity')
      if (token?.accessToken) {
        const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://generativelanguage.googleapis.com/v1beta'
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 3500)
        const res = await fetch(`${baseURL.replace(/\/+$/, '')}/models?key=${token.accessToken}`, {
          signal: controller.signal,
        })
        clearTimeout(timer)

        if (res.ok) {
          const data = (await res.json()) as { models?: Array<{ name: string; displayName?: string; description?: string }> }
          for (const item of data?.models || []) {
            const id = item.name.replace(/^models\//, '')
            if (id.startsWith('gemini')) {
              if (!modelsMap.has(id)) {
                modelsMap.set(id, {
                  provider,
                  id,
                  name: item.displayName || `Gemini ${id}`,
                  description: item.description || `Google ${id} (Live synced from account)`,
                })
              }
            }
          }
        }
      }
    } catch {
      // Fallback gracefully
    }

    return Array.from(modelsMap.values())
  }

  public override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const isThinking = model.includes('thinking') || model.includes('2.5')
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      context: {
        contextWindow: model.includes('1.5-pro') ? 2000000 : 1000000,
      },
      defaultMaxTokens: model.includes('flash') && !isThinking ? 8192 : 65536,
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
      throw new Error(`Google Gemini API error (${response.status}): ${errText}`)
    }

    if (!response.body) {
      throw new Error('No response body received from Gemini API.')
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
