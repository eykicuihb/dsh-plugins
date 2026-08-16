/**
 * xAI Grok OAuth Adapter
 * Connects to xAI Grok models using Grok OAuth token or subscription endpoint.
 * Dynamically queries the remote xAI /v1/models API endpoint when connected.
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

interface RemoteGrokModelMeta {
  id: string
  created?: number
  owned_by?: string
}

const OFFICIAL_GROK_MODELS: readonly LlmModelInfo[] = [
  { id: 'grok-2-1212', name: 'Grok-2', description: 'High-performance general reasoning and coding model' },
  { id: 'grok-2-vision-1212', name: 'Grok-2 Vision', description: 'Multimodal image and diagram comprehension' },
  { id: 'grok-beta', name: 'Grok Beta', description: 'Standard high-speed Grok chat model' },
]

export class GrokAdapter extends LlmAdapter {
  private readonly tokenStore: TokenStore
  private readonly quotaService?: QuotaService
  private readonly customBaseURL?: string
  private readonly modelMetaCache = new Map<string, RemoteGrokModelMeta>()

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

  public override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const modelsMap = new Map<string, LlmModelInfo>()

    // 1. Dynamic live query to remote xAI /models endpoint
    try {
      const token = this.tokenStore.loadToken('grok')
      const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://api.x.ai/v1'
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)

      const headers: Record<string, string> = {}
      if (token?.accessToken) {
        headers['Authorization'] = `Bearer ${token.accessToken}`
      }

      const res = await fetch(`${baseURL.replace(/\/+$/, '')}/models`, {
        headers,
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.ok) {
        const data = (await res.json()) as { data?: RemoteGrokModelMeta[] }
        const list = data?.data || []
        for (const item of list) {
          const id = item.id
          if (id.startsWith('grok')) {
            this.modelMetaCache.set(id, item)
            modelsMap.set(id, {
              provider,
              id,
              name: id,
              description: `xAI ${id} (Remote Synced)`,
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

    // 3. Fallback to official xAI model catalog
    return OFFICIAL_GROK_MODELS.map(m => ({ ...m, provider }))
  }

  public override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const isReasoning = model.includes('thinking') || model.includes('reasoning')
    return Promise.resolve({
      provider,
      id: model,
      name: OFFICIAL_GROK_MODELS.find(m => m.id === model)?.name || model,
      context: {
        contextWindow: 131072,
      },
      defaultMaxTokens: 8192,
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

  public override async *stream(
    _provider: string,
    model: string,
    options: GenerateOptions,
  ): AsyncIterableIterator<StreamChunk> {
    const token = this.tokenStore.loadToken('grok')
    if (!token?.accessToken) {
      throw new Error('xAI Grok OAuth token not found or expired. Please authorize via OAuth first.')
    }

    const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://api.x.ai/v1'
    const endpoint = `${baseURL.replace(/\/+$/, '')}/chat/completions`

    const messages = options.messages.map((m) => {
      if (typeof m.content === 'string') {
        return { role: m.role, content: m.content }
      }
      const parts = (m.content || []).map((p: any) => {
        if (p.type === 'text') return { type: 'text', text: p.text }
        if (p.type === 'image' && p.image) {
          return {
            type: 'image_url',
            image_url: { url: `data:${p.image.mediaType};base64,${p.image.data}` },
          }
        }
        return p
      })
      return { role: m.role, content: parts }
    })

    const body: Record<string, any> = {
      model,
      messages,
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.accessToken}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`xAI Grok API error (${response.status}): ${errText}`)
    }

    if (!response.body) {
      throw new Error('No response body received from Grok API.')
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
          if (trimmed === 'data: [DONE]') return

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6)
            try {
              const parsed = JSON.parse(dataStr)
              const choice = parsed.choices?.[0]
              if (!choice) continue

              const delta = choice.delta
              if (delta?.content) {
                yield { type: 'text', text: delta.content }
              }
              if (delta?.reasoning_content) {
                yield { type: 'reasoning', text: delta.reasoning_content }
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
