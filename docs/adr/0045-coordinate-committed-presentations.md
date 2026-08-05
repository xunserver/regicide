# Coordinate committed presentations before updating Phaser

v1 在 `LocalGameSession` 与 Phaser 之间设置唯一的表现协调器。所有 Canvas 玩家意图都由协调器在调用 `execute` 前捕获提交前只读快照；会话同步提交并通知订阅者期间，协调器不把新快照直接交给 Phaser，而是在操作返回 `committed` 后校验结果，用提交前快照、有序事件和结果快照规划一个动画批次。Phaser 不直接订阅会话，也不直接调用 `execute`。协调器内部的选择控制器是选中 `CardId` 集合的唯一所有者，向 React 和 Phaser 发布只读交互快照；协调器本身只暂存只读快照引用和 `AnimationCue[]`，不复制或推进 `GameState`。任何不属于当前操作的快照变化都会使旧批次立即失效并交还 React 呈现最新会话状态。这样既保留 `LocalGameSession` 的单一事实源，又避免先显示提交后局面再倒播动画的同步竞态。
