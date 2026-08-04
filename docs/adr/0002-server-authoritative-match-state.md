---
status: superseded by ADR-0003
---

# Make the server authoritative for online matches

同步在线对局的完整状态由服务端唯一持有和裁决，客户端只发送玩家意图并接收按玩家过滤的状态与事件。这个选择保护 Regicide 的隐藏手牌和牌堆信息，避免客户端之间的状态冲突，并让断线恢复以服务端状态为准；客户端仍可复用纯 core 做提示或本地单人，但不能决定在线对局结果。
