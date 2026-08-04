import type { GameState } from '@regicide/game-core'
import type { SaveProblem, StorageProblem } from './ports/game-save-store'
import type { DeepReadonly } from './readonly'

export type ReadonlyGameState = DeepReadonly<GameState>

export interface UninitializedSessionSnapshot {
  readonly status: 'uninitialized'
}

export interface NoGameSessionSnapshot {
  readonly status: 'no-game'
}

export interface ActiveSessionSnapshot {
  readonly status: 'active'
  readonly game: ReadonlyGameState
}

export interface UnrecoverableSaveSessionSnapshot {
  readonly status: 'unrecoverable-save'
  readonly reason: SaveProblem
}

export interface LoadFailedSessionSnapshot {
  readonly status: 'load-failed'
  readonly reason: StorageProblem
}

export type StaleSessionSnapshot =
  | { readonly status: 'stale' }
  | { readonly status: 'stale'; readonly previousGame: ReadonlyGameState }

export type SessionSnapshot =
  | UninitializedSessionSnapshot
  | NoGameSessionSnapshot
  | ActiveSessionSnapshot
  | UnrecoverableSaveSessionSnapshot
  | LoadFailedSessionSnapshot
  | StaleSessionSnapshot

export type InitializedSessionSnapshot = Exclude<SessionSnapshot, UninitializedSessionSnapshot>
