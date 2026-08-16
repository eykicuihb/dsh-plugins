import type { OAuthProviderType, QuotaMetrics } from '../types.ts'

export interface QuotaControllerState {
  metrics: Map<OAuthProviderType, QuotaMetrics>
  isRefreshing: boolean
  isLoggingIn: OAuthProviderType | null
  lastRefreshTime: number
}

export type StateListener = (state: QuotaControllerState) => void

const CONTROL_SERVER_URL = 'http://127.0.0.1:14555'

export class QuotaController {
  private state: QuotaControllerState = {
    metrics: new Map<OAuthProviderType, QuotaMetrics>(),
    isRefreshing: false,
    isLoggingIn: null,
    lastRefreshTime: Date.now(),
  }
  private readonly listeners = new Set<StateListener>()
  private pollingTimer: any = null

  constructor() {
    this.syncFromBackend()
    // Poll every 30 seconds for live updates
    if (typeof window !== 'undefined') {
      this.pollingTimer = setInterval(() => {
        this.syncFromBackend()
      }, 30000)
    }
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

  public async syncFromBackend(): Promise<void> {
    try {
      const res = await fetch(`${CONTROL_SERVER_URL}/oauth/status`)
      if (res.ok) {
        const data = await res.json()
        const now = Date.now()

        const providers: OAuthProviderType[] = ['codex', 'antigravity', 'grok']
        for (const p of providers) {
          const info = data[p]
          if (info && info.connected) {
            this.state.metrics.set(p, {
              provider: p,
              status: 'connected',
              accountEmail: info.email,
              subscriptionTier: info.plan || (p === 'codex' ? 'ChatGPT Plus / Pro' : p === 'antigravity' ? 'Google CloudCode PA' : 'SuperGrok'),
              tokenExpiresAt: info.expiresAt,
              requestsLimit: info.requestsLimit,
              requestsRemaining: info.requestsRemaining,
              rateLimits: info.rateLimits,
              modelQuotas: info.modelQuotas,
              lastUpdated: now,
            })
          } else {
            this.state.metrics.set(p, {
              provider: p,
              status: 'unauthorized',
              lastUpdated: now,
            })
          }
        }
        this.emit()
      }
    } catch {
      // Fallback
    }
  }

  public async startLogin(provider: OAuthProviderType): Promise<void> {
    this.state.isLoggingIn = provider
    this.emit()

    try {
      const res = await fetch(`${CONTROL_SERVER_URL}/oauth/login?provider=${provider}`)
      if (!res.ok) {
        throw new Error(`Failed to initialize OAuth (${res.status})`)
      }
      const { authUrl } = await res.json()

      // Open OAuth Authorization window in browser
      if (typeof window !== 'undefined') {
        window.open(authUrl, '_blank')
      }

      // Poll until connected
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        await this.syncFromBackend()
        const current = this.state.metrics.get(provider)
        if (current?.status === 'connected' || attempts > 60) {
          clearInterval(poll)
          this.state.isLoggingIn = null
          this.emit()
        }
      }, 1500)
    } catch {
      this.state.isLoggingIn = null
      this.emit()
    }
  }

  public async refreshProvider(provider: OAuthProviderType): Promise<void> {
    this.state.isRefreshing = true
    this.emit()
    try {
      await this.syncFromBackend()
    } finally {
      this.state.isRefreshing = false
      this.emit()
    }
  }

  public async refreshAll(): Promise<void> {
    this.state.isRefreshing = true
    this.emit()
    try {
      await this.syncFromBackend()
    } finally {
      this.state.isRefreshing = false
      this.state.lastRefreshTime = Date.now()
      this.emit()
    }
  }

  public async disconnect(provider: OAuthProviderType): Promise<void> {
    try {
      await fetch(`${CONTROL_SERVER_URL}/oauth/disconnect?provider=${provider}`, { method: 'POST' })
      this.state.metrics.set(provider, {
        provider,
        status: 'unauthorized',
        lastUpdated: Date.now(),
      })
      this.emit()
    } catch {
      // Ignore disconnect error
    }
  }
}
