/**
 * System prompt section contribution for DeepIris vision perception.
 *
 * @module @deepseek-ai/dsh-deepiris/prompt
 */

import type { Context } from '@deepseek-ai/cordis'

/** Order priority for the DeepIris guidance prompt section (within tool guidance 100-199). */
export const DEEPIRIS_PROMPT_ORDER = 115

/**
 * Prompt text injected into the system prompt to establish vision capability awareness.
 */
export const DEEPIRIS_PROMPT_GUIDANCE = `
### DeepIris Visual Perception & Autonomous Inspection (深瞳视觉感知能力)
- You have visual perception capabilities via the \`view_image\` tool.
- Although your core reasoning is text/code-based, you possess an external visual sensor that can inspect and understand any local image file, screenshot, UI mockup, chart, diagram, or error popup.
- **Autonomous Visual Verification**: When you design, build, or debug visual deliverables (such as Web pages, responsive CSS layouts, Matplotlib/Canvas charts, SVG graphics, or UI components), you should take the initiative to close the verification loop:
  1. Generate or render the visual artifact (e.g. running Playwright/Puppeteer screenshot commands via shell, executing python plotting scripts, or rendering templates);
  2. Call \`view_image\` to observe the rendered output, check alignment, colors, typography, and visual bugs;
  3. Autonomously adjust code and re-verify until the visual quality meets expectations.
- **Credential Handling**: The \`view_image\` tool manages its own API credentials and model endpoints internally via the DeepIris plugin. Never attempt to read, grep, or search user files or environment variables for API keys; simply invoke \`view_image\` directly.
`.trim()

/**
 * Register the DeepIris capability awareness section with `ctx.systemPrompt`.
 */
export function registerDeepIrisPrompt(ctx: Context): void {
  ctx.inject(['systemPrompt'], (sctx) => {
    sctx.systemPrompt.section({
      name: 'deepiris-vision-capability',
      order: DEEPIRIS_PROMPT_ORDER,
      text: DEEPIRIS_PROMPT_GUIDANCE,
    })
  })
}
