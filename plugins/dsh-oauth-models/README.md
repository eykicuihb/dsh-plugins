# @eykicuihb/dsh-oauth-models (OAuth Subscription Models & Live Quota Dashboard)

English | [中文](README.zh.md)

**`dsh-oauth-models`** is a high-performance Cordis-native plugin for **DeepSeek Harness (`dsh`)** that bridges **OpenAI Codex (ChatGPT Plus / Pro)** and **xAI Grok (SuperGrok / Premium)** OAuth subscriptions directly into your harness runtime. *(Google Antigravity is optionally supported and disabled by default)*.

It allows you to use your existing subscription accounts seamlessly without per-token API costs, featuring **100% remote dynamic model synchronization**, **one-click browser PKCE authorization**, **real-time reasoning / thought chain streaming (`reasoning-delta`)**, and a **Live Quota & Account Management Tab** in the WebUI.

---

## 🌟 Key Features

### 1. 🔑 1-Click Interactive PKCE OAuth Login
- **Built-in Local OAuth Bridge**: Runs a lightweight PKCE server handling official OAuth 2.0 authorization code flows on standard provider callback ports.
- **One-Click Browser Authorization**: Simply click **`🔑 OAuth 浏览器登录`** in the WebUI to open the official OpenAI or xAI authorization page.
- **Silent Auto-Refresh Vault**: Token expiration timestamps are continuously monitored and automatically refreshed in the background without session interruption.

### 2. 🌐 100% Live Remote Model Synchronization (Zero Hardcoding)
- **xAI Grok**: Dynamically syncs all available models from `https://api.x.ai/v1/models`:
  - `grok-4.20-0309-reasoning` / `grok-4.20-0309-non-reasoning` / `grok-4.20-multi-agent-0309`
  - `grok-4.3`, `grok-4.5`, `grok-3`, `grok-build-0.1`, etc.
- **OpenAI Codex**: Dynamically syncs from active Codex OAuth session catalog via ChatGPT Responses API:
  - `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`
  - `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `codex-auto-review`.
- **Google Antigravity (Optional)**: When enabled, dynamically queries Google CloudCode PA (`/v1internal:fetchAvailableModels`) for Gemini & Claude models.

### 3. 📊 100% Live Remote Quota & Rate Limit Fetching
- **xAI Grok**: Direct integration with `https://cli-chat-proxy.grok.com/v1/billing?format=credits` fetching live `creditUsagePercent` (e.g. `3% used / 97% remaining`) and exact weekly reset timestamps.
- **OpenAI Codex**: Direct integration with `https://chatgpt.com/backend-api/wham/usage` fetching live `used_percent` (e.g. `55% used / 45% remaining`) and weekly rolling windows.
- **Google Antigravity (Optional)**: Queries Gemini 5-hour rolling bucket and Claude weekly bucket from CloudCode PA.

### 4. 🧠 Deep Thinking & Reasoning Stream Support
- Conforms 100% to DeepSeek Harness `BlockAssembler` chunk contracts.
- Transmits raw reasoning / thought deltas (`reasoning-delta`) alongside content deltas (`text-delta`), enabling real-time visual thinking blocks in the UI.

### 5. 🎨 Native WebUI Live Quota Tab
- Injected right next to **「对话 (Chat)」** and **「轨迹 (Trajectory)」** via the `conversation.view` slot.
- Clean dark-theme cards with horizontal pill progress bars and live countdowns.

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
      grok:
        enabled: true
      antigravity:
        enabled: false # Google Antigravity (disabled by default)
```

### 2. Launch DeepSeek Harness WebUI

```bash
pnpm dsh web
```

### 3. Complete OAuth Authorization

1. Open the WebUI in your browser (`http://localhost:5173` or your configured port).
2. Go to the **「实时额度 (Live Quota)」** tab next to Chat & Trajectory.
3. Click **`🔑 OAuth 浏览器登录`** on the provider card (OpenAI Codex or xAI Grok).
4. Authorize in the browser popup window. The credentials will be saved, quota meters updated, and model catalogs populated dynamically.

### 4. Chatting with OAuth Models

Select any dynamically synchronized model from the model switcher in the chat interface or CLI:

```bash
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
