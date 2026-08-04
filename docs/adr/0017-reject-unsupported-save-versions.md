# Reject unsupported save versions in v1

自动存档同时带独立的 envelope 版本和 core `schemaVersion`。v1 只接受当前支持的版本，不实现旧版或未知新版的迁移；任一版本不匹配都进入不可恢复存档流程并保留原始内容，等待玩家显式清理。
