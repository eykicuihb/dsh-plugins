# @eykicuihb/dsh-deepiris (DeepIris Vision Perception Plugin)

English | [中文](README.zh.md)

**DeepIris** is a multi-provider visual perception and autonomous inspection plugin for **DeepSeek Harness (`dsh`)**.

It equips text/code reasoning LLMs (such as DeepSeek-V3, DeepSeek-R1, and DeepSeek-V4) with external "visual eyes" and autonomous inspection awareness, allowing the agent to inspect local images, screenshots, UI layouts, diagrams, charts, and error dialogs using external Vision-Language Models (VLMs).

---

## Features

- **Cordis Native Architecture**: Fully compliant with the Cordis microkernel model, injecting capabilities reversibly via `ctx.tools`, `ctx.systemPrompt`, and `ctx.settings`.
- **Multi-Provider VLM Support**:
  - **Alibaba DashScope**: `qwen2.5-vl-72b-instruct` / `qwen-vl-max`
  - **Zhipu AI**: `glm-4v-plus`
  - **OpenAI**: `gpt-4o`, `gpt-4o-mini`
  - **Anthropic**: `claude-3-5-sonnet`, `claude-3-5-haiku`
  - **Google Gemini**: `gemini-2.0-flash`, `gemini-1.5-pro`
  - **Ollama**: 100% offline local vision models (`qwen2.5-vl:latest`, `llava:latest`)
  - **Custom & OpenCode Go**: Any OpenAI-compatible multimodal endpoint (`https://api.opencode.ai/v1`, vLLM, SGLang, LiteLLM)
- **Autonomous Vision Mindset**: Injects system guidance prompting the model to render UI artifacts (e.g. Playwright/Puppeteer screenshots or Matplotlib charts), inspect visual deliverables with `view_image`, and iteratively fix bugs until visual quality standards are met.
- **WebUI Configuration Card**: Includes an interactive settings card in the WebUI Settings panel with local credential vault encryption and bilingual (English/Chinese) support.

---

## Installation & Configuration

### 1. Enable in `cordis.patch.yml`

Add the plugin to your `~/.dsh/cordis.patch.yml` or project configuration:

```yaml
- id: deepiris
  name: '@eykicuihb/dsh-deepiris'
  config:
    provider: dashscope # dashscope | zhipu | openai | anthropic | gemini | ollama | custom
    model: qwen2.5-vl-72b-instruct
    # apiKeyEnv: DASHSCOPE_API_KEY # optional env var override
```

### 2. Configuration Options

| Option | Type | Default | Description |
|---|---|---|---|
| `provider` | `string` | `'dashscope'` | Vision provider preset name (`dashscope`, `zhipu`, `openai`, `anthropic`, `gemini`, `ollama`, `custom`, `opencode`, etc.) |
| `model` | `string` | `''` | Custom VLM model name (leave blank to use the provider default) |
| `baseURL` | `string` | `''` | Custom API endpoint Base URL |
| `apiKey` | `string` | `''` | Direct API key (optional; WebUI credentials vault is recommended) |
| `apiKeyEnv` | `string` | `''` | Environment variable name to resolve API key from |
| `timeoutMs` | `number` | `60000` | Single request timeout in milliseconds |

---

## Tool: `view_image`

When DeepIris is active, the agent gains the `view_image` tool:

- **Parameters**:
  - `path` (*string, required*): Path to the image file (relative to workspace root or absolute path).
  - `prompt` (*string, optional*): Specific visual inspection focus (e.g., *"Check if the submit button is centered"*, *"Extract the error stack trace from this screenshot"*).

### Example Agent Usage:
```text
User: "Please check test.png in the project and inspect the button styling."
Agent calls: view_image({ path: "test.png", prompt: "Inspect button styling and centering" })
DeepIris response: [DeepIris Observation (dashscope/qwen2.5-vl-72b-instruct) of test.png]: ...
```

---

## License

MIT License © 2026 eykicuihb
