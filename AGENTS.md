# Repository Guidelines

## Project Structure

This repository contains three TypeScript packages:

- `packages/game-core`: the deterministic rules engine.
- `packages/game-application`: the framework-independent local solo orchestration layer.
- `packages/game-cli`: a separate command-line program and out-of-scope adapter for the browser app.

Keep `game-core` free of application-layer dependencies. Keep both `game-core` and
`game-application` free of React, DOM, networking, browser, and Node runtime dependencies;
`game-application` may depend only on `game-core` at runtime.

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

Vitest tests live in each tested package's `tests` directory. Core rule transitions should provide a
fixed state and command, then assert the complete resulting state and ordered events. Application
tests should use fake ports and fixed seeds, and must prove save-before-commit behavior. Rejections
must preserve the input state and emit no events. Keep all fixtures and simulations deterministic.
