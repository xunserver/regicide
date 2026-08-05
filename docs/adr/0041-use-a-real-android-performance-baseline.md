# Use a real Android performance baseline

v1 的性能验收以 Pixel 6a 级别的真实 Android 手机运行最新稳定版 Google Chrome 为最低基准。Playwright 的设备模拟只负责视口、响应式布局和交互流程回归；WebGL 帧率、触控反馈延迟、内存占用与长时间运行的热稳定性必须在真机上测量。这样可以验证移动 GPU 与浏览器合成行为，而不会把桌面模拟结果误当作 H5 游戏性能保证。
