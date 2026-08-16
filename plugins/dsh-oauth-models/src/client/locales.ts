/**
 * Bilingual localization for OAuth Models & Quota Dashboard
 */

export const en = {
  tabTitle: 'OAuth Subscriptions & Quotas',
  tabDescription: 'Real-time quota monitoring, rate-limit meters, and subscription status for OAuth models.',
  refreshAll: 'Refresh Quotas',
  refreshing: 'Refreshing…',
  lastUpdated: 'Last updated',

  // Statuses
  statusConnected: 'Connected',
  statusRefreshing: 'Refreshing Token',
  statusExpired: 'Token Expired',
  statusUnauthorized: 'Not Authorized',
  statusError: 'Error',

  // Card metrics
  requestsRemaining: 'Requests Remaining',
  tokensRemaining: 'Tokens Available',
  rateLimitRPM: 'RPM Limit',
  rateLimitTPM: 'TPM Limit',
  resetIn: 'Resets in',
  tokenExpiresIn: 'Token expires in',
  autoRenew: 'Auto-Renew Active',

  // Actions
  actionLogin: 'Authenticate / Login',
  actionRefresh: 'Refresh',
  actionDisconnect: 'Sign Out',

  // Provider Titles
  codexTitle: 'OpenAI Codex (ChatGPT Plus/Team/Pro)',
  codexDesc: 'Dynamically connects to OpenAI frontier models via ChatGPT Backend OAuth.',
  antigravityTitle: 'Google Antigravity (CloudCode PA)',
  antigravityDesc: 'Dynamically connects to Google Gemini & Claude models via Google Antigravity OAuth.',
  grokTitle: 'xAI Grok (SuperGrok / API)',
  grokDesc: 'Dynamically connects to xAI Grok frontier reasoning models via xAI OAuth.',
} as const

export const zh = {
  tabTitle: 'OAuth 订阅与实时额度',
  tabDescription: '实时监控 OpenAI Codex、Google Antigravity 与 xAI Grok 的官方订阅状态、请求余量与动态模型目录。',
  refreshAll: '刷新全部状态',
  refreshing: '正在刷新…',
  lastUpdated: '最后更新于',

  // 状态指示
  statusConnected: '已连接',
  statusRefreshing: '自动续期中',
  statusExpired: 'Token 已过期',
  statusUnauthorized: '未授权',
  statusError: '异常',

  // 卡片指标
  requestsRemaining: '剩余请求次数',
  tokensRemaining: '可用 Token 配额',
  rateLimitRPM: 'RPM 每分钟请求限额',
  rateLimitTPM: 'TPM 每分钟 Token 限额',
  resetIn: '配额重置倒计时',
  tokenExpiresIn: 'Token 有效期倒计时',
  autoRenew: '已启用自动静默续期',

  // 操作按钮
  actionLogin: '登录 / 重新授权',
  actionRefresh: '刷新状态',
  actionDisconnect: '断开连接',

  // 提供商信息
  codexTitle: 'OpenAI Codex (ChatGPT Plus/Team/Pro)',
  codexDesc: '通过 ChatGPT Backend OAuth 凭据直连并全动态同步 OpenAI 前沿推理模型。',
  antigravityTitle: 'Google Antigravity (CloudCode PA)',
  antigravityDesc: '通过 Google Antigravity OAuth 凭据直连并全动态同步 Google Gemini 与 Claude 模型。',
  grokTitle: 'xAI Grok (SuperGrok / xAI API)',
  grokDesc: '通过 xAI OAuth 凭据直连并全动态同步 xAI Grok 前沿推理模型。',
} as const
