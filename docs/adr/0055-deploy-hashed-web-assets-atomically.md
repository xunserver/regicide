# Deploy hashed web assets atomically

v1 静态托管让 `index.html` 每次重验证；带内容哈希的 JS、CSS、资源 manifest、图集、插画和音效使用 `public, max-age=31536000, immutable`。发布必须先上传全部新哈希资源并验证可取，再原子切换 HTML，旧哈希资源至少保留 30 天。若已打开的旧页面仍无法动态加载 Phaser chunk 或资源 manifest，DOM 错误流程提供“刷新加载新版”操作；刷新只重建页面并重新读取 `LocalGameSession`，不得清理或覆盖自动存档。该策略在不引入 Service Worker 的情况下避免 HTML 与延迟加载资源跨版本错配。
