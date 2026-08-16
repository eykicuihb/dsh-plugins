import { describe, it, expect, vi } from 'vitest'
import { apply, name, inject } from '../src/index.ts'

describe('dsh-oauth-models plugin entry', () => {
  it('should declare name and dependencies', () => {
    expect(name).toBe('oauth-models')
    expect(inject).toContain('llm')
  })

  it('should register adapters and effect disposers', () => {
    const registerAdapterMock = vi.fn().mockReturnValue(vi.fn())
    const effectMock = vi.fn()

    const mockCtx = {
      llm: {
        registerAdapter: registerAdapterMock,
      },
      effect: effectMock,
    } as any

    apply(mockCtx, {
      providers: {
        codex: { enabled: true },
        antigravity: { enabled: true },
        grok: { enabled: true },
      },
    })

    expect(registerAdapterMock).toHaveBeenCalledWith(['codex'], expect.anything())
    expect(registerAdapterMock).toHaveBeenCalledWith(['antigravity'], expect.anything())
    expect(registerAdapterMock).toHaveBeenCalledWith(['grok'], expect.anything())
    expect(effectMock).toHaveBeenCalled()
  })
})
