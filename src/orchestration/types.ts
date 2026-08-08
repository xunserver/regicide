import type { Card, GameEvent, GameState, Suit, VictoryRank } from '../core/index.ts'

export type Intent =
  | { type: 'TOGGLE_CARD'; cardId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'CONFIRM_PLAY' }
  | { type: 'CONFIRM_DEFEND' }
  | { type: 'YIELD' }
  | { type: 'FLIP_JESTER' }
  | { type: 'NEW_GAME'; seed?: number }

export type AvailableCommands = {
  canToggleCards: boolean
  canConfirmPlay: boolean
  canConfirmDefend: boolean
  canYield: boolean
  canFlipJester: boolean
  canNewGame: boolean
}

export type PlayPreview = {
  ok: true
  attackValue: number
  suits: Suit[]
  activeSuits: Suit[]
  damage: number
  immuneSuits: Suit[]
} | {
  ok: false
  error: string
}

export type DefendPreview = {
  required: number
  selectedValue: number
  remaining: number
  enough: boolean
}

export type EnemyView = {
  card: Card
  health: number
  attack: number
  damageDealt: number
  shield: number
  remainingHealth: number
  incomingDamage: number
}

export type SessionView = {
  phase: GameState['phase']
  hand: Card[]
  playArea: Card[]
  discardCount: number
  tavernCount: number
  castleRemaining: number
  enemiesDefeated: number
  enemy: EnemyView | null
  jestersRemaining: number
  jestersUsed: number
  selection: string[]
  selectedCards: Card[]
  commands: AvailableCommands
  playPreview: PlayPreview | null
  defendPreview: DefendPreview | null
  victory?: VictoryRank
  defeatReason?: string
  seed: number
  createdAt: number
  updatedAt: number
}

export type DispatchSuccess = {
  ok: true
  events: GameEvent[]
  view: SessionView
}

export type DispatchFailure = {
  ok: false
  error: string
  view: SessionView
}

export type DispatchResult = DispatchSuccess | DispatchFailure

export type PersistedSession = {
  version: 1
  seed: number
  rngState: number
  state: GameState
  selection: string[]
  createdAt: number
  updatedAt: number
}

export type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

export type CreateControllerOptions = {
  seed?: number
  storage?: StorageLike | null
  storageKey?: string
  now?: () => number
}
