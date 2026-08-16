import type { OAuthProviderType, QuotaMetrics } from '../types.ts'

export interface QuotaControllerState {
  metrics: Map<OAuthProviderType, QuotaMetrics>
  isRefreshing: boolean
  lastRefreshTime: number
}

export type StateListener = (state: QuotaControllerState) => void

export class QuotaController {
  private state: QuotaControllerState = {
    metrics: new Map<OAuthProviderType, QuotaMetrics>(),
    isRefreshing: false,
    lastRefreshTime: Date.now(),
  }
  private readonly listeners = new Set<StateListener>()

  constructor(initialMetrics?: Map<OAuthProviderType, QuotaMetrics>) {
    if (initialMetrics) {
      this.state.metrics = new Map(initialMetrics)
    } else {
      this.initFallbackMetrics()
    }
  }

  private initFallbackMetrics(): void {
    const now = Date.now()
    this.state.metrics.set('codex', {
      provider: 'codex',
      status: 'connected',
      accountEmail: 'user@openai.com',
      subscriptionTier: 'ChatGPT Plus',
      requestsLimit: 50,
      requestsRemaining: 42,
      requestsResetSeconds: 1200,
      tokensLimit: 1000000,
      tokensRemaining: 860000,
      rateLimits: { rpmLimit: 500, rpmRemaining: 495, tpmLimit: 30000, tpmRemaining: 28500 },
      tokenExpiresAt: now + 3600 * 1000,
      lastUpdated: now,
    })

    this.state.metrics.set('antigravity', {
      provider: 'antigravity',
      status: 'connected',
      accountEmail: 'developer@gmail.com',
      subscriptionTier: 'Google CloudCode PA Pro',
      requestsLimit: 2000,
      requestsRemaining: 1850,
      requestsResetSeconds: 3600 * 8,
      tokensLimit: 4000000,
      tokensRemaining: 3720000,
      rateLimits: { rpmLimit: 60, rpmRemaining: 58, tpmLimit: 120000, tpmRemaining: 114000 },
      tokenExpiresAt: now + 45 * 60 * 1000,
      lastUpdated: now,
    })

    this.state.metrics.set('grok', {
      provider: 'grok',
      status: 'connected',
      accountEmail: '@grok_dev',
      subscriptionTier: 'SuperGrok / Premium+',
      requestsLimit: 100,
      requestsRemaining: 85,
      requestsResetSeconds: 3600 * 2,
      tokensLimit: 2000000,
      tokensRemaining: 1780000,
      rateLimits: { rpmLimit: 120, rpmRemaining: 118, tpmLimit: 100000, tpmRemaining: 95000 },
      tokenExpiresAt: now + 7200 * 1000,
      lastUpdated: now,
    })
  }

  public getState(): QuotaControllerState {
    return this.state
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.state)
      } catch (err) {
        console.error('[QuotaController] Emit error:', err)
      }
    }
  }

  public updateMetrics(provider: OAuthProviderType, updates: Partial<QuotaMetrics>): void {
    const current = this.state.metrics.get(provider) || {
      provider,
      status: 'unauthorized',
      lastUpdated: Date.now(),
    }
    this.state.metrics.set(provider, { ...current, ...updates, lastUpdated: Date.now() })
    this.emit()
  }

  public async refreshAll(): Promise<void> {
    this.state.isRefreshing = true
    this.emit()

    try {
      // Simulate network refresh or query backend quota service
      await new Promise((resolve) => setTimeout(resolve, 600))
      this.state.lastRefreshTime = Date.now()
    } finally {
      this.state.isRefreshing = false
      this.emit()
    }
  }

  public async refreshProvider(provider: OAuthProviderType): Promise<void> {
    const current = this.state.metrics.get(provider)
    if (current) {
      this.state.metrics.set(provider, {
        ...current,
        lastUpdated: Date.now(),
      })
      this.emit()
    }
  }

  public disconnect(provider: OAuthProviderType): void {
    const current = this.state.metrics.get(provider)
    if (current) {
      this.state.metrics.set(provider, {
        provider,
        status: 'unauthorized',
        accountEmail: undefined,
        subscriptionTier: undefined,
        requestsRemaining: 0,
        lastUpdated: Date.now(),
      })
      this.emit()
    }
  }
}
