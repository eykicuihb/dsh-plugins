# DeepSeek Harness Community Plugins (dsh-plugins)

English | [中文](README.zh.md)

A curated collection of community plugins, tool extensions, and capabilities for **DeepSeek Harness (`dsh`)**, built on the **Cordis** microkernel architecture.

---

## Available Plugins

| Plugin | Package | Description | Status |
|---|---|---|---|
| 👁️ **DeepIris (深瞳)** | [`plugins/dsh-deepiris`](./plugins/dsh-deepiris) | Multi-provider VLM visual understanding, OCR, and autonomous UI testing/inspection for DeepSeek LLMs. | `v0.1.0` (Ready) |

---

## Getting Started

### 1. Installation

To install plugins into your DeepSeek Harness environment:

```bash
# In your DeepSeek Harness project or workspace:
pnpm add @eykicuihb/dsh-deepiris
```

### 2. Enabling Plugins in `cordis.patch.yml`

Plugins in `dsh` are declared and mounted through `cordis.patch.yml` or your profile configuration:

```yaml
- id: deepiris
  name: '@eykicuihb/dsh-deepiris'
  config:
    provider: dashscope # dashscope | zhipu | openai | anthropic | gemini | ollama | custom | opencode
    model: qwen2.5-vl-72b-instruct
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
