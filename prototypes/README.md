# PROTOTYPE — active table

These files are throwaway experiments for one question: how should an in-progress
portrait game table communicate selection, public intent previews, independent
interaction blockers, and committed event animation?

The fixed scenarios in `active-table-fixtures.json` feed both prototypes:

```bash
pnpm run prototype:logic
pnpm run prototype:ui
```

The logic prototype is terminal-driven. The UI prototype is served at
`http://localhost:4173/prototype/active-table?variant=A` and keeps all state in
memory. Append `&viewport=mobile` to simulate a 360px portrait viewport inside
a desktop browser. This directory is a primary source for the design
discussion, not production code.
