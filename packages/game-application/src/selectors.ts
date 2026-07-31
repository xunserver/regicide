import { calculatePower } from '@regicide/game-core'
import type { GameSession } from './types'

export function getSelectedPower(session: GameSession): number {
  const selected = new Set(session.selectedCardIds)
  return calculatePower(session.game.hand.filter((card) => selected.has(card.id)))
}
