/**
 * Google Antigravity (Gemini / Claude via CloudCode PA) OAuth Adapter
 * Connects to Google Antigravity models using CloudCode/Antigravity OAuth tokens or API keys.
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
    { id: 'gemini-3.0-pro', name: 'Gemini 3.0 Pro (Frontier)', description: 'Next-generation frontier reasoning, software synthesis, and 2M+ multimodal context' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Thinking)', description: 'Flagship hybrid reasoning, STEM reasoning, and 2M token context' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Thinking)', description: 'Ultra-fast low-latency frontier hybrid reasoning model' },
    { id: 'gemini-2.5-flash-thinking', name: 'Gemini 2.5 Flash Thinking', description: 'Deep chain-of-thought logic visualization and complex problem solving' },
    { id: 'claude-3-7-sonnet-thought', name: 'Claude 3.7 Sonnet (Thinking)', description: 'State-of-the-art hybrid reasoning and agentic coding via Antigravity CloudCode PA' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Frontier software engineering and architectural reasoning' },
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
      description: 'Google Antigravity & CloudCode PA frontier models authenticated via OAuth',
    }
  }

  public override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const modelsMap = new Map<string, LlmModelInfo>()

    // 1. Preload curated frontier Gemini 3.0 / 2.5 / Claude 3.7 models
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
            if (id.startsWith('gemini-3') || id.startsWith('gemini-2.5') || id.startsWith('claude')) {
              if (!modelsMap.has(id)) {
                modelsMap.set(id, {
                  provider,
                  id,
                  name: item.displayName || id,
                  description: item.description || `Antigravity ${id} (Live synced)`,
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
    const isThinking = model.includes('thinking') || model.includes('thought') || model.includes('2.5') || model.includes('3.0')
    const isClaude = model.includes('claude')
    return Promise.resolve({
      provider,
      id: model,
      name: this.knownModels.find(m => m.id === model)?.name || model,
      context: {
        contextWindow: isClaude ? 200000 : 2000000,
      },
      defaultMaxTokens: 65536,
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
