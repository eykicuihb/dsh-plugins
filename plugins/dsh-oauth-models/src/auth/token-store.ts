import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { OAuthProviderType, OAuthTokenData, OAuthConnectionStatus } from '../types.ts'

export interface TokenRefreshHandler {
  refreshToken(current: OAuthTokenData): Promise<OAuthTokenData>
  validateToken(current: OAuthTokenData): Promise<boolean>
}

export class TokenStore {
  private readonly storageDir: string
  private readonly refreshHandlers = new Map<OAuthProviderType, TokenRefreshHandler>()
  private readonly cache = new Map<OAuthProviderType, OAuthTokenData>()
  private readonly refreshPromises = new Map<OAuthProviderType, Promise<OAuthTokenData>>()

  constructor(customStorageDir?: string) {
    const baseHome = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
    this.storageDir = customStorageDir || path.join(baseHome, 'oauth')
    this.ensureStorageDir()
  }

  private ensureStorageDir(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true })
      }
    } catch {
      // Ignore directory creation failure in sandboxed / non-fs test environments
    }
  }

  public registerRefreshHandler(provider: OAuthProviderType, handler: TokenRefreshHandler): void {
    this.refreshHandlers.set(provider, handler)
  }

  private getTokenFilePath(provider: OAuthProviderType): string {
    return path.join(this.storageDir, `${provider}.json`)
  }

  public loadToken(provider: OAuthProviderType): OAuthTokenData | undefined {
    if (this.cache.has(provider)) {
      return this.cache.get(provider)
    }

    // 1. Check local DSH oauth storage
    const filePath = this.getTokenFilePath(provider)
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8')
        const data = JSON.parse(raw) as OAuthTokenData
        if (data?.accessToken) {
          this.cache.set(provider, data)
          return data
        }
      }
    } catch {
      // Ignore parse failure
    }

    // 2. Multi-source automatic bridge for system OAuth credentials
    if (provider === 'codex') {
      try {
        const codexAuthPath = path.join(os.homedir(), '.codex', 'auth.json')
        if (fs.existsSync(codexAuthPath)) {
          const raw = fs.readFileSync(codexAuthPath, 'utf-8')
          const auth = JSON.parse(raw)
          const token = auth?.tokens?.access_token || auth?.OPENAI_API_KEY || auth?.tokens?.id_token
          if (token) {
            const data: OAuthTokenData = {
              provider: 'codex',
              accessToken: token,
              refreshToken: auth?.tokens?.refresh_token,
              tokenType: 'Bearer',
              email: auth?.tokens?.account_id || 'codex-oauth@local',
            }
            this.cache.set(provider, data)
            return data
          }
        }
      } catch {
        // Ignore
      }
    }

    if (provider === 'antigravity') {
      try {
        const geminiAuthPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json')
        if (fs.existsSync(geminiAuthPath)) {
          const raw = fs.readFileSync(geminiAuthPath, 'utf-8')
          const auth = JSON.parse(raw)
          if (auth?.access_token) {
            const data: OAuthTokenData = {
              provider: 'antigravity',
              accessToken: auth.access_token,
              refreshToken: auth.refresh_token,
              tokenType: auth.token_type || 'Bearer',
              expiresAt: auth.expiry_date,
              email: 'antigravity-oauth@local',
            }
            this.cache.set(provider, data)
            return data
          }
        }
      } catch {
        // Ignore
      }
    }

    return undefined
  }

  public saveToken(data: OAuthTokenData): void {
    this.ensureStorageDir()
    this.cache.set(data.provider, data)
    const filePath = this.getTokenFilePath(data.provider)
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')
    } catch (err) {
      console.error(`[dsh-oauth-models] Failed to persist token for ${data.provider}:`, err)
    }
  }

  public deleteToken(provider: OAuthProviderType): void {
    this.cache.delete(provider)
    const filePath = this.getTokenFilePath(provider)
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
      }
    } catch {
      // Ignore deletion errors
    }
  }

  public getStatus(provider: OAuthProviderType, leadTimeMs: number = 60000): OAuthConnectionStatus {
    const token = this.loadToken(provider)
    if (!token || !token.accessToken) {
      return 'unauthorized'
    }
    if (token.expiresAt && Date.now() >= token.expiresAt) {
      return 'expired'
    }
    if (token.expiresAt && Date.now() + leadTimeMs >= token.expiresAt) {
      return 'refreshing'
    }
    return 'connected'
  }

  public async getValidToken(provider: OAuthProviderType, leadTimeMs: number = 120000): Promise<string> {
    const token = this.loadToken(provider)
    if (!token || !token.accessToken) {
      throw new Error(`[dsh-oauth-models] No OAuth token configured for provider: ${provider}. Please authenticate first.`)
    }

    const now = Date.now()
    const needsRefresh = token.expiresAt && (now + leadTimeMs >= token.expiresAt)

    if (!needsRefresh) {
      return token.accessToken
    }

    if (!token.refreshToken) {
      if (now >= token.expiresAt) {
        throw new Error(`[dsh-oauth-models] OAuth token for ${provider} has expired and no refresh token is available.`)
      }
      return token.accessToken
    }

    let refreshPromise = this.refreshPromises.get(provider)
    if (!refreshPromise) {
      const handler = this.refreshHandlers.get(provider)
      if (!handler) {
        throw new Error(`[dsh-oauth-models] No refresh handler registered for provider: ${provider}`)
      }

      refreshPromise = (async () => {
        try {
          const updated = await handler.refreshToken(token)
          this.saveToken(updated)
          return updated
        } finally {
          this.refreshPromises.delete(provider)
        }
      })()

      this.refreshPromises.set(provider, refreshPromise)
    }

    const updatedToken = await refreshPromise
    return updatedToken.accessToken
  }
}
