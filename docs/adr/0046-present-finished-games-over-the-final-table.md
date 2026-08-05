# Present finished games over the final table

`active.game.status` 为 `won` 或 `lost` 时，v1 继续用 Phaser 呈现冻结的最终牌桌，但关闭所有 Canvas 玩家输入；React 在其上显示 DOM 结算层，展示胜负、单人评级和经确认开始新局的操作。刷新或重新进入页面仍从自动存档恢复同一最终牌桌与结算，不自动清档或跳过结果。进行中对局的加载就绪点是第一个合法操作可获得反馈，已结束对局的就绪点则是最终牌桌与结算控件都已可用。
