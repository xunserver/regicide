# Use one session facade per page

H5 组合根为每个页面实例创建、初始化并最终销毁一个 `LocalGameSession`，页面内所有游戏 UI 共享该实例。UI 只能通过会话门面读取或订阅快照并调用应用操作，不得直接取得 `GameSaveStore`、`GameSeedSource` 或 core `dispatch`；`game-application` 自身不实现全局单例。
