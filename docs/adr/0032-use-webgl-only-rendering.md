# Use WebGL-only rendering for v1 UI

v1 表现引擎固定使用 WebGL 渲染器，不自动选择 WebGPU，也不提供 Canvas 2D 回退。当前牌桌规模不需要 WebGPU，目标运行时稳定支持 WebGL；单一路径可以减少渲染差异、资源验证和故障回退状态，等 WebGPU 在所选表现引擎中成为生产推荐后再重新评估。运行中丢失 WebGL 上下文时，UI 设置 `renderer` 交互阻断原因并快进当前动画批次；上下文恢复后只从最新 `SessionSnapshot` 重建 Phaser 场景，不回放提交事件，重建成功后只清除 `renderer` 原因。自动恢复失败时由 DOM 提供重试并保留会话与存档，渲染故障不得改变规则状态。
