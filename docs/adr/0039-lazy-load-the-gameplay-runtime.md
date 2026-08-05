# Lazy-load the gameplay runtime

v1 首先加载 React DOM 外壳并初始化 `LocalGameSession`，只有恢复出 `active` 对局或玩家确认开始新局时才动态加载 Phaser 与当前局面需要的素材；牌桌可操作后再后台预取其余插画和音效。新开局或替换当前局时，UI 必须先加载 Phaser chunk、成功初始化 WebGL 并取得包含基础卡框、四种花色符号和必要状态图标的关键图集，之后才能调用 `startNewGame` 或 `replaceWithNewGame`；可选插画和音效不阻塞提交。核心显示链路失败时由 DOM 提供重试，不创建新存档，也不替换旧存档；单张插画或音效失败时使用无插画卡面或静音降级，不阻止继续游戏。这样无对局、不可恢复存档和加载失败流程不必下载完整游戏运行时，所有加载故障也都不会改变规则状态。
