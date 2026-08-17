/**
 * Multi-provider VLM execution engine for DeepIris.
 *
 * @module @deepseek-ai/dsh-deepiris/provider
 */

import type { Context } from '@deepseek-ai/cordis'
import { PROVIDER_PRESETS } from './config.ts'
import type { Config } from './config.ts'
import type { ProviderPreset, VisionProviderType, VlmCallRequest, VlmCallResult } from './types.ts'

/** Resolved execution parameters for a single VLM invocation. */
export interface ResolvedVlmOptions {
  readonly provider: VisionProviderType
  readonly model: string
  readonly baseURL: string
  readonly apiKey: string
  readonly timeoutMs: number
}

/**
 * Sanitize observation text by stripping internal hidden thinking and reasoning tokens.
 * Supports <think>...</think>, <thought>...</thought>, <reasoning>...</reasoning>,
 * [THINK]...[/THINK], and handles edge cases such as unclosed tags.
 */
export function sanitizeVlmObservation(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return ''

  // 1. Strip complete paired thinking tags
  let cleaned = rawText
    .replace(/<think[\s\S]*?>[\s\S]*?<\/think>/gi, '')
    .replace(/<thought[\s\S]*?>[\s\S]*?<\/thought>/gi, '')
    .replace(/<reasoning[\s\S]*?>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/\[THINK\][\s\S]*?\[\/THINK\]/gi, '')
    .trim()

  // 2. If unclosed <think> or <thought> tag exists at start
  if (/^<(?:think|thought|reasoning)[\s\S]*?>/i.test(cleaned)) {
    cleaned = cleaned.replace(/^<(?:think|thought|reasoning)[\s\S]*?>/gi, '').trim()
  }

  // 3. Fallback: if stripping completely emptied the response (e.g. model ONLY output within <think>),
  // strip only the XML tags themselves and keep inner text so we don't return an empty observation.
  if (!cleaned) {
    cleaned = rawText
      .replace(/<\/?(?:think|thought|reasoning)[\s\S]*?>/gi, '')
      .replace(/\[\/?THINK\]/gi, '')
      .trim()
  }

  return cleaned || '未能从视觉模型获得有效的文本描述。'
}

/**
 * Resolve runtime options from merged plugin and user settings.
 */
export async function resolveVlmOptions(config: Config, ctx?: Context): Promise<ResolvedVlmOptions> {
  const provider = config.provider ?? 'dashscope'
  const preset = (PROVIDER_PRESETS as Record<string, ProviderPreset | undefined>)[provider] ?? PROVIDER_PRESETS.custom

  const baseURL = (config.baseURL && config.baseURL.trim().length > 0)
    ? config.baseURL.trim().replace(/\/+$/, '')
    : preset.baseURL

  const model = (config.model && config.model.trim().length > 0)
    ? config.model.trim()
    : preset.defaultModel

  const envVarName = (config.apiKeyEnv && config.apiKeyEnv.trim().length > 0)
    ? config.apiKeyEnv.trim()
    : preset.defaultApiKeyEnv

  let apiKey = (config.apiKey && config.apiKey.trim().length > 0) ? config.apiKey.trim() : ''

  const credentialKeys: string[] = []
  if (envVarName) credentialKeys.push(envVarName)
  if (preset.defaultApiKeyEnv && !credentialKeys.includes(preset.defaultApiKeyEnv)) {
    credentialKeys.push(preset.defaultApiKeyEnv)
  }
  if (provider === 'minimax') {
    for (const fallback of ['MINIMAX_API_KEY', 'MINIMAXI_API_KEY', 'CUSTOM_VISION_API_KEY']) {
      if (!credentialKeys.includes(fallback)) credentialKeys.push(fallback)
    }
  }
  if (provider === 'custom' || provider === 'opencode' || provider === 'opencode-go') {
    for (const fallback of ['CUSTOM_VISION_API_KEY', 'OPENCODE_API_KEY', 'OPENAI_API_KEY']) {
      if (!credentialKeys.includes(fallback)) credentialKeys.push(fallback)
    }
  }

  if (!apiKey && ctx) {
    const credentials = ctx.get('credentials')
    if (credentials !== undefined) {
      for (const key of credentialKeys) {
        const hit = await credentials.resolve(key).catch(() => undefined)
        if (hit?.value) {
          apiKey = hit.value
          break
        }
      }
    }
  }

  if (!apiKey) {
    for (const key of credentialKeys) {
      if (process.env[key]) {
        apiKey = process.env[key]!
        break
      }
    }
  }

  const timeoutMs = config.timeoutMs && config.timeoutMs >= 1000
    ? config.timeoutMs
    : 60000

  return {
    provider,
    model,
    baseURL,
    apiKey,
    timeoutMs,
  }
}

