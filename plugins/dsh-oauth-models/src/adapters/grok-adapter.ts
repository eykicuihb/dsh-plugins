/**
 * xAI Grok OAuth Adapter
 * Connects to xAI Grok models using Grok OAuth token or subscription endpoint.
 * 100% dynamically synchronizes model list from remote xAI /v1/models endpoint.
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

interface DynamicGrokModelMeta {
  id: string
  created?: number
  owned_by?: string
}

export class GrokAdapter extends LlmAdapter {
  private readonly tokenStore: TokenStore
  private readonly quotaService?: QuotaService
  private readonly customBaseURL?: string
  private readonly dynamicModels = new Map<string, DynamicGrokModelMeta>()

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
      description: 'xAI Grok models dynamically synchronized via SuperGrok / xAI OAuth',
    }
  }

  public override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    this.dynamicModels.clear()

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
        const data = (await res.json()) as { data?: DynamicGrokModelMeta[] }
        const list = data?.data || []
        for (const item of list) {
          if (item?.id) {
            this.dynamicModels.set(item.id, item)
          }
        }
      }
    } catch {
      // Ignore network errors
    }

    return Array.from(this.dynamicModels.values()).map(m => ({
      provider,
      id: m.id,
      name: m.id,
      description: `xAI ${m.id} model (Remote Synced)`,
    }))
  }

  public override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const isReasoning = model.includes('thinking') || model.includes('reasoning') || model.includes('grok-3')
    return Promise.resolve({
      provider,
      id: model,
      name: model,
      context: {
        contextWindow: 131072,
      },
      defaultMaxTokens: isReasoning ? 32768 : 8192,
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

    if (options.reasoningEffort && model.startsWith('grok-3')) {
      body.reasoning_effort = options.reasoningEffort
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
