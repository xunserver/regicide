# Persist the finished game

导致胜利或失败的 accepted transition 与其他提交一样，先把最终 `GameState` 写入唯一自动存档，再发布快照和事件。应用启动时恢复该最终状态并由 UI 展示结算；不得在胜负后自动清档或创建下一局，只有玩家确认开始新局后才替换它。
