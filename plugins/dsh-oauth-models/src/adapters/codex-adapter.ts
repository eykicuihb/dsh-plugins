/**
 * OpenAI Codex OAuth Adapter
 * Connects to OpenAI models using Codex OAuth token via ChatGPT backend API.
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

interface DynamicCodexModelMeta {
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
  private readonly dynamicModels = new Map<string, DynamicCodexModelMeta>()

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

    const token = this.tokenStore.loadToken('codex')
    if (!token?.accessToken) {
      return []
    }

    // 1. Synchronize dynamically from active Codex OAuth session cache
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

  public override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const model = options.model || 'gpt-5.6-sol'
    const token = this.tokenStore.loadToken('codex')
    if (!token?.accessToken) {
      throw new Error('OpenAI Codex OAuth token not found. Please authorize via OAuth in settings.')
    }

    const isCustomUrl = Boolean(this.customBaseURL && this.customBaseURL.trim())
    const endpoint = isCustomUrl
      ? `${this.customBaseURL!.trim().replace(/\/+$/, '')}/chat/completions`
      : 'https://chatgpt.com/backend-api/codex/responses'

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token.accessToken}`,
    }
    if (token.accountId) {
      headers['ChatGPT-Account-Id'] = token.accountId
    }

    let body: Record<string, any>

    if (isCustomUrl) {
      const messages = (options.messages || []).map((m: any) => {
        if (typeof m.content === 'string') return { role: m.role, content: m.content }
        if (Array.isArray(m.content)) {
          const text = m.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
          return { role: m.role, content: text }
        }
        return { role: m.role, content: String(m.content || '') }
      })
      body = { model, messages, stream: true }
      if (options.temperature !== undefined) body.temperature = options.temperature
      if (options.maxTokens) body.max_tokens = options.maxTokens
    } else {
      // ChatGPT Backend Codex Responses API format
      const input = (options.messages || []).map((m: any) => {
        const text = typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content)
            ? m.content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
            : String(m.content || '')
        return {
          type: 'message',
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: [{ type: 'input_text', text }],
        }
      })

      body = {
        model,
        input,
        stream: true,
        store: false,
      }
      if (options.reasoningEffort) {
        body.reasoning = { effort: options.reasoningEffort }
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: options.signal,
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

              // 1. ChatGPT Backend Responses API format
              if (parsed.type === 'response.output_text.delta' || parsed.type === 'response.text.delta') {
                if (parsed.delta) {
                  const textIndex = hasReasoning ? 1 : 0
                  yield { type: 'text-delta', index: textIndex, text: parsed.delta }
                }
              } else if (parsed.type === 'response.reasoning.delta' || parsed.type === 'response.thought.delta') {
                if (parsed.delta) {
                  hasReasoning = true
                  yield { type: 'reasoning-delta', index: 0, text: parsed.delta }
                }
              }

              // 2. Classic OpenAI ChatCompletions format fallback
              const choice = parsed.choices?.[0]
              if (choice?.delta?.reasoning_content) {
                hasReasoning = true
                yield { type: 'reasoning-delta', index: 0, text: choice.delta.reasoning_content }
              }
              if (choice?.delta?.content) {
                const textIndex = hasReasoning ? 1 : 0
                yield { type: 'text-delta', index: textIndex, text: choice.delta.content }
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
