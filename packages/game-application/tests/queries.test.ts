import {
  getCounterattackDamage as getCoreCounterattackDamage,
  getCurrentEnemyStats as getCoreCurrentEnemyStats,
  getEnemyDamage as getCoreEnemyDamage,
  getEnemyShield as getCoreEnemyShield,
  getLegalCommands,
  isEnemyImmunityCancelled as isCoreEnemyImmunityCancelled,
} from '@regicide/game-core'
import { describe, expect, it } from 'vitest'
import {
  getCounterattackDamage,
  getCurrentEnemyStats,
  getEnemyDamage,
  getEnemyShield,
  getLegalPlayerIntents,
  isEnemyImmunityCancelled,
  LocalGameSession,
  type ReadonlyGameState,
} from '../src'
import { FakeGameSaveStore } from './fakes/fake-game-save-store'
import { FixedGameSeedSource } from './fakes/fixed-game-seed-source'
import {
  createChoosingPlayerSoloGame,
  createPendingDiscardGame,
  createSoloGameState,
  LOCAL_PLAYER_ID,
} from './support'

function restoreReadonly(game = createSoloGameState('queries')): ReadonlyGameState {
  const session = new LocalGameSession(
    new FakeGameSaveStore({ loadResults: [{ status: 'loaded', game }] }),
    new FixedGameSeedSource(),
  )
  const result = session.initialize()
  if (result.snapshot.status !== 'active') throw new Error('Expected active snapshot')
  return result.snapshot.game
}

describe('solo game query facade', () => {
  it('maps legal core commands to actor-free solo intents', () => {
    const original = createSoloGameState('legal-intents')
    const game = restoreReadonly(original)
    const expected = getLegalCommands(original, LOCAL_PLAYER_ID).map((command) => {
      switch (command.type) {
        case 'play-cards':
          return { type: 'play-cards' as const, cardIds: command.cardIds }
        case 'yield':
          return { type: 'yield' as const }
        case 'discard-for-damage':
          return { type: 'discard-for-damage' as const, cardIds: command.cardIds }
        case 'use-solo-jester':
          return { type: 'use-solo-jester' as const, cardId: command.cardId }
        case 'choose-next-player':
          throw new Error('A valid application solo game cannot choose a player')
      }
    })

    const intents = getLegalPlayerIntents(game)

    expect(intents).toEqual(expected)
    expect(intents).toContainEqual({ type: 'yield' })
    expect(intents.every((intent) => !('actorId' in intent))).toBe(true)
    expect(Object.isFrozen(intents)).toBe(true)
    const play = intents.find((intent) => intent.type === 'play-cards')
    if (play?.type !== 'play-cards') throw new Error('Expected play intent')
    expect(Object.isFrozen(play.cardIds)).toBe(true)
  })

  it('returns damage-phase discard and Solo Jester intents', () => {
    const game = restoreReadonly(createPendingDiscardGame())
    const intents = getLegalPlayerIntents(game)

    expect(intents.some((intent) => intent.type === 'discard-for-damage')).toBe(true)
    expect(intents.some((intent) => intent.type === 'use-solo-jester')).toBe(true)
    expect(intents.some((intent) => intent.type === 'yield')).toBe(false)
  })

  it('never exposes the multiplayer choose-next-player command', () => {
    const coreValidButUnsupported = createChoosingPlayerSoloGame() as ReadonlyGameState

    expect(getLegalPlayerIntents(coreValidButUnsupported)).toEqual([])
  })

  it('adapts all stateful core queries to ReadonlyGameState', () => {
    const original = createSoloGameState('state-queries')
    const game = restoreReadonly(original)

    expect(getCounterattackDamage(game)).toBe(getCoreCounterattackDamage(original))
    expect(getCurrentEnemyStats(game)).toEqual(getCoreCurrentEnemyStats(original))
    expect(getEnemyDamage(game)).toBe(getCoreEnemyDamage(original))
    expect(getEnemyShield(game)).toBe(getCoreEnemyShield(original))
    expect(isEnemyImmunityCancelled(game)).toBe(isCoreEnemyImmunityCancelled(original))
    expect(Object.isFrozen(getCurrentEnemyStats(game))).toBe(true)
  })
})
