import type { GameEvent, RejectionReason } from '@regicide/game-core'
import type { StorageProblem } from './ports/game-save-store'
import type { DeepReadonly } from './readonly'
import type {
  ActiveSessionSnapshot,
  InitializedSessionSnapshot,
  NoGameSessionSnapshot,
  SessionSnapshot,
} from './session-snapshot'

export type ApplicationRejectionReason =
  | 'session-not-initialized'
  | 'already-initialized'
  | 'load-not-failed'
  | 'no-game-required'
  | 'active-game-required'
  | 'unrecoverable-save-required'
  | 'stale'
  | 'disposed'
  | 'operation-in-progress'

export interface ApplicationRejectedResult {
  readonly status: 'application-rejected'
  readonly reason: ApplicationRejectionReason
  readonly snapshot: SessionSnapshot
}

export type InitializeResult =
  | { readonly status: 'completed'; readonly snapshot: InitializedSessionSnapshot }
  | ApplicationRejectedResult

export type NewGameResult =
  | { readonly status: 'committed'; readonly snapshot: ActiveSessionSnapshot }
  | {
      readonly status: 'storage-error'
      readonly reason: StorageProblem
      readonly snapshot: SessionSnapshot
    }
  | ApplicationRejectedResult

export type ClearSaveResult =
  | { readonly status: 'cleared'; readonly snapshot: NoGameSessionSnapshot }
  | {
      readonly status: 'storage-error'
      readonly reason: StorageProblem
      readonly snapshot: SessionSnapshot
    }
  | ApplicationRejectedResult

export type CommittedGameEvent = DeepReadonly<GameEvent>

export type ExecuteResult =
  | {
      readonly status: 'committed'
      readonly snapshot: ActiveSessionSnapshot
      readonly events: readonly CommittedGameEvent[]
    }
  | {
      readonly status: 'rejected'
      readonly reason: RejectionReason
      readonly snapshot: ActiveSessionSnapshot
      readonly events: readonly []
    }
  | {
      readonly status: 'storage-error'
      readonly reason: StorageProblem
      readonly snapshot: ActiveSessionSnapshot
      readonly events: readonly []
    }
  | (ApplicationRejectedResult & { readonly events: readonly [] })