/**
 * Execute a visual observation request against the resolved provider.
 */
export async function executeVlmCall(
  options: ResolvedVlmOptions,
  request: VlmCallRequest,
): Promise<VlmCallResult> {
  const { provider, model, baseURL, apiKey, timeoutMs } = options
  const { dataUrl, prompt, signal } = request

  if (provider !== 'ollama' && !apiKey) {
    throw new Error(
      `[DeepIris] 视觉服务未配置 API Key。请在 WebUI 设置 -> 插件 -> DeepIris 中配置 API Key（或环境变量 MINIMAX_API_KEY / DASHSCOPE_API_KEY / CUSTOM_VISION_API_KEY）。`,
    )
  }

  const promptText = prompt && prompt.trim().length > 0
    ? `Please inspect this image carefully and address the following focus/request:\n${prompt.trim()}`
    : 'Please provide a comprehensive visual inspection of this image, describing its content, visual layout, key components, text elements (OCR), and any notable design or rendering details.'

  // Combine caller signal with timeout
  const timeoutController = new AbortController()
  const timeoutTimer = setTimeout(() => {
    timeoutController.abort(new Error(`[DeepIris] 视觉分析请求超时（已超过 ${timeoutMs}ms）`))
  }, timeoutMs)

  const combinedSignal = signal
    ? AbortSignal.any([signal, timeoutController.signal])
    : timeoutController.signal

  try {
    if (provider === 'anthropic') {
      return await callAnthropicVlm({
        baseURL,
        apiKey,
        model,
        dataUrl,
        promptText,
        signal: combinedSignal,
      })
    }

    return await callOpenAiCompatibleVlm({
      provider,
      baseURL,
      apiKey,
      model,
      dataUrl,
      promptText,
      signal: combinedSignal,
    })
  } finally {
    clearTimeout(timeoutTimer)
  }
}

interface OpenAiCallParams {
  provider: string
  baseURL: string
  apiKey: string
  model: string
  dataUrl: string
  promptText: string
  signal: AbortSignal
}

async function callOpenAiCompatibleVlm(params: OpenAiCallParams): Promise<VlmCallResult> {
  const { provider, baseURL, apiKey, model, dataUrl, promptText, signal } = params
  const endpoint = `${baseURL}/chat/completions`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  const body = {
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: promptText },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(
      `[DeepIris] 视觉服务调用失败 (${response.status} ${response.statusText}): ${errorText || '未知服务端错误'}`,
    )
  }

  const result = await response.json()
  const message = result.choices?.[0]?.message
  const content = message?.content

  let rawObservation = ''
  if (typeof content === 'string') {
    rawObservation = content
  } else if (Array.isArray(content)) {
    rawObservation = content
      .filter((part: any) => part.type === 'text' || typeof part.text === 'string')
      .map((part: any) => part.text || JSON.stringify(part))
      .join('\n')
  }

  const observation = sanitizeVlmObservation(rawObservation)

  return {
    observation,
    provider,
    model,
  }
}

interface AnthropicCallParams {
  baseURL: string
  apiKey: string
  model: string
  dataUrl: string
  promptText: string
  signal: AbortSignal
}

async function callAnthropicVlm(params: AnthropicCallParams): Promise<VlmCallResult> {
  const { baseURL, apiKey, model, dataUrl, promptText, signal } = params
  const endpoint = `${baseURL}/messages`

  // Parse data URL components: data:<mediaType>;base64,<data>
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) {
    throw new Error('[DeepIris] 无法解析图片 Data URL 格式')
  }
  const [, mediaType, base64Data] = match

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }

  const body = {
    model,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data,
            },
          },
          {
            type: 'text',
            text: promptText,
          },
        ],
      },
    ],
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(
      `[DeepIris] Anthropic 视觉服务调用失败 (${response.status} ${response.statusText}): ${errorText || '未知服务端错误'}`,
    )
  }

  const result = await response.json()
  const content = result.content

  let rawObservation = ''
  if (Array.isArray(content)) {
    rawObservation = content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('\n')
      .trim()
  } else if (typeof content === 'string') {
    rawObservation = content
  }

  const observation = sanitizeVlmObservation(rawObservation)

  return {
    observation,
    provider: 'anthropic',
    model,
  }
}
