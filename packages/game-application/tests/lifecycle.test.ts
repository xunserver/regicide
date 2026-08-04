import { createGame } from '@regicide/game-core'
import { describe, expect, it, vi } from 'vitest'
import { LocalGameSession } from '../src'
import { FakeGameSaveStore } from './fakes/fake-game-save-store'
import { FixedGameSeedSource } from './fakes/fixed-game-seed-source'
import { createSoloGameState, createTerminalSoloGame, LOCAL_PLAYER_ID } from './support'

describe('LocalGameSession game lifecycle', () => {
  it('saves a deterministic initial game before committing it', () => {
    const store = new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] })
    const seeds = new FixedGameSeedSource(['new-game'])
    const session = new LocalGameSession(store, seeds)
    session.initialize()
    const before = session.getSnapshot()
    const snapshotsDuringSave: unknown[] = []
    store.onSave = () => snapshotsDuringSave.push(session.getSnapshot())
    const listener = vi.fn(() => {
      expect(store.saveCalls).toBe(1)
    })
    session.subscribe(listener)

    const result = session.startNewGame()

    const expected = createGame({
      playerIds: [LOCAL_PLAYER_ID],
      startingPlayerId: LOCAL_PLAYER_ID,
      seed: 'new-game',
    })
    expect(result).toEqual({ status: 'committed', snapshot: { status: 'active', game: expected } })
    expect(snapshotsDuringSave).toEqual([before])
    expect(store.savedGames).toEqual([expected])
    expect(store.clearCalls).toBe(0)
    expect(seeds.calls).toBe(1)
    expect(listener).toHaveBeenCalledTimes(1)
    expect(session.getSnapshot()).toBe(result.snapshot)
  })

  it('keeps no-game unchanged when the first autosave fails', () => {
    const reason = { code: 'quota-exceeded' as const, message: 'full' }
    const store = new FakeGameSaveStore({
      loadResults: [{ status: 'empty' }],
      saveResults: [{ status: 'failed', reason }],
    })
    const seeds = new FixedGameSeedSource(['new-game'])
    const session = new LocalGameSession(store, seeds)
    session.initialize()
    const before = session.getSnapshot()
    const listener = vi.fn()
    session.subscribe(listener)

    expect(session.startNewGame()).toEqual({
      status: 'storage-error',
      reason,
      snapshot: before,
    })
    expect(session.getSnapshot()).toBe(before)
    expect(store.saveCalls).toBe(1)
    expect(listener).not.toHaveBeenCalled()
  })

  it('replaces an active game only after the new initial state is saved', () => {
    const oldGame = createSoloGameState('old')
    const store = new FakeGameSaveStore({
      loadResults: [{ status: 'loaded', game: oldGame }],
    })
    const seeds = new FixedGameSeedSource(['replacement'])
    const session = new LocalGameSession(store, seeds)
    session.initialize()
    const before = session.getSnapshot()
    store.onSave = () => expect(session.getSnapshot()).toBe(before)

    const result = session.replaceWithNewGame()

    expect(result.status).toBe('committed')
    expect(result.snapshot.status).toBe('active')
    if (result.snapshot.status !== 'active') throw new Error('Expected active snapshot')
    expect(result.snapshot.game).toEqual(createSoloGameState('replacement'))
    expect(result.snapshot.game).not.toEqual(oldGame)
    expect(store.clearCalls).toBe(0)
    expect(seeds.calls).toBe(1)
  })

  it('retains the exact old active snapshot when replacement save fails', () => {
    const reason = { code: 'unavailable' as const }
    const store = new FakeGameSaveStore({
      loadResults: [{ status: 'loaded', game: createSoloGameState('old') }],
      saveResults: [{ status: 'failed', reason }],
    })
    const session = new LocalGameSession(store, new FixedGameSeedSource(['replacement']))
    session.initialize()
    const before = session.getSnapshot()

    expect(session.replaceWithNewGame()).toEqual({
      status: 'storage-error',
      reason,
      snapshot: before,
    })
    expect(session.getSnapshot()).toBe(before)
  })

  it('clears only an unrecoverable save and returns to no-game', () => {
    const store = new FakeGameSaveStore({
      loadResults: [
        {
          status: 'unrecoverable',
          reason: { code: 'invalid-envelope', message: 'bad json' },
        },
      ],
    })
    const seeds = new FixedGameSeedSource()
    const session = new LocalGameSession(store, seeds)
    session.initialize()

    expect(session.clearUnrecoverableSave()).toEqual({
      status: 'cleared',
      snapshot: { status: 'no-game' },
    })
    expect(store.clearCalls).toBe(1)
    expect(store.saveCalls).toBe(0)
    expect(seeds.calls).toBe(0)
  })

  it('retains an unrecoverable save when clearing fails', () => {
    const reason = { code: 'unavailable' as const, message: 'denied' }
    const store = new FakeGameSaveStore({
      loadResults: [{ status: 'unrecoverable', reason: { code: 'invalid-envelope' } }],
      clearResults: [{ status: 'failed', reason }],
    })
    const session = new LocalGameSession(store, new FixedGameSeedSource())
    session.initialize()
    const before = session.getSnapshot()

    expect(session.clearUnrecoverableSave()).toEqual({
      status: 'storage-error',
      reason,
      snapshot: before,
    })
    expect(session.getSnapshot()).toBe(before)
  })

  it('restores a terminal game as active and replaces it only explicitly', () => {
    const terminal = createTerminalSoloGame()
    const store = new FakeGameSaveStore({
      loadResults: [{ status: 'loaded', game: terminal }],
    })
    const session = new LocalGameSession(store, new FixedGameSeedSource(['after-terminal']))

    expect(session.initialize()).toEqual({
      status: 'completed',
      snapshot: { status: 'active', game: terminal },
    })
    expect(store.saveCalls).toBe(0)
    expect(session.replaceWithNewGame().status).toBe('committed')
    expect(store.saveCalls).toBe(1)
  })

  it('rejects lifecycle operations from the wrong states without side effects', () => {
    const store = new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] })
    const seeds = new FixedGameSeedSource(['one'])
    const session = new LocalGameSession(store, seeds)

    expect(session.startNewGame()).toMatchObject({ reason: 'session-not-initialized' })
    expect(session.replaceWithNewGame()).toMatchObject({ reason: 'session-not-initialized' })
    expect(session.clearUnrecoverableSave()).toMatchObject({
      reason: 'session-not-initialized',
    })
    session.initialize()
    expect(session.replaceWithNewGame()).toMatchObject({ reason: 'active-game-required' })
    expect(session.clearUnrecoverableSave()).toMatchObject({
      reason: 'unrecoverable-save-required',
    })
    session.startNewGame()
    expect(session.startNewGame()).toMatchObject({ reason: 'no-game-required' })
    expect(session.clearUnrecoverableSave()).toMatchObject({
      reason: 'unrecoverable-save-required',
    })
    expect(store.clearCalls).toBe(0)
    expect(store.saveCalls).toBe(1)
    expect(seeds.calls).toBe(1)
  })

  it('creates identical games from the same injected seed', () => {
    const first = new LocalGameSession(
      new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] }),
      new FixedGameSeedSource(['repeatable']),
    )
    const second = new LocalGameSession(
      new FakeGameSaveStore({ loadResults: [{ status: 'empty' }] }),
      new FixedGameSeedSource(['repeatable']),
    )
    first.initialize()
    second.initialize()

    expect(first.startNewGame()).toEqual(second.startNewGame())
  })
})
