# Let the application own live game state

`LocalGameSession` 在应用层独占运行中的 `GameState`；UI 只能读取快照、订阅变化并提交玩家意图，不能直接替换或修改 core 状态。一次命令由 session 调用 core、保存被接受的结果，再更新最终快照并随操作结果返回有序事件；选牌、弹窗和动画进度仍属于 UI 表现状态。
