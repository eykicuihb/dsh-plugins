/**
 * xAI Grok OAuth Adapter
 * Connects to xAI Grok models using Grok OAuth token or subscription endpoint.
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

export class GrokAdapter extends LlmAdapter {
  private readonly tokenStore: TokenStore
  private readonly quotaService?: QuotaService
  private readonly customBaseURL?: string

  private readonly knownModels: readonly LlmModelInfo[] = [
    { id: 'grok-3', name: 'Grok-3 (Flagship Reasoning)', description: 'xAI flagship frontier reasoning model with highest STEM, math, and code solving' },
    { id: 'grok-3-mini', name: 'Grok-3 Mini (Fast Thinking)', description: 'High-throughput lightweight reasoning model for agile coding loops' },
    { id: 'grok-3-deepsearch', name: 'Grok-3 DeepSearch', description: 'Autonomous multi-agent deep research and structured factual reasoning' },
    { id: 'grok-3-vision', name: 'Grok-3 Vision (Multimodal Frontier)', description: 'Frontier multimodal comprehension for high-resolution UI, diagrams, and video' },
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
      description: 'xAI Grok frontier models authenticated via SuperGrok OAuth',
    }
  }

  public override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const modelsMap = new Map<string, LlmModelInfo>()

    // 1. Preload curated frontier Grok-3 models
    for (const m of this.knownModels) {
      modelsMap.set(m.id, { ...m, provider })
    }

    // 2. Synchronize dynamically with live xAI endpoint
    try {
      const token = this.tokenStore.loadToken('grok')
      if (token?.accessToken) {
        const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://api.x.ai/v1'
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 3500)
        const res = await fetch(`${baseURL.replace(/\/+$/, '')}/models`, {
          headers: { Authorization: `Bearer ${token.accessToken}` },
          signal: controller.signal,
        })
        clearTimeout(timer)

        if (res.ok) {
          const data = (await res.json()) as { data?: Array<{ id: string }> }
          for (const item of data?.data || []) {
            const id = item.id
            if (id.startsWith('grok')) {
              if (!modelsMap.has(id)) {
                modelsMap.set(id, {
                  provider,
                  id,
                  name: `xAI ${id}`,
                  description: `xAI ${id} model (Live synced from account)`,
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
    const isReasoning = model.startsWith('grok-3')
    return Promise.resolve({
      provider,
      id: model,
      name: this.knownModels.find(m => m.id === model)?.name || model,
      context: {
        contextWindow: 131072,
      },
      defaultMaxTokens: 32768,
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
