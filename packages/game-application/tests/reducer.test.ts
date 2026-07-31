import { describe, expect, it } from 'vitest'
import {
  createInitialSession,
  gameReducer,
  getCurrentPlayer,
  getSelectedSubmitCommand,
  getSelectedValue,
} from '../src'

describe('game application', () => {
  it('selects and unselects a card from the current hand', () => {
    const initial = createInitialSession()
    const cardId = getCurrentPlayer(initial).hand[0]!
    const selected = gameReducer(initial, { type: 'card/toggle', cardId })

    expect(selected.selectedCardIds).toEqual([cardId])
    expect(getSelectedValue(selected)).toBeGreaterThan(0)
    expect(gameReducer(selected, { type: 'card/toggle', cardId }).selectedCardIds).toEqual([])
  })

  it('submits a legal selection as a core command', () => {
    const initial = createInitialSession()
    const cardId = getCurrentPlayer(initial).hand[0]!
    const selected = gameReducer(initial, { type: 'card/toggle', cardId })
    expect(getSelectedSubmitCommand(selected)).toMatchObject({
      type: 'play-cards',
      cardIds: [cardId],
    })

    const next = gameReducer(selected, { type: 'cards/submit' })
    expect(getCurrentPlayer(next).hand).not.toContain(cardId)
    expect(next.selectedCardIds).toEqual([])
    expect(next.lastEvents[0]).toMatchObject({ type: 'cards-played', cardIds: [cardId] })
  })

  it('ignores a submit command when no cards are selected', () => {
    const initial = createInitialSession()
    expect(gameReducer(initial, { type: 'cards/submit' })).toBe(initial)
  })

  it('restarts with a new deterministic seed', () => {
    const initial = createInitialSession()
    const restarted = gameReducer(initial, { type: 'game/restart' })
    expect(restarted.restartCount).toBe(1)
    expect(restarted.game).not.toEqual(initial.game)
  })
})
