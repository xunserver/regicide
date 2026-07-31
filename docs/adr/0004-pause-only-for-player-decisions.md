# Pause the state machine only for player decisions

Core state represents points where player input is required rather than mirroring all four printed
turn steps. After a command, the core resolves mandatory suit powers, damage, enemy defeat, and
other deterministic consequences atomically, while emitted domain events preserve enough detail
for interfaces to present those consequences one at a time.
