/**
 * Type contracts for @eykicuihb/dsh-oauth-models
 */

export type OAuthProviderType = 'codex' | 'antigravity' | 'grok'

export type OAuthConnectionStatus = 'connected' | 'refreshing' | 'expired' | 'unauthorized' | 'error'

/** Stored OAuth token record for a provider */
export interface OAuthTokenData {
  provider: OAuthProviderType
  accessToken: string
  refreshToken?: string
  expiresAt: number // Timestamp in ms
  tokenType?: string
  accountEmail?: string
  accountName?: string
  accountId?: string
  subscriptionTier?: string
  customEndpoint?: string
  updatedAt: number
}

/** Specific Quota Window (e.g. 每周使用限额, 5小时周期限额) */
export interface QuotaWindowDetail {
  id: string
  label: string
  remainingPercentage: number
  resetTimeFormatted?: string
  resetAt?: number
}

/** Specific Model Quota breakdown (e.g. Gemini 3.6 Flash vs Claude Sonnet 4.6) */
export interface ModelQuotaDetail {
  modelId: string
  name: string
  remainingPercentage: number
  resetTime?: string
}

/** Real-time quota and subscription status */
export interface QuotaMetrics {
  provider: OAuthProviderType
  status: OAuthConnectionStatus
  accountEmail?: string
  accountName?: string
  subscriptionTier?: string

  /** Usage windows (Weekly limit, 5-hour limit, etc.) */
  quotaWindows?: QuotaWindowDetail[]

  /** Detailed Model breakdown */
  modelQuotas?: ModelQuotaDetail[]

  /** Requests remaining in the primary quota window */
  requestsLimit?: number
  requestsRemaining?: number
  requestsResetSeconds?: number

  /** Token or TPM limit */
  tokensLimit?: number
  tokensRemaining?: number

  /** RPM / TPM current load */
  rateLimits?: {
    rpmLimit?: number
    rpmRemaining?: number
    tpmLimit?: number
    tpmRemaining?: number
  }

  tokenExpiresAt?: number
  lastUpdated: number
  errorMessage?: string
}

/** Quota controller response */
export interface QuotaResponsePayload {
  metrics: Record<OAuthProviderType, QuotaMetrics>
  timestamp: number
}
