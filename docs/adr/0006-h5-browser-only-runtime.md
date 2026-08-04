# Deliver v1 as a browser H5 application

v1 的唯一产品运行时是普通浏览器 H5 应用，不建设服务端、原生端或 PWA 专属能力。浏览器应用依赖平台无关的 `game-application` 并实现浏览器存储适配器，但不设计安装、Service Worker、应用壳缓存或离线资源策略；现有 CLI 仍是范围外的独立程序。
