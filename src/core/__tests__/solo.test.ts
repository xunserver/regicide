import { describe, expect, it } from 'vitest'
import { applyAction, createSeededRng, getDefendDamage } from '../index.ts'
import { baseState, card, enemy } from './helpers.ts'

describe('solo rules', () => {
  it('rejects consecutive yields', () => {
    const rng = createSeededRng(1)
    const state = baseState({
      hand: [card('H', '10'), card('D', '10'), card('C', '10')],
      enemy: enemy('S', 'J', { attack: 10, shield: 10 }), // 0 damage after shield
    })

    const first = applyAction(state, { type: 'YIELD' }, rng)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    // shield == attack → auto skip defend back to play with lastTurnYielded
    expect(first.state.phase).toBe('play')
    expect(first.state.lastTurnYielded).toBe(true)

    const second = applyAction(first.state, { type: 'YIELD' }, rng)
    expect(second.ok).toBe(false)
  })

  it('requires discards to cover remaining attack', () => {
    const rng = createSeededRng(1)
    const state = baseState({
      hand: [card('H', '6'), card('D', '5'), card('C', '2')],
      enemy: enemy('S', 'J'), // atk 10, no shield
    })

    // Yield into defend
    const yielded = applyAction(state, { type: 'YIELD' }, rng)
    expect(yielded.ok).toBe(true)
    if (!yielded.ok) return
    expect(yielded.state.phase).toBe('defend')
    expect(getDefendDamage(yielded.state)).toBe(10)

    const blocked = applyAction(
      yielded.state,
      { type: 'DEFEND', cardIds: ['H6', 'D5'] },
      rng,
    )
    expect(blocked.ok).toBe(true)
    if (!blocked.ok) return
    expect(blocked.state.phase).toBe('play')
    expect(blocked.state.hand.map((c) => c.id)).toEqual(['C2'])
  })

  it('loses when hand cannot cover damage', () => {
    const rng = createSeededRng(1)
    const state = baseState({
      hand: [card('H', '2')],
      enemy: enemy('D', 'J'), // atk 10
    })

    const result = applyAction(state, { type: 'YIELD' }, rng)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.phase).toBe('lost')
    expect(result.state.defeatReason).toMatch(/cover/i)
  })

  it('flips jester to discard and refill hand', () => {
    const rng = createSeededRng(1)
    const state = baseState({
      hand: [card('H', '2'), card('H', '3')],
      tavern: [
        card('D', '2'),
        card('D', '3'),
        card('D', '4'),
        card('D', '5'),
        card('D', '6'),
        card('D', '7'),
        card('D', '8'),
        card('D', '9'),
      ],
      jestersRemaining: 2,
      jestersUsed: 0,
    })

    const result = applyAction(state, { type: 'FLIP_JESTER' }, rng)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.jestersRemaining).toBe(1)
    expect(result.state.jestersUsed).toBe(1)
    expect(result.state.hand).toHaveLength(8)
    expect(result.state.discard.map((c) => c.id).sort()).toEqual(['H2', 'H3'])
  })

  it('wins with gold when no jesters used', () => {
    const rng = createSeededRng(1)
    const state = baseState({
      hand: [card('C', '10')],
      enemy: enemy('H', 'K', { damageDealt: 20 }), // need 20 more; clubs 10 → 20 exact
      castle: [],
      jestersUsed: 0,
    })

    const result = applyAction(state, { type: 'PLAY', cardIds: ['C10'] }, rng)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.phase).toBe('won')
    expect(result.state.victory).toBe('gold')
  })

  it('wins with bronze when two jesters used', () => {
    const rng = createSeededRng(1)
    const state = baseState({
      hand: [card('C', '10')],
      enemy: enemy('H', 'K', { damageDealt: 20 }),
      castle: [],
      jestersUsed: 2,
      jestersRemaining: 0,
    })

    const result = applyAction(state, { type: 'PLAY', cardIds: ['C10'] }, rng)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.victory).toBe('bronze')
  })

  it('loses when empty-handed after a yield', () => {
    const rng = createSeededRng(1)
    // Shield fully blocks so yield returns to play with empty hand + lastTurnYielded
    const state = baseState({
      hand: [],
      enemy: enemy('H', 'J', { shield: 10 }),
      lastTurnYielded: false,
    })

    const result = applyAction(state, { type: 'YIELD' }, rng)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.state.phase).toBe('lost')
  })

  it('allows multiple plays in one turn until END_TURN', () => {
    const rng = createSeededRng(1)
    const state = baseState({
      hand: [card('H', '4'), card('D', '5'), card('C', '6'), card('S', '7')],
      enemy: enemy('C', 'J'), // atk 10, immunity clubs
    })

    const first = applyAction(state, { type: 'PLAY', cardIds: ['H4'] }, rng)
    expect(first.ok).toBe(true)
    if (!first.ok) return
    expect(first.state.phase).toBe('play')
    expect(first.state.playedThisTurn).toBe(true)
    expect(first.state.enemy?.damageDealt).toBe(4)
    expect(first.events.some((e) => e.type === 'DEFEND_REQUIRED')).toBe(false)

    const second = applyAction(first.state, { type: 'PLAY', cardIds: ['D5'] }, rng)
    expect(second.ok).toBe(true)
    if (!second.ok) return
    expect(second.state.phase).toBe('play')
    expect(second.state.enemy?.damageDealt).toBe(9)

    const yieldedInstead = applyAction(second.state, { type: 'YIELD' }, rng)
    expect(yieldedInstead.ok).toBe(false)

    const ended = applyAction(second.state, { type: 'END_TURN' }, rng)
    expect(ended.ok).toBe(true)
    if (!ended.ok) return
    expect(ended.state.phase).toBe('defend')
    expect(ended.events.some((e) => e.type === 'TURN_ENDED')).toBe(true)
    expect(getDefendDamage(ended.state)).toBe(10)
  })

  it('rejects END_TURN before any play', () => {
    const rng = createSeededRng(1)
    const state = baseState({
      hand: [card('H', '4')],
      enemy: enemy('S', 'J'),
    })
    const result = applyAction(state, { type: 'END_TURN' }, rng)
    expect(result.ok).toBe(false)
  })
})
