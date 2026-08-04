# Map player intents in the application layer

UI 只提交应用层定义的 `PlayerIntent`，不直接构造 `game-core` 的 `GameCommand`，也不提供 `actorId`。当前意图集包含单人模式会出现的出牌、让牌、承受伤害弃牌和使用 Solo Jester；`choose-next-player` 是多人命令，不进入单人应用接口。`LocalGameSession` 根据当前 `GameState` 将意图映射为 core 命令，调用 `dispatch`，并统一执行保存和事件发布。
