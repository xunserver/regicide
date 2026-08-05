# Derive interaction capabilities from independent blockers

v1 不维护可被任意流程切换的全局输入锁。会话状态、渲染器、动画批次、DOM 模态层、页面前后台、设备方向和视口尺寸分别拥有 `session`、`renderer`、`animation`、`modal`、`background`、`orientation` 与 `viewport` 阻断原因；每个流程只能设置或清除自己的原因。纯交互门面接收完整原因集合与只读选择快照，派生深只读的 `canSelectCards`、`canSubmitIntent`、`canFastForward` 和外壳操作能力；Canvas 与 TalkBack 语义控制层共同读取最终能力快照，提交前协调器再次验证。快进只清除 `animation`，关闭弹窗只清除 `modal`，恢复前台只清除 `background`；不存在 `unlock` 或 `unlockAll`。这样选择合法性与生命周期阻断各有一个计算位置，重叠流程也不会使一个流程错误恢复另一个流程仍应阻止的操作。
