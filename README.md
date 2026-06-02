# Tool FolderCleaner

一个面向本地素材目录的文件清理工具，重点解决同一镜头多版本文件长期堆积、人工筛选成本高的问题。

## 当前目标

- 提供桌面可视化 UI
- 递归查找指定名称的目标文件夹，例如 `unity`
- 按自定义扩展名过滤目标文件
- 在同一匹配文件夹内按镜头号分组
- 同一镜头组内仅保留最新 take
- 按修改时间执行稀疏保留，默认保留最早、最新和中间版本
- 支持批量扫描、预览确认和自动执行
- 支持应用内定期任务
- 支持回收站删除与彻底删除两种模式

## 当前规格文档

- 规格说明：`.trae/specs/build-folder-cleaner-retention-ui/spec.md`
- 任务拆分：`.trae/specs/build-folder-cleaner-retention-ui/tasks.md`
- 验收清单：`.trae/specs/build-folder-cleaner-retention-ui/checklist.md`

## Task 1 已完成内容

- 采用 `Tauri + React + Vite + TypeScript` 作为桌面应用基础栈
- 建立 `src/` 前端界面层与 `src-tauri/` 本地能力层目录结构
- 搭建单页仪表盘骨架，包含目录选择、规则区、统计区、扫描结果区、计划任务区
- 预留 Tauri 运行时适配：目录选择、设置加载/保存、删除命令调用
- 在 Rust 端提供 `load_settings`、`save_settings`、`delete_paths` 命令骨架

## 目录结构

```text
.
|-- src/                  # React/Vite 单页仪表盘
|   |-- components/       # 通用面板与统计卡片
|   |-- lib/              # 默认数据与 Tauri 调用适配
|   `-- types/            # 前端共享类型
|-- src-tauri/            # Tauri Rust 壳层与本地命令
|   |-- src/
|   |   |-- main.rs
|   |   `-- commands.rs
|   `-- tauri.conf.json
`-- .trae/specs/          # 规格、任务与验收文档
```

## 本地能力方案

- 目录选择：前端通过 `@tauri-apps/plugin-dialog` 打开系统目录选择器
- 文件访问：真实递归扫描逻辑计划放在 Rust 命令侧，前端仅管理路径和展示状态
- 删除策略：统一经由 `delete_paths` 命令执行，支持移入回收站与彻底删除两种模式
- 设置持久化：通过 `load_settings` / `save_settings` 读写应用配置目录下的 `settings.json`

## 开发命令

在本机安装 `Node.js`、`npm` 与 `Rust/Cargo` 后可执行：

```bash
npm install
npm run dev
npm run build
npm run tauri dev
```

## 当前验证情况

- 代码骨架、配置文件与任务文档已更新
- 当前环境缺少 `node`、`npm`、`cargo`，因此无法在此机器上执行 `npm install`、`vite build`、`tauri build`
- 后续进入 Task 2 前，建议先补齐上述运行时依赖，再执行完整构建验证
