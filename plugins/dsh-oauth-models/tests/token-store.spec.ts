import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { TokenStore } from '../src/auth/token-store.ts'
import type { OAuthTokenData } from '../src/types.ts'

describe('TokenStore', () => {
  let tempDir: string
  let store: TokenStore

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-token-store-test-'))
    store = new TokenStore(tempDir)
  })

  it('should return unauthorized when no token is present', () => {
    expect(store.getStatus('codex')).toBe('unauthorized')
  })

  it('should save, load, and compute connected status', () => {
    const token: OAuthTokenData = {
      provider: 'codex',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: Date.now() + 3600 * 1000,
      accountEmail: 'user@example.com',
      updatedAt: Date.now(),
    }

    store.saveToken(token)
    expect(store.getStatus('codex')).toBe('connected')

    const loaded = store.loadToken('codex')
    expect(loaded).toBeDefined()
    expect(loaded?.accessToken).toBe('test-access-token')
    expect(loaded?.accountEmail).toBe('user@example.com')
  })

  it('should detect expired tokens', () => {
    const token: OAuthTokenData = {
      provider: 'antigravity',
      accessToken: 'expired-access-token',
      expiresAt: Date.now() - 1000,
      updatedAt: Date.now(),
    }

    store.saveToken(token)
    expect(store.getStatus('antigravity')).toBe('expired')
  })

  it('should auto-refresh when token is expiring soon', async () => {
    const initialToken: OAuthTokenData = {
      provider: 'grok',
      accessToken: 'old-access-token',
      refreshToken: 'valid-refresh-token',
      expiresAt: Date.now() + 30000, // 30s left (< 60s lead time)
      updatedAt: Date.now(),
    }

    store.saveToken(initialToken)

    const refreshMock = vi.fn().mockResolvedValue({
      provider: 'grok',
      accessToken: 'new-refreshed-token',
      refreshToken: 'valid-refresh-token',
      expiresAt: Date.now() + 3600 * 1000,
      updatedAt: Date.now(),
    })

    store.registerRefreshHandler('grok', {
      refreshToken: refreshMock,
      validateToken: vi.fn().mockResolvedValue(true),
    })

    const token = await store.getValidToken('grok', 60000)
    expect(token).toBe('new-refreshed-token')
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })
})
