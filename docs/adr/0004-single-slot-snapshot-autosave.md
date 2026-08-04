# Use one snapshot autosave slot

v1 只保留一个自动存档槽：创建对局以及每次 core 接受命令后保存完整 `GameState`，拒绝命令不写存档，恢复时用 `parseGameState` 校验快照。快照是恢复事实，`GameEvent` 只负责当前迁移的表现反馈；首版不引入多个存档槽、手动检查点或事件溯源。
