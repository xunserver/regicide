export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'

export type NumericRank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
export type RoyalRank = 'jack' | 'queen' | 'king'
export type SuitedRank = NumericRank | 'animal-companion' | RoyalRank

export type CardId = string
export type PlayerId = string

export interface SuitedCard {
  readonly id: CardId
  readonly kind: 'suited'
  readonly suit: Suit
  readonly rank: SuitedRank
}

export interface JesterCard {
  readonly id: CardId
  readonly kind: 'jester'
  readonly rank: 'jester'
}

export type Card = SuitedCard | JesterCard

export interface RandomState {
  readonly algorithm: 'xorshift32'
  readonly state: number
}

export interface PlayerState {
  readonly id: PlayerId
  readonly hand: CardId[]
  readonly maxHandSize: number
  readonly yieldedLastTurn: boolean
}

export interface PlayRecord {
  readonly playerId: PlayerId
  readonly cardIds: CardId[]
}

export interface CurrentEnemy {
  readonly cardId: CardId
  readonly plays: PlayRecord[]
}

export type PendingDecision = 'play-or-yield' | 'discard-for-damage' | 'choose-next-player'

export type VictoryRating = 'gold' | 'silver' | 'bronze'

export type GameOutcome =
  | { readonly type: 'won'; readonly rating?: VictoryRating }
  | {
      readonly type: 'lost'
      readonly reason: 'cannot-suffer-damage' | 'cannot-play-or-yield'
      readonly playerId: PlayerId
    }

export interface GameState {
  readonly schemaVersion: 1
  readonly status: 'in-progress' | 'won' | 'lost'
  readonly outcome: GameOutcome | null
  readonly pendingDecision: PendingDecision | null
  readonly players: PlayerState[]
  readonly currentPlayerId: PlayerId
  readonly castleDeck: CardId[]
  readonly currentEnemy: CurrentEnemy | null
  readonly tavernDeck: CardId[]
  readonly discardPile: CardId[]
  readonly soloJesters: {
    readonly available: CardId[]
    readonly used: CardId[]
  }
  readonly excludedCards: CardId[]
  readonly random: RandomState
}

export interface CreateGameConfig {
  readonly playerIds: PlayerId[]
  readonly startingPlayerId: PlayerId
  readonly seed: string | number
}

export type GameCommand =
  | { readonly type: 'play-cards'; readonly actorId: PlayerId; readonly cardIds: CardId[] }
  | { readonly type: 'yield'; readonly actorId: PlayerId }
  | {
      readonly type: 'discard-for-damage'
      readonly actorId: PlayerId
      readonly cardIds: CardId[]
    }
  | {
      readonly type: 'choose-next-player'
      readonly actorId: PlayerId
      readonly playerId: PlayerId
    }
  | {
      readonly type: 'use-solo-jester'
      readonly actorId: PlayerId
      readonly cardId: CardId
    }

export type RejectionReason =
  | 'game-over'
  | 'wrong-player'
  | 'wrong-decision'
  | 'card-not-in-hand'
  | 'duplicate-card'
  | 'illegal-play'
  | 'yield-not-allowed'
  | 'insufficient-discard'
  | 'invalid-next-player'
  | 'solo-jester-unavailable'

export interface CardDraw {
  readonly playerId: PlayerId
  readonly cardId: CardId
}

export type GameEvent =
  | {
      readonly type: 'cards-played'
      readonly playerId: PlayerId
      readonly cardIds: CardId[]
      readonly attackValue: number
    }
  | {
      readonly type: 'hearts-resolved'
      readonly cardIds: CardId[]
    }
  | {
      readonly type: 'diamonds-resolved'
      readonly draws: CardDraw[]
    }
  | { readonly type: 'enemy-immunity-cancelled'; readonly enemyId: CardId }
  | {
      readonly type: 'enemy-damaged'
      readonly enemyId: CardId
      readonly amount: number
      readonly totalDamage: number
    }
  | {
      readonly type: 'enemy-defeated'
      readonly enemyId: CardId
      readonly exact: boolean
    }
  | { readonly type: 'enemy-revealed'; readonly enemyId: CardId }
  | {
      readonly type: 'counterattack-required'
      readonly playerId: PlayerId
      readonly amount: number
    }
  | {
      readonly type: 'damage-suffered'
      readonly playerId: PlayerId
      readonly amount: number
      readonly cardIds: CardId[]
    }
  | { readonly type: 'player-yielded'; readonly playerId: PlayerId }
  | {
      readonly type: 'next-player-chosen'
      readonly playerId: PlayerId
      readonly chosenBy: PlayerId
    }
  | {
      readonly type: 'solo-jester-used'
      readonly playerId: PlayerId
      readonly cardId: CardId
      readonly discardedCardIds: CardId[]
      readonly drawnCardIds: CardId[]
    }
  | { readonly type: 'turn-started'; readonly playerId: PlayerId }
  | { readonly type: 'game-won'; readonly rating?: VictoryRating }
  | {
      readonly type: 'game-lost'
      readonly reason: 'cannot-suffer-damage' | 'cannot-play-or-yield'
      readonly playerId: PlayerId
    }

export type TransitionResult =
  | { readonly accepted: true; readonly state: GameState; readonly events: GameEvent[] }
  | {
      readonly accepted: false
      readonly state: GameState
      readonly events: []
      readonly reason: RejectionReason
    }
