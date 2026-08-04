# Initialize the session explicitly

`LocalGameSession` 构造函数只接收端口依赖，不读取存档或注册浏览器事件。H5 组合根创建会话后调用一次 `initialize`，由它加载唯一存档、开始监听外部存档变化，并进入 `no-game`、`active` 或 `unrecoverable-save`；初始化完成前拒绝开始新局和玩家意图。若读取进入 `load-failed`，只有显式 `retryLoad` 才能再次尝试恢复；会话销毁时由 `dispose` 取消监听。
