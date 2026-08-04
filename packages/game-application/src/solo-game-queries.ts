import {
  getCounterattackDamage as getCoreCounterattackDamage,
  getCurrentEnemyStats as getCoreCurrentEnemyStats,
  getEnemyDamage as getCoreEnemyDamage,
  getEnemyShield as getCoreEnemyShield,
  getLegalCommands,
  isEnemyImmunityCancelled as isCoreEnemyImmunityCancelled,
} from '@regicide/game-core'
import type { PlayerIntent } from './player-intent'
import { deepFreeze, type DeepReadonly } from './readonly'
import { asCoreGameState, LOCAL_PLAYER_ID } from './solo-game'
import type { ReadonlyGameState } from './session-snapshot'

export function getLegalPlayerIntents(game: ReadonlyGameState): readonly PlayerIntent[] {
  const intents: PlayerIntent[] = []
  for (const command of getLegalCommands(asCoreGameState(game), LOCAL_PLAYER_ID)) {
    switch (command.type) {
      case 'play-cards':
        intents.push({ type: 'play-cards', cardIds: [...command.cardIds] })
        break
      case 'yield':
        intents.push({ type: 'yield' })
        break
      case 'discard-for-damage':
        intents.push({ type: 'discard-for-damage', cardIds: [...command.cardIds] })
        break
      case 'use-solo-jester':
        intents.push({ type: 'use-solo-jester', cardId: command.cardId })
        break
      case 'choose-next-player':
        break
    }
  }
  return deepFreeze(intents)
}

export function getCounterattackDamage(game: ReadonlyGameState): number {
  return getCoreCounterattackDamage(asCoreGameState(game))
}

export function getCurrentEnemyStats(
  game: ReadonlyGameState,
): DeepReadonly<ReturnType<typeof getCoreCurrentEnemyStats>> {
  return deepFreeze(getCoreCurrentEnemyStats(asCoreGameState(game)))
}

export function getEnemyDamage(game: ReadonlyGameState): number {
  return getCoreEnemyDamage(asCoreGameState(game))
}

export function getEnemyShield(game: ReadonlyGameState): number {
  return getCoreEnemyShield(asCoreGameState(game))
}

export function isEnemyImmunityCancelled(game: ReadonlyGameState): boolean {
  return isCoreEnemyImmunityCancelled(asCoreGameState(game))
}
