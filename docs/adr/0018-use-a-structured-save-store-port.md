# Use a structured save-store port

`game-application` 只依赖其定义的 `GameSaveStore` 端口，通过结构化的 `load`、`save` 和 `clear` 操作区分缺失、已加载、不可恢复以及读写失败。H5 浏览器适配器负责固定 key、JSON envelope、版本检查、`parseGameState` 校验和 Web Storage API；应用层不得导入 `window`、`localStorage` 或原始 key/value 协议。
