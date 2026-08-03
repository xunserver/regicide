import { describe, expect, it } from 'vitest'
import { getLegalCommands, isLegalPlay } from '../src'
import { createFixture } from './fixtures'

describe('play legality', () => {
  it('accepts single cards and Animal Companion pairs', () => {
    expect(isLegalPlay(['hearts-10'])).toBe(true)
    expect(isLegalPlay(['hearts-animal-companion', 'clubs-king'])).toBe(true)
    expect(isLegalPlay(['hearts-animal-companion', 'clubs-animal-companion'])).toBe(true)
  })

  it('accepts only same-rank numeric combos totaling at most ten', () => {
    expect(isLegalPlay(['hearts-5', 'clubs-5'])).toBe(true)
    expect(isLegalPlay(['hearts-3', 'clubs-3', 'spades-3'])).toBe(true)
    expect(isLegalPlay(['hearts-2', 'clubs-2', 'spades-2', 'diamonds-2'])).toBe(true)
    expect(isLegalPlay(['hearts-6', 'clubs-6'])).toBe(false)
    expect(isLegalPlay(['hearts-2', 'clubs-3'])).toBe(false)
    expect(isLegalPlay(['hearts-jack', 'clubs-jack'])).toBe(false)
    expect(isLegalPlay(['jester-1', 'hearts-2'])).toBe(false)
    expect(isLegalPlay([])).toBe(false)
    expect(isLegalPlay(['hearts-2', 'hearts-2'])).toBe(false)
    expect(isLegalPlay(['hearts-2', 'clubs-2', 'spades-2', 'diamonds-2', 'hearts-3'])).toBe(false)
  })

  it('enumerates every legal choice but not illegal combinations', () => {
    const game = createFixture({
      players: [{ id: 'p1', hand: ['hearts-5', 'clubs-5', 'spades-6'] }, { id: 'p2' }],
    })
    const commands = getLegalCommands(game, 'p1')

    expect(commands).toContainEqual({
      type: 'play-cards',
      actorId: 'p1',
      cardIds: ['hearts-5', 'clubs-5'],
    })
    expect(commands).not.toContainEqual({
      type: 'play-cards',
      actorId: 'p1',
      cardIds: ['hearts-5', 'spades-6'],
    })
    expect(commands).toContainEqual({ type: 'yield', actorId: 'p1' })
  })

  it('returns no commands for an inactive actor or terminal game', () => {
    const active = createFixture()
    const won = createFixture({ status: 'won', outcome: { type: 'won' } })
    expect(getLegalCommands(active, 'p2')).toEqual([])
    expect(getLegalCommands(active, 'missing')).toEqual([])
    expect(getLegalCommands(won, 'p1')).toEqual([])
  })

  it('enumerates only sufficient discards during counterattack damage', () => {
    const game = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2', 'clubs-8', 'spades-10'] }, { id: 'p2' }],
      pendingDecision: 'discard-for-damage',
    })
    const commands = getLegalCommands(game, 'p1')

    expect(commands.every((command) => command.type === 'discard-for-damage')).toBe(true)
    expect(commands).toContainEqual({
      type: 'discard-for-damage',
      actorId: 'p1',
      cardIds: ['spades-10'],
    })
    expect(commands).toContainEqual({
      type: 'discard-for-damage',
      actorId: 'p1',
      cardIds: ['hearts-2', 'clubs-8'],
    })
    expect(commands).not.toContainEqual({
      type: 'discard-for-damage',
      actorId: 'p1',
      cardIds: ['hearts-2'],
    })
  })

  it('enumerates every player during a Jester choice', () => {
    const game = createFixture({
      players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
      plays: [{ playerId: 'p1', cardIds: ['jester-1'] }],
      pendingDecision: 'choose-next-player',
    })
    expect(getLegalCommands(game, 'p1')).toEqual([
      { type: 'choose-next-player', actorId: 'p1', playerId: 'p1' },
      { type: 'choose-next-player', actorId: 'p1', playerId: 'p2' },
      { type: 'choose-next-player', actorId: 'p1', playerId: 'p3' },
    ])
  })

  it('offers available Solo Jesters in both actionable phases', () => {
    const play = createFixture({ players: [{ id: 'p1', hand: ['hearts-2'] }] })
    const discard = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2'] }],
      pendingDecision: 'discard-for-damage',
    })
    for (const game of [play, discard]) {
      expect(getLegalCommands(game, 'p1')).toContainEqual({
        type: 'use-solo-jester',
        actorId: 'p1',
        cardId: 'jester-1',
      })
      expect(getLegalCommands(game, 'p1')).toContainEqual({
        type: 'use-solo-jester',
        actorId: 'p1',
        cardId: 'jester-2',
      })
    }
  })
})
