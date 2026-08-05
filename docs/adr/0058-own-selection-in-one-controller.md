# Own selection in one controller

v1 将当前选中的 `CardId` 集合交给表现协调器内部唯一的 `SelectionController`。控制器只保存这一瞬时集合，不复制 `GameState`；它以最新 `SessionSnapshot` 调用 `getLegalPlayerIntents`，派生仍可加入的卡牌、完整可提交意图和 `previewPlayerIntent` 结果，再把深只读选择快照交给统一交互门面计算最终能力。Canvas 触控与 React 的 TalkBack 语义按钮都通过同一控制器切换或清除选择，React 只持有弹窗与焦点状态，Phaser 只持有可丢弃的显示对象。存储失败保持选择，提交成功、会话状态变化或显式重置清除选择；选择控制器不读取其他交互阻断原因。
