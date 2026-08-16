import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: [
      {
        find: '@deepseek-ai/cordis',
        replacement: '/Users/erik/workspace/antigravity/deepseek-harness/packages/session/session-persistence/node_modules/@deepseek-ai/cordis/lib/index.js',
      },
      {
        find: '@deepseek-ai/schemastery',
        replacement: '/Users/erik/workspace/antigravity/deepseek-harness/vendor/schemastery/lib/index.mjs',
      },
      {
        find: '@deepseek-ai/dsh-llm',
        replacement: '/Users/erik/workspace/antigravity/deepseek-harness/packages/llm/llm/src/index.ts',
      },
      {
        find: '@deepseek-ai/dsh-settings',
        replacement: '/Users/erik/workspace/antigravity/deepseek-harness/packages/settings/settings/src/index.ts',
      },
      {
        find: '@deepseek-ai/dsh-tools',
        replacement: '/Users/erik/workspace/antigravity/deepseek-harness/packages/core/tools/src/index.ts',
      },
      {
        find: '@deepseek-ai/dsh-system-prompt',
        replacement: '/Users/erik/workspace/antigravity/deepseek-harness/packages/core/system-prompt/src/index.ts',
      },
      {
        find: '@deepseek-ai/dsh-invariants',
        replacement: '/Users/erik/workspace/antigravity/deepseek-harness/packages/runtime-diagnostics/invariants/src/index.ts',
      },
      {
        find: '@deepseek-ai/dsh-workspace',
        replacement: '/Users/erik/workspace/antigravity/deepseek-harness/packages/core/workspace/src/index.ts',
      },
    ],
  },
  test: {
    globals: true,
    include: ['plugins/*/tests/**/*.spec.{ts,tsx}'],
  },
})
