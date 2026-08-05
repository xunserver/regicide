# Build the web UI as a static Vite SPA

未来的 `apps/web` 使用 Vite、React 和 TypeScript 构建为静态单页应用。v1 的页面状态完全由 `SessionSnapshot` 与瞬时 UI 状态驱动，不引入客户端路由；Phaser 通过动态 `import()` 形成独立 chunk，静态资源通过带内容哈希的 manifest 引用。构建依赖固定精确版本，CI 对生产构建执行 chunk 与首次可操作资源预算检查。该交付方式不增加 Service Worker、PWA 缓存或服务端渲染，与普通浏览器 H5 的既有范围保持一致。
