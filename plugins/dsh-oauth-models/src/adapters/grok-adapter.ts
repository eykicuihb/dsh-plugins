/**
 * xAI Grok OAuth Adapter
 * Connects to xAI Grok models using Grok OAuth token via xAI API.
 * 100% dynamically synchronizes model list from official xAI API.
 * Fully supports system prompts, reasoning streams, tool definitions, multi-turn parallel tool calling,
 * exact token accounting / usage reporting, and end-to-end stream-level retry resilience against 30s TTFT disconnects.
 */

import { CallId, LlmAdapter } from '@deepseek-ai/dsh-llm'
import type {
  GenerateOptions,
  LlmModelInfo,
  LlmProviderInfo,
  LlmResolvedModelInfo,
  StreamChunk,
  TokenUsage,
} from '@deepseek-ai/dsh-llm'
import type { TokenStore } from '../auth/token-store.ts'
import type { QuotaService } from '../quota/quota-service.ts'

interface DynamicGrokModelMeta {
  id: string
  name: string
  description?: string
  contextWindow: number
  defaultMaxTokens: number
  supportsReasoning?: boolean
}

interface ActiveToolCallState {
  callId: string
  name: string
  blockIndex: number
  accumulatedArgs: string
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Request was aborted'))
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        reject(new Error('Request was aborted'))
      },
      { once: true },
    )
  })
}

function isRetryableNetworkError(err: any): boolean {
  if (!err) return false
  const msg = String(err.message || err).toLowerCase()
  const code = String(err.code || err.cause?.code || '').toLowerCase()
  return (
    msg.includes('fetch failed') ||
    msg.includes('socket') ||
    msg.includes('econnreset') ||
    msg.includes('etimedout') ||
    msg.includes('econnrefused') ||
    msg.includes('epipe') ||
    msg.includes('network') ||
    msg.includes('other side closed') ||
    msg.includes('terminated') ||
    code.includes('err_socket') ||
    code.includes('und_err') ||
    code === 'econnreset' ||
    code === 'etimedout' ||
    code === 'eai_again'
  )
}

function isRetryableHttpStatus(status: number): boolean {
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 520 ||
    status === 524
  )
}

