/**
 * Tool definitions for DeepIris vision perception.
 *
 * @module @deepseek-ai/dsh-deepiris/tools
 */

import { readFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { executeVlmCall, resolveVlmOptions } from './provider.ts'
import type { Config } from './config.ts'
import type { ViewImageResult } from './types.ts'

/** Supported image extensions and corresponding MIME types. */
const EXTENSION_MIME_MAP: Readonly<Record<string, string>> = Object.freeze({
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
})

/**
 * Register the `view_image` tool with `ctx.tools`.
 */
export function registerViewImageTool(
  ctx: Context,
  getConfig: () => Config,
): void {
  ctx.inject(['tools'], (sctx) => {
    sctx.tools.register(
      defineTool({
        name: 'view_image',
        description:
          'Inspect and understand an image file (local path or screenshot). Use this tool to observe visual designs, charts, diagrams, error dialogs, or UI renderings to extract visual structure, text (OCR), layout details, and qualitative feedback.',
        parameters: {
          path: {
            type: 'string',
            required: true,
            description: 'Path to the image file (relative to the workspace root or absolute).',
          },
          prompt: {
            type: 'string',
            description:
              'Optional specific question or visual focus (e.g. "Check if the buttons are centered", "Extract the table data as markdown", "Why is the chart layout broken?"). Default is a comprehensive visual breakdown.',
          },
        },
        output: {
          schema: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              observation: { type: 'string' },
              provider: { type: 'string' },
              model: { type: 'string' },
            },
            additionalProperties: false,
          },
          render: (args, value) => [
            {
              type: 'text',
              text: `[DeepIris Observation (${value.provider}/${value.model}) of ${args.path}]:\n${value.observation}`,
            },
          ],
        },
        presentCall(args) {
          return {
            card: 'generic',
            title: `view_image: ${args.path}`,
            rawInput: args.prompt !== undefined ? `Focus: ${args.prompt}` : undefined,
            locations: [{ path: args.path }],
          }
        },
        presentResult(args, result) {
          return {
            card: 'generic',
            title: `DeepIris: ${args.path}`,
            content: result.content,
          }
        },
        async execute(args, exec): Promise<ViewImageResult> {
          const cwd = sctx.get('workspace')?.cwd ?? process.cwd()
          const normalizedPath = args.path.trim()
          if (normalizedPath.length === 0) {
            throw new Error('[DeepIris] Invalid path: image path must not be empty.')
          }

          const absPath = isAbsolute(normalizedPath)
            ? normalizedPath
            : resolve(cwd, normalizedPath)

          let buffer: Buffer
          try {
            buffer = await readFile(absPath, { signal: exec.signal })
          } catch (error: unknown) {
            const message = error instanceof Error ? error.message : String(error)
            throw new Error(`[DeepIris] 无法读取图片文件 "${absPath}": ${message}`)
          }

          const ext = absPath.split('.').pop()?.toLowerCase() ?? 'png'
          const mimeType = EXTENSION_MIME_MAP[ext] ?? 'image/png'
          const base64Data = buffer.toString('base64')
          const dataUrl = `data:${mimeType};base64,${base64Data}`

          const currentConfig = getConfig()
          const resolvedOptions = await resolveVlmOptions(currentConfig, sctx)

          const callResult = await executeVlmCall(resolvedOptions, {
            dataUrl,
            ...args.prompt !== undefined ? { prompt: args.prompt } : {},
            ...exec.signal !== undefined ? { signal: exec.signal } : {},
          })

          return {
            path: args.path,
            observation: callResult.observation,
            provider: callResult.provider,
            model: callResult.model,
          }
        },
      }),
    )
  })
}
