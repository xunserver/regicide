import { describe, expect, it } from 'vitest'
import { createSeededRng, createSeededRngFromState } from '../../core/index.ts'
import { buildView, previewPlay, toggleSelection } from '../queries.ts'
import type { GameState } from '../../core/index.ts'
import { makeCard, makeEnemy } from '../../core/index.ts'

function stateWith(hand: GameState['hand'], enemySuit: 'H' | 'D' | 'C' | 'S' = 'H'): GameState {
  return {
    phase: 'play',
    tavern: [],
    castle: [],
    discard: [],
    playArea: [],
    hand,
    enemy: makeEnemy(makeCard(enemySuit, 'J')),
    jestersRemaining: 2,
    jestersUsed: 0,
    lastTurnYielded: false,
    playedThisTurn: false,
  }
}

describe('queries', () => {
  it('previews club double and diamond immunity', () => {
    const clubs = previewPlay(stateWith([makeCard('C', '8')]), [makeCard('C', '8')])
    expect(clubs.ok).toBe(true)
    if (clubs.ok) expect(clubs.damage).toBe(16)

    const immune = previewPlay(stateWith([makeCard('D', '7')], 'D'), [makeCard('D', '7')])
    expect(immune.ok).toBe(true)
    if (immune.ok) {
      expect(immune.damage).toBe(7)
      expect(immune.immuneSuits).toEqual(['D'])
      expect(immune.activeSuits).toEqual([])
    }
  })

  it('toggles selection membership', () => {
    const state = stateWith([makeCard('H', '2'), makeCard('H', '3')])
    const once = toggleSelection(state, [], 'H2')
    expect(once.selection).toEqual(['H2'])
    const twice = toggleSelection(state, once.selection, 'H2')
    expect(twice.selection).toEqual([])
  })

  it('builds castle progress counters', () => {
    const view = buildView({
      seed: 1,
      createdAt: 1,
      updatedAt: 1,
      selection: [],
      state: {
        ...stateWith([]),
        castle: [makeCard('D', 'J'), makeCard('C', 'J')],
        enemy: makeEnemy(makeCard('H', 'J')),
      },
    })
    expect(view.castleRemaining).toBe(3)
    expect(view.enemiesDefeated).toBe(9)
  })
})

describe('seeded rng checkpoint', () => {
  it('restores the exact stream', () => {
    const rng = createSeededRng(123)
    rng.next()
    rng.shuffle([1, 2, 3, 4])
    const checkpoint = rng.getState()
    const a = rng.next()

    const restored = createSeededRngFromState(checkpoint)
    expect(restored.next()).toBe(a)
  })
})
