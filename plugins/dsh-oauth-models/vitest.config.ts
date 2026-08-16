import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@deepseek-ai/dsh-llm': path.resolve('/Users/erik/workspace/antigravity/deepseek-harness/packages/llm/llm/src/index.ts'),
      '@deepseek-ai/cordis': path.resolve('/Users/erik/workspace/antigravity/deepseek-harness/packages/core/cordis/src/index.ts'),
      '@deepseek-ai/schemastery': path.resolve('/Users/erik/workspace/antigravity/deepseek-harness/node_modules/.pnpm/@deepseek-ai+schemastery@4.4.3/node_modules/@deepseek-ai/schemastery/lib/index.js'),
    },
  },
  test: {
    globals: true,
  },
})
