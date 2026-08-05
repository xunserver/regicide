# Preview player intents in the application

v1 由 `game-application` 提供统一的只读玩家意图预览，而不是让 React 或 Phaser 复制规则计算。公开接口是纯函数 `previewPlayerIntent(game, intent): PlayerIntentPreview | null`：只为对传入 `game` 完整合法的意图返回按意图类型区分的深只读公开摘要，否则返回 `null`；查询本身不能判断调用方传入的快照是否已被更新快照取代，因此 UI 必须在会话快照引用变化时丢弃选择与预览。`getLegalPlayerIntents` 继续独立负责合法选择与可扩展组合。预览字段固定为出牌的攻击、实际伤害、有效花色、抽牌数、敌人结果与预计反击，让牌的预计反击，承伤弃牌的所需、所选与超出点数，以及 Solo Jester 的弃牌数、抽牌数、使用后剩余次数与仍需承受的公开伤害。预览不保存、不推进状态或随机进度，也不暴露候选 `GameState`、预提交 `GameEvent[]` 或任何暗牌身份。
