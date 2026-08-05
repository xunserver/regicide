# Use a graded asset pipeline

v1 把基础卡框、四种花色符号和必要状态图标打入一个关键无损图集，卡牌位阶与文字由运行时叠加。每张可选原创插画以独立、带内容哈希的 WebP 交付，使单项失败只退化对应卡面；短音效统一使用 Opus/WebM，失败时静音。构建生成类型化资源 manifest，记录逻辑 ID、哈希 URL、像素尺寸以及 `required` 或 `optional` 分类，并校验尺寸和传输预算。关键图集或 manifest 不可用时进入 DOM 重试，可选资源不得阻塞创建存档或恢复可操作牌桌。
