# Use an explicit session state machine

UI 可见的 `SessionSnapshot` 是封闭的可判别联合：`uninitialized`、`no-game`、`active { game }`、`unrecoverable-save { reason }`、`load-failed { reason }` 和 `stale { previousGame? }`。`active.game.status` 继续区分进行中、胜利与失败；普通命令写入失败只返回 `storage-error` 并保留原快照，不另行改变会话状态。
