# Use snapshots as persistence truth

Serialized `GameState` snapshots are the persistence truth for v1, while domain events describe the
effects of one accepted command for presentation and optional auditing. The core does not rebuild a
game by replaying events; applications may retain commands or events for replay features without
making core correctness depend on a complete historical log.
