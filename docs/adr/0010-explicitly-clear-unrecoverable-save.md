# Require explicit cleanup for an unrecoverable save

启动恢复时，如果单槽自动存档不存在，应用可以进入无对局状态；如果存档存在但 JSON envelope、存档版本或 `parseGameState` 校验失败，应用必须报告不可恢复存档并保留原始内容。只有玩家明确确认清理后，才允许删除该存档并创建新局；应用不得把损坏存档静默当作不存在或直接覆盖。
