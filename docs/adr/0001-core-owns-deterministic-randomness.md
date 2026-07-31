# Let core own deterministic randomness

The game core owns deck construction, shuffling rules, and every other random game decision,
because these are part of the rules rather than presentation concerns. Callers provide a seed; the
core uses a fixed deterministic algorithm and stores its progress in `GameState`, allowing games to
resume reproducibly even when Hearts causes a mid-game shuffle. Tests may use dedicated fixtures
with predetermined decks, but the production API does not accept an unserializable random callback.
