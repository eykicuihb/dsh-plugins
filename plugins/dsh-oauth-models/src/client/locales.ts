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
  codexTitle: 'OpenAI Codex (ChatGPT Plus/Team)',
  codexDesc: 'Access gpt-4o, o1, and o3-mini via OpenAI Codex OAuth token.',
  antigravityTitle: 'Google Antigravity (Gemini CloudCode PA)',
  antigravityDesc: 'Access Gemini 2.5 Pro (Thinking) and Flash via Google CloudCode OAuth.',
  grokTitle: 'xAI Grok (SuperGrok / API)',
  grokDesc: 'Access Grok-3, Grok-3 Mini, and Grok-2 Vision via xAI OAuth.',
} as const

export const zh = {
  tabTitle: 'OAuth 订阅与实时额度',
  tabDescription: '实时监控 OpenAI Codex、Google Antigravity 与 xAI Grok 的订阅额度、请求余量与速率限制。',
  refreshAll: '刷新全部额度',
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
  actionRefresh: '刷新额度',
  actionDisconnect: '断开连接',
  
  // 提供商信息
  codexTitle: 'OpenAI Codex (ChatGPT Plus/Team)',
  codexDesc: '通过 OpenAI Codex OAuth 凭据直连 GPT-4o、o1 与 o3-mini 深度推理模型。',
  antigravityTitle: 'Google Antigravity (Gemini CloudCode PA)',
  antigravityDesc: '通过 Google CloudCode PA OAuth 直连 Gemini 2.5 Pro (思考链) 与 Flash。',
  grokTitle: 'xAI Grok (SuperGrok / xAI API)',
  grokDesc: '通过 xAI OAuth 直连 Grok-3、Grok-3 Mini 思考模型与 Grok-2 Vision。',
} as const
