import type { OAuthTokenData, QuotaMetrics, ModelQuotaDetail } from '../types.ts'
import type { TokenRefreshHandler } from './token-store.ts'

export class AntigravityAuthHandler implements TokenRefreshHandler {
  private readonly googleTokenUrl = 'https://oauth2.googleapis.com/token'

  public async refreshToken(current: OAuthTokenData): Promise<OAuthTokenData> {
    if (!current.refreshToken) {
      throw new Error('[AntigravityAuth] No refresh token available for Google Antigravity')
    }

    try {
      const response = await fetch(this.googleTokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: current.refreshToken,
          client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || 'cloudcode-pa-client',
          client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Google token refresh failed (${response.status}): ${text}`)
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
      throw new Error(`[AntigravityAuth] Token refresh error: ${(err as Error).message}`)
    }
  }

  public async validateToken(current: OAuthTokenData): Promise<boolean> {
    try {
      const res = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(current.accessToken)}`)
      return res.status === 200
    } catch {
      return false
    }
  }

  public parseRateLimitHeaders(headers: Headers): Partial<QuotaMetrics> {
    const quotaRemaining = headers.get('x-goog-quota-remaining')
    const quotaLimit = headers.get('x-goog-quota-limit')

    const updates: Partial<QuotaMetrics> = {
      lastUpdated: Date.now(),
      status: 'connected',
    }

    if (quotaRemaining !== null) {
      updates.requestsRemaining = parseInt(quotaRemaining, 10)
    }
    if (quotaLimit !== null) {
      updates.requestsLimit = parseInt(quotaLimit, 10)
    }

    return updates
  }

  /**
   * Fetch live Google CloudCode PA quota and model availability
   */
  public async fetchQuota(token: OAuthTokenData): Promise<Partial<QuotaMetrics>> {
    let email = token.accountEmail
    let planTier = token.subscriptionTier || 'Google Antigravity'
    const modelQuotas: ModelQuotaDetail[] = []

    try {
      // 1. Fetch user email via tokeninfo
      const tokenInfoRes = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${encodeURIComponent(token.accessToken)}`)
      if (tokenInfoRes.ok) {
        const info = await tokenInfoRes.json()
        if (info.email) email = info.email
      }

      // 2. Fetch plan tier via loadCodeAssist
      const lcaRes = await fetch('https://daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.accessToken}`,
          'User-Agent': 'antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)',
          'x-goog-api-client': 'google-api-nodejs-client/10.3.0',
        },
        body: JSON.stringify({ metadata: { ideType: 'ANTIGRAVITY' } }),
      })
      if (lcaRes.ok) {
        const lca = await lcaRes.json()
        const tier = lca.currentTier?.id || lca.currentTier?.name
        if (tier) {
          planTier = tier === 'free-tier' ? 'Google Antigravity (Free Tier)' : `Google Antigravity (${tier})`
        }
      }

      // 3. Fetch live model quotas via fetchAvailableModels
      const famRes = await fetch('https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.accessToken}`,
          'User-Agent': 'antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)',
          'x-goog-api-client': 'google-api-nodejs-client/10.3.0',
        },
        body: JSON.stringify({ project: token.accountId || '' }),
      })

      if (famRes.ok) {
        const fam = await famRes.json()
        const models = fam.models || {}
        for (const [id, meta] of Object.entries(models)) {
          if (id.startsWith('chat_') || id.startsWith('tab_')) continue
          const q = (meta as any).quotaInfo || (meta as any).quota
          if (q && typeof q.remainingFraction === 'number') {
            const cleanName = ((meta as any).displayName || id).replace(/\s*\((Low|Medium|High|Thinking)\)/gi, '').trim()
            modelQuotas.push({
              modelId: id,
              name: cleanName,
              remainingPercentage: Math.round(q.remainingFraction * 1000) / 10,
              resetTime: q.resetTime,
            })
          }
        }
      }
    } catch {
      // Ignore network errors
    }

    return {
      provider: 'antigravity',
      status: 'connected',
      accountEmail: email || 'google-user@gmail.com',
      subscriptionTier: planTier,
      tokenExpiresAt: token.expiresAt,
      modelQuotas: modelQuotas.length > 0 ? modelQuotas : undefined,
      lastUpdated: Date.now(),
    }
  }
}
