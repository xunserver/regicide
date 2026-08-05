# Enforce cold-start transfer budgets

v1 以冷缓存生产构建的实际网络传输检查首次可操作成本：React DOM 外壳的 JS 与 CSS gzip 传输不超过 `150 KiB`，Phaser 与游戏代码 chunk 的 gzip 传输不超过 `500 KiB`，首次就绪所需字体、图像和音效按其生产编码后的实际传输字节计算且不超过 `1.5 MiB`，冷启动至就绪的总传输量不超过 `2.2 MiB`。超过任一阈值都必须通过拆包、压缩、延迟加载或削减素材解决，不能把已压缩图片或音频错误地按再次 gzip 估算，也不能以目标浏览器固定为最新 Chrome 为由忽略移动网络成本。
