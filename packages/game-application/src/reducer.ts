import { createGame, dispatch as dispatchCore } from '@regicide/game-core'
import type { GameCommand as CoreGameCommand } from '@regicide/game-core'
import { getCurrentPlayer, getSelectedSubmitCommand } from './selectors'
import type { GameCommand, GameSession } from './types'

function createSession(restartCount: number): GameSession {
  return {
    game: createGame({
      playerIds: ['player-1'],
      startingPlayerId: 'player-1',
      seed: `web-demo-${restartCount}`,
    }),
    selectedCardIds: [],
    lastEvents: [],
    restartCount,
  }
}

export function createInitialSession(): GameSession {
  return createSession(0)
}

function applyCoreCommand(session: GameSession, command: CoreGameCommand): GameSession {
  const result = dispatchCore(session.game, command)
  if (!result.accepted) return session
  return {
    ...session,
    game: result.state,
    selectedCardIds: [],
    lastEvents: result.events,
  }
}

export function gameReducer(session: GameSession, command: GameCommand): GameSession {
  switch (command.type) {
    case 'card/toggle': {
      if (
        session.game.pendingDecision !== 'play-or-yield' &&
        session.game.pendingDecision !== 'discard-for-damage'
      ) {
        return session
      }
      if (!getCurrentPlayer(session).hand.includes(command.cardId)) return session

      const isSelected = session.selectedCardIds.includes(command.cardId)
      return {
        ...session,
        selectedCardIds: isSelected
          ? session.selectedCardIds.filter((cardId) => cardId !== command.cardId)
          : [...session.selectedCardIds, command.cardId],
      }
    }

    case 'cards/submit': {
      const coreCommand = getSelectedSubmitCommand(session)
      return coreCommand ? applyCoreCommand(session, coreCommand) : session
    }

    case 'game/yield':
      return applyCoreCommand(session, {
        type: 'yield',
        actorId: session.game.currentPlayerId,
      })

    case 'solo-jester/use':
      return applyCoreCommand(session, {
        type: 'use-solo-jester',
        actorId: session.game.currentPlayerId,
        cardId: command.cardId,
      })

    case 'next-player/choose':
      return applyCoreCommand(session, {
        type: 'choose-next-player',
        actorId: session.game.currentPlayerId,
        playerId: command.playerId,
      })

    case 'game/restart':
      return createSession(session.restartCount + 1)
  }
}
