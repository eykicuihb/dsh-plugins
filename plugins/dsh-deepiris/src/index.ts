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

  // 2. Inject system prompt guidance for autonomous visual verification
  registerDeepIrisPrompt(ctx)

  // 3. Register the model-facing view_image tool
  registerViewImageTool(ctx, () => currentConfig())
}
