export type Suit = 'H' | 'D' | 'C' | 'S'

export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'

export type Card = {
  id: string
  rank: Rank
  suit: Suit
}

export type Phase = 'play' | 'defend' | 'won' | 'lost'

export type VictoryRank = 'gold' | 'silver' | 'bronze'

export type EnemyState = {
  card: Card
  health: number
  attack: number
  damageDealt: number
  /** Cumulative Spades shield that successfully applied. */
  shield: number
}

export type GameState = {
  phase: Phase
  /** Draw pile; index 0 is the top. */
  tavern: Card[]
  /** Remaining castle enemies after the current one; index 0 is next. */
  castle: Card[]
  discard: Card[]
  /** Cards played against the current enemy. */
  playArea: Card[]
  hand: Card[]
  enemy: EnemyState | null
  jestersRemaining: number
  jestersUsed: number
  /** Solo: cannot yield twice in a row. */
  lastTurnYielded: boolean
  victory?: VictoryRank
  defeatReason?: string
}

export type Action =
  | { type: 'FLIP_JESTER' }
  | { type: 'PLAY'; cardIds: string[] }
  | { type: 'YIELD' }
  | { type: 'DEFEND'; cardIds: string[] }

export type GameEvent =
  | { type: 'JESTER_FLIPPED'; discarded: Card[]; drawn: Card[] }
  | { type: 'CARDS_PLAYED'; cards: Card[]; attackValue: number }
  | { type: 'YIELDED' }
  | { type: 'POWER_HEARTS'; moved: Card[] }
  | { type: 'POWER_DIAMONDS'; drawn: Card[] }
  | { type: 'POWER_CLUBS'; damage: number }
  | { type: 'POWER_SPADES'; shieldAdded: number; shieldTotal: number }
  | { type: 'DAMAGE_DEALT'; damage: number; damageDealt: number }
  | {
      type: 'ENEMY_DEFEATED'
      enemy: Card
      exact: boolean
      nextEnemy: Card | null
    }
  | { type: 'DEFEND_REQUIRED'; damage: number }
  | { type: 'DAMAGE_BLOCKED'; cards: Card[]; damage: number }
  | { type: 'TURN_STARTED' }
  | { type: 'GAME_WON'; victory: VictoryRank }
  | { type: 'GAME_LOST'; reason: string }

export type ApplySuccess = {
  ok: true
  state: GameState
  events: GameEvent[]
}

export type ApplyFailure = {
  ok: false
  error: string
  state: GameState
}

export type ApplyResult = ApplySuccess | ApplyFailure

export type Rng = {
  /** Returns a float in [0, 1). */
  next: () => number
  shuffle: <T>(items: readonly T[]) => T[]
}

/** Seeded RNG that can be checkpointed for save/load. */
export type SeededRng = Rng & {
  /** Current internal PRNG state (not the original seed). */
  getState: () => number
}

export type CreateSoloOptions = {
  seed?: number
  rng?: Rng
}
