/**
 * Configuration and Schemastery definitions for DeepIris vision perception plugin.
 *
 * @module @deepseek-ai/dsh-deepiris/config
 */

import z from '@deepseek-ai/schemastery'
import type { ProviderPreset, VisionProviderType } from './types.ts'

/** Default provider presets with endpoint addresses and recommended models. */
export const PROVIDER_PRESETS: Readonly<Record<VisionProviderType, ProviderPreset>> = Object.freeze({
  dashscope: {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen2.5-vl-72b-instruct',
    defaultApiKeyEnv: 'DASHSCOPE_API_KEY',
    displayName: '通义千问 (Qwen2.5-VL)',
  },
  zhipu: {
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4v-plus',
    defaultApiKeyEnv: 'ZHIPU_API_KEY',
    displayName: '智谱 AI (GLM-4V)',
  },
  minimax: {
    baseURL: 'https://api.minimaxi.chat/v1',
    defaultModel: 'MiniMax-M3',
    defaultApiKeyEnv: 'MINIMAX_API_KEY',
    displayName: 'MiniMax (海螺 AI / MiniMax-M3)',
  },
  openai: {
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    defaultApiKeyEnv: 'OPENAI_API_KEY',
    displayName: 'OpenAI (GPT-4o)',
  },
  anthropic: {
    baseURL: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-3-5-haiku-20241022',
    defaultApiKeyEnv: 'ANTHROPIC_API_KEY',
    displayName: 'Anthropic (Claude 3.5)',
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash',
    defaultApiKeyEnv: 'GEMINI_API_KEY',
    displayName: 'Google Gemini',
  },
  ollama: {
    baseURL: 'http://127.0.0.1:11434/v1',
    defaultModel: 'qwen2.5-vl:latest',
    defaultApiKeyEnv: 'OLLAMA_API_KEY',
    displayName: '本地 Ollama (Qwen2.5-VL / MiniCPM-V)',
  },
  custom: {
    baseURL: 'http://localhost:8000/v1',
    defaultModel: 'custom-vlm',
    defaultApiKeyEnv: 'CUSTOM_VISION_API_KEY',
    displayName: '自定义 OpenAI 兼容 API',
  },
})

/** Plugin configuration interface. */
export interface Config {
  /** The vision model provider to route requests to. */
  provider?: VisionProviderType
  /** Exact model identifier (e.g. qwen2.5-vl-72b-instruct, gpt-4o, MiniMax-M3). */
  model?: string
  /** Custom endpoint URL base. */
  baseURL?: string
  /** Literal API key (optional; prefer apiKeyEnv). */
  apiKey?: string
  /** Environment variable name carrying the provider API key. */
  apiKeyEnv?: string
  /** Request timeout in milliseconds (defaults to 60000ms). */
  timeoutMs?: number
}

/** Schemastery validation schema and Web UI form descriptors. */
export const Config: z<Config> = z.object({
  provider: z.string().default('dashscope').description('视觉模型供应商（如 dashscope, zhipu, minimax, openai, anthropic, gemini, ollama, custom 或自定义）'),
  model: z.string().description('模型名称（留空则自动选用该供应商的推荐视觉模型）'),
  baseURL: z.string().description('API 端点 Base URL（留空则自动选用官方默认地址）'),
  apiKey: z.string().role('secret').description('直接填写 API Key（可选）'),
  apiKeyEnv: z.string().role('credential-ref').description('从环境变量读取 API Key（如 MINIMAX_API_KEY / DASHSCOPE_API_KEY / OPENAI_API_KEY）'),
  timeoutMs: z.number().min(1000).default(60000).description('单次视觉分析超时毫秒数'),
})
