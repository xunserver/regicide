# Fix the solo game configuration in the application

`game-application` 固定单人局的 core 创建参数：`playerIds` 只包含一个稳定的本地玩家 ID，`startingPlayerId` 使用同一 ID。UI 的 `startNewGame` 不接收玩家数量、玩家 ID 或起始玩家；应用层取得注入的 seed 后自行调用 `createGame`。core 的多人能力继续保留，但不进入当前产品接口。
