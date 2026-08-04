import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  getCounterattackDamage,
  getCurrentEnemyStats,
  getEnemyDamage,
  getEnemyShield,
  getLegalPlayerIntents,
  isEnemyImmunityCancelled,
  LocalGameSession,
} from '../src'
import type {
  ActiveSessionSnapshot,
  GameSaveStore,
  GameSeedSource,
  PlayerIntent,
  ReadonlyGameState,
  SaveClearResult,
  SaveLoadResult,
  SaveWriteResult,
} from '../src'

describe('public API', () => {
  it('exports only the session and readonly query facade as runtime values', async () => {
    const publicApi = await import('../src')

    expect(Object.keys(publicApi).sort()).toEqual(
      [
        'LocalGameSession',
        'getCounterattackDamage',
        'getCurrentEnemyStats',
        'getEnemyDamage',
        'getEnemyShield',
        'getLegalPlayerIntents',
        'isEnemyImmunityCancelled',
      ].sort(),
    )
    expect(publicApi).toMatchObject({
      LocalGameSession,
      getCounterattackDamage,
      getCurrentEnemyStats,
      getEnemyDamage,
      getEnemyShield,
      getLegalPlayerIntents,
      isEnemyImmunityCancelled,
    })
  })

  it('exposes only the four actor-free solo player intents', () => {
    expectTypeOf<PlayerIntent>().toEqualTypeOf<
      | { readonly type: 'play-cards'; readonly cardIds: readonly string[] }
      | { readonly type: 'yield' }
      | { readonly type: 'discard-for-damage'; readonly cardIds: readonly string[] }
      | { readonly type: 'use-solo-jester'; readonly cardId: string }
    >()
  })

  it('keeps ports synchronous and snapshots deeply readonly', () => {
    expectTypeOf<ReturnType<GameSaveStore['load']>>().toEqualTypeOf<SaveLoadResult>()
    expectTypeOf<ReturnType<GameSaveStore['save']>>().toEqualTypeOf<SaveWriteResult>()
    expectTypeOf<ReturnType<GameSaveStore['clear']>>().toEqualTypeOf<SaveClearResult>()
    expectTypeOf<GameSeedSource['nextSeed']>().returns.toEqualTypeOf<string | number>()
    expectTypeOf<ActiveSessionSnapshot['game']>().toEqualTypeOf<ReadonlyGameState>()
    expectTypeOf(getLegalPlayerIntents).parameter(0).toEqualTypeOf<ReadonlyGameState>()
  })
})
