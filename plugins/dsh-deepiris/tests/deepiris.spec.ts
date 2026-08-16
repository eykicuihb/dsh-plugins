import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { CallId, type ContentBlock } from '@deepseek-ai/dsh-llm'

import * as deepiris from '../src/index.ts'
import { resolveVlmOptions } from '../src/provider.ts'

const testToolSignal = new AbortController().signal

function getTextContent(content: readonly ContentBlock[]): string {
  return content
    .filter((b): b is { type: 'text'; text: string } => b.type === 'text')
    .map(b => b.text)
    .join('')
}

class MemorySettingsProvider extends SettingsProvider {
  doc: Record<string, unknown>

  constructor(ctx: Context, initialDoc: Record<string, unknown> = {}) {
    super(ctx)
    this.doc = structuredClone(initialDoc)
  }

  get writable(): boolean {
    return true
  }

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve(structuredClone(this.doc))
  }

  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.doc[ns] = structuredClone(section)
    return Promise.resolve()
  }
}

describe('@deepseek-ai/dsh-deepiris', () => {
  let tempDir: string
  let testImagePath: string

  beforeEach(() => {
    tempDir = join(tmpdir(), `deepiris-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(tempDir, { recursive: true })
    testImagePath = join(tempDir, 'test.png')
    // Write 1x1 transparent PNG buffer
    const pngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    )
    writeFileSync(testImagePath, pngBuffer)
  })

  afterEach(() => {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
    vi.restoreAllMocks()
  })

  async function createTestContext(config: deepiris.Config = {}) {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(MemorySettingsProvider)
    await ctx.plugin(deepiris, config)
    return ctx
  }

  it('registers the view_image tool and its schema', async () => {
    const ctx = await createTestContext()
    const schemas = ctx.tools.schemas()
    const viewImageSchema = schemas.find(s => s.name === 'view_image')

    expect(viewImageSchema).toBeDefined()
    expect(viewImageSchema?.description).toContain('Inspect and understand an image file')
    const params = viewImageSchema?.parameters as { properties?: Record<string, unknown>; required?: string[] }
    expect(params.properties).toHaveProperty('path')
    expect(params.properties).toHaveProperty('prompt')
    expect(params.required).toContain('path')
  })

  it('injects the vision capability guidance into system prompt', async () => {
    const ctx = await createTestContext()
    const assembly = await ctx.systemPrompt.assemble({})
    const rendered = assembly.sections.map(s => s.text).join('\n')

    expect(rendered).toContain('DeepIris Visual Perception')
    expect(rendered).toContain('view_image')
    expect(rendered).toContain('Autonomous Visual Verification')
  })

  it('resolves options for all built-in providers correctly', async () => {
    // 1. Default DashScope
    const dashscope = await resolveVlmOptions({ provider: 'dashscope' })
    expect(dashscope.baseURL).toBe('https://dashscope.aliyuncs.com/compatible-mode/v1')
    expect(dashscope.model).toBe('qwen2.5-vl-72b-instruct')

    // 2. Zhipu GLM-4V
    const zhipu = await resolveVlmOptions({ provider: 'zhipu' })
    expect(zhipu.baseURL).toBe('https://open.bigmodel.cn/api/paas/v4')
    expect(zhipu.model).toBe('glm-4v-plus')

    // 3. OpenAI
    const openai = await resolveVlmOptions({ provider: 'openai' })
    expect(openai.baseURL).toBe('https://api.openai.com/v1')
    expect(openai.model).toBe('gpt-4o-mini')

    // 4. Anthropic
    const anthropic = await resolveVlmOptions({ provider: 'anthropic' })
    expect(anthropic.baseURL).toBe('https://api.anthropic.com/v1')
    expect(anthropic.model).toBe('claude-3-5-haiku-20241022')

    // 5. Google Gemini
    const gemini = await resolveVlmOptions({ provider: 'gemini' })
    expect(gemini.baseURL).toBe('https://generativelanguage.googleapis.com/v1beta/openai')
    expect(gemini.model).toBe('gemini-2.0-flash')

    // 6. Ollama (offline)
    const ollama = await resolveVlmOptions({ provider: 'ollama' })
    expect(ollama.baseURL).toBe('http://127.0.0.1:11434/v1')
    expect(ollama.model).toBe('qwen2.5-vl:latest')

    // 7. Custom override
    const custom = await resolveVlmOptions({
      provider: 'custom',
      baseURL: 'https://my-vlm.internal/v1',
      model: 'my-custom-vlm',
      apiKey: 'custom-key',
      timeoutMs: 90000,
    })
    expect(custom.baseURL).toBe('https://my-vlm.internal/v1')
    expect(custom.model).toBe('my-custom-vlm')
    expect(custom.apiKey).toBe('custom-key')
    expect(custom.timeoutMs).toBe(90000)
  })

  it('executes view_image successfully with mocked OpenAI-compatible endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'This image shows a single pixel test pattern with a white background.',
            },
          },
        ],
      }),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    const ctx = await createTestContext({
      provider: 'dashscope',
      apiKey: 'test-dashscope-key',
    })

    const result = await ctx.tools.execute({
      signal: testToolSignal,
      callId: CallId('call-1'),
      name: 'view_image',
      arguments: {
        path: testImagePath,
        prompt: 'Check the image contents',
      },
    })

    expect(result.isError).toBe(false)
    const textContent = getTextContent(result.content)

    expect(textContent).toContain('single pixel test pattern')
    expect(mockFetch).toHaveBeenCalledOnce()

    const firstCall = mockFetch.mock.calls[0]
    expect(firstCall).toBeDefined()
    const requestBody = JSON.parse(firstCall?.[1]?.body as string)
    expect(requestBody.model).toBe('qwen2.5-vl-72b-instruct')
    expect(requestBody.messages[0].content[0].text).toContain('Check the image contents')
  })

  it('executes view_image successfully with mocked Anthropic endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          {
            type: 'text',
            text: 'Claude observation: clean rendered UI component with centered button.',
          },
        ],
      }),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    const ctx = await createTestContext({
      provider: 'anthropic',
      apiKey: 'test-anthropic-key',
    })

    const result = await ctx.tools.execute({
      signal: testToolSignal,
      callId: CallId('call-2'),
      name: 'view_image',
      arguments: {
        path: testImagePath,
      },
    })

    expect(result.isError).toBe(false)
    const textContent = getTextContent(result.content)

    expect(textContent).toContain('clean rendered UI component')
    expect(mockFetch).toHaveBeenCalledOnce()
    const firstCall = mockFetch.mock.calls[0]
    expect(firstCall).toBeDefined()
    const callHeaders = firstCall?.[1]?.headers as Record<string, string>
    expect(callHeaders['x-api-key']).toBe('test-anthropic-key')
  })

  it('executes view_image with local Ollama without requiring API key', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Ollama local observation: chart displaying revenue metrics.',
            },
          },
        ],
      }),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    const ctx = await createTestContext({
      provider: 'ollama',
      baseURL: 'http://127.0.0.1:11434/v1',
    })

    const result = await ctx.tools.execute({
      signal: testToolSignal,
      callId: CallId('call-ollama'),
      name: 'view_image',
      arguments: {
        path: testImagePath,
      },
    })

    expect(result.isError).toBe(false)
    const textContent = getTextContent(result.content)

    expect(textContent).toContain('Ollama local observation')
    expect(mockFetch).toHaveBeenCalledOnce()
    const firstCall = mockFetch.mock.calls[0]
    expect(firstCall).toBeDefined()
    expect(firstCall?.[0]).toBe('http://127.0.0.1:11434/v1/chat/completions')
  })

  it('dynamically adapts to runtime user settings changes', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Observation with dynamic settings.',
            },
          },
        ],
      }),
    })
    globalThis.fetch = mockFetch as unknown as typeof fetch

    const ctx = await createTestContext({
      provider: 'dashscope',
      apiKey: 'initial-key',
    })

    // Update settings at runtime via settings service
    await ctx.settings.update(deepiris.DEEPIRIS_SETTINGS_NAMESPACE, {
      provider: 'openai',
      model: 'gpt-4o',
      apiKey: 'dynamic-openai-key',
    })

    const result = await ctx.tools.execute({
      signal: testToolSignal,
      callId: CallId('call-dynamic'),
      name: 'view_image',
      arguments: {
        path: testImagePath,
      },
    })

    expect(result.isError).toBe(false)
    const firstCall = mockFetch.mock.calls[0]
    expect(firstCall).toBeDefined()
    const requestBody = JSON.parse(firstCall?.[1]?.body as string)
    expect(requestBody.model).toBe('gpt-4o')
    const headers = firstCall?.[1]?.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer dynamic-openai-key')
  })

  it('returns error when file does not exist', async () => {
    const ctx = await createTestContext({
      provider: 'dashscope',
      apiKey: 'test-key',
    })

    const nonExistentPath = join(tempDir, 'not-found.png')
    const result = await ctx.tools.execute({
      signal: testToolSignal,
      callId: CallId('call-3'),
      name: 'view_image',
      arguments: {
        path: nonExistentPath,
      },
    })

    expect(result.isError).toBe(true)
    const textContent = getTextContent(result.content)

    expect(textContent).toContain('无法读取图片文件')
  })

  it('returns error when missing API key for cloud provider', async () => {
    const ctx = await createTestContext({
      provider: 'dashscope',
      apiKey: '',
      apiKeyEnv: 'UNSET_API_KEY_ENV_FOR_TEST',
    })

    const result = await ctx.tools.execute({
      signal: testToolSignal,
      callId: CallId('call-4'),
      name: 'view_image',
      arguments: {
        path: testImagePath,
      },
    })

    expect(result.isError).toBe(true)
    const textContent = getTextContent(result.content)

    expect(textContent).toContain('API Key')
  })
})
