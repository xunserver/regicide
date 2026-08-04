# Separate session lifecycle operations

会话用三个受状态约束的操作表达对局生命周期：`startNewGame` 只从 `no-game` 创建；`replaceWithNewGame` 只在 UI 已确认替换正常对局后调用；`clearUnrecoverableSave` 只删除不可恢复存档并回到 `no-game`，不顺便创建新局。无效状态调用返回显式应用拒绝，不改变存档或会话。
