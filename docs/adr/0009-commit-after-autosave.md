# Commit accepted transitions only after autosave

core 接受命令后产生的状态和事件只是候选结果；`LocalGameSession` 必须先把候选状态写入自动存档，成功后才能替换内存中的当前状态并向 UI 发布快照和有序事件。若写入失败，会话保留旧状态、不发布本次 core 事件，并返回可重试的应用层存储错误，从而保证玩家看到的已提交局面始终可以刷新恢复。
