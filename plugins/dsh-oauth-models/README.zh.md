# @eykicuihb/dsh-oauth-models (OAuth 订阅模型与配额看板插件)

[English](README.md) | 中文

**`dsh-oauth-models`** 是专为 **DeepSeek Harness (`dsh`)** 打造的 Cordis 原生微内核插件，用于无缝桥接 **OpenAI Codex (ChatGPT Plus / Pro)**、**Google Antigravity (Gemini & Claude on CloudCode PA)** 与 **xAI Grok (SuperGrok / Premium)** 的官方 OAuth 订阅账号。

无需购买昂贵的按 Token 计费 API Key，直接复用您现有的订阅权益，具备 **100% 远端动态模型目录实时拉取**、**一键式浏览器 PKCE 交互登录**、**完整思考链流式渲染 (`reasoning-delta`)** 以及 **WebUI 订阅与配额管理看板**。

---

## 🌟 核心特性

### 1. 🔑 一键交互式 OAuth 2.0 PKCE 浏览器登录
- **内置本地 OAuth 握手服务**：全自动监听标准回调端口（1455、51121、56121），生成安全 PKCE 密钥对。
- **一键授权**：在 WebUI 设置页面点击 **`🔑 OAuth 浏览器登录`**，直接拉起 Google / OpenAI / xAI 官方授权页。
- **无感静默自动续期**：全自动后台刷新即将过期的 Access Token，长期运行永不掉线。

### 2. 🌐 100% 官方远端动态模型同步（零本地写死）
- **Google Antigravity**：登录后实时向 Google CloudCode PA 接口（`/v1internal:fetchAvailableModels`）探测并拉取最新模型：
  - `gemini-3.6-flash-high` / `gemini-3.6-flash-medium` / `gemini-3.6-flash-low`
  - `gemini-3.1-pro-high` / `gemini-3.1-flash-lite`
  - `gemini-2.5-pro` (支持思考链，100万上下文) / `gemini-2.5-flash`
  - `claude-sonnet-4-6` (深度思考) / `claude-opus-4-6-thinking`
  - `gpt-oss-120b-medium`、`gemini-3-flash` 等全部官方最新模型。
- **xAI Grok**：实时从 `https://api.x.ai/v1/models` 同步账号下可用模型：
  - `grok-4.20-0309-reasoning` / `grok-4.20-0309-non-reasoning` / `grok-4.20-multi-agent-0309`
  - `grok-4.3`、`grok-4.5`、`grok-4.6`、`grok-build-0.1` 等。
- **OpenAI Codex**：通过 ChatGPT Backend Responses 协议实时动态挂载：
  - `gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna`
  - `gpt-5.5`、`gpt-5.4`、`gpt-5.4-mini`、`codex-auto-review`。

### 3. 🧠 深度思考链流式支持 (Thinking Stream)
- 100% 遵循 DeepSeek Harness 核心 `BlockAssembler` 流式契约。
- 思考过程 (`reasoning-delta`) 与正文回答 (`text-delta`) 分离流式推送，前端实时展开折叠思考过程。
- 严格遵循多轮对话上下文规范（用户输入 `input_text` 与助手输出 `output_text` 动态序列化）。

### 4. 📊 WebUI 原生暗黑风格配额与账号管理看板
- 在 WebUI 设置中心自动注入 **OAuth 订阅配额 (OAuth Subscriptions & Quotas)** 独立标签页。
- 实时展示授权邮箱、订阅套餐等级、连接状态（`CONNECTED` / `UNAUTHORIZED`）、手动刷新与一键注销。

---

## 📦 安装与配置使用

### 1. 在 `cordis.patch.yml` 中启用插件

在 `~/.dsh/cordis.patch.yml` 或项目的配置文件中声明：

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
```

### 2. 启动 DeepSeek Harness WebUI

```bash
pnpm dsh web
```

### 3. 进行 OAuth 账号授权

1. 浏览器打开 WebUI 页面（默认 `http://localhost:5173`）。
2. 点击左侧导航栏 **Settings (设置)** -> **OAuth 订阅配额 (OAuth Subscriptions & Quotas)**。
3. 在对应卡片（OpenAI Codex / Google Antigravity / xAI Grok）上点击 **`🔑 OAuth 浏览器登录`**。
4. 浏览器会弹出官方登录窗口，登录并同意授权后窗口自动关闭，DSH 即刻显示 `CONNECTED` 并动态列出最新模型列表。

### 4. 选择模型开始对话

在主界面的模型选择下拉菜单或 CLI 中自由切换任意同步出的最新模型：

```bash
# 通过 CLI 使用 Google Antigravity 模型
dsh --provider antigravity --model gemini-3.6-flash-high

# 通过 CLI 使用 OpenAI Codex 模型
dsh --provider codex --model gpt-5.6-sol

# 通过 CLI 使用 xAI Grok 模型
dsh --provider grok --model grok-4.20-0309-reasoning
```

---

## 🔒 安全说明

- 凭据安全保存在本机 `~/.dsh/oauth/<provider>.json` 中。
- 绝不经过任何第三方转发或跳板服务器，所有请求均直连各厂商官方端点。

---

## 📄 开源协议

MIT License © 2026 eykicuihb
