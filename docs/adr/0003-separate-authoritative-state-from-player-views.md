# Separate authoritative state from player views

The core maintains one complete authoritative game state, including every hand, deck order, and
random-source progress. Viewer-specific redaction, transport security, and authentication belong to
the application or server boundary; commands identify their actor so the core can still enforce
turn ownership and card ownership as game rules.
