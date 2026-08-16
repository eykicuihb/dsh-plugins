import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TokenStore } from '../src/auth/token-store.ts'
import { CodexAdapter } from '../src/adapters/codex-adapter.ts'
import { AntigravityAdapter } from '../src/adapters/antigravity-adapter.ts'
import { GrokAdapter } from '../src/adapters/grok-adapter.ts'
import type { GenerateOptions } from '@deepseek-ai/dsh-llm'

describe('LLM Adapters', () => {
  let tokenStore: TokenStore
  let codex: CodexAdapter
  let antigravity: AntigravityAdapter
  let grok: GrokAdapter

  beforeEach(() => {
    tokenStore = new TokenStore('/tmp/dsh-adapters-test')
    codex = new CodexAdapter(tokenStore)
    antigravity = new AntigravityAdapter(tokenStore)
    grok = new GrokAdapter(tokenStore)
  })

  it('should describe provider info and list models', async () => {
    expect(codex.providerInfo('codex').name).toContain('Codex')
    expect(antigravity.providerInfo('antigravity').name).toContain('Antigravity')
    expect(grok.providerInfo('grok').name).toContain('Grok')

    const codexModels = await codex.listModels('codex')
    expect(codexModels.some((m) => m.id === 'gpt-4o')).toBe(true)
    expect(codexModels.some((m) => m.id === 'o1')).toBe(true)

    const antiModels = await antigravity.listModels('antigravity')
    expect(antiModels.some((m) => m.id === 'gemini-2.5-pro')).toBe(true)

    const grokModels = await grok.listModels('grok')
    expect(grokModels.some((m) => m.id === 'grok-3')).toBe(true)
  })

  it('should resolve reasoning metadata for o1 and gemini-2.5-pro', async () => {
    const o1Info = await codex.resolveModel('codex', 'o1')
    expect(o1Info.reasoning).toBeDefined()
    expect(o1Info.reasoning?.defaultEffort).toBe('medium')

    const geminiInfo = await antigravity.resolveModel('antigravity', 'gemini-2.5-pro')
    expect(geminiInfo.reasoning).toBeDefined()

    const grokInfo = await grok.resolveModel('grok', 'grok-3')
    expect(grokInfo.reasoning).toBeDefined()
  })

  it('should stream chunks and extract reasoning tokens', async () => {
    tokenStore.saveToken({
      provider: 'codex',
      accessToken: 'valid-mock-token',
      expiresAt: Date.now() + 3600 * 1000,
      updatedAt: Date.now(),
    })

    const sseResponse = [
      'data: {"choices":[{"delta":{"reasoning_content":"Thinking about coding problem..."}}]}',
      'data: {"choices":[{"delta":{"content":"Here is the solution:"}}]}',
      'data: {"choices":[{"delta":{"content":"\\n```python\\nprint(1)\\n```"}}]}',
      'data: [DONE]',
    ].join('\n\n')

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'x-ratelimit-remaining-requests': '49' }),
      body: {
        getReader: () => {
          let called = false
          return {
            read: () => {
              if (!called) {
                called = true
                return Promise.resolve({
                  done: false,
                  value: new TextEncoder().encode(sseResponse),
                })
              }
              return Promise.resolve({ done: true, value: undefined })
            },
            releaseLock: () => {},
          }
        },
      },
    })

    const options: GenerateOptions = {
      provider: 'codex',
      model: 'o1',
      messages: [{ id: '1' as any, role: 'user', content: [{ type: 'text', text: 'Hello' }], source: { category: 'user' } }],
    }

    const chunks = []
    for await (const chunk of codex.stream(options)) {
      chunks.push(chunk)
    }

    expect(chunks.some((c) => c.type === 'reasoning-delta')).toBe(true)
    expect(chunks.some((c) => c.type === 'text-delta')).toBe(true)
    expect(chunks.some((c) => c.type === 'finish')).toBe(true)
  })
})
