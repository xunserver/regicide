import { ENEMY_STATS } from './constants.ts'
import type { Card, Rank, Suit } from './types.ts'

export function cardId(suit: Suit, rank: Rank): string {
  return `${suit}${rank}`
}

export function makeCard(suit: Suit, rank: Rank): Card {
  return { id: cardId(suit, rank), suit, rank }
}

/** Attack / discard cover value for a card. */
export function cardValue(card: Card): number {
  switch (card.rank) {
    case 'A':
      return 1
    case 'J':
      return 10
    case 'Q':
      return 15
    case 'K':
      return 20
    default:
      return Number(card.rank)
  }
}

export function isAce(card: Card): boolean {
  return card.rank === 'A'
}

export function isRoyal(card: Card): boolean {
  return card.rank === 'J' || card.rank === 'Q' || card.rank === 'K'
}

export function enemyStatsFor(rank: Rank): { attack: number; health: number } {
  if (rank !== 'J' && rank !== 'Q' && rank !== 'K') {
    throw new Error(`Not a royal rank: ${rank}`)
  }
  return ENEMY_STATS[rank]
}

export function findCards(hand: readonly Card[], ids: readonly string[]): Card[] | null {
  const remaining = new Map<string, Card>()
  for (const card of hand) {
    remaining.set(card.id, card)
  }

  const selected: Card[] = []
  for (const id of ids) {
    const card = remaining.get(id)
    if (!card) return null
    remaining.delete(id)
    selected.push(card)
  }
  return selected
}

export function removeCards(hand: readonly Card[], ids: readonly string[]): Card[] {
  const idSet = new Set(ids)
  return hand.filter((card) => !idSet.has(card.id))
}

export function sumValues(cards: readonly Card[]): number {
  return cards.reduce((total, card) => total + cardValue(card), 0)
}
