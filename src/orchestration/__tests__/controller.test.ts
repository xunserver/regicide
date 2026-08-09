import { describe, expect, it } from 'vitest'
import { cardValue } from '../../core/index.ts'
import { createController, memoryStorage } from '../index.ts'

describe('createController', () => {
  it('starts a seeded solo game with a view model', () => {
    const controller = createController({ seed: 7, storage: null })
    const view = controller.getView()

    expect(view.seed).toBe(7)
    expect(view.hand).toHaveLength(8)
    expect(view.enemy?.card.rank).toBe('J')
    expect(view.phase).toBe('play')
    expect(view.commands.canYield).toBe(true)
    expect(view.commands.canFlipJester).toBe(true)
    expect(view.commands.canConfirmPlay).toBe(false)
  })

  it('toggles selection and confirms a legal single-card play', () => {
    const controller = createController({ seed: 7, storage: null })
    const first = controller.getView().hand[0]!

    const toggled = controller.dispatch({ type: 'TOGGLE_CARD', cardId: first.id })
    expect(toggled.ok).toBe(true)
    if (!toggled.ok) return

    expect(toggled.view.selection).toEqual([first.id])
    expect(toggled.view.playPreview?.ok).toBe(true)
    expect(toggled.view.commands.canConfirmPlay).toBe(true)

    const played = controller.dispatch({ type: 'CONFIRM_PLAY' })
    expect(played.ok).toBe(true)
    if (!played.ok) return
    expect(played.events.some((e) => e.type === 'CARDS_PLAYED')).toBe(true)
    expect(played.view.selection).toEqual([])
    expect(played.view.hand.some((c) => c.id === first.id)).toBe(false)
    // Non-lethal plays stay in the play phase so more cards can be played.
    if (played.view.phase === 'play') {
      expect(played.view.commands.canEndTurn).toBe(true)
      expect(played.view.commands.canYield).toBe(false)
    }
  })

  it('rejects confirm play when selection is empty or illegal', () => {
    const controller = createController({ seed: 11, storage: null })

    const empty = controller.dispatch({ type: 'CONFIRM_PLAY' })
    expect(empty.ok).toBe(false)

    const hand = controller.getView().hand
    const first = hand.find((c) => c.rank !== 'A') ?? hand[0]!
    const second =
      hand.find(
        (c) =>
          c.id !== first.id &&
          c.rank !== 'A' &&
          c.rank !== first.rank &&
          !['2', '3', '4', '5'].includes(c.rank),
      ) ?? hand.find((c) => c.id !== first.id && c.rank !== first.rank)!

    controller.dispatch({ type: 'TOGGLE_CARD', cardId: first.id })
    controller.dispatch({ type: 'TOGGLE_CARD', cardId: second.id })

    const view = controller.getView()
    expect(view.selection).toHaveLength(2)
    expect(view.playPreview?.ok).toBe(false)
    expect(view.commands.canConfirmPlay).toBe(false)

    const result = controller.dispatch({ type: 'CONFIRM_PLAY' })
    expect(result.ok).toBe(false)
  })

  it('supports yield into defend and confirm defend from selection', () => {
    const controller = createController({ seed: 3, storage: null })

    for (let i = 0; i < 40; i += 1) {
      const view = controller.getView()
      if (view.phase === 'defend' || view.phase === 'lost' || view.phase === 'won') break

      if (view.commands.canEndTurn) {
        controller.dispatch({ type: 'END_TURN' })
        continue
      }

      if (view.commands.canYield) {
        controller.dispatch({ type: 'YIELD' })
        continue
      }

      const card = view.hand[0]
      if (!card) break
      controller.dispatch({ type: 'TOGGLE_CARD', cardId: card.id })
      controller.dispatch({ type: 'CONFIRM_PLAY' })
    }

    const defendView = controller.getView()
    if (defendView.phase !== 'defend') {
      expect(['lost', 'won', 'play']).toContain(defendView.phase)
      return
    }

    expect(defendView.defendPreview).not.toBeNull()
    const needed = defendView.defendPreview!.required

    let total = 0
    for (const card of defendView.hand) {
      if (total >= needed) break
      controller.dispatch({ type: 'TOGGLE_CARD', cardId: card.id })
      total += cardValue(card)
    }

    const ready = controller.getView()
    expect(ready.commands.canConfirmDefend).toBe(true)
    const blocked = controller.dispatch({ type: 'CONFIRM_DEFEND' })
    expect(blocked.ok).toBe(true)
    if (!blocked.ok) return
    expect(blocked.view.phase).toBe('play')
  })

  it('notifies subscribers on dispatch', () => {
    const controller = createController({ seed: 1, storage: null })
    let calls = 0
    const unsubscribe = controller.subscribe(() => {
      calls += 1
    })

    controller.dispatch({ type: 'CLEAR_SELECTION' })
    expect(calls).toBe(1)
    unsubscribe()
    controller.dispatch({ type: 'CLEAR_SELECTION' })
    expect(calls).toBe(1)
  })

  it('persists and restores jester usage / seed', () => {
    const storage = memoryStorage()
    const a = createController({ seed: 99, storage })
    const cardId = a.getView().hand[0]!.id
    a.dispatch({ type: 'TOGGLE_CARD', cardId })
    a.dispatch({ type: 'CONFIRM_PLAY' })
    const flipped = a.dispatch({ type: 'FLIP_JESTER' })
    expect(flipped.ok).toBe(true)

    const b = createController({ seed: 1, storage })
    expect(b.load()).toBe(true)
    const restored = b.getView()
    expect(restored.seed).toBe(99)
    expect(restored.jestersUsed).toBe(1)
    expect(restored.jestersRemaining).toBe(1)
    expect(restored.hand).toHaveLength(8)
  })

  it('NEW_GAME replaces the session', () => {
    const controller = createController({ seed: 5, storage: null })
    const before = controller.getView().hand.map((c) => c.id)
    controller.dispatch({ type: 'NEW_GAME', seed: 6 })
    const after = controller.getView()
    expect(after.seed).toBe(6)
    expect(after.hand.map((c) => c.id)).not.toEqual(before)
    expect(after.jestersRemaining).toBe(2)
  })
})
