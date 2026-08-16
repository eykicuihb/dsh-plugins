# DeepSeek Harness 社区插件合集 (dsh-plugins)

[English](README.md) | 中文

面向 **DeepSeek Harness (`dsh`)** 与 **Cordis** 微内核架构的社区插件与能力扩展精选合集。

---

## 插件列表

| 插件名称 | 目录 / 包名 | 描述 | 状态 |
|---|---|---|---|
| 👁️ **DeepIris (深瞳)** | [`plugins/dsh-deepiris`](./plugins/dsh-deepiris) | 为 DeepSeek 提供多 Provider VLM 视觉感知、OCR 识别与自主 UI 闭环质检能力。 | `v0.1.0` (就绪) |

---

## 快速上手

### 1. 安装插件

在你的 DeepSeek Harness 项目或运行环境中安装所需插件：

```bash
pnpm add @eykicuihb/dsh-deepiris
```

### 2. 在 `cordis.patch.yml` 中挂载启用

在 `~/.dsh/cordis.patch.yml` 或项目配置文件中声明挂载：

```yaml
- id: deepiris
  name: '@eykicuihb/dsh-deepiris'
  config:
    provider: dashscope # dashscope | zhipu | openai | anthropic | gemini | ollama | custom | opencode
    model: qwen2.5-vl-72b-instruct
```

---

## 贡献指南

欢迎社区开发者为 DeepSeek Harness 生态贡献更多实用插件！

1. Fork 本仓库并 Clone 到本地；
2. 在 `plugins/<你的插件名>` 目录下开发插件；
3. 确保遵循 Cordis 插件规范（声明 `inject` 依赖、可逆生命周期 Disposer、严格配置 Schema 校验）；
4. 提交 Pull Request。

---

## 开源协议

MIT License © 2026 eykicuihb
