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

## 后续计划

当前仓库已完成需求规格整理，下一步进入桌面应用技术栈初始化与界面骨架搭建。
