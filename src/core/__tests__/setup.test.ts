import { describe, expect, it } from 'vitest'
import { cardValue, createSeededRng, createSoloGame, HAND_LIMIT_SOLO } from '../index.ts'

describe('createSoloGame', () => {
  it('deals 8 cards and reveals a Jack first', () => {
    const { state } = createSoloGame({ seed: 1 })

    expect(state.hand).toHaveLength(HAND_LIMIT_SOLO)
    expect(state.enemy?.card.rank).toBe('J')
    expect(state.castle).toHaveLength(11)
    expect(state.jestersRemaining).toBe(2)
    expect(state.phase).toBe('play')

    const tavernAndHand = [...state.tavern, ...state.hand]
    expect(tavernAndHand).toHaveLength(40) // 4 suits × 10 ranks, no jesters
    expect(tavernAndHand.every((c) => c.rank !== 'J' && c.rank !== 'Q' && c.rank !== 'K')).toBe(
      true,
    )
  })

  it('is deterministic for the same seed', () => {
    const a = createSoloGame({ seed: 42 }).state
    const b = createSoloGame({ seed: 42 }).state
    expect(a.hand.map((c) => c.id)).toEqual(b.hand.map((c) => c.id))
    expect(a.enemy?.card.id).toBe(b.enemy?.card.id)
  })

  it('shuffles with injectable rng', () => {
    const rng = createSeededRng(99)
    const { state } = createSoloGame({ rng })
    expect(state.hand.length).toBe(8)
  })
})

describe('cardValue', () => {
  it('maps ranks to attack values', () => {
    expect(cardValue({ id: 'HA', suit: 'H', rank: 'A' })).toBe(1)
    expect(cardValue({ id: 'D10', suit: 'D', rank: '10' })).toBe(10)
    expect(cardValue({ id: 'SJ', suit: 'S', rank: 'J' })).toBe(10)
    expect(cardValue({ id: 'CQ', suit: 'C', rank: 'Q' })).toBe(15)
    expect(cardValue({ id: 'HK', suit: 'H', rank: 'K' })).toBe(20)
  })
})
