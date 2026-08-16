/** DeepIris locale copy bundles. */

export const deepirisLocaleEn = {
  deepirisTitle: 'DeepIris (Vision Perception)',
  deepirisDescription: 'Multi-provider VLM visual understanding, OCR, and autonomous inspection.',
  deepirisProvider: 'Vision Provider',
  deepirisProviderHint: 'dashscope, zhipu, openai, anthropic, gemini, ollama, custom',
  deepirisModel: 'Model name',
  deepirisModelHint: 'Leave blank to use the default vision model for the selected provider.',
  deepirisApiKey: 'API key',
  deepirisApiKeyHint: 'Stored securely in credentials. Leave blank for local Ollama.',
  deepirisApiKeySet: 'A key is configured.',
  deepirisApiKeyUnset: 'No key is configured.',
  deepirisBaseUrl: 'Endpoint URL',
  deepirisBaseUrlHint: 'Leave blank to use the provider default endpoint.',
  deepirisTimeoutMs: 'Timeout (ms)',
  deepirisTimeoutMsHint: 'Timeout in milliseconds for visual perception calls (default 60000ms).',
} as const

export const deepirisLocaleZh = {
  deepirisTitle: 'DeepIris 视觉感知',
  deepirisDescription: '配置多 Provider VLM 视觉模型以赋予 Agent 自主视觉理解与 UI 闭环能力。',
  deepirisProvider: '视觉提供方 (Provider)',
  deepirisProviderHint: 'dashscope, zhipu, openai, anthropic, gemini, ollama, custom',
  deepirisModel: '视觉模型 (Model)',
  deepirisModelHint: '留空则使用该 Provider 的默认视觉模型。',
  deepirisApiKey: 'API Key',
  deepirisApiKeyHint: '保存在本地凭据库中，不会暴露给模型。本地 Ollama 可留空。',
  deepirisApiKeySet: '已配置密钥。',
  deepirisApiKeyUnset: '未配置密钥。',
  deepirisBaseUrl: '接口地址 (Base URL)',
  deepirisBaseUrlHint: '留空则使用提供方官方默认端点。',
  deepirisTimeoutMs: '超时时间 (毫秒)',
  deepirisTimeoutMsHint: '单次视觉理解调用的超时时长（默认 60000ms）。',
} as const
