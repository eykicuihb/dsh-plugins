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
      `[DeepIris] 视觉服务未配置 API Key。请在 WebUI 设置 -> 插件 -> DeepIris 中配置 API Key。`,
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
  const content = result.choices?.[0]?.message?.content
  const observation = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content.map(part => (part.type === 'text' ? part.text : JSON.stringify(part))).join('\n')
      : '未能从视觉模型获得有效的文本描述。'

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

  // Parse data URL: data:image/png;base64,...
  const match = /^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/.exec(dataUrl)
  if (!match || !match[1] || !match[2]) {
    throw new Error('[DeepIris] 无法解析图片的 Base64 数据 URL 格式')
  }

  const mediaType = match[1]
  const base64Data = match[2]

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  }

  const body = {
    model,
    max_tokens: 4096,
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
      `[DeepIris] Anthropic 视觉调用失败 (${response.status} ${response.statusText}): ${errorText || '未知错误'}`,
    )
  }

  const result = await response.json()
  const blocks = result.content ?? []
  const observation = blocks
    .filter((b: { type: string; text?: string }) => b.type === 'text' && typeof b.text === 'string')
    .map((b: { text: string }) => b.text)
    .join('\n') || '未能从 Anthropic 获得有效文本分析。'

  return {
    observation,
    provider: 'anthropic',
    model,
  }
}
