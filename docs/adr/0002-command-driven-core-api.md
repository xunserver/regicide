# Use a command-driven core API

The core exposes readable, serializable state snapshots but keeps all state changes behind a small
command API. Commands express player decisions, while the core validates them and resolves every
automatic rule before returning a new state and domain events; presentation and application layers
may render the game freely but do not orchestrate or bypass its rules.
