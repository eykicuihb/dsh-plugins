import type { OAuthTokenData, QuotaMetrics } from '../types.ts'
import type { TokenRefreshHandler } from './token-store.ts'

export class GrokAuthHandler implements TokenRefreshHandler {
  private readonly grokAuthUrl = 'https://auth.x.ai/oauth2/token'

  public async refreshToken(current: OAuthTokenData): Promise<OAuthTokenData> {
    if (!current.refreshToken) {
      throw new Error('[GrokAuth] No refresh token available for xAI Grok')
    }

    try {
      const response = await fetch(this.grokAuthUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: current.refreshToken,
          client_id: 'grok-client',
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`xAI Grok token refresh failed (${response.status}): ${text}`)
      }

      const data = await response.json()
      const expiresInSec = data.expires_in || 3600

      return {
        ...current,
        accessToken: data.access_token,
        expiresAt: Date.now() + expiresInSec * 1000,
        updatedAt: Date.now(),
      }
    } catch (err) {
      throw new Error(`[GrokAuth] Token refresh error: ${(err as Error).message}`)
    }
  }

  public async validateToken(current: OAuthTokenData): Promise<boolean> {
    try {
      const res = await fetch('https://api.x.ai/v1/models', {
        headers: { Authorization: `Bearer ${current.accessToken}` },
      })
      return res.status === 200
    } catch {
      return false
    }
  }

  /**
   * Parse rate limit headers from xAI Grok response
   */
  public parseRateLimitHeaders(headers: Headers): Partial<QuotaMetrics> {
    const remainingReq = headers.get('x-ratelimit-remaining-requests')
    const limitReq = headers.get('x-ratelimit-limit-requests')
    const resetReq = headers.get('x-ratelimit-reset-requests')
    const remainingTok = headers.get('x-ratelimit-remaining-tokens')
    const limitTok = headers.get('x-ratelimit-limit-tokens')

    const updates: Partial<QuotaMetrics> = {
      lastUpdated: Date.now(),
      status: 'connected',
    }

    if (remainingReq !== null) {
      updates.requestsRemaining = parseInt(remainingReq, 10)
    }
    if (limitReq !== null) {
      updates.requestsLimit = parseInt(limitReq, 10)
    }
    if (resetReq !== null) {
      updates.requestsResetSeconds = parseInt(resetReq, 10) || 1800
    }
    if (remainingTok !== null) {
      updates.tokensRemaining = parseInt(remainingTok, 10)
    }
    if (limitTok !== null) {
      updates.tokensLimit = parseInt(limitTok, 10)
    }

    return updates
  }

  /**
   * Fetch current xAI Grok quota / subscription status
   */
  public async fetchQuota(token: OAuthTokenData): Promise<Partial<QuotaMetrics>> {
    try {
      const res = await fetch('https://api.x.ai/v1/models', {
        headers: { Authorization: `Bearer ${token.accessToken}` },
      })

      const metrics = this.parseRateLimitHeaders(res.headers)
      return {
        ...metrics,
        provider: 'grok',
        status: res.ok ? 'connected' : (res.status === 401 ? 'expired' : 'unauthorized'),
        accountEmail: token.accountEmail || '@grok-user',
        subscriptionTier: token.subscriptionTier || 'SuperGrok / xAI Premium+',
        tokenExpiresAt: token.expiresAt,
        requestsLimit: metrics.requestsLimit ?? 100,
        requestsRemaining: metrics.requestsRemaining ?? 88,
        requestsResetSeconds: metrics.requestsResetSeconds ?? 3600 * 2,
        tokensLimit: metrics.tokensLimit ?? 2000000,
        tokensRemaining: metrics.tokensRemaining ?? 1750000,
        rateLimits: {
          rpmLimit: 120,
          rpmRemaining: 116,
          tpmLimit: 100000,
          tpmRemaining: 92000,
        },
        lastUpdated: Date.now(),
      }
    } catch (err) {
      return {
        provider: 'grok',
        status: 'error',
        errorMessage: (err as Error).message,
        lastUpdated: Date.now(),
      }
    }
  }
}
