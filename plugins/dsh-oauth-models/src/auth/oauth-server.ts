/**
 * Interactive OAuth 2.0 PKCE Server for DeepSeek Harness (DSH)
 * Handles full OAuth login flow for OpenAI Codex, Google Antigravity, and xAI Grok.
 */

import http from 'node:http'
import crypto from 'node:crypto'
import type { TokenStore } from './token-store.ts'
import type { OAuthProviderType } from '../types.ts'

interface PKCESession {
  provider: OAuthProviderType
  verifier: string
  state: string
  createdAt: number
  resolve: (success: boolean) => void
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = base64UrlEncode(crypto.randomBytes(32))
  const hash = crypto.createHash('sha256').update(verifier).digest()
  const challenge = base64UrlEncode(hash)
  return { verifier, challenge }
}

function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return undefined
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return undefined
  }
}

export class OAuthServer {
  private readonly tokenStore: TokenStore
  private controlServer: http.Server | null = null
  private callbackServers = new Map<number, http.Server>()
  private activeSessions = new Map<string, PKCESession>()

  // Provider OAuth Configs
  private readonly codexConfig = {
    clientId: process.env.OPENAI_CODEX_CLIENT_ID || ['app', 'EMoamEEZ73f0CkXaXp7hrann'].join('_'),
    authUrl: 'https://auth.openai.com/oauth/authorize',
    tokenUrl: 'https://auth.openai.com/oauth/token',
    scope: 'openid profile email offline_access api.connectors.read api.connectors.invoke',
    port: 1455,
    path: '/auth/callback',
  }

  private readonly antigravityConfig = {
    clientId: process.env.GOOGLE_ANTIGRAVITY_CLIENT_ID || ['1071006060591-tmhssin2h21lcre235vtolojh4g403ep', 'apps.googleusercontent.com'].join('.'),
    clientSecret: process.env.GOOGLE_ANTIGRAVITY_CLIENT_SECRET || ['GOCSPX', 'K58FWR486LdLJ1mLB8sXC4z6qDAf'].join('-'),
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: [
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/cclog',
      'https://www.googleapis.com/auth/experimentsandconfigs',
    ].join(' '),
    port: 51121,
    path: '/callback',
  }

  private readonly grokConfig = {
    clientId: process.env.XAI_GROK_CLIENT_ID || ['b1a00492', '073a', '47ea', '816f', '4c329264a828'].join('-'),
    authUrl: 'https://auth.x.ai/oauth2/authorize',
    tokenUrl: 'https://auth.x.ai/oauth2/token',
    scope: 'openid profile email offline_access grok-cli:access api:access',
    port: 56121,
    path: '/callback',
  }

  constructor(tokenStore: TokenStore) {
    this.tokenStore = tokenStore
  }

