# DeepSeek Harness 社区插件合集 (dsh-plugins)

[English](README.md) | 中文

面向 **DeepSeek Harness (`dsh`)** 与 **Cordis** 微内核架构的社区插件与能力扩展精选合集。

---

## 🌟 插件列表

| 插件名称 | 目录 / 包名 | 描述 | 状态 |
|---|---|---|---|
| 🔑 **OAuth Models & Subscriptions** | [`plugins/dsh-oauth-models`](./plugins/dsh-oauth-models) | OpenAI Codex (ChatGPT Plus/Pro)、Google Antigravity (CloudCode PA) 与 xAI Grok 官方订阅直连插件。支持 100% 远端动态模型同步、一键浏览器 PKCE 登录与 WebUI 配额看板。 | `v0.1.0` (就绪) |
| 👁️ **DeepIris (深瞳)** | [`plugins/dsh-deepiris`](./plugins/dsh-deepiris) | 为 DeepSeek 提供多 Provider VLM 视觉感知、高精度 OCR 识别与自主 UI 闭环质检能力。 | `v0.1.0` (就绪) |

---

## 🚀 快速上手

### 1. 在 `cordis.patch.yml` 中声明挂载插件

在 `~/.dsh/cordis.patch.yml` 或你的配置文件中加入：

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

### 2. 启动 DeepSeek Harness WebUI

```bash
pnpm dsh web
```

### 3. 进行 OAuth 账号授权

1. 在 WebUI 设置中心打开 **OAuth 订阅配额 (OAuth Subscriptions & Quotas)**；
2. 在对应厂商卡片点击 **`🔑 OAuth 浏览器登录`**；
3. 在弹出的浏览器窗口中完成 Google、OpenAI 或 xAI 官方授权；
4. 授权成功后返回对话界面，即可在模型列表中直接选择动态同步到的最新模型（如 `gemini-3.6-flash`、`gpt-5.6-sol`、`grok-4.20`、`claude-sonnet-4-6` 等）并开始带有思考链的顺畅对话！

---

## 🛠️ 贡献指南

欢迎社区开发者为 DeepSeek Harness 生态贡献更多实用插件！

1. Fork 本仓库并 Clone 到本地；
2. 在 `plugins/<你的插件名>` 目录下开发插件；
3. 确保遵循 Cordis 插件规范（声明 `inject` 依赖、可逆生命周期 Disposer、严格配置 Schema 校验）；
4. 提交 Pull Request。

---

## 📄 开源协议

MIT License © 2026 eykicuihb
