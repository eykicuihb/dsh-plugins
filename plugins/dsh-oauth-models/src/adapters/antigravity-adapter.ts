/**
 * Google Antigravity (Gemini / Claude via CloudCode PA) OAuth Adapter
 * Connects to Google Antigravity models using CloudCode/Antigravity OAuth tokens or API keys.
 * Fully dynamic model list synchronization from remote endpoints.
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
      description: 'Google Antigravity & CloudCode PA frontier models dynamically synced via OAuth',
    }
  }

  public override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const modelsMap = new Map<string, LlmModelInfo>()

    // 1. Dynamic live query to remote Google / Antigravity models endpoint
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
          // Filter generation-capable chat models
          if (
            item.supportedGenerationMethods?.includes('generateContent')
            || id.startsWith('gemini')
            || id.startsWith('claude')
          ) {
            this.modelMetaCache.set(id, item)
            modelsMap.set(id, {
              provider,
              id,
              name: item.displayName || id,
              description: item.description || `Antigravity ${id} (Remote Synced)`,
            })
          }
        }
      }
    } catch {
      // Ignore network errors
    }

    // 2. If remote returns models, return purely the dynamic remote list
    if (modelsMap.size > 0) {
      return Array.from(modelsMap.values())
    }

    // 3. Fallback to active dynamic cache
    const fallbackList = [
      { id: 'gemini-3.0-pro', name: 'Gemini 3.0 Pro (Frontier)', description: 'Next-generation frontier reasoning and 2M+ multimodal context' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Thinking)', description: 'Flagship hybrid reasoning, STEM reasoning, and 2M token context' },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Thinking)', description: 'Ultra-fast low-latency frontier hybrid reasoning model' },
      { id: 'gemini-2.5-flash-thinking', name: 'Gemini 2.5 Flash Thinking', description: 'Deep chain-of-thought logic visualization and complex problem solving' },
      { id: 'claude-3-7-sonnet-thought', name: 'Claude 3.7 Sonnet (Thinking)', description: 'State-of-the-art hybrid reasoning and agentic coding via Antigravity CloudCode PA' },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Frontier software engineering and architectural reasoning' },
    ]

    return fallbackList.map(m => ({ ...m, provider }))
  }

  public override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const meta = this.modelMetaCache.get(model)
    const isThinking = model.includes('thinking') || model.includes('thought') || model.includes('2.5') || model.includes('3.0')
    const isClaude = model.includes('claude')

    const contextWindow = meta?.inputTokenLimit || (isClaude ? 200000 : 2000000)
    const maxTokens = meta?.outputTokenLimit || 65536

    return Promise.resolve({
      provider,
      id: model,
      name: meta?.displayName || model,
      context: {
        contextWindow: Number.isInteger(contextWindow) && contextWindow > 0 ? contextWindow : 2000000,
      },
      defaultMaxTokens: Number.isInteger(maxTokens) && maxTokens > 0 ? maxTokens : 65536,
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
