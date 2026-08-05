# Use portrait-only gameplay for v1

v1 只提供竖屏可玩布局；手机进入横屏时，DOM 外壳显示旋转设备遮罩并设置 `orientation` 交互阻断原因，已提交会话状态不受影响。页面不请求 Fullscreen API 或 `screen.orientation.lock()`，也不把这些权限型 API 的成功或失败纳入游戏流程。首版不维护第二套横屏牌桌，因为有限的纵向空间会损害敌人、战场和八张手牌的可读性，同时使布局、命中区域和视觉回归矩阵接近翻倍；普通 Chrome 页面的动态工具栏和安全区由响应式布局直接处理。
