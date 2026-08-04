import { describe, expect, it, vi } from 'vitest'
import { LocalGameSession } from '../src'
import { FakeGameSaveStore } from './fakes/fake-game-save-store'
import { FixedGameSeedSource } from './fakes/fixed-game-seed-source'
import {
  createChoosingPlayerSoloGame,
  createMalformedGameState,
  createOtherPlayerSoloGame,
  createSoloGameState,
} from './support'

describe('LocalGameSession initialization', () => {
  it('constructs without reading storage, taking a seed, or subscribing', () => {
    const store = new FakeGameSaveStore()
    const seeds = new FixedGameSeedSource()
    const session = new LocalGameSession(store, seeds)
    const first = session.getSnapshot()

    expect(first).toEqual({ status: 'uninitialized' })
    expect(session.getSnapshot()).toBe(first)
    expect(Object.isFrozen(first)).toBe(true)
    expect(store.calls).toEqual([])
    expect(seeds.calls).toBe(0)
  })

  it('initializes an empty slot as no-game and registers one listener', () => {
    const store = new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] })
    const seeds = new FixedGameSeedSource()
    const session = new LocalGameSession(store, seeds)
    const listener = vi.fn()
    session.subscribe(listener)

    const result = session.initialize()

    expect(result).toEqual({ status: 'completed', snapshot: { status: 'no-game' } })
    expect(session.getSnapshot()).toBe(result.snapshot)
    expect(store.calls).toEqual(['subscribe', 'load'])
    expect(store.subscribeCalls).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(seeds.calls).toBe(0)
  })

  it('restores, clones, and freezes a valid fixed-player solo game', () => {
    const saved = createSoloGameState()
    const store = new FakeGameSaveStore({
      loadResults: [{ status: 'loaded', game: saved }],
    })
    const session = new LocalGameSession(store, new FixedGameSeedSource())

    const result = session.initialize()

    expect(result.status).toBe('completed')
    expect(result.snapshot).toEqual({ status: 'active', game: saved })
    if (result.snapshot.status !== 'active') throw new Error('Expected active snapshot')
    expect(result.snapshot.game).not.toBe(saved)
    expect(Object.isFrozen(result.snapshot.game)).toBe(true)
    expect(Object.isFrozen(result.snapshot.game.players)).toBe(true)
    expect(Object.isFrozen(result.snapshot.game.players[0]!.hand)).toBe(true)
  })

  it('preserves an adapter-reported unrecoverable save', () => {
    const reason = { code: 'unsupported-save-version' as const, message: 'version 2' }
    const store = new FakeGameSaveStore({
      loadResults: [{ status: 'unrecoverable', reason }],
    })
    const session = new LocalGameSession(store, new FixedGameSeedSource())

    expect(session.initialize()).toEqual({
      status: 'completed',
      snapshot: { status: 'unrecoverable-save', reason },
    })
    const snapshot = session.getSnapshot()
    expect(Object.isFrozen(snapshot)).toBe(true)
    if (snapshot.status !== 'unrecoverable-save') throw new Error('Expected broken save')
    expect(snapshot.reason).not.toBe(reason)
    expect(Object.isFrozen(snapshot.reason)).toBe(true)
    expect(store.clearCalls).toBe(0)
  })

  it('rejects a valid core game that does not use the fixed local player', () => {
    const store = new FakeGameSaveStore({
      loadResults: [{ status: 'loaded', game: createOtherPlayerSoloGame() }],
    })
    const session = new LocalGameSession(store, new FixedGameSeedSource())

    expect(session.initialize()).toEqual({
      status: 'completed',
      snapshot: {
        status: 'unrecoverable-save',
        reason: {
          code: 'invalid-solo-game',
          message: 'Saved game violates the fixed local solo game invariants.',
        },
      },
    })
  })

  it('rejects a core-valid multiplayer-only decision in a restored solo game', () => {
    const store = new FakeGameSaveStore({
      loadResults: [{ status: 'loaded', game: createChoosingPlayerSoloGame() }],
    })
    const session = new LocalGameSession(store, new FixedGameSeedSource())

    expect(session.initialize()).toMatchObject({
      status: 'completed',
      snapshot: {
        status: 'unrecoverable-save',
        reason: { code: 'invalid-solo-game' },
      },
    })
  })

  it('defensively rejects an invalid game returned as loaded by an adapter', () => {
    const store = new FakeGameSaveStore({
      loadResults: [{ status: 'loaded', game: createMalformedGameState() }],
    })
    const session = new LocalGameSession(store, new FixedGameSeedSource())

    expect(session.initialize()).toEqual({
      status: 'completed',
      snapshot: {
        status: 'unrecoverable-save',
        reason: {
          code: 'invalid-game-state',
          message: 'The save store returned an invalid core game state.',
        },
      },
    })
  })

  it('enters load-failed on a storage read failure', () => {
    const reason = { code: 'unavailable' as const, message: 'blocked' }
    const store = new FakeGameSaveStore({ loadResults: [{ status: 'failed', reason }] })
    const session = new LocalGameSession(store, new FixedGameSeedSource())

    expect(session.initialize()).toEqual({
      status: 'completed',
      snapshot: { status: 'load-failed', reason },
    })
    expect(store.activeExternalListeners).toBe(1)
  })

  it('cleans up its external listener when a port unexpectedly throws during load', () => {
    const store = new FakeGameSaveStore()
    store.throwOnNextLoad = true
    const session = new LocalGameSession(store, new FixedGameSeedSource())

    expect(() => session.initialize()).toThrow('unexpected load failure')
    expect(session.getSnapshot()).toEqual({ status: 'uninitialized' })
    expect(store.subscribeCalls).toBe(1)
    expect(store.unsubscribeCalls).toBe(1)
    expect(store.activeExternalListeners).toBe(0)

    expect(session.initialize()).toEqual({
      status: 'completed',
      snapshot: { status: 'no-game' },
    })
    expect(store.subscribeCalls).toBe(2)
    expect(store.activeExternalListeners).toBe(1)
  })

  it('retries a failed load without registering another external listener or taking a seed', () => {
    const store = new FakeGameSaveStore({
      loadResults: [
        { status: 'failed', reason: { code: 'unknown', message: 'first' } },
        { status: 'loaded', game: createSoloGameState('retry') },
      ],
    })
    const seeds = new FixedGameSeedSource()
    const session = new LocalGameSession(store, seeds)
    session.initialize()

    const result = session.retryLoad()

    expect(result.status).toBe('completed')
    expect(result.snapshot.status).toBe('active')
    expect(store.loadCalls).toBe(2)
    expect(store.subscribeCalls).toBe(1)
    expect(seeds.calls).toBe(0)
  })

  it('keeps load-failed and publishes the new failure on another failed retry', () => {
    const store = new FakeGameSaveStore({
      loadResults: [
        { status: 'failed', reason: { code: 'unknown', message: 'first' } },
        { status: 'failed', reason: { code: 'unavailable', message: 'second' } },
      ],
    })
    const session = new LocalGameSession(store, new FixedGameSeedSource())
    session.initialize()
    const before = session.getSnapshot()
    const listener = vi.fn()
    session.subscribe(listener)

    const result = session.retryLoad()

    expect(result).toEqual({
      status: 'completed',
      snapshot: {
        status: 'load-failed',
        reason: { code: 'unavailable', message: 'second' },
      },
    })
    expect(result.snapshot).not.toBe(before)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('keeps the same snapshot reference when a retry repeats the same load failure', () => {
    const reason = { code: 'unavailable' as const, message: 'still blocked' }
    const store = new FakeGameSaveStore({
      loadResults: [
        { status: 'failed', reason },
        { status: 'failed', reason: { ...reason } },
      ],
    })
    const session = new LocalGameSession(store, new FixedGameSeedSource())
    session.initialize()
    const before = session.getSnapshot()
    const listener = vi.fn()
    session.subscribe(listener)

    const result = session.retryLoad()

    expect(result).toEqual({ status: 'completed', snapshot: before })
    expect(result.snapshot).toBe(before)
    expect(session.getSnapshot()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
  })

  it('rejects duplicate initialization and retry outside load-failed', () => {
    const session = new LocalGameSession(
      new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] }),
      new FixedGameSeedSource(),
    )

    expect(session.retryLoad()).toEqual({
      status: 'application-rejected',
      reason: 'session-not-initialized',
      snapshot: { status: 'uninitialized' },
    })
    session.initialize()
    expect(session.initialize()).toEqual({
      status: 'application-rejected',
      reason: 'already-initialized',
      snapshot: { status: 'no-game' },
    })
    expect(session.retryLoad()).toEqual({
      status: 'application-rejected',
      reason: 'load-not-failed',
      snapshot: { status: 'no-game' },
    })
  })
})
