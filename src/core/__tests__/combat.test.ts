import { describe, expect, it } from 'vitest'
import { applyAction, createSeededRng } from '../index.ts'
import { baseState, card, enemy } from './helpers.ts'

describe('suit powers and combat', () => {
  it('doubles damage with Clubs and shields with Spades', () => {
    const rng = createSeededRng(1)
    const state = baseState({
      hand: [card('C', '8'), card('S', '5')],
      enemy: enemy('H', 'J'),
    })

    const clubs = applyAction(state, { type: 'PLAY', cardIds: ['C8'] }, rng)
    expect(clubs.ok).toBe(true)
    if (!clubs.ok) return
    expect(clubs.state.enemy?.damageDealt).toBe(16)
    expect(clubs.events.some((e) => e.type === 'POWER_CLUBS')).toBe(true)

    // Continue from a fresh play against same enemy with prior damage/shield cleared for spades test
    const spadesState = baseState({
      phase: 'play',
      hand: [card('S', '5')],
      enemy: enemy('H', 'J', { damageDealt: 0, shield: 0 }),
    })
    const spades = applyAction(spadesState, { type: 'PLAY', cardIds: ['S5'] }, rng)
    expect(spades.ok).toBe(true)
    if (!spades.ok) return
    expect(spades.state.enemy?.shield).toBe(5)
    expect(spades.state.enemy?.damageDealt).toBe(5)
  })

  it('ignores suit power matching enemy immunity', () => {
    const rng = createSeededRng(1)
    const state = baseState({
      hand: [card('D', '7')],
      tavern: [card('H', '2'), card('H', '3')],
      enemy: enemy('D', 'J'),
    })

    const result = applyAction(state, { type: 'PLAY', cardIds: ['D7'] }, rng)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.hand).toHaveLength(0)
    expect(result.state.tavern).toHaveLength(2)
    expect(result.events.some((e) => e.type === 'POWER_DIAMONDS')).toBe(false)
    expect(result.state.enemy?.damageDealt).toBe(7)
  })

  it('resolves Hearts before Diamonds on Ace pairs', () => {
    const rng = createSeededRng(1)
    const state = baseState({
      hand: [card('H', 'A'), card('D', '8')],
      discard: [card('C', '2'), card('C', '3'), card('C', '4')],
      tavern: [card('S', '2'), card('S', '3'), card('S', '4'), card('S', '5'), card('S', '6'), card('S', '7'), card('S', '8'), card('S', '9'), card('S', '10')],
      enemy: enemy('C', 'J'),
    })

    const result = applyAction(state, { type: 'PLAY', cardIds: ['HA', 'D8'] }, rng)
    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Attack 9: hearts move 9 (only 3 available) under tavern, then diamonds draw 9 (hand limit 8).
    expect(result.events.some((e) => e.type === 'POWER_HEARTS')).toBe(true)
    expect(result.events.some((e) => e.type === 'POWER_DIAMONDS')).toBe(true)
    expect(result.state.hand.length).toBeLessThanOrEqual(8)
    expect(result.state.enemy?.damageDealt).toBe(9)
  })

  it('applies combo powers at total attack value', () => {
    const rng = createSeededRng(1)
    const state = baseState({
      hand: [card('D', '3'), card('S', '3'), card('C', '3')],
      tavern: Array.from({ length: 20 }, (_, i) =>
        card('H', (['A', '2', '4', '5', '6', '7', '8', '9', '10'] as const)[i % 9]!),
      ),
      enemy: enemy('H', 'J'),
    })

    const result = applyAction(
      state,
      { type: 'PLAY', cardIds: ['D3', 'S3', 'C3'] },
      rng,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // Total 9: draw 9, shield 9, deal 18
    expect(result.state.enemy?.shield).toBe(9)
    expect(result.state.enemy?.damageDealt).toBe(18)
    expect(result.state.hand.length).toBe(8) // emptied 3, drew up to limit
  })

  it('places exact-kill enemy on top of tavern', () => {
    const rng = createSeededRng(1)
    const jack = card('H', 'J')
    const next = card('D', 'J')
    const state = baseState({
      hand: [card('C', '10')],
      enemy: enemy('H', 'J', { damageDealt: 0, card: jack }),
      castle: [next],
    })

    // Clubs 10 → 20 damage exact
    const result = applyAction(state, { type: 'PLAY', cardIds: ['C10'] }, rng)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.tavern[0]?.id).toBe('HJ')
    expect(result.state.enemy?.card.id).toBe('DJ')
    expect(result.state.phase).toBe('play')
    expect(result.state.playArea).toHaveLength(0)
  })

  it('discards overkill enemy and skips defend', () => {
    const rng = createSeededRng(1)
    const state = baseState({
      hand: [card('C', '10')],
      enemy: enemy('H', 'J', { damageDealt: 5 }),
      castle: [card('S', 'J')],
      discard: [],
    })

    // 16 damage → total 21 > 20
    const result = applyAction(state, { type: 'PLAY', cardIds: ['C10'] }, rng)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.discard.some((c) => c.id === 'HJ')).toBe(true)
    expect(result.state.phase).toBe('play')
    expect(result.events.some((e) => e.type === 'DEFEND_REQUIRED')).toBe(false)
  })
})
