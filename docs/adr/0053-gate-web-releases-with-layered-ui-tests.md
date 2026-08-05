# Gate web releases with layered UI tests

v1 Web 发布使用分层 UI 验收门槛。Vitest 以固定快照和种子测试纯布局、选择控制器、动画规划器、表现协调器与页面生命周期状态机；React 组件测试覆盖所有会话页面、确认和错误弹窗的焦点行为，以及 TalkBack 语义控制层。Playwright 在既定视口矩阵中覆盖触控流程、Canvas 非空像素与视觉截图、横竖切换、后台恢复，并注入存储、资源和 WebGL 故障。最后在 Pixel 6a 基准真机的最新稳定版 Chrome 上验收加载、帧率、触控、长时间运行和完整 TalkBack 对局。桌面设备模拟只用于确定性流程与布局回归，不得代替移动 GPU 或辅助技术验收。
