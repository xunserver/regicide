# Use Phaser 4 as the v1 presentation engine

v1 在 `apps/web` 中固定使用 Phaser `4.2.1` 作为表现引擎，仅用其 WebGL 渲染、Scene、资源加载、统一输入和 Tween 能力来实现牌桌与提交事件动画；Phaser 不拥有 `GameState`、规则、随机或存档，也不进入 `game-core` 和 `game-application`。选择 Phaser 而不是 PixiJS，是因为已确认的有序动画、整体快进和移动页面生命周期可以复用成熟的 Tween 与 Scene 机制，避免项目自行组合渲染器和动画框架；不选择 Cocos Creator，是因为 v1 不需要可视化编辑器、3D、物理或跨原生平台工具链。版本升级必须通过目标 Android Chrome 上的交互与视觉回归测试。
