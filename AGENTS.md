# Repository Guidelines

## Project Structure

This repository contains only `packages/game-core`, a framework-independent TypeScript rules
engine. Keep it free of React, DOM, networking, persistence, and application-layer dependencies.

## Commands

Run from the repository root:

```bash
pnpm install
pnpm run build
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run test:coverage
pnpm run format:check
pnpm run check
```

## Style

Prettier is authoritative: 2 spaces, LF, no semicolons, single quotes, trailing commas, and 100
columns. Prefer `import type`, `PascalCase` for types, and `camelCase` for functions and variables.

## Testing

Vitest tests live in `packages/game-core/tests`. Rule transitions should provide a fixed state and
command, then assert the complete resulting state and ordered events. Rejections must preserve the
input state and emit no events. Keep all fixtures and simulations deterministic.
