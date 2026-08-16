/**
 * @deepseek-ai/dsh-deepiris — DeepIris Vision Perception Plugin
 *
 * Provides multi-provider VLM visual understanding, autonomous UI testing,
 * and perception capability awareness for DeepSeek Harness.
 *
 * @module @deepseek-ai/dsh-deepiris
 */

import type { Context } from '@deepseek-ai/cordis'
import { installSettingsSection, settingsNamespace } from '@deepseek-ai/dsh-settings'
import { Config } from './config.ts'
import { registerDeepIrisPrompt } from './prompt.ts'
import { registerViewImageTool } from './tools.ts'

export { Config, PROVIDER_PRESETS } from './config.ts'
export { DEEPIRIS_PROMPT_GUIDANCE, DEEPIRIS_PROMPT_ORDER } from './prompt.ts'
export { executeVlmCall, resolveVlmOptions } from './provider.ts'
export type { ResolvedVlmOptions } from './provider.ts'
export { registerViewImageTool } from './tools.ts'
export type {
  ProviderPreset,
  ViewImageArgs,
  ViewImageResult,
  VisionProviderType,
  VlmCallRequest,
  VlmCallResult,
} from './types.ts'

/** Cordis plugin identifier. */
export const name = 'deepiris'

/** Settings namespace for DeepIris configuration. */
export const DEEPIRIS_SETTINGS_NAMESPACE = settingsNamespace('deepiris')

/** Required services for DeepIris backend plugin. */
export const inject = ['settings', 'tools', 'systemPrompt', 'llm']

/**
 * Apply DeepIris plugin to the Cordis context.
 */
export function apply(ctx: Context, initialConfig: Config = {}): void {
  let currentConfig: () => Config = () => initialConfig

  // 1. Install user-modifiable settings section (seamlessly attaches when settings service exists)
  installSettingsSection(ctx, DEEPIRIS_SETTINGS_NAMESPACE, Config, initialConfig, {
    setSource: (source) => {
      currentConfig = source
    },
    onChange: () => {},
  })

  // 2. Expose the settings namespace to web API proxy via configurable provider registration
  if (ctx.llm?.registerConfigurableProviders) {
    try {
      const handle = ctx.llm.registerConfigurableProviders([
        {
          provider: 'deepiris-vision',
          displayName: 'DeepIris Vision',
          settingsNs: DEEPIRIS_SETTINGS_NAMESPACE,
          settingsPath: [],
        },
      ])
      ctx.effect(() => handle, 'dsh-deepiris: configurable provider registration')
    } catch {
      // Ignore if already registered
    }
  }

  // 3. Inject system prompt guidance for autonomous visual verification
  registerDeepIrisPrompt(ctx)

  // 4. Register the model-facing view_image tool
  registerViewImageTool(ctx, () => currentConfig())
}

apply.inject = inject

export default {
  name,
  inject,
  apply,
}
