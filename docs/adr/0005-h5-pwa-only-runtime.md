---
status: superseded by ADR-0006
---

# Deliver v1 only as an H5 PWA

v1 的唯一产品运行时是 H5 PWA，不建设服务端、原生端或其他产品适配器。浏览器应用依赖平台无关的 `game-application`，并在自身基础设施边界实现浏览器存储和 PWA 生命周期；现有 CLI 是范围外的独立程序，本架构不依赖也不修改它。
