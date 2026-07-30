import type { GameState } from '@regicide/game-core'

export interface GameSession {
  game: GameState
  selectedCardIds: string[]
}

export type GameCommand =
  { type: 'card/toggle'; cardId: string } | { type: 'cards/play' } | { type: 'game/restart' }
