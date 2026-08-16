import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { TokenStore } from '../src/auth/token-store.ts'
import { QuotaService } from '../src/quota/quota-service.ts'

describe('QuotaService', () => {
  let tempDir: string
  let store: TokenStore
  let service: QuotaService

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-quota-service-test-'))
    store = new TokenStore(tempDir)
    service = new QuotaService(store)
  })

  it('should initialize default metrics for all 3 providers', () => {
    const codex = service.getMetrics('codex')
    const antigravity = service.getMetrics('antigravity')
    const grok = service.getMetrics('grok')

    expect(codex.provider).toBe('codex')
    expect(codex.status).toBe('unauthorized')

    expect(antigravity.provider).toBe('antigravity')
    expect(antigravity.status).toBe('unauthorized')

    expect(grok.provider).toBe('grok')
    expect(grok.status).toBe('unauthorized')
  })

  it('should parse OpenAI rate-limit headers correctly', () => {
    const headers = new Headers({
      'x-ratelimit-remaining-requests': '42',
      'x-ratelimit-limit-requests': '50',
      'x-ratelimit-reset-requests': '25m',
      'x-ratelimit-remaining-tokens': '850000',
      'x-ratelimit-limit-tokens': '1000000',
    })

    service.updateFromHeaders('codex', headers)

    const updated = service.getMetrics('codex')
    expect(updated.status).toBe('connected')
    expect(updated.requestsRemaining).toBe(42)
    expect(updated.requestsLimit).toBe(50)
    expect(updated.requestsResetSeconds).toBe(1500) // 25m = 1500s
    expect(updated.tokensRemaining).toBe(850000)
    expect(updated.tokensLimit).toBe(1000000)
  })

  it('should notify subscribers on quota updates', () => {
    const listener = vi.fn()
    const unsubscribe = service.subscribe(listener)

    const headers = new Headers({
      'x-ratelimit-remaining-requests': '30',
      'x-ratelimit-limit-requests': '100',
    })

    service.updateFromHeaders('grok', headers)
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    service.updateFromHeaders('grok', headers)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