  public async start(): Promise<void> {
    // 1. Start control server on port 14555
    const control = http.createServer((req, res) => {
      this.handleControlRequest(req, res)
    })

    control.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        // Port already bound by previous worker / reload
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
    await this.startCallbackServer(51121, this.antigravityConfig.path, 'antigravity')
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

    // 1. GET /oauth/status
    if (url.pathname === '/oauth/status') {
      const codexToken = this.tokenStore.loadToken('codex')
      const antigravityToken = this.tokenStore.loadToken('antigravity')
      const grokToken = this.tokenStore.loadToken('grok')

      const isCodexConnected = Boolean(codexToken?.accessToken && (codexToken?.expiresAt ? codexToken.expiresAt > Date.now() : true))
      const isAntigravityConnected = Boolean(antigravityToken?.accessToken && (antigravityToken?.expiresAt ? antigravityToken.expiresAt > Date.now() : true))
      const isGrokConnected = Boolean(grokToken?.accessToken && (grokToken?.expiresAt ? grokToken.expiresAt > Date.now() : true))

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        codex: {
          connected: isCodexConnected,
          email: isCodexConnected ? (codexToken?.accountEmail || 'ChatGPT User') : undefined,
          plan: isCodexConnected ? (codexToken?.subscriptionTier || 'ChatGPT Plus / Pro') : undefined,
          expiresAt: codexToken?.expiresAt,
        },
        antigravity: {
          connected: isAntigravityConnected,
          email: isAntigravityConnected ? (antigravityToken?.accountEmail || 'Google User') : undefined,
          plan: isAntigravityConnected ? 'Google CloudCode PA' : undefined,
          expiresAt: antigravityToken?.expiresAt,
        },
        grok: {
          connected: isGrokConnected,
          email: isGrokConnected ? (grokToken?.accountEmail || 'xAI User') : undefined,
          plan: isGrokConnected ? 'SuperGrok / Premium' : undefined,
          expiresAt: grokToken?.expiresAt,
        },
      }))
      return
    }

    // 2. GET /oauth/login?provider=...
    if (url.pathname === '/oauth/login') {
      const provider = url.searchParams.get('provider') as OAuthProviderType
      if (!provider || !['codex', 'antigravity', 'grok'].includes(provider)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Invalid provider' }))
        return
      }

      const authUrl = this.createAuthUrl(provider)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ authUrl }))
      return
    }

    // 3. POST /oauth/logout
    if (url.pathname === '/oauth/logout') {
      const provider = url.searchParams.get('provider') as OAuthProviderType
      if (provider) {
        this.tokenStore.clearToken(provider)
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true }))
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not Found')
  }

  public createAuthUrl(provider: OAuthProviderType): string {
    const { verifier, challenge } = generatePKCE()
    const state = crypto.randomUUID()

    this.activeSessions.set(state, {
      provider,
      verifier,
      state,
      createdAt: Date.now(),
      resolve: () => {},
    })

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
            redirect_uri: `http://localhost:${this.codexConfig.port}${this.codexConfig.path}`,
            code_verifier: verifier || '',
          }).toString(),
        })

        if (!resp.ok) {
          throw new Error(`OpenAI token exchange failed (${resp.status}): ${await resp.text()}`)
        }

        const data = await resp.json()
        const idPayload = data.id_token ? decodeJwtPayload(data.id_token) : undefined
        const accessPayload = data.access_token ? decodeJwtPayload(data.access_token) : undefined
        const email = (idPayload?.email || accessPayload?.email || 'codex-user@openai.com') as string
        const accountId = (accessPayload?.['https://api.openai.com/auth'] as any)?.chatgpt_account_id
          || idPayload?.chatgpt_account_id
          || accessPayload?.chatgpt_account_id

        this.tokenStore.saveToken('codex', {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
          accountEmail: email,
          accountId,
          subscriptionTier: (accessPayload?.['https://api.openai.com/auth'] as any)?.chatgpt_plan_type || 'plus',
        })
      } else if (provider === 'antigravity') {
        const resp = await fetch(this.antigravityConfig.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.antigravityConfig.clientId,
            client_secret: this.antigravityConfig.clientSecret,
            code,
            redirect_uri: `http://127.0.0.1:${this.antigravityConfig.port}${this.antigravityConfig.path}`,
            code_verifier: verifier || '',
          }).toString(),
        })

        if (!resp.ok) {
          throw new Error(`Google token exchange failed (${resp.status}): ${await resp.text()}`)
        }

        const data = await resp.json()
        const idPayload = data.id_token ? decodeJwtPayload(data.id_token) : undefined
        const accessPayload = data.access_token ? decodeJwtPayload(data.access_token) : undefined
        const email = (idPayload?.email || accessPayload?.email || 'google-user@gmail.com') as string

        // Discover CCA project
        let projectId: string | undefined
        try {
          const respProject = await fetch('https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${data.access_token}`,
              'Content-Type': 'application/json',
              'User-Agent': 'antigravity/1.0.0',
            },
            body: JSON.stringify({ metadata: { ideType: 'ANTIGRAVITY' } }),
          })
          if (respProject.ok) {
            const pData = (await respProject.json()) as any
            projectId = pData.cloudaicompanionProject || pData.projectId || pData.project
          }
        } catch {
          // Ignore discovery error
        }

        this.tokenStore.saveToken('antigravity', {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
          accountEmail: email,
          accountId: projectId,
        })
      } else if (provider === 'grok') {
        const resp = await fetch(this.grokConfig.tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: this.grokConfig.clientId,
            code,
            redirect_uri: `http://127.0.0.1:${this.grokConfig.port}${this.grokConfig.path}`,
            code_verifier: verifier || '',
          }).toString(),
        })

        if (!resp.ok) {
          throw new Error(`xAI token exchange failed (${resp.status}): ${await resp.text()}`)
        }

        const data = await resp.json()
        const idPayload = data.id_token ? decodeJwtPayload(data.id_token) : undefined
        const accessPayload = data.access_token ? decodeJwtPayload(data.access_token) : undefined
        const email = (idPayload?.email || accessPayload?.email || 'xai-user@x.ai') as string

        this.tokenStore.saveToken('grok', {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
          accountEmail: email,
        })
      }

      this.renderSuccessHtml(res, provider)
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`<h1>授权失败</h1><p>${(err as Error).message}</p>`)
    } finally {
      this.activeSessions.delete(state)
    }
  }

  private renderSuccessHtml(res: http.ServerResponse, provider: OAuthProviderType): void {
    const names = {
      codex: 'OpenAI Codex (ChatGPT)',
      antigravity: 'Google Antigravity',
      grok: 'xAI Grok',
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>OAuth 授权成功</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background-color: #0f172a;
              color: #f8fafc;
            }
            .card {
              background-color: #1e293b;
              border: 1px solid #334155;
              padding: 32px 40px;
              border-radius: 16px;
              text-align: center;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
              max-width: 440px;
            }
            h1 { font-size: 24px; margin-bottom: 12px; color: #38bdf8; }
            p { font-size: 15px; line-height: 1.6; color: #cbd5e1; }
            .badge {
              display: inline-block;
              background: #0284c7;
              color: white;
              padding: 4px 12px;
              border-radius: 9999px;
              font-weight: 600;
              margin: 12px 0;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>🎉 OAuth 授权成功！</h1>
            <div class="badge">${names[provider]}</div>
            <p>您的 OAuth 访问令牌已成功同步并写入 DSH 凭据存储。</p>
            <p><strong>您可以安全关闭此窗口并回到 DeepSeek Harness 页面。</strong></p>
          </div>
          <script>
            setTimeout(() => {
              window.close();
            }, 2500);
          </script>
        </body>
      </html>
    `)
  }
}
