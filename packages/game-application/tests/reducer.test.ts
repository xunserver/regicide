import { describe, expect, it } from 'vitest'
import { createInitialSession, gameReducer, getSelectedPower } from '../src'

describe('game application', () => {
  it('selects and unselects a card', () => {
    const initial = createInitialSession()
    const selected = gameReducer(initial, { type: 'card/toggle', cardId: 'heart-7' })

    expect(selected.selectedCardIds).toEqual(['heart-7'])
    expect(getSelectedPower(selected)).toBe(7)
    expect(
      gameReducer(selected, { type: 'card/toggle', cardId: 'heart-7' }).selectedCardIds,
    ).toEqual([])
  })

  it('coordinates a complete play command', () => {
    const initial = createInitialSession()
    const selected = {
      ...initial,
      selectedCardIds: ['heart-7', 'diamond-9'],
    }
    const next = gameReducer(selected, { type: 'cards/play' })

    expect(next.game.enemy.health).toBe(8)
    expect(next.game.hand).toHaveLength(3)
    expect(next.selectedCardIds).toEqual([])
  })

  it('ignores play commands when no card is selected', () => {
    const initial = createInitialSession()

    expect(gameReducer(initial, { type: 'cards/play' })).toBe(initial)
  })
})
