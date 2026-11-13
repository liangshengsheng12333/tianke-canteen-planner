# TodoWrite 桌面接入简要需求

日期：2026-10-20（Asia/Shanghai）

## 问题

本地 TodoKit MCP 已安装并在 Codex CLI 配置中启用，但 Codex 桌面聊天没有加载出工具，因此聊天中无法调用待办操作。

## 成功标准

- Codex 桌面插件目录能识别本地 TodoWrite 插件。
- 插件将新增、查看、更新、完成等操作连接到现有 TodoKit MCP 和工作区任务数据文件。
- 新建本地聊天后，桌面工具可见并可通过自然语言调用。

## 范围

- 在工作区建立本地插件清单、插件说明和 MCP 配置。
- 注册并启用工作区本地插件。
- 记录当前宿主是否可核实工具可见性。

## 约束

- 复用已安装的 `@j0hanz/todokit-mcp@2.1.0` 与现有 `任务数据.json`。
- 不安装新的依赖，不修改业务源码或业务MEMORY。
- Todo 数据继续留在 `Resources/工具/todokit/任务数据.json`。
- 插件安装完成不等于当前聊天会话已加载工具；需要在新聊天确认。

## 初步方案

按 OpenAI 本地 Codex 插件格式，在工作区 `.agents/plugins/marketplace.json` 中登记插件，以 `.codex/config.toml` 启用，再通过 Codex 插件命令安装到本机缓存。

## 待解决问题

- Codex 桌面是否在本机新聊天中成功发现本地 stdio MCP 工具，须安装后实测。
