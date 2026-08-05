# Coordinate the Android page lifecycle

v1 用一个幂等的页面生命周期协调器统一处理 `visibilitychange`、`pagehide`、`pageshow` 以及目标 Chrome 的 `freeze` 和 `resume`。进入后台或冻结时设置 `background` 交互阻断原因、快进当前动画批次，并暂停 Phaser 循环与音频；恢复时重新测量视口，先读取最新 `SessionSnapshot`，再按当前会话页面重绘或重建表现，最后只清除 `background` 原因。重复、乱序或同时到达的生命周期事件不得重复播放动画、音效或调用会话操作。每次规则提交已在返回前完成自动存档，因此页面不使用 `unload` 或 `beforeunload` 保存，也不显示离页确认。
