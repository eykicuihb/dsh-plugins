/** DeepIris locale copy bundles. */

export type PluginsSettingsLocaleKey =
  | 'nav' | 'title' | 'intro' | 'tabs' | 'configurableTab' | 'empty'
  | 'overridden' | 'reset' | 'readOnly' | 'expand' | 'collapse'
  | 'save' | 'saving' | 'discard' | 'unsaved' | 'saveFailed' | 'invalidNumber'
  | 'deepirisTitle' | 'deepirisDescription' | 'deepirisProvider' | 'deepirisProviderHint'
  | 'deepirisModel' | 'deepirisModelHint' | 'deepirisApiKey' | 'deepirisApiKeyHint'
  | 'deepirisApiKeySet' | 'deepirisApiKeyUnset' | 'deepirisBaseUrl' | 'deepirisBaseUrlHint'
  | 'deepirisTimeoutMs' | 'deepirisTimeoutMsHint'

export const deepirisLocaleEn: Record<string, string> = {
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
  overridden: 'Overridden',
  reset: 'Reset to default',
  readOnly: 'This deployment stores settings read-only.',
  expand: 'Show settings',
  collapse: 'Hide settings',
  save: 'Save',
  saving: 'Saving…',
  discard: 'Discard',
  unsaved: 'Unsaved',
  saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
  invalidNumber: 'Enter a number, or leave blank to use the default.',
}

export const deepirisLocaleZh: Record<string, string> = {
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
  overridden: '已覆盖',
  reset: '恢复默认',
  readOnly: '本部署的设置为只读。',
  expand: '展开设置',
  collapse: '收起设置',
  save: '保存',
  saving: '保存中…',
  discard: '放弃修改',
  unsaved: '未保存',
  saveFailed: '本部署没有接受这些值，已保留供你修改。',
  invalidNumber: '请填数字；留空表示使用默认值。',
}
