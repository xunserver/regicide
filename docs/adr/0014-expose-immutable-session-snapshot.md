# Expose an immutable session snapshot

`LocalGameSession` 向 UI 提供不可变的会话快照：有对局时包含深只读的当前 `GameState`，无对局或恢复失败时包含对应会话状态和错误元数据。首版不复制一套平行 `GameView` 作为事实源；application 提供接受该只读状态的查询门面，避免 UI 为调用 core 查询而去除只读类型。UI 只读取快照并维护自己的选择、弹窗和动画状态。
