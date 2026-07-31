import { getAttackValue, getLegalCommands } from '@regicide/game-core'
import type { GameCommand as CoreGameCommand, PlayerState } from '@regicide/game-core'
import type { GameSession } from './types'

export function getCurrentPlayer(session: GameSession): PlayerState {
  const player = session.game.players.find(
    (candidate) => candidate.id === session.game.currentPlayerId,
  )
  if (!player) throw new Error('Current player is missing from the game')
  return player
}

export function getSelectedValue(session: GameSession): number {
  return getAttackValue(session.selectedCardIds)
}

export function getSelectedSubmitCommand(session: GameSession): CoreGameCommand | null {
  const { game, selectedCardIds } = session
  const type =
    game.pendingDecision === 'play-or-yield'
      ? 'play-cards'
      : game.pendingDecision === 'discard-for-damage'
        ? 'discard-for-damage'
        : null
  if (!type || selectedCardIds.length === 0) return null

  const legal = getLegalCommands(game, game.currentPlayerId)
  return (
    legal.find(
      (command) =>
        command.type === type &&
        command.cardIds.length === selectedCardIds.length &&
        command.cardIds.every((cardId) => selectedCardIds.includes(cardId)),
    ) ?? null
  )
}
