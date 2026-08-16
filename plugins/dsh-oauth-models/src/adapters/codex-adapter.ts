/**
 * OpenAI Codex OAuth Adapter
 * Connects to OpenAI models using Codex OAuth token or direct subscription endpoint.
 * Dynamically synchronizes models live from active OAuth state and models catalog.
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

interface CachedModelMeta {
  slug: string
  displayName: string
  description?: string
  contextWindow?: number
  defaultReasoningLevel?: string
  supportedReasoningLevels?: Array<{ effort: string; description?: string }>
}

export class CodexAdapter extends LlmAdapter {
  private readonly tokenStore: TokenStore
  private readonly quotaService?: QuotaService
  private readonly customBaseURL?: string
  private readonly modelMetaCache = new Map<string, CachedModelMeta>()

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
      description: 'Live OpenAI models synchronized from active Codex OAuth subscription',
    }
  }

  private loadModelsFromLocalOAuthCache(): CachedModelMeta[] {
    const results: CachedModelMeta[] = []
    const paths = [
      path.join(os.homedir(), '.codex', 'models_cache.json'),
      path.join(os.homedir(), '.codex', 'cc-switch-model-catalog.json'),
      path.join(os.homedir(), '.codex', 'opencodex-catalog.json'),
    ]

    for (const p of paths) {
      try {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf-8')
          const data = JSON.parse(raw)
          const list = data?.models || []
          for (const item of list) {
            if (item?.slug && !results.some(r => r.slug === item.slug)) {
              results.push({
                slug: item.slug,
                displayName: item.display_name || item.slug,
                description: item.description,
                contextWindow: item.context_window || 272000,
                defaultReasoningLevel: item.default_reasoning_level,
                supportedReasoningLevels: item.supported_reasoning_levels,
              })
            }
          }
          if (results.length > 0) break
        }
      } catch {
        // Continue to next path
      }
    }

    return results
  }

  public override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    const modelsMap = new Map<string, LlmModelInfo>()

    // 1. Read live models from system OAuth cache
    const localModels = this.loadModelsFromLocalOAuthCache()
    for (const m of localModels) {
      this.modelMetaCache.set(m.slug, m)
      modelsMap.set(m.slug, {
        provider,
        id: m.slug,
        name: m.displayName,
        description: m.description || `OpenAI ${m.displayName}`,
      })
    }

    // 2. Synchronize dynamically with live OpenAI models endpoint if OAuth token exists
    try {
      const token = this.tokenStore.loadToken('codex')
      if (token?.accessToken) {
        const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://api.openai.com/v1'
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
            if (
              (id.startsWith('gpt-5') || id.startsWith('gpt-4') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('chatgpt'))
              && !id.includes('realtime') && !id.includes('audio') && !id.includes('transcription') && !id.includes('embedding')
            ) {
              if (!modelsMap.has(id)) {
                modelsMap.set(id, {
                  provider,
                  id,
                  name: `OpenAI ${id}`,
                  description: `OpenAI ${id} model (Live synced)`,
                })
              }
            }
          }
        }
      }
    } catch {
      // Graceful fallback
    }

    return Array.from(modelsMap.values())
  }

  public override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const meta = this.modelMetaCache.get(model)
    const isReasoning = meta?.supportedReasoningLevels && meta.supportedReasoningLevels.length > 0
      || model.startsWith('o1') || model.startsWith('o3') || model.startsWith('gpt-5')

    const efforts = meta?.supportedReasoningLevels?.map(r => ({
      id: r.effort,
      name: r.effort.charAt(0).toUpperCase() + r.effort.slice(1),
      description: r.description,
    })) || [
      { id: 'low', name: 'Low' },
      { id: 'medium', name: 'Medium' },
      { id: 'high', name: 'High' },
    ]

    return Promise.resolve({
      provider,
      id: model,
      name: meta?.displayName || model,
      context: {
        contextWindow: meta?.contextWindow || 272000,
      },
      defaultMaxTokens: isReasoning ? 65536 : 16384,
      reasoning: isReasoning
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

    const meta = this.modelMetaCache.get(model)
    const isReasoning = meta?.supportedReasoningLevels && meta.supportedReasoningLevels.length > 0
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
