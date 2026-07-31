import type { Card, CardId, NumericRank, RoyalRank, Suit, SuitedCard, SuitedRank } from './types'

export const SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
export const NUMERIC_RANKS: readonly NumericRank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10]
export const ROYAL_RANKS: readonly RoyalRank[] = ['jack', 'queen', 'king']
export const JESTER_IDS: readonly CardId[] = ['jester-1', 'jester-2']

function suitedCardId(suit: Suit, rank: SuitedRank): CardId {
  return `${suit}-${rank}`
}

const suitedCards: SuitedCard[] = SUITS.flatMap((suit) =>
  [...NUMERIC_RANKS, 'animal-companion' as const, ...ROYAL_RANKS].map((rank) => ({
    id: suitedCardId(suit, rank),
    kind: 'suited' as const,
    suit,
    rank,
  })),
)

const jesters: Card[] = JESTER_IDS.map((id) => ({ id, kind: 'jester', rank: 'jester' }))

export const CARDS: readonly Card[] = [...suitedCards, ...jesters]
export const CARD_IDS: readonly CardId[] = CARDS.map((card) => card.id)

const cardById = new Map(CARDS.map((card) => [card.id, card]))

export function getCard(cardId: CardId): Card {
  const card = cardById.get(cardId)
  if (!card) throw new RangeError(`Unknown card id: ${cardId}`)
  return card
}

export function isCardId(value: unknown): value is CardId {
  return typeof value === 'string' && cardById.has(value)
}

export function getCardValue(cardId: CardId): number {
  const card = getCard(cardId)
  if (card.kind === 'jester') return 0
  if (typeof card.rank === 'number') return card.rank
  if (card.rank === 'animal-companion') return 1
  return getEnemyStats(card.rank).attack
}

export function isRoyalCard(card: Card): card is SuitedCard & { rank: RoyalRank } {
  return card.kind === 'suited' && ROYAL_RANKS.includes(card.rank as RoyalRank)
}

export function getEnemyStats(rank: RoyalRank): {
  readonly attack: number
  readonly health: number
} {
  switch (rank) {
    case 'jack':
      return { attack: 10, health: 20 }
    case 'queen':
      return { attack: 15, health: 30 }
    case 'king':
      return { attack: 20, health: 40 }
  }
}

export function getCardsByRank(rank: RoyalRank): CardId[] {
  return SUITS.map((suit) => suitedCardId(suit, rank))
}

export function getTavernCardIds(): CardId[] {
  return SUITS.flatMap((suit) =>
    [...NUMERIC_RANKS, 'animal-companion' as const].map((rank) => suitedCardId(suit, rank)),
  )
}
