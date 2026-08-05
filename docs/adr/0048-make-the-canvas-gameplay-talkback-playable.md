# Make the Canvas gameplay fully playable with TalkBack

Android TalkBack 的完整可玩性属于 v1 验收范围。视觉牌桌仍只由 Phaser Canvas 绘制，Canvas 本身对辅助技术隐藏；React 提供非视觉 DOM 语义控制层，以与手牌顺序一致的切换按钮、公开牌桌状态和操作按钮暴露同一交互。表现协调器内部的选择控制器是选中状态唯一所有者，DOM 与 Canvas 只订阅其只读快照，不复制规则或建立平行状态树。提交结果通过节制的 live region 播报，确认和错误弹窗管理焦点进入与返回；所有可见触控命中区域至少为 `48 CSS px`。自动化测试覆盖语义与焦点契约，发布前仍需在基准真机执行人工 TalkBack 完整对局。
