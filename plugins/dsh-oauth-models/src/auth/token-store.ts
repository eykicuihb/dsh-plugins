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
      // Ignore directory creation failure
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
        if (data?.accessToken) {
          this.cache.set(provider, data)
          return data
        }
      }
    } catch {
      // Ignore parse failure
    }

    return undefined
  }

  public saveToken(provider: OAuthProviderType, data: Partial<OAuthTokenData>): void {
    this.ensureStorageDir()
    const fullData: OAuthTokenData = {
      provider,
      accessToken: data.accessToken || '',
      refreshToken: data.refreshToken,
      tokenType: data.tokenType || 'Bearer',
      expiresAt: data.expiresAt,
      accountEmail: data.accountEmail,
      accountId: data.accountId,
      subscriptionTier: data.subscriptionTier,
      updatedAt: Date.now(),
    }
    this.cache.set(provider, fullData)
    const filePath = this.getTokenFilePath(provider)
    try {
      fs.writeFileSync(filePath, JSON.stringify(fullData, null, 2), 'utf-8')
    } catch (err) {
      console.error(`[dsh-oauth-models] Failed to persist token for ${provider}:`, err)
    }
  }

  public clearToken(provider: OAuthProviderType): void {
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

  public deleteToken(provider: OAuthProviderType): void {
    this.clearToken(provider)
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

    const handler = this.refreshHandlers.get(provider)
    if (!handler) {
      return token.accessToken
    }

    if (this.refreshPromises.has(provider)) {
      const refreshed = await this.refreshPromises.get(provider)!
      return refreshed.accessToken
    }

    const refreshPromise = (async () => {
      try {
        const refreshed = await handler.refreshToken(token)
        this.saveToken(provider, refreshed)
        return refreshed
      } finally {
        this.refreshPromises.delete(provider)
      }
    })()

    this.refreshPromises.set(provider, refreshPromise)
    const result = await refreshPromise
    return result.accessToken
  }
}
