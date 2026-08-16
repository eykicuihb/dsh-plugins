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

    const filePath = this.getTokenFilePath(provider)
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf-8')
        const data = JSON.parse(raw) as OAuthTokenData
        this.cache.set(provider, data)
        return data
      }
    } catch {
      // Return undefined on read / parse failure
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

  /**
   * Returns a valid access token.
   * If the current token is about to expire, it automatically executes provider-specific refresh.
   */
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

    // Token is expiring or expired, perform auto-refresh if refreshToken is available
    if (!token.refreshToken) {
      if (now >= token.expiresAt) {
        throw new Error(`[dsh-oauth-models] OAuth token for ${provider} has expired and no refresh token is available.`)
      }
      return token.accessToken
    }

    // Deduplicate in-flight refresh requests for the same provider
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
