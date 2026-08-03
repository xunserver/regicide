import { describe, expect, it } from 'vitest'
import {
  getAttackValue,
  getCounterattackDamage,
  getCurrentEnemyStats,
  getEnemyDamage,
  getEnemyShield,
  isEnemyImmunityCancelled,
} from '../src'
import { createFixture } from './fixtures'

describe('rule queries', () => {
  it('adds the values of numeric, companion, Royal, and Jester cards', () => {
    expect(getAttackValue(['hearts-2', 'clubs-animal-companion', 'jester-1'])).toBe(3)
    expect(getAttackValue(['hearts-jack', 'diamonds-queen', 'clubs-king'])).toBe(45)
    expect(getAttackValue([])).toBe(0)
  })

  it('doubles Clubs damage unless the enemy has Clubs immunity', () => {
    const active = createFixture({
      currentEnemyId: 'hearts-queen',
      plays: [{ playerId: 'p1', cardIds: ['clubs-5'] }],
    })
    const immune = createFixture({
      currentEnemyId: 'clubs-queen',
      plays: [{ playerId: 'p1', cardIds: ['clubs-5'] }],
    })
    const cancelledFirst = createFixture({
      currentEnemyId: 'clubs-queen',
      plays: [
        { playerId: 'p1', cardIds: ['jester-1'] },
        { playerId: 'p2', cardIds: ['clubs-5'] },
      ],
    })
    const cancelledAfter = createFixture({
      currentEnemyId: 'clubs-queen',
      plays: [
        { playerId: 'p1', cardIds: ['clubs-5'] },
        { playerId: 'p2', cardIds: ['jester-1'] },
      ],
    })

    expect(getEnemyDamage(active)).toBe(10)
    expect(getEnemyDamage(immune)).toBe(5)
    expect(getEnemyDamage(cancelledFirst)).toBe(10)
    expect(getEnemyDamage(cancelledAfter)).toBe(5)
  })

  it('accumulates Spades shield and applies Jester cancellation retroactively', () => {
    const active = createFixture({
      currentEnemyId: 'hearts-queen',
      plays: [
        { playerId: 'p1', cardIds: ['spades-5'] },
        { playerId: 'p2', cardIds: ['spades-4'] },
      ],
    })
    const immune = createFixture({
      currentEnemyId: 'spades-queen',
      plays: [{ playerId: 'p1', cardIds: ['spades-5'] }],
    })
    const cancelled = createFixture({
      currentEnemyId: 'spades-queen',
      plays: [
        { playerId: 'p1', cardIds: ['spades-5'] },
        { playerId: 'p2', cardIds: ['jester-1'] },
      ],
    })

    expect(getEnemyShield(active)).toBe(9)
    expect(getEnemyShield(immune)).toBe(0)
    expect(isEnemyImmunityCancelled(immune)).toBe(false)
    expect(isEnemyImmunityCancelled(cancelled)).toBe(true)
    expect(getEnemyShield(cancelled)).toBe(5)
  })

  it('derives effective enemy statistics and clamps health and counterattack to zero', () => {
    const game = createFixture({
      currentEnemyId: 'hearts-jack',
      plays: [{ playerId: 'p1', cardIds: ['clubs-10', 'spades-animal-companion'] }],
    })

    expect(getCurrentEnemyStats(game)).toEqual({
      attack: 10,
      health: 20,
      damage: 22,
      shield: 11,
      healthRemaining: 0,
    })
    expect(getCounterattackDamage(game)).toBe(0)
  })

  it('returns null statistics and zero counterattack after victory', () => {
    const won = createFixture({ status: 'won', outcome: { type: 'won' } })
    expect(getCurrentEnemyStats(won)).toBeNull()
    expect(getCounterattackDamage(won)).toBe(0)
  })

  it('rejects enemy-specific queries when a won game has no current enemy', () => {
    const won = createFixture({ status: 'won', outcome: { type: 'won' } })

    expect(() => getEnemyDamage(won)).toThrow('In-progress game has no current enemy')
    expect(() => getEnemyShield(won)).toThrow('In-progress game has no current enemy')
    expect(() => isEnemyImmunityCancelled(won)).toThrow('In-progress game has no current enemy')
  })
})
