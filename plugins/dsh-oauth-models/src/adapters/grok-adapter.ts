/**
 * xAI Grok OAuth Adapter
 * Connects to xAI Grok models using Grok OAuth token.
 * 100% dynamically synchronizes model list from remote xAI models endpoint.
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
  name?: string
  description?: string
  contextWindow?: number
  maxTokens?: number
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
      description: 'xAI Grok models dynamically synchronized via Grok OAuth API',
    }
  }

  public override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    this.dynamicModels.clear()

    const token = this.tokenStore.loadToken('grok')
    if (!token?.accessToken) {
      return []
    }

    try {
      const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://api.x.ai/v1'
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 4000)

      const res = await fetch(`${baseURL.replace(/\/+$/, '')}/models`, {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
        },
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ id: string; created?: number }> }
        for (const item of data?.data || []) {
          const id = item.id
          if (!id.includes('embedding') && !id.includes('moderation')) {
            this.dynamicModels.set(id, {
              id,
              name: id,
              description: `xAI ${id} (Live Remote Synced)`,
              contextWindow: 131072,
              maxTokens: 65536,
            })
          }
        }
      }
    } catch {
      // Ignore network error
    }

    return Array.from(this.dynamicModels.values()).map(m => ({
      provider,
      id: m.id,
      name: m.name || m.id,
      description: m.description || `xAI ${m.id}`,
    }))
  }

  public override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const meta = this.dynamicModels.get(model)
    const isReasoning = model.includes('reasoning') || model.includes('grok-3') || model.includes('grok-4') || model.includes('deepsearch')
    const contextWindow = meta?.contextWindow || 131072
    const maxTokens = meta?.maxTokens || 65536

    return Promise.resolve({
      provider,
      id: model,
      name: meta?.name || model,
      context: {
        contextWindow: Number.isInteger(contextWindow) && contextWindow > 0 ? contextWindow : 131072,
      },
      defaultMaxTokens: Number.isInteger(maxTokens) && maxTokens > 0 ? maxTokens : 65536,
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
    const model = options.model
    const token = this.tokenStore.loadToken('grok')
    if (!token?.accessToken) {
      throw new Error('xAI Grok OAuth token not found. Please authorize via OAuth in settings.')
    }

    const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://api.x.ai/v1'
    const endpoint = `${baseURL.replace(/\/+$/, '')}/chat/completions`

    const messages = (options.messages || []).map((m: any) => {
      if (typeof m.content === 'string') {
        return { role: m.role, content: m.content }
      }
      if (Array.isArray(m.content)) {
        const textParts = m.content
          .filter((p: any) => p.type === 'text')
          .map((p: any) => p.text)
          .join('\n')
        return { role: m.role, content: textParts }
      }
      return { role: m.role, content: String(m.content || '') }
    })

    const body: Record<string, any> = {
      model,
      messages,
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
    }

    if (options.reasoningEffort) {
      body.reasoning_effort = options.reasoningEffort
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.accessToken}`,
      },
      body: JSON.stringify(body),
      signal: options.signal,
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`xAI Grok API error (${response.status}): ${errText}`)
    }

    if (!response.body) {
      throw new Error('No response body received from xAI API.')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let hasReasoning = false

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
            yield { type: 'finish', reason: { kind: 'stop' } }
            return
          }

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6)
            try {
              const parsed = JSON.parse(dataStr)
              const choice = parsed.choices?.[0]
              if (!choice) continue

              const delta = choice.delta
              if (delta?.reasoning_content) {
                hasReasoning = true
                yield { type: 'reasoning-delta', index: 0, text: delta.reasoning_content }
              }
              if (delta?.content) {
                const textIndex = hasReasoning ? 1 : 0
                yield { type: 'text-delta', index: textIndex, text: delta.content }
              }
            } catch {
              // Ignore partial JSON parse errors
            }
          }
        }
      }
      yield { type: 'finish', reason: { kind: 'stop' } }
    } finally {
      reader.releaseLock()
    }
  }
}
