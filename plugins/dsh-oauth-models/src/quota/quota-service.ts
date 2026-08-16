import type { OAuthProviderType, QuotaMetrics, OAuthConnectionStatus } from '../types.ts'
import { TokenStore } from '../auth/token-store.ts'
import { CodexAuthHandler } from '../auth/codex-auth.ts'
import { AntigravityAuthHandler } from '../auth/antigravity-auth.ts'
import { GrokAuthHandler } from '../auth/grok-auth.ts'

export type QuotaChangeListener = (metrics: Map<OAuthProviderType, QuotaMetrics>) => void

export class QuotaService {
  private readonly tokenStore: TokenStore
  private readonly codexAuth: CodexAuthHandler
  private readonly antigravityAuth: AntigravityAuthHandler
  private readonly grokAuth: GrokAuthHandler
  private readonly metricsCache = new Map<OAuthProviderType, QuotaMetrics>()
  private readonly listeners = new Set<QuotaChangeListener>()
  private pollTimer: NodeJS.Timeout | null = null

  constructor(tokenStore?: TokenStore) {
    this.tokenStore = tokenStore || new TokenStore()
    this.codexAuth = new CodexAuthHandler()
    this.antigravityAuth = new AntigravityAuthHandler()
    this.grokAuth = new GrokAuthHandler()

    // Register refresh handlers into tokenStore
    this.tokenStore.registerRefreshHandler('codex', this.codexAuth)
    this.tokenStore.registerRefreshHandler('antigravity', this.antigravityAuth)
    this.tokenStore.registerRefreshHandler('grok', this.grokAuth)

    // Initialize default states
    this.initDefaultMetrics('codex')
    this.initDefaultMetrics('antigravity')
    this.initDefaultMetrics('grok')
  }

  private initDefaultMetrics(provider: OAuthProviderType): void {
    const status: OAuthConnectionStatus = this.tokenStore.getStatus(provider)
    const token = this.tokenStore.loadToken(provider)
    this.metricsCache.set(provider, {
      provider,
      status,
      accountEmail: token?.accountEmail,
      subscriptionTier: token?.subscriptionTier,
      tokenExpiresAt: token?.expiresAt,
      lastUpdated: Date.now(),
    })
  }

  public getTokenStore(): TokenStore {
    return this.tokenStore
  }

  public getMetrics(provider: OAuthProviderType): QuotaMetrics {
    return this.metricsCache.get(provider) || {
      provider,
      status: this.tokenStore.getStatus(provider),
      lastUpdated: Date.now(),
    }
  }

  public getAllMetrics(): Map<OAuthProviderType, QuotaMetrics> {
    return new Map(this.metricsCache)
  }

  public subscribe(listener: QuotaChangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    const snapshot = this.getAllMetrics()
    for (const listener of this.listeners) {
      try {
        listener(snapshot)
      } catch (err) {
        console.error('[QuotaService] Listener error:', err)
      }
    }
  }

  /**
   * Update quota metrics from response headers after an LLM request
   */
  public updateFromHeaders(provider: OAuthProviderType, headers: Headers): void {
    let updates: Partial<QuotaMetrics> = {}
    if (provider === 'codex') {
      updates = this.codexAuth.parseRateLimitHeaders(headers)
    } else if (provider === 'antigravity') {
      updates = this.antigravityAuth.parseRateLimitHeaders(headers)
    } else if (provider === 'grok') {
      updates = this.grokAuth.parseRateLimitHeaders(headers)
    }

    const current = this.getMetrics(provider)
    const updated: QuotaMetrics = {
      ...current,
      ...updates,
      status: 'connected',
      lastUpdated: Date.now(),
    }
    this.metricsCache.set(provider, updated)
    this.notify()
  }

  /**
   * Proactively refresh quota metrics for a specific provider
   */
  public async refreshQuota(provider: OAuthProviderType): Promise<QuotaMetrics> {
    const token = this.tokenStore.loadToken(provider)
    if (!token || !token.accessToken) {
      const current = this.getMetrics(provider)
      const updated: QuotaMetrics = {
        ...current,
        status: 'unauthorized',
        lastUpdated: Date.now(),
      }
      this.metricsCache.set(provider, updated)
      this.notify()
      return updated
    }

    let fetched: Partial<QuotaMetrics> = {}
    if (provider === 'codex') {
      fetched = await this.codexAuth.fetchQuota(token)
    } else if (provider === 'antigravity') {
      fetched = await this.antigravityAuth.fetchQuota(token)
    } else if (provider === 'grok') {
      fetched = await this.grokAuth.fetchQuota(token)
    }

    const current = this.getMetrics(provider)
    const updated: QuotaMetrics = {
      ...current,
      ...fetched,
      lastUpdated: Date.now(),
    }
    this.metricsCache.set(provider, updated)
    this.notify()
    return updated
  }

  /**
   * Refresh all registered OAuth quotas
   */
  public async refreshAll(): Promise<Map<OAuthProviderType, QuotaMetrics>> {
    await Promise.allSettled([
      this.refreshQuota('codex'),
      this.refreshQuota('antigravity'),
      this.refreshQuota('grok'),
    ])
    return this.getAllMetrics()
  }

  /**
   * Start background periodic polling for quota status
   */
  public startPolling(intervalMs: number = 120000): () => void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = setInterval(() => {
      this.refreshAll().catch(() => {})
    }, intervalMs)

    return () => {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    }
  }

  public dispose(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.listeners.clear()
  }
}
