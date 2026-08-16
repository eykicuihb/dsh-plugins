# DeepSeek Harness Community Plugins (dsh-plugins)

English | [中文](README.zh.md)

A curated collection of community plugins, tool extensions, and capabilities for **DeepSeek Harness (`dsh`)**, built on the **Cordis** microkernel architecture.

---

## 🌟 Available Plugins

| Plugin | Package | Description | Status |
|---|---|---|---|
| 🔑 **OAuth Models & Subscriptions** | [`plugins/dsh-oauth-models`](./plugins/dsh-oauth-models) | OpenAI Codex (ChatGPT Plus/Pro), Google Antigravity (CloudCode PA), and xAI Grok subscriptions bridge with 100% remote dynamic model synchronization, 1-click browser PKCE login, and live WebUI management. | `v0.1.0` (Ready) |
| 👁️ **DeepIris (深瞳)** | [`plugins/dsh-deepiris`](./plugins/dsh-deepiris) | Multi-provider VLM visual understanding, high-accuracy OCR, and autonomous UI testing/inspection for DeepSeek LLMs. | `v0.1.0` (Ready) |

---

## 🚀 Quick Start Guide

### 1. Enabling Plugins in `cordis.patch.yml`

In your `~/.dsh/cordis.patch.yml` (or project config), declare the plugins:

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

- id: deepiris
  name: '@eykicuihb/dsh-deepiris'
  config:
    provider: dashscope
```

### 2. Launch DeepSeek Harness WebUI

```bash
pnpm dsh web
```

### 3. Authorize Your Subscriptions

1. Navigate to **Settings -> OAuth 订阅配额 (OAuth Subscriptions & Quotas)**.
2. Click **`🔑 OAuth 浏览器登录`** for Google Antigravity, OpenAI Codex, or xAI Grok.
3. Complete authentication in the official browser window.
4. Return to chat and select any of the dynamically synchronized models (`gemini-3.6-flash`, `gpt-5.6-sol`, `grok-4.20`, `claude-sonnet-4-6`) to begin chatting with real-time thought chains!

---

## 🛠️ Contributing

We welcome community contributions to expand the DeepSeek Harness ecosystem!

1. Fork the repository
2. Create your plugin directory under `plugins/<plugin-name>`
3. Ensure your plugin follows Cordis lifecycle discipline (`inject`, reversible effects, schema typing)
4. Submit a Pull Request

---

## 📄 License

MIT License © 2026 eykicuihb
