import type { Context } from '@deepseek-ai/cordis'
import { OAuthModelsConfigSchema, type OAuthModelsConfig } from './config.ts'
import { TokenStore } from './auth/token-store.ts'
import { QuotaService } from './quota/quota-service.ts'
import { OAuthServer } from './auth/oauth-server.ts'
import { CodexAdapter } from './adapters/codex-adapter.ts'
import { AntigravityAdapter } from './adapters/antigravity-adapter.ts'
import { GrokAdapter } from './adapters/grok-adapter.ts'

export const name = 'dsh-oauth-models'
export const Config = OAuthModelsConfigSchema

export const using = ['llm'] as const

export function apply(ctx: Context, config: OAuthModelsConfig): void {
  const tokenStore = new TokenStore()
  const quotaService = new QuotaService(tokenStore)
  const isAntigravityEnabled = config.providers?.antigravity?.enabled === true
  const oauthServer = new OAuthServer(tokenStore, isAntigravityEnabled)

  // 0. Start local OAuth 2.0 PKCE Server for interactive login
  oauthServer.start().catch((err) => {
    console.error('[dsh-oauth-models] Failed to start OAuth server:', err)
  })

  // Register settings namespace for DSH API proxy
  if (typeof (ctx.llm as any).registerConfigurableProviders === 'function') {
    const configurableList: any[] = [
      { provider: 'codex', displayName: 'OpenAI Codex (OAuth)', settingsNs: 'oauth-models', settingsPath: [] },
      { provider: 'grok', displayName: 'xAI Grok (OAuth)', settingsNs: 'oauth-models', settingsPath: [] },
    ]
    if (isAntigravityEnabled) {
      configurableList.push({ provider: 'antigravity', displayName: 'Google Antigravity (OAuth)', settingsNs: 'oauth-models', settingsPath: [] })
    }
    ;(ctx.llm as any).registerConfigurableProviders(configurableList)
  }

  const codexConfig = config.providers?.codex
  const antigravityConfig = config.providers?.antigravity
  const grokConfig = config.providers?.grok

  // 1. Register OpenAI Codex Adapter
  if (codexConfig?.enabled !== false) {
    const codexAdapter = new CodexAdapter(tokenStore, quotaService, codexConfig?.customBaseURL)
    const disposeCodex = ctx.llm.registerAdapter(['codex'], codexAdapter)
    ctx.effect(() => disposeCodex, 'dsh-oauth-models: codex adapter')
  }

  // 2. Register Google Antigravity Adapter (Only when enabled)
  if (isAntigravityEnabled) {
    const antigravityAdapter = new AntigravityAdapter(tokenStore, quotaService, antigravityConfig?.customBaseURL)
    const disposeAntigravity = ctx.llm.registerAdapter(['antigravity'], antigravityAdapter)
    ctx.effect(() => disposeAntigravity, 'dsh-oauth-models: antigravity adapter')
  }

  // 3. Register xAI Grok Adapter
  if (grokConfig?.enabled !== false) {
    const grokAdapter = new GrokAdapter(tokenStore, quotaService, grokConfig?.customBaseURL)
    const disposeGrok = ctx.llm.registerAdapter(['grok'], grokAdapter)
    ctx.effect(() => disposeGrok, 'dsh-oauth-models: grok adapter')
  }

  // Start background quota polling
  const stopPolling = quotaService.startPolling(config.quotaPollIntervalMs || 120000)
  ctx.effect(() => () => {
    stopPolling()
    quotaService.dispose()
    oauthServer.stop()
  }, 'dsh-oauth-models: quota polling and oauth server')
}
