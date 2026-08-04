import type { CardId } from '@regicide/game-core'

export type PlayerIntent =
  | { readonly type: 'play-cards'; readonly cardIds: readonly CardId[] }
  | { readonly type: 'yield' }
  | { readonly type: 'discard-for-damage'; readonly cardIds: readonly CardId[] }
  | { readonly type: 'use-solo-jester'; readonly cardId: CardId }
