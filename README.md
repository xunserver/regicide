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
