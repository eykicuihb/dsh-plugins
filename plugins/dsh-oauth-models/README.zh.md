# @eykicuihb/dsh-oauth-models (OAuth 订阅模型与实时额度看板插件)

[English](README.md) | 中文

**`dsh-oauth-models`** 是专为 **DeepSeek Harness (`dsh`)** 打造的 Cordis 原生插件，无缝接入 **OpenAI Codex**、**Google Antigravity (Gemini CloudCode PA)** 和 **xAI Grok** 三大 OAuth 订阅模型。

无需为单次 Token 购买昂贵的 API Key，直接使用个人或团队现有的订阅账号（ChatGPT Plus/Team、Google CloudCode Pro、SuperGrok），并具备**静默自动续期**、**高保真思考链输出 (Reasoning Delta)** 以及 **WebUI 实时额度/限额看板**。

---

## 🌟 核心特性

- **三大顶级 OAuth 订阅源支持**：
  - **OpenAI Codex**：`gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini`, `gpt-4.5-preview`, `codex`
  - **Google Antigravity**：`gemini-2.5-pro` (思考链), `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-exp`
  - **xAI Grok**：`grok-3` (深度思考), `grok-3-mini`, `grok-2-vision`, `grok-beta`
- **本地凭据保险库与静默自动续期**：
  - 自动在 Token 即将过期前（可配置前置时间）通过 `refreshToken` 换取最新令牌，保证长任务和深夜无人值守开发绝不中断。
- **思考链流式支持 (Reasoning Stream)**：
  - 完美适配 `dsh-llm` 规范，实时向上层渲染 o1、o3-mini、Gemini 2.5 和 Grok-3 的推理思维链。
- **WebUI 实时额度与限额看板**：
  - 在 Web 界面 **设置 -> 插件** 中注册专属 **OAuth 订阅与实时额度** Tab。
  - 实时展示 5小时/滚动窗口剩余请求数（如 42/50 条）、Token 消耗进度条、RPM/TPM 限额水位与 Token 有效期倒计时。

---

## 🚀 安装与配置

### 1. 在 `cordis.patch.yml` 中挂载

在你的 `~/.dsh/cordis.patch.yml` 或项目配置文件中声明：

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

### 2. 在命令行中使用

配置后，可在 CLI 或 WebUI 模型选择器中直接调用：

```bash
# 调用 OpenAI o1
dsh --provider codex --model o1

# 调用 Gemini 2.5 Pro (带思考链)
dsh --provider antigravity --model gemini-2.5-pro

# 调用 xAI Grok-3
dsh --provider grok --model grok-3
```

---

## 📊 WebUI 额度监控面板

打开 WebUI **设置 -> 插件 -> OAuth 订阅与实时额度**：
- 查看各提供商的连接状态（🟢 已连接 / 🟡 自动续期中 / 🔴 Token 已过期）；
- 监控当前时间窗口内的剩余请求数与重置倒计时；
- 点击 **[刷新额度]** 或 **[登录/重新授权]**。

---

## 开源协议

MIT License © 2026 eykicuihb
