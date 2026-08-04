import { describe, expect, it, vi } from 'vitest'
import { LocalGameSession } from '../src'
import { FakeGameSaveStore } from './fakes/fake-game-save-store'
import { FixedGameSeedSource } from './fakes/fixed-game-seed-source'
import { createSoloGameState, findPlayCommand } from './support'

describe('LocalGameSession subscriptions, staleness, and disposal', () => {
  it('keeps snapshot references stable until a committed state change', () => {
    const session = new LocalGameSession(
      new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] }),
      new FixedGameSeedSource(['new']),
    )
    const uninitialized = session.getSnapshot()
    expect(session.getSnapshot()).toBe(uninitialized)

    session.initialize()
    const noGame = session.getSnapshot()
    expect(noGame).not.toBe(uninitialized)
    expect(session.getSnapshot()).toBe(noGame)

    session.startNewGame()
    expect(session.getSnapshot()).not.toBe(noGame)
    expect(session.getSnapshot()).toBe(session.getSnapshot())
  })

  it('supports idempotent unsubscribe and does not notify removed listeners', () => {
    const session = new LocalGameSession(
      new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] }),
      new FixedGameSeedSource(),
    )
    const listener = vi.fn()
    const unsubscribe = session.subscribe(listener)
    unsubscribe()
    unsubscribe()

    session.initialize()

    expect(listener).not.toHaveBeenCalled()
  })

  it('isolates listener failures after commit and continues notifying in order', () => {
    const session = new LocalGameSession(
      new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] }),
      new FixedGameSeedSource(),
    )
    const calls: string[] = []
    session.subscribe(() => {
      calls.push('first')
      throw new Error('UI failed')
    })
    session.subscribe(() => calls.push('second'))

    const result = session.initialize()

    expect(result.status).toBe('completed')
    expect(session.getSnapshot().status).toBe('no-game')
    expect(calls).toEqual(['first', 'second'])
  })

  it('rejects nested mutations from a snapshot listener', () => {
    const store = new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] })
    const seeds = new FixedGameSeedSource()
    const session = new LocalGameSession(store, seeds)
    let nested: ReturnType<LocalGameSession['startNewGame']> | undefined
    session.subscribe(() => {
      nested = session.startNewGame()
    })

    const outer = session.initialize()

    expect(outer.status).toBe('completed')
    expect(nested).toEqual({
      status: 'application-rejected',
      reason: 'operation-in-progress',
      snapshot: { status: 'no-game' },
    })
    expect(store.saveCalls).toBe(0)
    expect(seeds.calls).toBe(0)
  })

  it('invalidates an active session after an external save change', () => {
    const game = createSoloGameState('external')
    const store = new FakeGameSaveStore({
      loadResults: [{ status: 'loaded', game }],
    })
    const seeds = new FixedGameSeedSource(['replacement'])
    const session = new LocalGameSession(store, seeds)
    session.initialize()
    const active = session.getSnapshot()
    if (active.status !== 'active') throw new Error('Expected active snapshot')
    const listener = vi.fn()
    session.subscribe(listener)

    store.emitExternalChange()

    expect(session.getSnapshot()).toEqual({ status: 'stale', previousGame: active.game })
    expect(listener).toHaveBeenCalledTimes(1)
    const play = findPlayCommand(game)
    expect(session.execute({ type: 'play-cards', cardIds: play.cardIds })).toMatchObject({
      status: 'application-rejected',
      reason: 'stale',
      events: [],
    })
    expect(session.replaceWithNewGame()).toMatchObject({
      status: 'application-rejected',
      reason: 'stale',
    })
    expect(session.clearUnrecoverableSave()).toMatchObject({
      status: 'application-rejected',
      reason: 'stale',
    })
    expect(session.retryLoad()).toMatchObject({
      status: 'application-rejected',
      reason: 'stale',
    })
    expect(store.saveCalls).toBe(0)
    expect(store.clearCalls).toBe(0)
    expect(seeds.calls).toBe(0)
  })

  it('invalidates no-game without a previousGame and ignores repeated external changes', () => {
    const store = new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] })
    const session = new LocalGameSession(store, new FixedGameSeedSource())
    session.initialize()
    const listener = vi.fn()
    session.subscribe(listener)

    store.emitExternalChange()
    store.emitExternalChange()

    expect(session.getSnapshot()).toEqual({ status: 'stale' })
    expect('previousGame' in session.getSnapshot()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('ignores impossible reentrant external notifications during a committed operation', () => {
    const store = new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] })
    const session = new LocalGameSession(store, new FixedGameSeedSource())
    const statuses: string[] = []
    session.subscribe(() => {
      statuses.push(session.getSnapshot().status)
      if (session.getSnapshot().status === 'no-game') store.emitExternalChange()
    })

    const result = session.initialize()

    expect(result).toEqual({ status: 'completed', snapshot: { status: 'no-game' } })
    expect(session.getSnapshot()).toEqual({ status: 'no-game' })
    expect(statuses).toEqual(['no-game'])
  })

  it('disposes idempotently, unsubscribes, and rejects later mutations', () => {
    const store = new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] })
    const session = new LocalGameSession(store, new FixedGameSeedSource())
    session.initialize()
    const before = session.getSnapshot()
    const listener = vi.fn()
    session.subscribe(listener)

    session.dispose()
    session.dispose()
    store.emitExternalChange()

    expect(store.unsubscribeCalls).toBe(1)
    expect(store.activeExternalListeners).toBe(0)
    expect(session.getSnapshot()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
    expect(session.startNewGame()).toEqual({
      status: 'application-rejected',
      reason: 'disposed',
      snapshot: before,
    })
    expect(session.replaceWithNewGame()).toMatchObject({
      status: 'application-rejected',
      reason: 'disposed',
    })
    expect(session.clearUnrecoverableSave()).toMatchObject({
      status: 'application-rejected',
      reason: 'disposed',
    })
    expect(session.retryLoad()).toMatchObject({
      status: 'application-rejected',
      reason: 'disposed',
    })
    expect(session.execute({ type: 'play-cards', cardIds: [] })).toEqual({
      status: 'application-rejected',
      reason: 'disposed',
      snapshot: before,
      events: [],
    })
  })

  it('makes disposal final even when adapter unsubscribe throws', () => {
    const store = new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] })
    const session = new LocalGameSession(store, new FixedGameSeedSource())
    session.initialize()
    store.throwOnUnsubscribe = true

    expect(() => session.dispose()).not.toThrow()
    expect(session.initialize()).toMatchObject({
      status: 'application-rejected',
      reason: 'disposed',
    })
  })

  it('defers disposal requested by a listener until the committed operation finishes', () => {
    const store = new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] })
    const session = new LocalGameSession(store, new FixedGameSeedSource())
    session.subscribe(() => session.dispose())

    expect(session.initialize()).toEqual({
      status: 'completed',
      snapshot: { status: 'no-game' },
    })
    expect(store.unsubscribeCalls).toBe(1)
    expect(session.startNewGame()).toMatchObject({
      status: 'application-rejected',
      reason: 'disposed',
    })
  })

  it('returns a no-op subscription after disposal', () => {
    const session = new LocalGameSession(new FakeGameSaveStore(), new FixedGameSeedSource())
    session.dispose()
    const unsubscribe = session.subscribe(() => undefined)

    expect(() => unsubscribe()).not.toThrow()
  })
})
