# Separate snapshots from transient events

`LocalGameSession.getSnapshot` 与 `subscribe` 只提供当前已提交的会话快照和状态。`execute` 成功时返回包含最终快照与有序 `GameEvent[]` 的提交结果，由调用该操作的 UI 控制器消费；事件不进入快照，也不使用全局可重放事件总线，从而避免组件重新订阅或渲染时重复播放表现效果。
