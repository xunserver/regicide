# Repository Guidelines

## Project Structure & Module Organization

This pnpm workspace is managed by Turborepo. Keep dependency direction aligned with the architecture:

- `packages/common`: framework-independent shared types and utilities.
- `packages/game-core`: pure TypeScript rules and state; never import React, DOM, or outer packages.
- `packages/game-application`: framework-independent commands and sessions over `game-core`.
- `packages/game-ui`: React UI, hooks, providers, styles, and animations; use application APIs.
- `apps/web`: Vite browser entry point.
- `card-deck-pipeline`: standalone Python asset pipeline (`src/cardpipe`) and pytest tests.
- `docs/`: gameplay/product documentation. Stable browser assets go in `apps/web/public/game-assets`; bundled assets go in package `src/assets`.

## Build, Test, and Development Commands

Run these from the repository root:

```bash
pnpm install                 # install workspace dependencies
pnpm run dev                 # start the web app through Turborepo
pnpm run build               # build all packages and the web app
pnpm run lint                # ESLint and Stylelint checks
pnpm run typecheck           # TypeScript checks
pnpm run test                # run Vitest suites
pnpm run format:check        # verify Prettier formatting
pnpm run check               # lint, typecheck, test, build, and formatting
```

Use `pnpm --filter @regicide/game-core test` for focused tests. For the Python pipeline, install its dev extra and run `pytest` from `card-deck-pipeline/`.

## Coding Style & Naming Conventions

Prettier is authoritative: 2 spaces, LF, no semicolons, single quotes, trailing commas, and 100 columns. Run `pnpm run format` before submitting. ESLint checks typed TypeScript; Stylelint checks CSS. Use `PascalCase` for React components/types, `camelCase` for functions/variables, and lowercase test names such as `rules.test.ts`. Prefer `import type` and preserve boundaries enforced in `eslint.config.ts`.

## Testing Guidelines

Vitest tests live in package `tests/` directories and should cover rule transitions, edge cases, and reducers. Update tests with behavior changes; keep them deterministic. The Python pipeline uses pytest under `card-deck-pipeline/tests/`.

## Commit & Pull Request Guidelines

Use short, imperative, sentence-case subjects (for example, `Add enemy immunity rules`) and focused commits. Pull requests should explain the change, list validation commands, link an issue/design document, and include screenshots or a recording for UI changes. Call out gameplay, public exports, generated assets, and configuration changes.

## Security & Configuration Tips

Do not commit secrets or local environment files. Copy `card-deck-pipeline/.env.example` when configuring the asset pipeline. For deployments under a subpath, set `VITE_BASE_PATH`; keep generated output and caches out of commits.
