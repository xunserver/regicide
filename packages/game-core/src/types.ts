export type Suit = 'heart' | 'diamond' | 'club' | 'spade'

export interface Card {
  id: string
  name: string
  suit: Suit
  power: number
  description: string
}

export type GamePhase = 'player-turn' | 'victory'

export interface GameState {
  phase: GamePhase
  turn: number
  enemy: {
    name: string
    health: number
    maxHealth: number
  }
  hand: Card[]
  discard: Card[]
  log: string[]
}
