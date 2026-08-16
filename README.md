# DeepSeek Harness Community Plugins (dsh-plugins)

English | [中文](README.zh.md)

A curated collection of community plugins, tool extensions, and capabilities for **DeepSeek Harness (`dsh`)**, built on the **Cordis** microkernel architecture.

---

## 🌟 Available Plugins

| Plugin | Package | Description | Status |
|---|---|---|---|
| 🔑 **OAuth Models & Subscriptions** | [`plugins/dsh-oauth-models`](./plugins/dsh-oauth-models) | OpenAI Codex (ChatGPT Plus/Pro) and xAI Grok subscriptions bridge with 100% remote dynamic model synchronization, 1-click browser PKCE login, and native **Live Quota (实时额度)** navigation tab in WebUI. *(Google Antigravity is optionally supported & disabled by default)*. | `v0.1.0` (Ready) |
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
      grok:
        enabled: true
      antigravity:
        enabled: false # Google Antigravity (disabled by default)

- id: deepiris
  name: '@eykicuihb/dsh-deepiris'
  config:
    provider: dashscope
```

### 2. Launch DeepSeek Harness WebUI

```bash
pnpm dsh web
```

### 3. Authorize Your Subscriptions & View Live Quotas

1. In the WebUI, click the **「实时额度 (Live Quota)」** tab right next to **「对话 (Chat)」** and **「轨迹 (Trajectory)」**.
2. Click **`🔑 OAuth 浏览器登录`** on the provider card (OpenAI Codex or xAI Grok).
3. Complete authentication in the official browser popup window.
4. The card will immediately reflect your live subscription tier, weekly usage limit (e.g. `Weekly SuperGrok Limit (3% used / 97% remaining)`), and exact reset countdown timer.
5. Return to chat and select any dynamically synchronized model (`gpt-5.6-sol`, `grok-4.20-0309-reasoning`, `grok-3`) with full thought chain streaming!

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
