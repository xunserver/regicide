# Return expected application failures explicitly

`LocalGameSession` 对 UI 返回可判别的应用结果：core 拒绝使用 `rejected`，自动存档写入失败使用 `storage-error`，恢复校验失败使会话进入 `unrecoverable-save`。这些情况不以未分类异常表达；只有违反程序不变量等非预期缺陷才抛出异常。