function mapWireUsage(usage: any): TokenUsage {
  const cached =
    usage.prompt_tokens_details?.cached_tokens ??
    usage.input_tokens_details?.cached_tokens ??
    usage.prompt_cache_hit_tokens ??
    0
  const cacheWrite =
    usage.prompt_tokens_details?.cache_write_tokens ??
    usage.input_tokens_details?.cache_write_tokens ??
    0
  const reasoning =
    usage.completion_tokens_details?.reasoning_tokens ??
    usage.output_tokens_details?.reasoning_tokens ??
    0
  const totalInput = usage.prompt_tokens ?? usage.input_tokens ?? 0
  const totalOutput = usage.completion_tokens ?? usage.output_tokens ?? 0

  return {
    inputTokens: Math.max(0, totalInput - cached),
    outputTokens: totalOutput,
    ...(cached > 0 ? { cacheReadTokens: cached } : {}),
    ...(cacheWrite > 0 ? { cacheWriteTokens: cacheWrite } : {}),
    ...(reasoning > 0 ? { reasoningTokens: reasoning } : {}),
  }
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
      description: 'xAI Grok models dynamically synchronized from official xAI API',
    }
  }

  public override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    this.dynamicModels.clear()

    const token = this.tokenStore.loadToken('grok')
    if (!token?.accessToken) {
      return []
    }

    const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://api.x.ai/v1'
    const endpoint = `${baseURL.replace(/\/+$/, '')}/models`

    try {
      const response = await fetch(endpoint, {
        headers: {
          'Authorization': `Bearer ${token.accessToken}`,
          'Accept': 'application/json',
        },
      })

      if (response.ok) {
        const data = (await response.json()) as { data?: Array<{ id: string; name?: string }> }
        const models = data?.data || []

        for (const item of models) {
          if (item?.id) {
            const isReasoning = item.id.includes('reasoning') || item.id.includes('grok-3')
            this.dynamicModels.set(item.id, {
              id: item.id,
              name: item.name || item.id,
              description: `xAI Grok model ${item.id}`,
              contextWindow: 131072,
              defaultMaxTokens: 32768,
              supportsReasoning: isReasoning,
            })
          }
        }
      }
    } catch {
      // Fallback
    }

    return Array.from(this.dynamicModels.values()).map(m => ({
      provider,
      id: m.id,
      name: m.name,
      description: m.description || `xAI Grok ${m.name}`,
    }))
  }

  public override resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const meta = this.dynamicModels.get(model)
    const isReasoning = meta?.supportsReasoning || model.includes('reasoning') || model.includes('grok-3')

    return Promise.resolve({
      provider,
      id: model,
      name: meta?.name || model,
      context: {
        contextWindow: meta?.contextWindow && meta.contextWindow > 0 ? meta.contextWindow : 131072,
      },
      defaultMaxTokens: meta?.defaultMaxTokens && meta.defaultMaxTokens > 0 ? meta.defaultMaxTokens : 32768,
      reasoning: isReasoning
        ? {
            efforts: [
              { id: 'low', name: 'Low', description: 'Faster response' },
              { id: 'medium', name: 'Medium', description: 'Balanced reasoning' },
              { id: 'high', name: 'High', description: 'Thorough reasoning' },
            ],
            defaultEffort: 'medium',
          }
        : undefined,
    })
  }

  public override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const model = options.model
    if (!model) {
      throw new Error('No model specified for Grok adapter.')
    }

    const token = this.tokenStore.loadToken('grok')
    if (!token?.accessToken) {
      throw new Error('xAI Grok OAuth token not found. Please authorize via OAuth in settings.')
    }

    const baseURL = (this.customBaseURL && this.customBaseURL.trim()) || 'https://api.x.ai/v1'
    const endpoint = `${baseURL.replace(/\/+$/, '')}/chat/completions`

    // Bi-directional tool name mapping
    const toolNameMap = new Map<string, string>() // wireName -> origName
    const origToWireName = new Map<string, string>() // origName -> wireName

    for (const tool of options.tools || []) {
      const wireName = tool.name.replace(/[^a-zA-Z0-9_-]/g, '__')
      toolNameMap.set(wireName, tool.name)
      origToWireName.set(tool.name, wireName)
    }

    const wireMessages: any[] = []
    if (options.system) {
      wireMessages.push({ role: 'system', content: options.system })
    }

    for (const m of options.messages || []) {
      const contentBlocks = Array.isArray(m.content) ? m.content : [{ type: 'text', text: String(m.content || '') }]
      if (m.role === 'assistant') {
        const text = contentBlocks.filter(b => b.type === 'text').map(b => b.text).join('\n')
        const toolCalls = contentBlocks.filter(b => b.type === 'tool-call').map(tc => ({
          id: tc.id,
          type: 'function',
          function: {
            name: origToWireName.get(tc.name) || tc.name.replace(/[^a-zA-Z0-9_-]/g, '__'),
            arguments: tc.arguments,
          },
        }))
        wireMessages.push({
          role: 'assistant',
          content: text || '',
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        })
      } else {
        const text = contentBlocks.filter(b => b.type === 'text').map(b => b.text).join('\n')
        if (text) {
          wireMessages.push({ role: 'user', content: text })
        }
        const toolResults = contentBlocks.filter(b => b.type === 'tool-result')
        for (const tr of toolResults) {
          const resultText = Array.isArray(tr.content)
            ? tr.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n')
            : String(tr.content || '')
          wireMessages.push({
            role: 'tool',
            tool_call_id: tr.toolCallId,
            content: resultText || '(no output)',
          })
        }
      }
    }

    const wireTools = (options.tools || []).map(t => {
      let params = t.parameters || { type: 'object', properties: {} }
      if (params.properties) {
        if (params.properties.sandbox_permissions || params.properties.justification) {
          const filteredProps = { ...params.properties }
          delete filteredProps.sandbox_permissions
          delete filteredProps.justification
          params = { ...params, properties: filteredProps }
        }
      }
      return {
        type: 'function',
        function: {
          name: origToWireName.get(t.name) || t.name.replace(/[^a-zA-Z0-9_-]/g, '__'),
          description: t.description,
          parameters: params,
        },
      }
    })

    const body: Record<string, any> = {
      model,
      messages: wireMessages,
      stream: true,
      stream_options: { include_usage: true },
      ...(wireTools.length > 0 ? { tools: wireTools } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : { temperature: 0.7 }),
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    }

    if (options.reasoningEffort && options.reasoningEffort !== 'off' && !model.includes('0309-reasoning')) {
      body.reasoning_effort = options.reasoningEffort
    }

    const maxRetries = 3
    let lastError: any = undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (options.signal?.aborted) {
        throw new Error('Request was aborted')
      }

      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
      let chunksYielded = 0

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token.accessToken}`,
            'Connection': 'keep-alive',
          },
          body: JSON.stringify(body),
          signal: options.signal,
        })

        if (!response.ok) {
          const errText = await response.text()
          if (attempt < maxRetries && isRetryableHttpStatus(response.status)) {
            const delayMs = 1500 * Math.pow(2, attempt)
            await sleep(delayMs, options.signal)
            continue
          }
          throw new Error(`xAI Grok API error (${response.status}): ${errText}`)
        }

        if (!response.body) {
          throw new Error('No response body received from xAI API.')
        }

        reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let hasToolCalls = false
        let pendingUsage: TokenUsage | undefined

        let nextBlockIndex = 0
        let textBlockIndex: number | null = null
        let reasoningBlockIndex: number | null = null

        const toolCallByOutputIndex = new Map<number, ActiveToolCallState>()
        const allActiveToolCalls = new Set<ActiveToolCallState>()

        /** Helper to emit authoritative cleaned block-end for tool calls */
        const emitToolCallBlockEnds = function* () {
          for (const toolInfo of allActiveToolCalls) {
            let finalArgs = toolInfo.accumulatedArgs
            try {
              const argsObj = JSON.parse(toolInfo.accumulatedArgs)
              let modified = false

              if (argsObj.sandbox_permissions !== undefined) {
                delete argsObj.sandbox_permissions
                modified = true
              }
              if (argsObj.justification !== undefined) {
                delete argsObj.justification
                modified = true
              }

              if (modified) {
                finalArgs = JSON.stringify(argsObj)
              }
            } catch {
              // Keep raw if not valid JSON
            }

            chunksYielded++
            yield {
              type: 'block-end' as const,
              index: toolInfo.blockIndex,
              block: {
                type: 'tool-call' as const,
                id: CallId(toolInfo.callId),
                name: toolInfo.name,
                arguments: finalArgs,
              },
            }
          }
          allActiveToolCalls.clear()
        }

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
              yield* emitToolCallBlockEnds()
              if (pendingUsage) {
                chunksYielded++
                yield { type: 'usage', usage: pendingUsage }
              }
              chunksYielded++
              yield { type: 'finish', reason: { kind: hasToolCalls ? 'tool-calls' : 'stop' } }
              return
            }

            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6)
              try {
                const parsed = JSON.parse(dataStr)
                const rawUsage = parsed.usage
                if (rawUsage) {
                  pendingUsage = mapWireUsage(rawUsage)
                }

                const choice = parsed.choices?.[0]
                if (!choice) continue

                const delta = choice.delta
                if (delta?.reasoning_content) {
                  if (reasoningBlockIndex === null) reasoningBlockIndex = nextBlockIndex++
                  chunksYielded++
                  yield { type: 'reasoning-delta', index: reasoningBlockIndex, text: delta.reasoning_content }
                }
                if (delta?.content) {
                  if (textBlockIndex === null) textBlockIndex = nextBlockIndex++
                  chunksYielded++
                  yield { type: 'text-delta', index: textBlockIndex, text: delta.content }
                }
                if (delta?.tool_calls) {
                  hasToolCalls = true
                  for (const tc of delta.tool_calls) {
                    const tcIndex = tc.index ?? 0
                    let toolInfo = toolCallByOutputIndex.get(tcIndex)
                    if (!toolInfo) {
                      const wireName = tc.function?.name
                      const origName = wireName ? toolNameMap.get(wireName) || wireName.replace(/__/g, '.') : 'tool'
                      toolInfo = {
                        callId: tc.id || `call_${tcIndex}`,
                        name: origName,
                        blockIndex: nextBlockIndex++,
                        accumulatedArgs: '',
                      }
                      toolCallByOutputIndex.set(tcIndex, toolInfo)
                      allActiveToolCalls.add(toolInfo)
                    } else if (tc.function?.name) {
                      const wireName = tc.function.name
                      toolInfo.name = toolNameMap.get(wireName) || wireName.replace(/__/g, '.')
                    }
                    if (tc.id) {
                      toolInfo.callId = tc.id
                    }
                    const frag = tc.function?.arguments || ''
                    toolInfo.accumulatedArgs += frag
                    chunksYielded++
                    yield {
                      type: 'tool-call-delta',
                      index: toolInfo.blockIndex,
                      id: CallId(toolInfo.callId),
                      name: toolInfo.name,
                      argumentsDelta: frag,
                    }
                  }
                }
                if (choice.finish_reason) {
                  yield* emitToolCallBlockEnds()
                  if (pendingUsage) {
                    chunksYielded++
                    yield { type: 'usage', usage: pendingUsage }
                  }
                  chunksYielded++
                  yield {
                    type: 'finish',
                    reason: {
                      kind: choice.finish_reason === 'tool_calls' || hasToolCalls ? 'tool-calls' : 'stop',
                    },
                  }
                  return
                }
              } catch {
                // Ignore partial JSON parse errors
              }
            }
          }
        }
        yield* emitToolCallBlockEnds()
        if (pendingUsage) {
          chunksYielded++
          yield { type: 'usage', usage: pendingUsage }
        }
        chunksYielded++
        yield { type: 'finish', reason: { kind: hasToolCalls ? 'tool-calls' : 'stop' } }
        return
      } catch (err: any) {
        if (options.signal?.aborted || err.name === 'AbortError') {
          throw err
        }
        lastError = err

        // If no chunks were yielded to the caller yet, we can safely retry!
        if (chunksYielded === 0 && attempt < maxRetries && isRetryableNetworkError(err)) {
          const delayMs = 1500 * Math.pow(2, attempt)
          await sleep(delayMs, options.signal)
          continue
        }

        throw lastError
      } finally {
        if (reader) {
          try {
            reader.releaseLock()
          } catch {}
        }
      }
    }

    throw lastError || new Error('Failed to stream from xAI Grok API after retries')
  }
}
