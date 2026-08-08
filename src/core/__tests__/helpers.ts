import type { Card, EnemyState, GameState, Rank, Suit } from '../types.ts'
import { makeCard } from '../cards.ts'
import { makeEnemy } from '../setup.ts'

export function card(suit: Suit, rank: Rank): Card {
  return makeCard(suit, rank)
}

export function enemy(suit: Suit, rank: 'J' | 'Q' | 'K', overrides?: Partial<EnemyState>): EnemyState {
  return {
    ...makeEnemy(makeCard(suit, rank)),
    ...overrides,
    card: makeCard(suit, rank),
  }
}

export function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    phase: 'play',
    tavern: [],
    castle: [],
    discard: [],
    playArea: [],
    hand: [],
    enemy: enemy('H', 'J'),
    jestersRemaining: 2,
    jestersUsed: 0,
    lastTurnYielded: false,
    ...overrides,
  }
}
