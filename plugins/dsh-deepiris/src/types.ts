/**
 * Type definitions for @deepseek-ai/dsh-deepiris vision perception plugin.
 *
 * @module @deepseek-ai/dsh-deepiris/types
 */

/** Supported vision model provider identifiers. */
export type VisionProviderType =
  | 'dashscope'
  | 'zhipu'
  | 'minimax'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'ollama'
  | 'custom'
  | (string & {})

/** Preset configuration metadata for a built-in provider. */
export interface ProviderPreset {
  readonly baseURL: string
  readonly defaultModel: string
  readonly defaultApiKeyEnv: string
  readonly displayName: string
}

/** Request payload sent to the VLM provider abstraction. */
export interface VlmCallRequest {
  /** Base64 data URL representing the image (e.g. data:image/png;base64,...). */
  readonly dataUrl: string
  /** Specific question or focus prompt from the user / model. */
  readonly prompt?: string
  /** Abort signal for request cancellation and timeout. */
  readonly signal?: AbortSignal
}

/** Normalized outcome returned by the VLM provider. */
export interface VlmCallResult {
  /** Natural language visual observation and analysis. */
  readonly observation: string
  /** Provider identifier that fulfilled the request. */
  readonly provider: string
  /** Model name that fulfilled the request. */
  readonly model: string
}

/** Input parameters accepted by the view_image tool. */
export interface ViewImageArgs {
  /** Workspace-relative or absolute file path to the image. */
  readonly path: string
  /** Optional specific visual question or inspection focus. */
  readonly prompt?: string
}

/** Structured value returned by the view_image tool. */
export interface ViewImageResult {
  /** Image path inspected. */
  readonly path: string
  /** Qualitative visual observation and breakdown. */
  readonly observation: string
  /** Provider identifier used for the analysis. */
  readonly provider: string
  /** Model name used for the analysis. */
  readonly model: string
}
