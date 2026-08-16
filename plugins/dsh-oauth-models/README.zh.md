# @eykicuihb/dsh-oauth-models (OAuth 订阅模型直连与实时额度面板)

[English](README.md) | 中文

**`dsh-oauth-models`** 是专为 **DeepSeek Harness (`dsh`)** 打造的高性能 Cordis 原生插件，可将您的 **OpenAI Codex (ChatGPT Plus / Pro)** 与 **xAI Grok (SuperGrok / Premium)** 官方订阅无缝接入 Harness 运行时。*(Google Antigravity 默认关闭，可按需开启)*。

零 API 额外费用，支持 **100% 远端动态模型目录同步**、**一键浏览器 PKCE 授权登录**、**思考链深度推理流（`reasoning-delta`）实时输出**，并在 WebUI 主视窗注入原生的 **「实时额度」** 导航面板。

---

## 🌟 核心特性

### 1. 🔑 一键交互式 PKCE OAuth 浏览器登录
- **内置轻量 PKCE 服务**：在本地标准回调端口上处理各官方 OAuth 2.0 授权码流。
- **一键浏览器授权**：在 WebUI 中点击 **`🔑 OAuth 浏览器登录`** 即可调起官方 OpenAI / xAI 授权页。
- **静默自动续期**：持续监控 Token 过期倒计时并在后台静默刷新，会话调用永不断连。

### 2. 🌐 100% 远端动态模型目录同步（零硬编码）
- **xAI Grok**：直连 `https://api.x.ai/v1/models` 获取最新模型：
  - `grok-4.20-0309-reasoning` / `grok-4.20-0309-non-reasoning` / `grok-4.20-multi-agent-0309`
  - `grok-4.3`, `grok-4.5`, `grok-3`, `grok-build-0.1` 等。
- **OpenAI Codex**：直连 ChatGPT Responses API 获取最新模型：
  - `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`
  - `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `codex-auto-review`。
- **Google Antigravity（可选）**：开启后直连 Google CloudCode PA (`/v1internal:fetchAvailableModels`) 动态拉取 Gemini 与 Claude 模型。

### 3. 📊 100% 官方 post-OAuth 远端真实额度接口直连
- **xAI Grok**：直连 `https://cli-chat-proxy.grok.com/v1/billing?format=credits` 抓取真实 `creditUsagePercent`（如 `已用 3% / 剩余 97%`）与每周重置时间。
- **OpenAI Codex**：直连 `https://chatgpt.com/backend-api/wham/usage` 抓取真实 `used_percent`（如 `已用 55% / 剩余 45%`）与每周滚动重置时间。
- **Google Antigravity（可选）**：直接区分并计算 Gemini 5小时周期配额与 Claude 独立配额。

### 4. 🧠 完整深度思考链（Reasoning）流式输出
- 100% 兼容 DeepSeek Harness 的 `BlockAssembler` 分块协议。
- 同步传输 `reasoning-delta` 与 `text-delta`，在 WebUI 中完美呈现可折叠的实时思考过程。

### 5. 🎨 原生 WebUI「实时额度」主导航 Tab
- 通过 `conversation.view` 插槽挂载在顶部导航栏（并列于 **「对话」** 与 **「轨迹」** 右侧）。
- 采用深色胶囊进度条与倒计时设计，实时掌控各大订阅配额。

---

## 📦 安装与配置

### 1. 在 `cordis.patch.yml` 中声明插件

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
        enabled: false # Google Antigravity (默认关闭)
```

### 2. 启动 DeepSeek Harness WebUI

```bash
pnpm dsh web
```

### 3. 完成 OAuth 授权

1. 打开 WebUI，切换至顶部 **「实时额度」** Tab。
2. 点击对应 Provider 卡片上的 **`🔑 OAuth 浏览器登录`**。
3. 在弹出的浏览器窗口中确认授权，凭据自动加密保存，模型列表与配额进度条即刻自动刷新。

### 4. 调用 OAuth 模型对话

在 WebUI 下拉模型列表或 CLI 中直接指定模型名称：

```bash
# 命令行调用 OpenAI Codex 模型
dsh --provider codex --model gpt-5.6-sol

# 命令行调用 xAI Grok 模型
dsh --provider grok --model grok-4.20-0309-reasoning
```

---

## 🔒 凭据安全

- Token 凭据加密保存在本地 `~/.dsh/oauth/<provider>.json`。
- 不经过任何第三方代理服务，所有请求均为本机与官方 API 直接通信。

---

## 📄 开源协议

MIT License © 2026 eykicuihb
