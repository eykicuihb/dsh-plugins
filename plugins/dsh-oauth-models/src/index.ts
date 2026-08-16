/**
 * @eykicuihb/dsh-oauth-models
 * OAuth Subscription Models & Live Quota Dashboard plugin for DeepSeek Harness (dsh)
 */

import type { Context } from '@deepseek-ai/cordis'
import { Config } from './config.ts'
import type { OAuthPluginConfig } from './types.ts'
import { TokenStore } from './auth/token-store.ts'
import { QuotaService } from './quota/quota-service.ts'
import { CodexAdapter } from './adapters/codex-adapter.ts'
import { AntigravityAdapter } from './adapters/antigravity-adapter.ts'
import { GrokAdapter } from './adapters/grok-adapter.ts'

export { Config } from './config.ts'
export type { OAuthPluginConfig, OAuthProviderType, QuotaMetrics, OAuthTokenData } from './types.ts'
export { TokenStore } from './auth/token-store.ts'
export { QuotaService } from './quota/quota-service.ts'
export { CodexAdapter } from './adapters/codex-adapter.ts'
export { AntigravityAdapter } from './adapters/antigravity-adapter.ts'
export { GrokAdapter } from './adapters/grok-adapter.ts'

export const name = 'oauth-models'
export const inject = ['llm']

export function apply(ctx: Context, config: OAuthPluginConfig = {}): void {
  const tokenStore = new TokenStore()
  const quotaService = new QuotaService(tokenStore)

  const codexConfig = config.providers?.codex
  const antigravityConfig = config.providers?.antigravity
  const grokConfig = config.providers?.grok

  // 1. Register OpenAI Codex Adapter
  if (codexConfig?.enabled !== false) {
    const codexAdapter = new CodexAdapter(tokenStore, quotaService, codexConfig?.customBaseURL)
    const disposeCodex = ctx.llm.registerAdapter(['codex'], codexAdapter)
    ctx.effect(() => disposeCodex, 'dsh-oauth-models: codex adapter')
  }

  // 2. Register Google Antigravity Adapter
  if (antigravityConfig?.enabled !== false) {
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
  }, 'dsh-oauth-models: quota polling')
}
