# Invalidate the session after an external save change

v1 不支持多个标签页并行推进同一对局。H5 存档适配器监听唯一存档 key 的外部 `storage` 变化并通知 `LocalGameSession`；会话随后进入 `stale` 状态、拒绝新的玩家意图，并让 UI 提示刷新恢复最新存档。首版不实现跨标签页实时同步、合并或冲突解决。
