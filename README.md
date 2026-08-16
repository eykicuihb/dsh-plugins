# DeepSeek Harness Community Plugins (dsh-plugins)

English | [中文](README.zh.md)

A curated collection of community plugins, tool extensions, and capabilities for **DeepSeek Harness (`dsh`)**, built on the **Cordis** microkernel architecture.

---

## Available Plugins

| Plugin | Package | Description | Status |
|---|---|---|---|
| 👁️ **DeepIris (深瞳)** | [`plugins/dsh-deepiris`](./plugins/dsh-deepiris) | Multi-provider VLM visual understanding, OCR, and autonomous UI testing/inspection for DeepSeek LLMs. | `v0.1.0` (Ready) |
| 🔑 **OAuth Models & Quota** | [`plugins/dsh-oauth-models`](./plugins/dsh-oauth-models) | OpenAI Codex, Google Antigravity, and xAI Grok OAuth subscriptions bridge with live WebUI Quota Dashboard. | `v0.1.0` (Ready) |

---

## Getting Started

### 1. Installation

To install plugins into your DeepSeek Harness environment:

```bash
# Install DeepIris
pnpm add @eykicuihb/dsh-deepiris

# Install OAuth Models
pnpm add @eykicuihb/dsh-oauth-models
```

### 2. Enabling Plugins in `cordis.patch.yml`

```yaml
- id: deepiris
  name: '@eykicuihb/dsh-deepiris'
  config:
    provider: dashscope

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

---

## Contributing

We welcome community contributions to expand the DeepSeek Harness ecosystem!

1. Fork the repository
2. Create your plugin directory under `plugins/<plugin-name>`
3. Ensure your plugin follows Cordis lifecycle discipline (`inject`, reversible effects, schema typing)
4. Submit a Pull Request

---

## License

MIT License © 2026 eykicuihb
