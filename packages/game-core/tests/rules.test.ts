import { describe, expect, it } from 'vitest'
import { calculatePower, createInitialGame, playCards } from '../src'

describe('game rules', () => {
  it('calculates the total power of cards', () => {
    const game = createInitialGame()

    expect(calculatePower([game.hand[0]!, game.hand[2]!])).toBe(16)
  })

  it('plays cards without mutating the previous state', () => {
    const initial = createInitialGame()
    const next = playCards(initial, ['heart-7', 'diamond-9'])

    expect(next.enemy.health).toBe(8)
    expect(next.hand).toHaveLength(3)
    expect(next.discard).toHaveLength(2)
    expect(next.turn).toBe(2)
    expect(initial.enemy.health).toBe(24)
  })

  it('ignores an empty play', () => {
    const initial = createInitialGame()

    expect(playCards(initial, [])).toBe(initial)
  })
})
