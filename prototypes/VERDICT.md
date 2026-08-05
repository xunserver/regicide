# PROTOTYPE — current observations

Question: how should an in-progress portrait table communicate selection, public
intent previews, independent blockers, and committed event animation?

The paired Solo Jester fixtures have the same public projection and the same
public preview when the preview reports `resolution: hidden-dependent` and avoids
claiming a concrete next decision. The actual core outcomes still differ: one
hidden top card leaves the game in the discard phase, while the other immediately
loses. This is the behavior the production preview contract must preserve.

The TUI also confirms two interaction rules from the architecture notes:

- a storage failure keeps the selected intent available for retry;
- fast-forward removes only the `animation` blocker, while background, modal,
  renderer, orientation, viewport, and session blockers remain independent.

The three UI structures are intentionally still undecided. The next human
decision is which information hierarchy, or which combination of A, B, and C,
should be folded into the real `apps/web` implementation.
