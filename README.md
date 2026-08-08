# Regicide / 弑君者 (H5)

移动端弑君者 — Vite + React + TypeScript 6 + **Phaser 4**。

## 分层

| 层 | 路径 | 职责 |
|---|---|---|
| **core** | `src/core` | 单人规则引擎 |
| **orchestration** | `src/orchestration` | 会话 / 意图 / 存档 |
| **game** | `src/game` | Phaser 场景与卡牌表现 |
| **ui** | `src/ui` | React 全屏挂载 |

界面文案统一中文（`src/game/i18n/zh.ts`）。

## 脚本

```bash
npm run dev
npm test
npm run build
node scripts/qa-browser.mjs
```
