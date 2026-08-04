import type { GameCommand } from '@regicide/game-core'
import type { PlayerIntent } from './player-intent'
import { LOCAL_PLAYER_ID } from './solo-game'

export function intentToCommand(intent: PlayerIntent): GameCommand {
  switch (intent.type) {
    case 'play-cards':
      return { type: 'play-cards', actorId: LOCAL_PLAYER_ID, cardIds: [...intent.cardIds] }
    case 'yield':
      return { type: 'yield', actorId: LOCAL_PLAYER_ID }
    case 'discard-for-damage':
      return {
        type: 'discard-for-damage',
        actorId: LOCAL_PLAYER_ID,
        cardIds: [...intent.cardIds],
      }
    case 'use-solo-jester':
      return { type: 'use-solo-jester', actorId: LOCAL_PLAYER_ID, cardId: intent.cardId }
  }
}
