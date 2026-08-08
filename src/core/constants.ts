import type { Rank, Suit } from './types.ts'

export const SUITS: readonly Suit[] = ['H', 'D', 'C', 'S']

export const NUMBER_RANKS: readonly Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
]

export const ROYAL_RANKS: readonly Rank[] = ['J', 'Q', 'K']

export const HAND_LIMIT_SOLO = 8
export const JESTERS_SOLO = 2

export const ENEMY_STATS = {
  J: { attack: 10, health: 20 },
  Q: { attack: 15, health: 30 },
  K: { attack: 20, health: 40 },
} as const
