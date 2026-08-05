# Use React for the DOM shell

v1 的 `apps/web` 使用 React 呈现会话生命周期页面、确认与错误弹窗、横屏遮罩，并承载 Phaser Canvas。组合根只创建一个 `LocalGameSession`，React 通过 `useSyncExternalStore` 订阅其不可变快照；选择由表现协调器内部唯一的选择控制器持有，React 只保存弹窗和焦点等瞬时 DOM 状态。不复制 `GameState`，也不引入 Redux、Zustand 或其他并行应用状态容器。Phaser 不直接订阅会话，而通过表现协调器取得视觉快照、动画提示和只读选择快照。相比手写 DOM 更新，这让封闭的会话状态和覆盖层保持声明式且更容易做组件测试。
