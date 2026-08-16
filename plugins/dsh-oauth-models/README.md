# @eykicuihb/dsh-oauth-models (OAuth Subscription Models & Live Quota Dashboard)

English | [中文](README.zh.md)

**`dsh-oauth-models`** is a Cordis-native plugin for **DeepSeek Harness (`dsh`)** that bridges **OpenAI Codex**, **Google Antigravity (Gemini CloudCode PA)**, and **xAI Grok** OAuth subscriptions into your harness.

It allows you to use your existing subscription accounts (ChatGPT Plus/Team, Google CloudCode Pro, SuperGrok) directly without paying per-token API keys, complete with silent auto-refresh, reasoning token streaming (o1, o3-mini, Gemini 2.5 thinking, Grok-3), and a **Live Quota & Rate Limit Dashboard Tab** in the WebUI.

---

## Key Features

- **3 Major OAuth Providers Supported**:
  - **OpenAI Codex**: `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini`, `gpt-4.5-preview`, `codex`
  - **Google Antigravity**: `gemini-2.5-pro` (Thinking), `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-exp`
  - **xAI Grok**: `grok-3` (Reasoning), `grok-3-mini`, `grok-2-vision`, `grok-beta`
- **Silent Auto-Refresh Token Vault**:
  - Automatically refreshes `accessToken` using `refreshToken` before expiration.
  - Zero session interruption.
- **Reasoning Stream Support**:
  - Transmits full thought chains (`reasoning-delta`) to the agent and UI.
- **WebUI Live Quota Dashboard**:
  - Registers a dedicated **OAuth Subscriptions & Quotas** tab in the WebUI Settings.
  - Displays remaining requests (e.g. 42/50), sliding window reset timers, TPM/RPM limits, and one-click refresh/re-auth actions.

---

## Installation & Setup

### 1. In `cordis.patch.yml`

Add the plugin to your `~/.dsh/cordis.patch.yml` or project configuration:

```yaml
- id: oauth-models
  name: '@eykicuihb/dsh-oauth-models'
  config:
    providers:
      codex:
        enabled: true
        defaultModel: o3-mini
      antigravity:
        enabled: true
        defaultModel: gemini-2.5-pro
      grok:
        enabled: true
        defaultModel: grok-3
    quotaPollIntervalMs: 120000
```

### 2. Using the Models in `dsh`

Once active, the models are immediately selectable from the WebUI model picker or CLI:

```bash
# Example selecting OpenAI o1 via Codex OAuth
dsh --provider codex --model o1

# Example selecting Gemini 2.5 Pro via Antigravity OAuth
dsh --provider antigravity --model gemini-2.5-pro

# Example selecting Grok-3 via Grok OAuth
dsh --provider grok --model grok-3
```

---

## WebUI Quota Dashboard

Navigate to **Settings -> Plugins -> OAuth Subscriptions & Quotas**:
- View live percentage meters for remaining requests in the active window.
- Monitor token throughput and rate limits (RPM / TPM).
- Trigger manual quota refreshes or re-authenticate accounts.

---

## License

MIT License © 2026 eykicuihb
