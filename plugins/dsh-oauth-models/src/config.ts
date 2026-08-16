import z from '@deepseek-ai/schemastery'

export interface OAuthModelsConfig {
  providers: {
    codex: {
      enabled: boolean
      customBaseURL?: string
      defaultModel?: string
    }
    antigravity: {
      enabled: boolean
      customBaseURL?: string
      defaultModel?: string
    }
    grok: {
      enabled: boolean
      customBaseURL?: string
      defaultModel?: string
    }
  }
  quotaPollIntervalMs?: number
  autoRefreshTokens?: boolean
}

export const OAuthModelsConfigSchema: z<OAuthModelsConfig> = z.object({
  providers: z.object({
    codex: z.object({
      enabled: z.boolean().default(true).description('Enable OpenAI Codex OAuth provider'),
      customBaseURL: z.string().description('Custom API Base URL for Codex / ChatGPT endpoint'),
      defaultModel: z.string().description('Optional default Codex model'),
    }),
    antigravity: z.object({
      enabled: z.boolean().default(false).description('Enable Google Antigravity OAuth provider (Disabled by default)'),
      customBaseURL: z.string().description('Custom API Base URL for CloudCode PA endpoint'),
      defaultModel: z.string().description('Optional default Antigravity model'),
    }),
    grok: z.object({
      enabled: z.boolean().default(true).description('Enable xAI Grok OAuth provider'),
      customBaseURL: z.string().description('Custom API Base URL for xAI API endpoint'),
      defaultModel: z.string().description('Optional default Grok model'),
    }),
  }),
  quotaPollIntervalMs: z.number().default(120000).description('Quota polling interval in milliseconds'),
  autoRefreshTokens: z.boolean().default(true).description('Automatically refresh expiring OAuth tokens'),
})
