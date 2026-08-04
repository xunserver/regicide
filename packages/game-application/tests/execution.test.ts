import { dispatch } from '@regicide/game-core'
import { describe, expect, it, vi } from 'vitest'
import { LocalGameSession, type PlayerIntent } from '../src'
import { FakeGameSaveStore } from './fakes/fake-game-save-store'
import { FixedGameSeedSource } from './fakes/fixed-game-seed-source'
import {
  createConsecutiveYieldGame,
  createPendingDiscardGame,
  createSoloGameState,
  createTerminalSoloGame,
  findDiscardCommand,
  findPlayCommand,
  LOCAL_PLAYER_ID,
} from './support'

function restore(game = createSoloGameState()): {
  readonly session: LocalGameSession
  readonly store: FakeGameSaveStore
} {
  const store = new FakeGameSaveStore({ loadResults: [{ status: 'loaded', game }] })
  const session = new LocalGameSession(store, new FixedGameSeedSource())
  session.initialize()
  return { session, store }
}

describe('LocalGameSession intent execution', () => {
  it('maps play-cards to the fixed local actor and commits the complete transition', () => {
    const initial = createSoloGameState('play')
    const command = findPlayCommand(initial)
    const expected = dispatch(initial, command)
    if (!expected.accepted) throw new Error('Expected accepted core transition')
    const { session, store } = restore(initial)
    const before = session.getSnapshot()
    const duringSave: unknown[] = []
    store.onSave = () => duringSave.push(session.getSnapshot())
    const notifications: unknown[] = []
    session.subscribe(() => {
      notifications.push(session.getSnapshot())
      expect(store.saveCalls).toBe(1)
    })
    const cardIds = Object.freeze([...command.cardIds])

    const result = session.execute({ type: 'play-cards', cardIds })

    expect(result).toEqual({
      status: 'committed',
      snapshot: { status: 'active', game: expected.state },
      events: expected.events,
    })
    expect(duringSave).toEqual([before])
    expect(store.savedGames).toEqual([expected.state])
    expect(notifications).toEqual([result.snapshot])
    expect(session.getSnapshot()).toBe(result.snapshot)
    expect(Object.isFrozen(result.events)).toBe(true)
    expect(result.events.every(Object.isFrozen)).toBe(true)
    expect(cardIds).toEqual(command.cardIds)
    expect(expected.events[0]).toMatchObject({ playerId: LOCAL_PLAYER_ID })
  })

  it('maps discard-for-damage and preserves the complete ordered core events', () => {
    const initial = createPendingDiscardGame()
    const command = findDiscardCommand(initial)
    const expected = dispatch(initial, command)
    if (!expected.accepted) throw new Error('Expected accepted discard')
    const { session, store } = restore(initial)

    const result = session.execute({
      type: 'discard-for-damage',
      cardIds: command.cardIds,
    })

    expect(result).toEqual({
      status: 'committed',
      snapshot: { status: 'active', game: expected.state },
      events: expected.events,
    })
    expect(store.savedGames).toEqual([expected.state])
    expect(result.events).toEqual(expected.events)
  })

  it('maps the single-player yield action to the fixed local actor', () => {
    const initial = createSoloGameState('yield')
    const expected = dispatch(initial, { type: 'yield', actorId: LOCAL_PLAYER_ID })
    if (!expected.accepted) throw new Error('Expected accepted solo Yield')
    const { session, store } = restore(initial)

    const result = session.execute({ type: 'yield' })

    expect(result).toEqual({
      status: 'committed',
      snapshot: { status: 'active', game: expected.state },
      events: expected.events,
    })
    expect(result.events[0]).toEqual({ type: 'player-yielded', playerId: LOCAL_PLAYER_ID })
    expect(store.savedGames).toEqual([expected.state])
  })

  it('returns the core rejection for a consecutive single-player yield', () => {
    const { session, store } = restore(createConsecutiveYieldGame())
    const before = session.getSnapshot()

    expect(session.execute({ type: 'yield' })).toEqual({
      status: 'rejected',
      reason: 'yield-not-allowed',
      snapshot: before,
      events: [],
    })
    expect(store.saveCalls).toBe(0)
    expect(session.getSnapshot()).toBe(before)
  })

  it('maps use-solo-jester to the available core card and fixed actor', () => {
    const initial = createSoloGameState('jester')
    const cardId = initial.soloJesters.available[0]!
    const expected = dispatch(initial, {
      type: 'use-solo-jester',
      actorId: LOCAL_PLAYER_ID,
      cardId,
    })
    if (!expected.accepted) throw new Error('Expected accepted solo Jester')
    const { session, store } = restore(initial)

    const result = session.execute({ type: 'use-solo-jester', cardId })

    expect(result).toEqual({
      status: 'committed',
      snapshot: { status: 'active', game: expected.state },
      events: expected.events,
    })
    expect(store.savedGames).toEqual([expected.state])
    expect(result.events[0]).toEqual({
      type: 'solo-jester-used',
      playerId: LOCAL_PLAYER_ID,
      cardId,
      discardedCardIds: initial.players[0]!.hand,
      drawnCardIds: initial.tavernDeck.slice(0, initial.players[0]!.maxHandSize),
    })
  })

  it('returns a core rejection without saving, notifying, or replacing the snapshot', () => {
    const { session, store } = restore()
    const before = session.getSnapshot()
    const listener = vi.fn()
    session.subscribe(listener)

    const result = session.execute({ type: 'play-cards', cardIds: [] })

    expect(result).toEqual({
      status: 'rejected',
      reason: 'illegal-play',
      snapshot: before,
      events: [],
    })
    expect(result.snapshot).toBe(before)
    expect(Object.isFrozen(result.events)).toBe(true)
    expect(session.getSnapshot()).toBe(before)
    expect(store.saveCalls).toBe(0)
    expect(listener).not.toHaveBeenCalled()
  })

  it('discards an accepted candidate and its events when saving fails', () => {
    const initial = createSoloGameState('save-failure')
    const command = findPlayCommand(initial)
    const expected = dispatch(initial, command)
    if (!expected.accepted) throw new Error('Expected accepted core transition')
    const reason = { code: 'quota-exceeded' as const, message: 'full' }
    const store = new FakeGameSaveStore({
      loadResults: [{ status: 'loaded', game: initial }],
      saveResults: [{ status: 'failed', reason }],
    })
    const session = new LocalGameSession(store, new FixedGameSeedSource())
    session.initialize()
    const before = session.getSnapshot()
    const listener = vi.fn()
    session.subscribe(listener)

    const result = session.execute({ type: 'play-cards', cardIds: command.cardIds })

    expect(result).toEqual({
      status: 'storage-error',
      reason,
      snapshot: before,
      events: [],
    })
    expect(session.getSnapshot()).toBe(before)
    expect(store.saveCalls).toBe(1)
    expect(store.savedGames).toEqual([expected.state])
    if (before.status !== 'active') throw new Error('Expected active snapshot')
    expect(store.savedGames[0]).not.toEqual(before.game)
    expect(listener).not.toHaveBeenCalled()
  })

  it('lets core reject an intent against a finished game as game-over', () => {
    const { session, store } = restore(createTerminalSoloGame())
    const before = session.getSnapshot()

    expect(session.execute({ type: 'play-cards', cardIds: ['hearts-2'] })).toEqual({
      status: 'rejected',
      reason: 'game-over',
      snapshot: before,
      events: [],
    })
    expect(store.saveCalls).toBe(0)
  })

  it('rejects execution outside active without calling core-facing storage', () => {
    const store = new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] })
    const session = new LocalGameSession(store, new FixedGameSeedSource())
    const intent: PlayerIntent = { type: 'play-cards', cardIds: ['hearts-2'] }

    expect(session.execute(intent)).toEqual({
      status: 'application-rejected',
      reason: 'session-not-initialized',
      snapshot: { status: 'uninitialized' },
      events: [],
    })
    session.initialize()
    expect(session.execute(intent)).toEqual({
      status: 'application-rejected',
      reason: 'active-game-required',
      snapshot: { status: 'no-game' },
      events: [],
    })
    expect(store.saveCalls).toBe(0)
  })
})
