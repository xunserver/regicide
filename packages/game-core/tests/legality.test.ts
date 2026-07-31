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
})
