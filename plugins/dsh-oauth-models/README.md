# @eykicuihb/dsh-oauth-models (OAuth Subscription Models & Live Quota Dashboard)

English | [中文](README.zh.md)

**`dsh-oauth-models`** is a high-performance Cordis-native plugin for **DeepSeek Harness (`dsh`)** that bridges **OpenAI Codex (ChatGPT Plus / Pro)**, **Google Antigravity (Gemini & Claude on CloudCode PA)**, and **xAI Grok (SuperGrok / Premium)** OAuth subscriptions directly into your harness runtime.

It allows you to use your existing subscription accounts seamlessly without per-token API costs, featuring **100% remote dynamic model synchronization**, **one-click browser PKCE authorization**, **real-time reasoning / thought chain streaming (`reasoning-delta`)**, and a **Live Quota & Account Management Dashboard** in the WebUI.

---

## 🌟 Key Features

### 1. 🔑 1-Click Interactive PKCE OAuth Login
- **Built-in Local OAuth Bridge**: Runs a lightweight PKCE server handling official OAuth 2.0 authorization code flows on standard provider callback ports.
- **One-Click Browser Authorization**: Simply click **`🔑 OAuth 浏览器登录`** in the WebUI Settings tab to open the official Google, OpenAI, or xAI authorization page.
- **Silent Auto-Refresh Vault**: Token expiration timestamps are continuously monitored and automatically refreshed in the background without session interruption.

### 2. 🌐 100% Live Remote Model Synchronization (No Hardcoding)
- **Google Antigravity**: Dynamically queries Google CloudCode PA (`/v1internal:fetchAvailableModels`) upon authentication to populate real available models:
  - `gemini-3.6-flash-high` / `gemini-3.6-flash-medium` / `gemini-3.6-flash-low`
  - `gemini-3.1-pro-high` / `gemini-3.1-flash-lite`
  - `gemini-2.5-pro` (Reasoning & 1M context) / `gemini-2.5-flash`
  - `claude-sonnet-4-6` (Reasoning) / `claude-opus-4-6-thinking`
  - `gpt-oss-120b-medium`, `gemini-3-flash`, and more.
- **xAI Grok**: Dynamically syncs all available models from `https://api.x.ai/v1/models`:
  - `grok-4.20-0309-reasoning` / `grok-4.20-0309-non-reasoning` / `grok-4.20-multi-agent-0309`
  - `grok-4.3`, `grok-4.5`, `grok-4.6`, `grok-build-0.1`, etc.
- **OpenAI Codex**: Dynamically syncs from active Codex OAuth session catalog via ChatGPT Responses API:
  - `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`
  - `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `codex-auto-review`.

### 3. 🧠 Deep Thinking & Reasoning Stream Support
- Conforms 100% to DeepSeek Harness `BlockAssembler` chunk contracts.
- Transmits raw reasoning / thought deltas (`reasoning-delta`) alongside content deltas (`text-delta`), enabling real-time visual thinking blocks in the UI.

### 4. 📊 Live OAuth Status & Management Dashboard
- Registers a dedicated **OAuth 订阅配额 (OAuth Subscriptions & Quotas)** tab in WebUI Settings.
- Clean dark-theme cards indicating exact account email, plan tier, real-time connection status (`CONNECTED` / `UNAUTHORIZED`), manual refresh, and one-click disconnection.

---

## 📦 Installation & Setup

### 1. Enable Plugin in `cordis.patch.yml`

Add the plugin to your `~/.dsh/cordis.patch.yml` (or your project configuration):

```yaml
- id: oauth-models
  name: '@eykicuihb/dsh-oauth-models'
  config:
    providers:
      codex:
        enabled: true
      antigravity:
        enabled: true
      grok:
        enabled: true
```

### 2. Launch DeepSeek Harness WebUI

```bash
pnpm dsh web
```

### 3. Complete OAuth Authorization

1. Open the WebUI in your browser (`http://localhost:5173` or your configured port).
2. Go to **Settings (设置)** -> **OAuth 订阅配额 (OAuth Subscriptions & Quotas)**.
3. Click **`🔑 OAuth 浏览器登录`** on the provider card (OpenAI Codex, Google Antigravity, or xAI Grok).
4. Authorize in the browser popup window. The credentials will be saved and the model list will automatically refresh.

### 4. Chatting with OAuth Models

Select any dynamically synchronized model from the model switcher in the chat interface or CLI:

```bash
# Example selecting Google Antigravity model via CLI
dsh --provider antigravity --model gemini-3.6-flash-high

# Example selecting OpenAI Codex model via CLI
dsh --provider codex --model gpt-5.6-sol

# Example selecting xAI Grok model via CLI
dsh --provider grok --model grok-4.20-0309-reasoning
```

---

## 🔒 Credential Security

- Token credentials are encrypted and stored locally in `~/.dsh/oauth/<provider>.json`.
- OAuth client IDs and endpoints use verified official OpenID discovery standards.
- No third-party servers or external proxies are involved; all token exchanges and model requests communicate directly between your machine and official provider endpoints.

---

## 📄 License

MIT License © 2026 eykicuihb
