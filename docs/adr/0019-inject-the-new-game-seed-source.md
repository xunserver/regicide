# Inject the new-game seed source

创建新局所需的 seed 由 `game-application` 定义的 `GameSeedSource` 端口提供；H5 组合根注入基于 `crypto.getRandomValues` 的实现，测试注入固定值。core 和应用服务不直接调用 `Math.random` 或 `Date.now`；新局创建后，所有随机进度只由持久化在 `GameState` 中的随机状态推进。
