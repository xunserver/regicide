# Keep v1 application APIs synchronous

v1 的 `LocalGameSession` 操作以及 `GameSaveStore`、`GameSeedSource` 端口都使用同步返回值。当前 core 转换、`localStorage` 读写和 `crypto.getRandomValues` 都是同步操作，因此不引入没有实际异步工作的 `Promise`、队列或 loading 状态；未来改用异步存储时再单独升级边界。
