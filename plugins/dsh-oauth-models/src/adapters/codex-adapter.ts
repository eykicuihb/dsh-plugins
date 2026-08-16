/**
 * OpenAI Codex OAuth Adapter
 * Connects to OpenAI models using Codex OAuth token or direct subscription endpoint.
 * 100% dynamically synchronizes model list from active OAuth remote session.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
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

interface DynamicModelMeta {
  id: string
  name: string
  description?: string
  contextWindow: number
  defaultMaxTokens: number
  defaultReasoningLevel?: string
  supportedReasoningLevels?: Array<{ effort: string; description?: string }>
}

export class CodexAdapter extends LlmAdapter {
  private readonly tokenStore: TokenStore
  private readonly quotaService?: QuotaService
  private readonly customBaseURL?: string
  private readonly dynamicModels = new Map<string, DynamicModelMeta>()

  constructor(tokenStore: TokenStore, quotaService?: QuotaService, customBaseURL?: string) {
    super()
    this.tokenStore = tokenStore
    this.quotaService = quotaService
    this.customBaseURL = customBaseURL
  }

  public override providerInfo(_provider: string): LlmProviderInfo {
    return {
      id: 'codex',
      name: 'OpenAI Codex (OAuth)',
      description: 'OpenAI models dynamically synchronized from active Codex OAuth session',
    }
  }

  public override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    this.dynamicModels.clear()

    // 1. Synchronize from active Codex OAuth session cache
    const sessionCachePaths = [
      path.join(os.homedir(), '.codex', 'models_cache.json'),
      path.join(os.homedir(), '.codex', 'cc-switch-model-catalog.json'),
      path.join(os.homedir(), '.codex', 'opencodex-catalog.json'),
    ]

    for (const p of sessionCachePaths) {
      try {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf-8')
          const data = JSON.parse(raw)
          const list = data?.models || []
          for (const item of list) {
            if (item?.slug && !this.dynamicModels.has(item.slug)) {
              this.dynamicModels.set(item.slug, {
                id: item.slug,
                name: item.display_name || item.slug,
                description: item.description,
                contextWindow: item.context_window || 272000,
                defaultMaxTokens: 65536,
                defaultReasoningLevel: item.default_reasoning_level,
                supportedReasoningLevels: item.supported_reasoning_levels,
              })
            }
          }
          if (this.dynamicModels.size > 0) break
        }
      } catch {
        // Ignore file read error
      }
    }

    // 2. Synchronize dynamically from remote endpoint if available
    try {
      const token = this.tokenStore.loadToken('codex')
      if (token?.accessToken) {
        const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://api.openai.com/v1'
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 4000)
        const res = await fetch(`${baseURL.replace(/\/+$/, '')}/models`, {
          headers: { Authorization: `Bearer ${token.accessToken}` },
          signal: controller.signal,
        })
        clearTimeout(timer)

        if (res.ok) {
          const data = (await res.json()) as { data?: Array<{ id: string }> }
          for (const item of data?.data || []) {
            const id = item.id
            if (
              !id.includes('realtime') && !id.includes('audio') &&
              !id.includes('transcription') && !id.includes('embedding') && !id.includes('tts')
            ) {
              if (!this.dynamicModels.has(id)) {
                this.dynamicModels.set(id, {
                  id,
                  name: id,
                  description: `OpenAI ${id} (Remote Synced)`,
                  contextWindow: 128000,
                  defaultMaxTokens: 16384,
                })
              }
            }
          }
        }
      }
    } catch {
      // Ignore network errors
    }

    return Array.from(this.dynamicModels.values()).map(m => ({
      provider,
      id: m.id,
      name: m.name,
      description: m.description || `OpenAI ${m.name}`,
    }))
  }

  public override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const meta = this.dynamicModels.get(model)
    const isReasoning = Boolean(meta?.supportedReasoningLevels && meta.supportedReasoningLevels.length > 0)
      || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('gpt-5')

    const efforts = meta?.supportedReasoningLevels?.map(r => ({
      id: r.effort,
      name: r.effort.charAt(0).toUpperCase() + r.effort.slice(1),
      description: r.description,
    })) || (isReasoning ? [
      { id: 'low', name: 'Low' },
      { id: 'medium', name: 'Medium' },
      { id: 'high', name: 'High' },
    ] : undefined)

    return Promise.resolve({
      provider,
      id: model,
      name: meta?.name || model,
      context: {
        contextWindow: meta?.contextWindow && meta.contextWindow > 0 ? meta.contextWindow : 272000,
      },
      defaultMaxTokens: meta?.defaultMaxTokens && meta.defaultMaxTokens > 0 ? meta.defaultMaxTokens : 65536,
      reasoning: isReasoning && efforts
        ? {
            efforts,
            defaultEffort: meta?.defaultReasoningLevel || 'medium',
          }
        : undefined,
    })
  }

  public override async *stream(
    _provider: string,
    model: string,
    options: GenerateOptions,
  ): AsyncIterableIterator<StreamChunk> {
    const token = this.tokenStore.loadToken('codex')
    if (!token?.accessToken) {
      throw new Error('Codex OAuth token not found or expired. Please authorize via OAuth first.')
    }

    const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://api.openai.com/v1'
    const endpoint = `${baseURL.replace(/\/+$/, '')}/chat/completions`

    const meta = this.dynamicModels.get(model)
    const isReasoning = Boolean(meta?.supportedReasoningLevels && meta.supportedReasoningLevels.length > 0)
      || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('gpt-5')

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
    }

    if (isReasoning) {
      if (options.reasoningEffort) {
        body.reasoning_effort = options.reasoningEffort
      }
      if (options.maxTokens) {
        body.max_completion_tokens = options.maxTokens
      }
    } else {
      if (options.temperature !== undefined) body.temperature = options.temperature
      if (options.maxTokens) body.max_tokens = options.maxTokens
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
      throw new Error(`OpenAI Codex API error (${response.status}): ${errText}`)
    }

    if (!response.body) {
      throw new Error('No response body received from Codex API.')
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
              // Ignore parse error on partial chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
