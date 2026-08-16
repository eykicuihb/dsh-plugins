/**
 * OAuth 2.0 PKCE Authorization & Quota Control Server
 * Runs a local server on port 14555 for WebUI control and handles callbacks on standard ports.
 * All quotas and rate limits are fetched 100% dynamically from official remote APIs.
 */

import http from 'node:http'
import crypto from 'node:crypto'
import { URL, URLSearchParams } from 'node:url'
import type { OAuthProviderType, OAuthTokenData, QuotaWindowDetail } from '../types.ts'
import type { TokenStore } from './token-store.ts'

interface OAuthConfig {
  clientId: string
  clientSecret?: string
  authUrl: string
  tokenUrl: string
  scope: string
  port: number
  path: string
}

const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || Buffer.from('MTA3MTAwNjA2MDQ2OS11cDdhcTQxYjQ5dDZrNWVzb2J2ZTQ0NmVuNWk3NGRlYi5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbQ==', 'base64').toString('utf-8')
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || Buffer.from('R0NDU1BYLXE3MS1jMHY2NHR2a2NlYktWcC1ub252UHJraDg=', 'base64').toString('utf-8')

function formatChineseDate(input: string | number | Date): string {
  try {
    const d = typeof input === 'number' && input < 1e11 ? new Date(input * 1000) : new Date(input)
    if (isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const day = d.getDate()
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${y}年${m}月${day}日 ${hh}:${mm}`
  } catch {
    return ''
  }
}

export class OAuthServer {
  private readonly tokenStore: TokenStore
  private readonly enableAntigravity: boolean
  private controlServer: http.Server | null = null
  private readonly callbackServers = new Map<number, http.Server>()
  private readonly activeSessions = new Map<string, { provider: OAuthProviderType; verifier: string }>()

  private readonly codexConfig: OAuthConfig = {
    clientId: 'app-6548df609804b46c8eb742e88a08d6a5',
    authUrl: 'https://auth.openai.com/authorize',
    tokenUrl: 'https://auth.openai.com/oauth/token',
    scope: 'openid email profile offline_access model.request model.read',
    port: 1455,
    path: '/auth/callback',
  }

  private readonly antigravityConfig: OAuthConfig = {
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/userinfo.email openid',
    port: 51121,
    path: '/oauth-callback',
  }

  private readonly grokConfig: OAuthConfig = {
    clientId: 'b1a00492-073a-47ea-816f-4c329264a828',
    authUrl: 'https://auth.x.ai/oauth2/authorize',
    tokenUrl: 'https://auth.x.ai/oauth2/token',
    scope: 'openid profile email offline_access grok-cli:access api:access',
    port: 56121,
    path: '/callback',
  }

  constructor(tokenStore: TokenStore, enableAntigravity: boolean = false) {
    this.tokenStore = tokenStore
    this.enableAntigravity = enableAntigravity
  }

  public async start(): Promise<void> {
    // 1. Start control server on port 14555
    const control = http.createServer((req, res) => {
      this.handleControlRequest(req, res)
    })

    control.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        // Port already bound
      }
    })

    await new Promise<void>((resolve) => {
      control.listen(14555, '127.0.0.1', () => {
        this.controlServer = control
        resolve()
      })
      setTimeout(resolve, 200)
    })

    // 2. Start provider-specific callback servers
    await this.startCallbackServer(1455, this.codexConfig.path, 'codex')
    if (this.enableAntigravity) {
      await this.startCallbackServer(51121, this.antigravityConfig.path, 'antigravity')
    }
    await this.startCallbackServer(56121, this.grokConfig.path, 'grok')
  }

  public stop(): void {
    this.controlServer?.close()
    for (const server of this.callbackServers.values()) {
      server.close()
    }
    this.callbackServers.clear()
  }

  private async startCallbackServer(port: number, path: string, provider: OAuthProviderType): Promise<void> {
    try {
      const server = http.createServer((req, res) => {
        const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
        if (url.pathname === path) {
          const code = url.searchParams.get('code')
          const state = url.searchParams.get('state')
          if (code && state) {
            this.handleCallback(provider, code, state, res)
            return
          }
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
      })

      server.on('error', (_err: any) => {
        // Handle EADDRINUSE gracefully
      })

      await new Promise<void>((resolve) => {
        server.listen(port, '127.0.0.1', () => {
          this.callbackServers.set(port, server)
          resolve()
        })
        setTimeout(resolve, 200)
      })
    } catch {
      // Ignore bind error
    }
  }

  /**
   * 100% Dynamic Quota from Google Antigravity Remote API
   */
  private async fetchAntigravityLiveQuota(token: OAuthTokenData): Promise<QuotaWindowDetail[]> {
    const quotaWindows: QuotaWindowDetail[] = []

    try {
      const res = await fetch('https://daily-cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token.accessToken}`,
          'User-Agent': 'antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)',
          'x-goog-api-client': 'google-api-nodejs-client/10.3.0',
        },
        body: JSON.stringify({ project: token.accountId || '' }),
      })

      if (res.ok) {
        const data = (await res.json()) as { models?: Record<string, any> }
        let geminiPercent = 100
        let geminiReset: string | undefined
        let nonGeminiPercent = 100
        let nonGeminiReset: string | undefined

        for (const [id, meta] of Object.entries(data.models || {})) {
          if (id.startsWith('chat_') || id.startsWith('tab_')) continue
          const q = meta.quotaInfo || meta.quota
          if (q && typeof q.remainingFraction === 'number') {
            const pct = Math.round(q.remainingFraction * 1000) / 10
            if (id.toLowerCase().includes('gemini')) {
              geminiPercent = Math.min(geminiPercent, pct)
              if (q.resetTime && !geminiReset) geminiReset = q.resetTime
            } else {
              nonGeminiPercent = Math.min(nonGeminiPercent, pct)
              if (q.resetTime && !nonGeminiReset) nonGeminiReset = q.resetTime
            }
          }
        }

        // 1. Gemini Models Quota
        quotaWindows.push({
          id: 'antigravity-gemini',
          label: 'Gemini 系列模型配额',
          remainingPercentage: geminiPercent,
          resetTimeFormatted: geminiReset ? formatChineseDate(geminiReset) : undefined,
        })

        // 2. Non-Gemini / Claude Models Quota
        quotaWindows.push({
          id: 'antigravity-nongemini',
          label: 'Claude / 非 Gemini 模型配额',
          remainingPercentage: nonGeminiPercent,
          resetTimeFormatted: nonGeminiReset ? formatChineseDate(nonGeminiReset) : undefined,
        })
      }
    } catch {
      // Ignore network error
    }

    return quotaWindows
  }

  /**
   * 100% Dynamic Quota from xAI Grok Remote Billing API (format=credits)
   */
  private async fetchGrokLiveQuota(token: OAuthTokenData): Promise<QuotaWindowDetail[]> {
    const windows: QuotaWindowDetail[] = []
    try {
      const res = await fetch('https://cli-chat-proxy.grok.com/v1/billing?format=credits', {
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${token.accessToken}`,
          'x-grok-client-mode': 'cli',
        },
      })
      if (res.ok) {
        const data = await res.json()
        const cfg = data?.config
        const usedPercent = typeof cfg?.creditUsagePercent === 'number' ? cfg.creditUsagePercent : 0
        const remainingPercent = Math.max(0, 100 - usedPercent)
        const periodEnd = cfg?.currentPeriod?.end || cfg?.billingPeriodEnd

        windows.push({
          id: 'grok-weekly',
          label: '每周使用限额 (Weekly SuperGrok Limit)',
          remainingPercentage: remainingPercent,
          resetTimeFormatted: periodEnd ? formatChineseDate(periodEnd) : undefined,
        })
      }
    } catch {
      // Ignore network error
    }
    return windows
  }

  /**
   * 100% Dynamic Quota from OpenAI ChatGPT Backend WHAM Usage API
   */
  private async fetchCodexLiveQuota(token: OAuthTokenData): Promise<{
    quotaWindows: QuotaWindowDetail[]
    planType?: string
  }> {
    const quotaWindows: QuotaWindowDetail[] = []
    let planType: string | undefined

    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token.accessToken}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      }
      if (token.accountId) {
        headers['ChatGPT-Account-Id'] = token.accountId
      }

      const res = await fetch('https://chatgpt.com/backend-api/wham/usage', { headers })
      if (res.ok) {
        const data = await res.json()
        planType = data.plan_type ? `ChatGPT ${data.plan_type.toUpperCase()}` : undefined

        const rateLimit = data.rate_limit
        if (rateLimit) {
          const primary = rateLimit.primary_window
          if (primary) {
            const usedPct = typeof primary.used_percent === 'number' ? primary.used_percent : 0
            const remainingPct = Math.max(0, 100 - usedPct)
            const resetAt = primary.reset_at

            quotaWindows.push({
              id: 'codex-primary',
              label: primary.limit_window_seconds >= 604800 ? '每周使用限额' : '使用限额',
              remainingPercentage: remainingPct,
              resetTimeFormatted: resetAt ? formatChineseDate(resetAt) : undefined,
              resetAt: typeof resetAt === 'number' ? resetAt * 1000 : undefined,
            })
          }

          const secondary = rateLimit.secondary_window
          if (secondary) {
            const usedPct = typeof secondary.used_percent === 'number' ? secondary.used_percent : 0
            const remainingPct = Math.max(0, 100 - usedPct)
            const resetAt = secondary.reset_at

            quotaWindows.push({
              id: 'codex-secondary',
              label: '周期限额',
              remainingPercentage: remainingPct,
              resetTimeFormatted: resetAt ? formatChineseDate(resetAt) : undefined,
              resetAt: typeof resetAt === 'number' ? resetAt * 1000 : undefined,
            })
          }
        }
      }
    } catch {
      // Ignore network error
    }

    return { quotaWindows, planType }
  }

  private async handleControlRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // Enable CORS for DSH WebUI
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url || '/', 'http://127.0.0.1:14555')

    // 1. GET /oauth/status or GET /oauth/quota
    if (url.pathname === '/oauth/status' || url.pathname === '/oauth/quota') {
      const codexToken = this.tokenStore.loadToken('codex')
      const antigravityToken = this.enableAntigravity ? this.tokenStore.loadToken('antigravity') : null
      const grokToken = this.tokenStore.loadToken('grok')

      const isCodexConnected = Boolean(codexToken?.accessToken && (codexToken?.expiresAt ? codexToken.expiresAt > Date.now() : true))
      const isAntigravityConnected = Boolean(antigravityToken?.accessToken && (antigravityToken?.expiresAt ? antigravityToken.expiresAt > Date.now() : true))
      const isGrokConnected = Boolean(grokToken?.accessToken && (grokToken?.expiresAt ? grokToken.expiresAt > Date.now() : true))

      // 100% Dynamic Quota fetching concurrently for active providers
      const [antigravityWindows, grokWindows, codexLive] = await Promise.all([
        isAntigravityConnected && antigravityToken
          ? this.fetchAntigravityLiveQuota(antigravityToken)
          : Promise.resolve([]),
        isGrokConnected && grokToken
          ? this.fetchGrokLiveQuota(grokToken)
          : Promise.resolve([]),
        isCodexConnected && codexToken
          ? this.fetchCodexLiveQuota(codexToken)
          : Promise.resolve({ quotaWindows: [] }),
      ])

      const responsePayload: Record<string, any> = {
        codex: {
          connected: isCodexConnected,
          email: isCodexConnected ? (codexToken?.accountEmail || 'ChatGPT User') : undefined,
          plan: isCodexConnected ? (codexLive.planType || codexToken?.subscriptionTier || 'ChatGPT Plus / Pro') : undefined,
          expiresAt: codexToken?.expiresAt,
          quotaWindows: isCodexConnected && codexLive.quotaWindows.length > 0 ? codexLive.quotaWindows : undefined,
        },
        grok: {
          connected: isGrokConnected,
          email: isGrokConnected ? (grokToken?.accountEmail || 'xAI User') : undefined,
          plan: isGrokConnected ? (grokToken?.subscriptionTier || 'SuperGrok') : undefined,
          expiresAt: grokToken?.expiresAt,
          quotaWindows: isGrokConnected && grokWindows.length > 0 ? grokWindows : undefined,
        },
      }

      if (this.enableAntigravity) {
        responsePayload.antigravity = {
          connected: isAntigravityConnected,
          email: isAntigravityConnected ? (antigravityToken?.accountEmail || 'Google User') : undefined,
          plan: isAntigravityConnected ? (antigravityToken?.subscriptionTier || 'Google CloudCode PA') : undefined,
          expiresAt: antigravityToken?.expiresAt,
          quotaWindows: isAntigravityConnected && antigravityWindows.length > 0 ? antigravityWindows : undefined,
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(responsePayload))
      return
    }

    // 2. GET /oauth/login?provider=...
    if (url.pathname === '/oauth/login') {
      const provider = url.searchParams.get('provider') as OAuthProviderType
      if (!provider) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing provider query parameter' }))
        return
      }

      try {
        const authUrl = this.generateAuthorizationUrl(provider)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ authUrl }))
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
      return
    }

    // 3. POST /oauth/disconnect?provider=...
    if (url.pathname === '/oauth/disconnect') {
      const provider = url.searchParams.get('provider') as OAuthProviderType
      if (provider) {
        this.tokenStore.deleteToken(provider)
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  }

  private generateAuthorizationUrl(provider: OAuthProviderType): string {
    const verifier = crypto.randomBytes(32).toString('base64url')
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url')
    const state = crypto.randomUUID()

    this.activeSessions.set(state, { provider, verifier })

    if (provider === 'codex') {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.codexConfig.clientId,
        redirect_uri: `http://localhost:${this.codexConfig.port}${this.codexConfig.path}`,
        scope: this.codexConfig.scope,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        codex_cli_simplified_flow: 'true',
        originator: 'opencodex',
        id_token_add_organizations: 'true',
      })
      return `${this.codexConfig.authUrl}?${params.toString()}`
    }

    if (provider === 'antigravity') {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.antigravityConfig.clientId,
        redirect_uri: `http://127.0.0.1:${this.antigravityConfig.port}${this.antigravityConfig.path}`,
        scope: this.antigravityConfig.scope,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'consent select_account',
        state,
      })
      return `${this.antigravityConfig.authUrl}?${params.toString()}`
    }

    if (provider === 'grok') {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.grokConfig.clientId,
        redirect_uri: `http://127.0.0.1:${this.grokConfig.port}${this.grokConfig.path}`,
        scope: this.grokConfig.scope,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        state,
        nonce: crypto.randomUUID(),
      })
      return `${this.grokConfig.authUrl}?${params.toString()}`
    }

    throw new Error(`Unsupported provider: ${provider}`)
  }

  private async handleCallback(
    provider: OAuthProviderType,
    code: string,
    state: string,
    res: http.ServerResponse,
  ): Promise<void> {
    const session = this.activeSessions.get(state)
    const verifier = session?.verifier

    try {
      if (provider === 'codex') {
        const resp = await fetch(this.codexConfig.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.codexConfig.clientId,
            code,
            code_verifier: verifier || '',
            redirect_uri: `http://localhost:${this.codexConfig.port}${this.codexConfig.path}`,
          }),
        })

        if (!resp.ok) {
          const errText = await resp.text()
          throw new Error(`Codex token exchange failed (${resp.status}): ${errText}`)
        }

        const tokenData = await resp.json()
        let email = 'ChatGPT User'
        let accountId: string | undefined
        if (tokenData.id_token) {
          try {
            const payload = JSON.parse(Buffer.from(tokenData.id_token.split('.')[1], 'base64').toString('utf-8'))
            email = payload.email || email
            accountId = payload['https://api.openai.com/auth']?.user_id
          } catch {
            // Ignore JWT decode error
          }
        }

        this.tokenStore.saveToken('codex', {
          provider: 'codex',
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
          accountEmail: email,
          accountId,
          subscriptionTier: 'ChatGPT Plus / Pro',
          updatedAt: Date.now(),
        })
      } else if (provider === 'antigravity') {
        const resp = await fetch(this.antigravityConfig.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.antigravityConfig.clientId,
            client_secret: this.antigravityConfig.clientSecret || '',
            code,
            code_verifier: verifier || '',
            redirect_uri: `http://127.0.0.1:${this.antigravityConfig.port}${this.antigravityConfig.path}`,
          }),
        })

        if (!resp.ok) {
          const errText = await resp.text()
          throw new Error(`Google token exchange failed (${resp.status}): ${errText}`)
        }

        const tokenData = await resp.json()
        let email = 'Google User'
        if (tokenData.id_token) {
          try {
            const payload = JSON.parse(Buffer.from(tokenData.id_token.split('.')[1], 'base64').toString('utf-8'))
            email = payload.email || email
          } catch {
            // Ignore JWT parse error
          }
        }

        // Onboard project via loadCodeAssist
        let projectId = 'fourth-champion-wjjzm'
        try {
          const lca = await fetch('https://daily-cloudcode-pa.googleapis.com/v1internal:loadCodeAssist', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenData.access_token}`,
              'User-Agent': 'antigravity/cli/1.0.13 (aidev_client; os_type=darwin; arch=arm64)',
              'x-goog-api-client': 'google-api-nodejs-client/10.3.0',
            },
            body: JSON.stringify({ metadata: { ideType: 'ANTIGRAVITY' } }),
          })
          if (lca.ok) {
            const lcaData = await lca.json()
            projectId = lcaData.cloudaicompanionProject || lcaData.projectId || projectId
          }
        } catch {
          // Fallback to discovered project
        }

        this.tokenStore.saveToken('antigravity', {
          provider: 'antigravity',
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
          accountEmail: email,
          accountId: projectId,
          subscriptionTier: 'Google CloudCode PA',
          updatedAt: Date.now(),
        })
      } else if (provider === 'grok') {
        const resp = await fetch(this.grokConfig.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.grokConfig.clientId,
            code,
            code_verifier: verifier || '',
            redirect_uri: `http://127.0.0.1:${this.grokConfig.port}${this.grokConfig.path}`,
          }),
        })

        if (!resp.ok) {
          const errText = await resp.text()
          throw new Error(`xAI token exchange failed (${resp.status}): ${errText}`)
        }

        const tokenData = await resp.json()
        let email = 'xAI User'
        if (tokenData.id_token) {
          try {
            const payload = JSON.parse(Buffer.from(tokenData.id_token.split('.')[1], 'base64').toString('utf-8'))
            email = payload.email || email
          } catch {
            // Ignore JWT parse error
          }
        }

        this.tokenStore.saveToken('grok', {
          provider: 'grok',
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
          accountEmail: email,
          subscriptionTier: 'SuperGrok',
          updatedAt: Date.now(),
        })
      }

      this.activeSessions.delete(state)

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>OAuth 授权成功</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; border-radius: 12px; padding: 32px 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 420px; border: 1px solid #334155; }
            h1 { color: #10b981; margin-top: 0; font-size: 24px; }
            p { color: #94a3b8; font-size: 15px; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🎉 OAuth 授权成功！</h1>
            <p>已成功连接 ${provider.toUpperCase()} 账户。凭据已安全保存，窗口将在 2 秒后自动关闭。</p>
          </div>
          <script>
            setTimeout(() => { window.close(); }, 2000);
          </script>
        </body>
        </html>
      `)
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>OAuth 授权失败</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #1e293b; border-radius: 12px; padding: 32px 40px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; max-width: 420px; border: 1px solid #ef4444; }
            h1 { color: #ef4444; margin-top: 0; font-size: 24px; }
            p { color: #94a3b8; font-size: 14px; line-height: 1.6; word-break: break-all; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>❌ 授权失败</h1>
            <p>${err.message}</p>
          </div>
        </body>
        </html>
      `)
    }
  }
}
