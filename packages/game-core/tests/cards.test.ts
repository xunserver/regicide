import { describe, expect, it } from 'vitest'
import {
  CARDS,
  CARD_IDS,
  JESTER_IDS,
  NUMERIC_RANKS,
  ROYAL_RANKS,
  SUITS,
  getCard,
  getCardValue,
  getEnemyStats,
  isCardId,
  isRoyalCard,
} from '../src'

describe('card catalog', () => {
  it('contains every unique suited card and both Jesters', () => {
    expect(SUITS).toEqual(['hearts', 'diamonds', 'clubs', 'spades'])
    expect(NUMERIC_RANKS).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(ROYAL_RANKS).toEqual(['jack', 'queen', 'king'])
    expect(JESTER_IDS).toEqual(['jester-1', 'jester-2'])
    expect(CARDS).toHaveLength(54)
    expect(CARD_IDS).toHaveLength(54)
    expect(new Set(CARD_IDS)).toHaveLength(54)
  })

  it('looks up and identifies known card ids', () => {
    expect(getCard('hearts-5')).toEqual({
      id: 'hearts-5',
      kind: 'suited',
      suit: 'hearts',
      rank: 5,
    })
    expect(getCard('jester-1')).toEqual({ id: 'jester-1', kind: 'jester', rank: 'jester' })
    expect(isCardId('spades-king')).toBe(true)
    expect(isCardId('unknown-card')).toBe(false)
    expect(isCardId(5)).toBe(false)
    expect(() => getCard('unknown-card')).toThrow('Unknown card id')
  })

  it.each([
    ['jester-1', 0],
    ['hearts-animal-companion', 1],
    ['diamonds-2', 2],
    ['clubs-10', 10],
    ['spades-jack', 10],
    ['spades-queen', 15],
    ['spades-king', 20],
  ] as const)('assigns %s a value of %i', (cardId, value) => {
    expect(getCardValue(cardId)).toBe(value)
  })

  it('identifies Royals and exposes all Royal statistics', () => {
    expect(isRoyalCard(getCard('hearts-jack'))).toBe(true)
    expect(isRoyalCard(getCard('hearts-10'))).toBe(false)
    expect(isRoyalCard(getCard('jester-1'))).toBe(false)
    expect(getEnemyStats('jack')).toEqual({ attack: 10, health: 20 })
    expect(getEnemyStats('queen')).toEqual({ attack: 15, health: 30 })
    expect(getEnemyStats('king')).toEqual({ attack: 20, health: 40 })
  })
})
