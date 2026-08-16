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
  subscriptionTier?: string
  customEndpoint?: string
  updatedAt: number
}

/** Rate limit window details */
export interface RateLimitWindow {
  limit: number
  remaining: number
  resetInSeconds: number
  unit: 'requests' | 'tokens' | 'sliding_window'
}

/** Real-time quota and subscription status */
export interface QuotaMetrics {
  provider: OAuthProviderType
  status: OAuthConnectionStatus
  accountEmail?: string
  accountName?: string
  subscriptionTier?: string
  
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

/** Model info exposed by the OAuth providers */
export interface OAuthModelDefinition {
  id: string
  name: string
  contextWindow: number
  maxOutputTokens: number
  supportsReasoning?: boolean
  supportsVision?: boolean
  supportsTools?: boolean
  defaultReasoningEffort?: 'low' | 'medium' | 'high'
}

/** Configuration options for the OAuth plugin */
export interface OAuthPluginConfig {
  providers?: {
    codex?: {
      enabled?: boolean
      customBaseURL?: string
      defaultModel?: string
    }
    antigravity?: {
      enabled?: boolean
      customBaseURL?: string
      projectId?: string
      defaultModel?: string
    }
    grok?: {
      enabled?: boolean
      customBaseURL?: string
      defaultModel?: string
    }
  }
  quotaPollIntervalMs?: number
  tokenRefreshLeadTimeMs?: number
}
