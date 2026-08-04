import { createGame, parseGameState, type GameState } from '@regicide/game-core'
import type { GameSeedSource } from './ports/game-seed-source'
import { deepFreeze } from './readonly'
import type { ReadonlyGameState } from './session-snapshot'

export const LOCAL_PLAYER_ID = 'local-player'

export type RestoreSoloGameResult =
  | { readonly status: 'restored'; readonly game: ReadonlyGameState }
  | { readonly status: 'invalid-game-state' }
  | { readonly status: 'invalid-solo-game' }

export function createSoloGame(seedSource: GameSeedSource): ReadonlyGameState {
  return deepFreeze(
    createGame({
      playerIds: [LOCAL_PLAYER_ID],
      startingPlayerId: LOCAL_PLAYER_ID,
      seed: seedSource.nextSeed(),
    }),
  )
}

export function restoreSoloGame(game: GameState): RestoreSoloGameResult {
  let restored: GameState
  try {
    restored = parseGameState(game)
  } catch {
    return { status: 'invalid-game-state' }
  }

  if (
    restored.players.length !== 1 ||
    restored.players[0]!.id !== LOCAL_PLAYER_ID ||
    restored.pendingDecision === 'choose-next-player'
  ) {
    return { status: 'invalid-solo-game' }
  }

  return { status: 'restored', game: deepFreeze(restored) }
}

export function asCoreGameState(game: ReadonlyGameState): GameState {
  return game as GameState
}
