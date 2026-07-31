import type { CardId, GameEvent, GameState, PlayerId } from '@regicide/game-core'

export interface GameSession {
  readonly game: GameState
  readonly selectedCardIds: CardId[]
  readonly lastEvents: GameEvent[]
  readonly restartCount: number
}

export type GameCommand =
  | { readonly type: 'card/toggle'; readonly cardId: CardId }
  | { readonly type: 'cards/submit' }
  | { readonly type: 'game/yield' }
  | { readonly type: 'solo-jester/use'; readonly cardId: CardId }
  | { readonly type: 'next-player/choose'; readonly playerId: PlayerId }
  | { readonly type: 'game/restart' }
