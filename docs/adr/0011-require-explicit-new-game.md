# Require an explicit new-game action

没有自动存档时，`LocalGameSession` 进入无对局状态，不在应用启动或恢复流程中自动调用 `createGame`。玩家明确选择开始新局后，应用层才创建初始 `GameState`、写入单槽自动存档，并发布新对局快照。
