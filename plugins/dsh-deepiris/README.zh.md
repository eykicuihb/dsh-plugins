# @eykicuihb/dsh-deepiris (DeepIris 深瞳视觉感知插件)

[English](README.md) | 中文

**DeepIris（深瞳）** 是为 **DeepSeek Harness (`dsh`)** 打造的多提供商视觉感知与自主视觉检验插件。

它为以纯文本/代码推理见长的 DeepSeek 模型配备外部“视觉感知传感器”，并注入感知心智，使模型能够在自主主导的开发闭环中（如 UI 调整、数据制图、架构图逆向、网页截图质检、报错弹窗 OCR 等）调用 `view_image` 进行视觉观察与自我纠错。

---

## 核心特性

- **一切皆插件**：完全遵循 Cordis 规范，通过可逆副作用挂载到 `ctx.tools`、`ctx.systemPrompt` 与 `ctx.settings`。
- **多提供商全面支持**：
  - **阿里云通义千问 (DashScope)**：`qwen2.5-vl-72b-instruct` / `qwen-vl-max`
  - **智谱清言 (Zhipu AI)**：`glm-4v-plus`
  - **OpenAI**：`gpt-4o`, `gpt-4o-mini`
  - **Anthropic**：`claude-3-5-sonnet`, `claude-3-5-haiku`
  - **Google Gemini**：`gemini-2.0-flash`, `gemini-1.5-pro`
  - **Ollama 本地模型**：100% 纯离线环境 (`qwen2.5-vl:latest`, `llava:latest`)
  - **自定义端点 & OpenCode Go**：任何兼容 OpenAI 视觉协议的端点（如 `https://api.opencode.ai/v1`、vLLM、SGLang、LiteLLM 等）
- **自主感知心智**：注入系统级能力指引，引导模型在编写 UI、图表代码后，自主截屏并调用 `view_image` 检验视觉呈现，形成“行动-观察-纠错”闭环。
- **WebUI 设置卡片**：提供完整的设置面板组件，与本地凭据库（`ctx.credentials`）打通，支持中英文双语和动态热更新。

---

## 安装与配置

### 1. 在 `cordis.patch.yml` 中启用

在你的 `~/.dsh/cordis.patch.yml` 或项目配置文件中添加：

```yaml
- id: deepiris
  name: '@eykicuihb/dsh-deepiris'
  config:
    provider: dashscope # dashscope | zhipu | openai | anthropic | gemini | ollama | custom | opencode
    model: qwen2.5-vl-72b-instruct
```

### 2. 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `provider` | `string` | `'dashscope'` | 提供商预设（`dashscope`, `zhipu`, `openai`, `anthropic`, `gemini`, `ollama`, `custom`, `opencode` 等） |
| `model` | `string` | `''` | 自定义视觉模型名（留空则自动选用该 Provider 的推荐模型） |
| `baseURL` | `string` | `''` | 自定义 API Base URL |
| `apiKey` | `string` | `''` | 直接填写的 API Key (可选；推荐在 WebUI 凭据库中配置) |
| `apiKeyEnv` | `string` | `''` | 读取 API Key 的环境变量名称 |
| `timeoutMs` | `number` | `60000` | 单次视觉调用超时时间（毫秒） |

---

## 工具：`view_image`

插件激活后，Agent 会获得 `view_image` 工具：

- **参数**：
  - `path` (*string, 必填*)：图片文件路径（支持工作区相对路径或绝对路径）。
  - `prompt` (*string, 选填*)：希望视觉模型核查的具体事项（如：“检查按钮是否居中”、“提取该错误截图中的调用栈文字”）。

### 模型调用示例：
```text
用户：“请帮我查看项目里的 test.png，看看按钮样式是否正确。”
DeepSeek 调用：view_image({ path: "test.png", prompt: "检查按钮对齐与颜色样式" })
DeepIris 返回：[DeepIris Observation (dashscope/qwen2.5-vl-72b-instruct) of test.png]: ...
```

---

## 开源协议

MIT License © 2026 eykicuihb
