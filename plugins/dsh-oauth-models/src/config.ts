import Schema from '@deepseek-ai/schemastery'
import type { OAuthPluginConfig } from './types.ts'

export const Config: Schema<OAuthPluginConfig> = Schema.object({
  providers: Schema.object({
    codex: Schema.object({
      enabled: Schema.boolean().default(true).description('Enable OpenAI Codex OAuth models'),
      customBaseURL: Schema.string().default('').description('Custom proxy endpoint for Codex / OpenAI'),
      defaultModel: Schema.string().default('gpt-4o').description('Default Codex model'),
    }).description('OpenAI Codex OAuth Configuration'),

    antigravity: Schema.object({
      enabled: Schema.boolean().default(true).description('Enable Google Antigravity / CloudCode models'),
      customBaseURL: Schema.string().default('').description('Custom proxy endpoint for CloudCode PA'),
      projectId: Schema.string().default('').description('Google Cloud Project ID override'),
      defaultModel: Schema.string().default('gemini-2.5-pro').description('Default Antigravity model'),
    }).description('Google Antigravity OAuth Configuration'),

    grok: Schema.object({
      enabled: Schema.boolean().default(true).description('Enable xAI Grok models'),
      customBaseURL: Schema.string().default('').description('Custom proxy endpoint for xAI Grok'),
      defaultModel: Schema.string().default('grok-3').description('Default Grok model'),
    }).description('xAI Grok OAuth Configuration'),
  }).description('OAuth Provider configurations'),

  quotaPollIntervalMs: Schema.number().default(120000).description('Background quota status polling interval in ms (default 2 mins)'),
  tokenRefreshLeadTimeMs: Schema.number().default(120000).description('Lead time in ms to trigger automatic token refresh before expiration'),
})
