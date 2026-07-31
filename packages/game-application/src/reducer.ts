import { createInitialGame, playCards } from '@regicide/game-core'
import type { GameCommand, GameSession } from './types'

export function createInitialSession(): GameSession {
  return {
    game: createInitialGame(),
    selectedCardIds: [],
  }
}

export function gameReducer(session: GameSession, command: GameCommand): GameSession {
  switch (command.type) {
    case 'card/toggle': {
      if (session.game.phase !== 'player-turn') return session
      if (!session.game.hand.some((card) => card.id === command.cardId)) return session

      const isSelected = session.selectedCardIds.includes(command.cardId)
      return {
        ...session,
        selectedCardIds: isSelected
          ? session.selectedCardIds.filter((id) => id !== command.cardId)
          : [...session.selectedCardIds, command.cardId],
      }
    }

    case 'cards/play': {
      if (session.game.phase !== 'player-turn' || session.selectedCardIds.length === 0) {
        return session
      }

      return {
        game: playCards(session.game, session.selectedCardIds),
        selectedCardIds: [],
      }
    }

    case 'game/restart':
      return createInitialSession()
  }
}
