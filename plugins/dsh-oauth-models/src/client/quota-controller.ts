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
              subscriptionTier: p === 'codex' ? 'ChatGPT Plus / Pro' : p === 'antigravity' ? 'Google CloudCode PA' : 'SuperGrok',
              tokenExpiresAt: info.expiresAt,
              requestsLimit: 100,
              requestsRemaining: 95,
              tokensLimit: 2000000,
              tokensRemaining: 1850000,
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

      // Start polling for authorization completion
      if (this.pollingTimer) clearInterval(this.pollingTimer)
      let attempts = 0
      this.pollingTimer = setInterval(async () => {
        attempts++
        if (attempts > 80) {
          clearInterval(this.pollingTimer)
          this.state.isLoggingIn = null
          this.emit()
          return
        }

        try {
          const statusRes = await fetch(`${CONTROL_SERVER_URL}/oauth/status`)
          if (statusRes.ok) {
            const data = await statusRes.json()
            if (data[provider]?.connected) {
              clearInterval(this.pollingTimer)
              this.state.isLoggingIn = null
              await this.syncFromBackend()
            }
          }
        } catch {
          // Ignore polling errors
        }
      }, 1500)
    } catch (err) {
      this.state.isLoggingIn = null
      this.emit()
      alert(`OAuth Login Failed: ${(err as Error).message}`)
    }
  }

  public async refreshAll(): Promise<void> {
    this.state.isRefreshing = true
    this.emit()

    try {
      await this.syncFromBackend()
    } finally {
      this.state.isRefreshing = false
      this.emit()
    }
  }

  public async refreshProvider(provider: OAuthProviderType): Promise<void> {
    await this.syncFromBackend()
  }

  public async disconnect(provider: OAuthProviderType): Promise<void> {
    try {
      await fetch(`${CONTROL_SERVER_URL}/oauth/logout?provider=${provider}`, { method: 'POST' })
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
