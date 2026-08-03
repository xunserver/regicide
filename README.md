# Regicide Core

Pure TypeScript rules and deterministic state transitions for the Regicide card game.

## Structure

- `packages/game-core/src`: cards, state validation, legal commands, queries, setup, and transitions.
- `packages/game-core/tests`: deterministic unit and complete-game simulation tests.

The core API follows this model:

```text
GameState + GameCommand -> TransitionResult
```

An accepted transition returns the next `GameState` and ordered `GameEvent[]`. A rejected
transition returns the original state, an empty event list, and a rejection reason.

## Commands

```bash
pnpm install
pnpm run test
pnpm run test:coverage
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run format:check
pnpm run check
```

## 命令行游戏

启动命令行游戏，支持 1 到 4 名玩家：

```bash
pnpm install
pnpm play -- --players=1 --seed=my-game
```

CLI 会显示当前敌人、手牌和所有合法操作，在提示处输入操作编号即可。支持出牌、跳过回合、
反击弃牌、Jester 后选择下一位玩家，以及单人模式的 Solo Jester。输入 `q` 退出游戏。省略
`--seed` 会使用随机种子；使用相同 seed 可以复现相同的初始局面。
