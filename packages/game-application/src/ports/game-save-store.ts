import type { GameState } from '@regicide/game-core'
import type { ReadonlyGameState } from '../session-snapshot'

export type SaveProblemCode =
  | 'invalid-envelope'
  | 'unsupported-save-version'
  | 'unsupported-game-version'
  | 'invalid-game-state'
  | 'invalid-solo-game'

export interface SaveProblem {
  readonly code: SaveProblemCode
  readonly message?: string
}

export type StorageProblemCode = 'unavailable' | 'quota-exceeded' | 'unknown'

export interface StorageProblem {
  readonly code: StorageProblemCode
  readonly message?: string
}

export type SaveLoadResult =
  | { readonly status: 'empty' }
  | { readonly status: 'loaded'; readonly game: GameState }
  | { readonly status: 'unrecoverable'; readonly reason: SaveProblem }
  | { readonly status: 'failed'; readonly reason: StorageProblem }

export type SaveWriteResult =
  { readonly status: 'saved' } | { readonly status: 'failed'; readonly reason: StorageProblem }

export type SaveClearResult =
  { readonly status: 'cleared' } | { readonly status: 'failed'; readonly reason: StorageProblem }

export interface GameSaveStore {
  load(): SaveLoadResult
  save(game: ReadonlyGameState): SaveWriteResult
  clear(): SaveClearResult
  onExternalChange(listener: () => void): () => void
}
