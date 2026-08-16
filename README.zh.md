# DeepSeek Harness 社区插件合集 (dsh-plugins)

[English](README.md) | 中文

为 **DeepSeek Harness (`dsh`)** 量身打造的高性能社区插件、工具扩展与前沿能力合集，基于 **Cordis** 微内核架构构建。

---

## 🌟 包含插件列表

| 插件名称 | 插件目录 | 功能描述 | 状态 |
|---|---|---|---|
| 🔑 **OAuth 订阅模型直连与实时额度** | [`plugins/dsh-oauth-models`](./plugins/dsh-oauth-models) | 直连 OpenAI Codex (ChatGPT Plus/Pro) 与 xAI Grok (SuperGrok) 官方订阅模型，100% 远端动态模型同步，一键浏览器 PKCE 登录，WebUI 主视窗原生 **「实时额度」** 面板。*(Google Antigravity 默认关闭，可按需开启)* | `v0.1.0` (就绪) |
| 👁️ **DeepIris (深瞳多模态视觉)** | [`plugins/dsh-deepiris`](./plugins/dsh-deepiris) | 为 DeepSeek 带来多 Provider 视觉多模态理解、高精 OCR 解析与自主 UI 页面测试/巡检能力。 | `v0.1.0` (就绪) |

---

## 🚀 快速上手指南

### 1. 在 `cordis.patch.yml` 中声明插件

在用户主目录的 `~/.dsh/cordis.patch.yml`（或项目级配置）中启用插件：

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

- id: deepiris
  name: '@eykicuihb/dsh-deepiris'
  config:
    provider: dashscope
```

### 2. 启动 DeepSeek Harness WebUI

```bash
pnpm dsh web
```

### 3. 一键授权登录与查看实时额度

1. 打开 WebUI，在顶部导航栏（**「对话」** 与 **「轨迹」** 右侧）点击 **「实时额度」** 标签页。
2. 点击对应 Provider 卡片上的 **`🔑 OAuth 浏览器登录`**（支持 OpenAI Codex 与 xAI Grok）。
3. 在弹出的官方授权页面中完成登录，凭据安全落盘并开启后台静默自动续期。
4. 页面将即刻展示来自官方 post-OAuth 接口的实时数据（如 `Weekly SuperGrok Limit (已用 3% / 剩余 97%)`、每周重置时间倒计时等）。
5. 回到对话页，在模型切换器中直接选择动态同步出的前沿推理模型（如 `gpt-5.6-sol`、`grok-4.20-0309-reasoning`、`grok-3`），享受完整思考链（Reasoning）流式输出！

---

## 🛠️ 参与贡献

欢迎提交 Issue 和 Pull Request 为 DeepSeek Harness 生态添砖加瓦！

---

## 📄 开源协议

MIT License © 2026 eykicuihb
