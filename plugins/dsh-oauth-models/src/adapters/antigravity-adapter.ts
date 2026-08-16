/**
 * Google Antigravity (Gemini & Claude) OAuth Adapter
 * Connects to Google Cloud Code Assist / Antigravity OAuth API.
 * 100% dynamically synchronizes model list from remote Google Antigravity PA endpoint.
 */

import crypto from 'node:crypto'
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

interface DynamicAntigravityModelMeta {
  id: string
  displayName?: string
  description?: string
  inputTokenLimit?: number
  outputTokenLimit?: number
  supportsThinking?: boolean
  supportsImages?: boolean
}

const WIRE_MODEL_FALLBACKS: Record<string, string> = {
  'gemini-3.1-pro-high': 'gemini-pro-agent',
  'gemini-3.1-pro-preview': 'gemini-pro-agent',
  'gemini-3.5-flash-extra-low': 'gemini-3.6-flash-low',
  'gemini-3.5-flash-low': 'gemini-3.6-flash-medium',
  'gemini-3.5-flash-high': 'gemini-3.6-flash-high',
  'gemini-3-flash-agent': 'gemini-3.6-flash-high',
}

export class AntigravityAdapter extends LlmAdapter {
  private readonly tokenStore: TokenStore
  private readonly quotaService?: QuotaService
  private readonly customBaseURL?: string
  private readonly dynamicModels = new Map<string, DynamicAntigravityModelMeta>()

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
      description: 'Google Gemini & Claude models dynamically synchronized via Antigravity OAuth',
    }
  }

  public override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    this.dynamicModels.clear()

    const token = this.tokenStore.loadToken('antigravity')
    if (!token?.accessToken) {
      return []
    }

    const endpoints = [
      (this.customBaseURL && this.customBaseURL.trim()) || 'https://daily-cloudcode-pa.googleapis.com',
      'https://cloudcode-pa.googleapis.com',
    ]

    for (const base of endpoints) {
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 4000)

        const res = await fetch(`${base.replace(/\/+$/, '')}/v1internal:fetchAvailableModels`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token.accessToken}`,
            'User-Agent': 'antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)',
            'x-goog-api-client': 'google-api-nodejs-client/10.3.0',
          },
          body: JSON.stringify({ project: token.accountId || '' }),
          signal: controller.signal,
        })
        clearTimeout(timer)

        if (res.ok) {
          const data = (await res.json()) as { models?: Record<string, any> }
          const modelsMap = data?.models || {}
          for (const [modelId, meta] of Object.entries(modelsMap)) {
            this.dynamicModels.set(modelId, {
              id: modelId,
              displayName: meta.displayName || modelId,
              description: meta.description || `Google Antigravity ${meta.displayName || modelId}`,
              inputTokenLimit: meta.maxTokens || 1048576,
              outputTokenLimit: meta.maxOutputTokens || 65535,
              supportsThinking: Boolean(meta.supportsThinking),
              supportsImages: Boolean(meta.supportsImages),
            })
          }
          if (this.dynamicModels.size > 0) break
        }
      } catch {
        // Try fallback endpoint
      }
    }

    return Array.from(this.dynamicModels.values()).map(m => ({
      provider,
      id: m.id,
      name: m.displayName || m.id,
      description: m.description || `Antigravity ${m.displayName || m.id}`,
    }))
  }

  public override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const meta = this.dynamicModels.get(model)
    const isClaude = /claude/i.test(model)
    const isThinking = meta?.supportsThinking
      || isClaude
      || model.includes('thinking')
      || model.includes('pro')
      || model.includes('3.6-flash')
      || model.includes('2.5')

    const contextWindow = meta?.inputTokenLimit || (isClaude ? 250000 : 1048576)
    const maxTokens = meta?.outputTokenLimit || 65535

    let efforts: Array<{ id: string; name?: string; description?: string }> | undefined
    let defaultEffort = 'medium'

    if (isClaude) {
      efforts = [
        { id: 'low', name: 'Low' },
        { id: 'medium', name: 'Medium' },
        { id: 'high', name: 'High' },
        { id: 'max', name: 'Max' },
      ]
      defaultEffort = 'high'
    } else if (model.includes('3.1-pro')) {
      efforts = [
        { id: 'low', name: 'Low' },
        { id: 'high', name: 'High' },
      ]
      defaultEffort = 'high'
    } else if (isThinking) {
      efforts = [
        { id: 'low', name: 'Low' },
        { id: 'medium', name: 'Medium' },
        { id: 'high', name: 'High' },
      ]
      defaultEffort = 'medium'
    }

    return Promise.resolve({
      provider,
      id: model,
      name: meta?.displayName || model,
      context: {
        contextWindow: Number.isInteger(contextWindow) && contextWindow > 0 ? contextWindow : 1048576,
      },
      defaultMaxTokens: Number.isInteger(maxTokens) && maxTokens > 0 ? maxTokens : 65535,
      reasoning: isThinking && efforts
        ? {
            efforts,
            defaultEffort,
          }
        : undefined,
    })
  }

  public override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    let wireModel = options.model
    if (options.model === 'gemini-3.6-flash') {
      if (options.reasoningEffort === 'low') wireModel = 'gemini-3.6-flash-low'
      else if (options.reasoningEffort === 'high') wireModel = 'gemini-3.6-flash-high'
      else wireModel = 'gemini-3.6-flash-medium'
    } else if (options.model === 'gemini-3.1-pro') {
      if (options.reasoningEffort === 'low') wireModel = 'gemini-3.1-pro-low'
      else wireModel = 'gemini-pro-agent'
    } else if (WIRE_MODEL_FALLBACKS[options.model]) {
      wireModel = WIRE_MODEL_FALLBACKS[options.model]
    }

    const token = this.tokenStore.loadToken('antigravity')
    if (!token?.accessToken) {
      throw new Error('Google Antigravity OAuth token not found. Please authorize via OAuth in settings.')
    }

    const base = (this.customBaseURL && this.customBaseURL.trim()) || 'https://daily-cloudcode-pa.googleapis.com'
    const endpoint = `${base.replace(/\/+$/, '')}/v1internal:generateContent?alt=sse`

    const contents = (options.messages || []).map((m: any) => {
      const role = m.role === 'assistant' ? 'model' : 'user'
      if (typeof m.content === 'string') {
        return { role, parts: [{ text: m.content }] }
      }
      if (Array.isArray(m.content)) {
        const parts = m.content.map((p: any) => {
          if (p.type === 'text') return { text: p.text }
          if (p.type === 'image' && p.image) {
            return {
              inline_data: {
                mime_type: p.image.mediaType,
                data: p.image.data,
              },
            }
          }
          return { text: String(p.text || '') }
        })
        return { role, parts }
      }
      return { role, parts: [{ text: String(m.content || '') }] }
    })

    const generationConfig: Record<string, any> = {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxTokens,
    }

    if (/claude/i.test(wireModel) || wireModel.includes('thinking') || wireModel.includes('2.5-pro')) {
      if (options.reasoningEffort && options.reasoningEffort !== 'off') {
        const eff = options.reasoningEffort
        const thinkingLevel = (eff === 'max' || eff === 'ultra' || eff === 'xhigh') ? 'high' : eff
        generationConfig.thinkingConfig = { thinkingLevel }
      }
    }

    const body = {
      project: token.accountId || '',
      model: wireModel,
      userAgent: 'antigravity',
      requestType: 'agent',
      requestId: `agent-${crypto.randomUUID()}`,
      request: {
        contents,
        generationConfig,
      },
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.accessToken}`,
        'User-Agent': 'antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)',
        'x-goog-api-client': 'google-api-nodejs-client/10.3.0',
      },
      body: JSON.stringify(body),
      signal: options.signal,
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

          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6)
            try {
              const parsed = JSON.parse(dataStr)
              const candidate = parsed.response?.candidates?.[0] || parsed.candidates?.[0]
              if (!candidate) continue

              const parts = candidate.content?.parts || []
              for (const part of parts) {
                if (part.thought) {
                  hasReasoning = true
                  yield { type: 'reasoning-delta', index: 0, text: part.thought }
                } else if (part.text) {
                  const textIndex = hasReasoning ? 1 : 0
                  yield { type: 'text-delta', index: textIndex, text: part.text }
                }
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
