import {
  HAND_LIMIT_SOLO,
  JESTERS_SOLO,
  NUMBER_RANKS,
  ROYAL_RANKS,
  SUITS,
} from './constants.ts'
import { enemyStatsFor, makeCard } from './cards.ts'
import { createMathRng, createSeededRng } from './rng.ts'
import type { Card, CreateSoloOptions, EnemyState, GameState, Rng } from './types.ts'

export function createSoloGame(options: CreateSoloOptions = {}): {
  state: GameState
  rng: Rng
} {
  const rng =
    options.rng ??
    (options.seed !== undefined ? createSeededRng(options.seed) : createMathRng())

  const castle = buildCastle(rng)
  const current = castle.shift()
  if (!current) {
    throw new Error('Castle deck is empty')
  }

  const tavern = buildTavern(rng)
  const hand: Card[] = []
  while (hand.length < HAND_LIMIT_SOLO && tavern.length > 0) {
    hand.push(tavern.shift()!)
  }

  const state: GameState = {
    phase: 'play',
    tavern,
    castle,
    discard: [],
    playArea: [],
    hand,
    enemy: makeEnemy(current),
    jestersRemaining: JESTERS_SOLO,
    jestersUsed: 0,
    lastTurnYielded: false,
  }

  return { state, rng }
}

export function makeEnemy(card: Card): EnemyState {
  const stats = enemyStatsFor(card.rank)
  return {
    card,
    health: stats.health,
    attack: stats.attack,
    damageDealt: 0,
    shield: 0,
  }
}

function buildCastle(rng: Rng): Card[] {
  const byRank = ROYAL_RANKS.map((rank) => {
    const royals = SUITS.map((suit) => makeCard(suit, rank))
    return rng.shuffle(royals)
  })

  // Kings at bottom, then Queens, Jacks on top — draw from front.
  return [...byRank[0]!, ...byRank[1]!, ...byRank[2]!]
}

function buildTavern(rng: Rng): Card[] {
  const cards: Card[] = []
  for (const suit of SUITS) {
    for (const rank of NUMBER_RANKS) {
      cards.push(makeCard(suit, rank))
    }
  }
  // Solo: jesters stay aside (not in tavern).
  return rng.shuffle(cards)
}
