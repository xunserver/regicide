import { dispatch } from '@regicide/game-core'
import { intentToCommand } from './intent-to-command'
import type {
  ApplicationRejectedResult,
  ApplicationRejectionReason,
  ClearSaveResult,
  ExecuteResult,
  InitializeResult,
  NewGameResult,
} from './operation-results'
import type { PlayerIntent } from './player-intent'
import type { GameSaveStore, SaveLoadResult } from './ports/game-save-store'
import type { GameSeedSource } from './ports/game-seed-source'
import { deepFreeze } from './readonly'
import { asCoreGameState, createSoloGame, restoreSoloGame } from './solo-game'
import type {
  ActiveSessionSnapshot,
  InitializedSessionSnapshot,
  SessionSnapshot,
} from './session-snapshot'

const UNINITIALIZED_SNAPSHOT = deepFreeze({ status: 'uninitialized' } as const)
const NO_GAME_SNAPSHOT = deepFreeze({ status: 'no-game' } as const)
const NO_EVENTS: readonly [] = deepFreeze([] as const)

type SnapshotListener = () => void

export class LocalGameSession {
  private snapshot: SessionSnapshot = UNINITIALIZED_SNAPSHOT
  private readonly listeners = new Set<SnapshotListener>()
  private unsubscribeExternalChange: (() => void) | undefined
  private operationInProgress = false
  private disposed = false
  private disposeRequested = false

  public constructor(
    private readonly store: GameSaveStore,
    private readonly seedSource: GameSeedSource,
  ) {}

  public initialize(): InitializeResult {
    return this.runOperation(
      (reason) => this.applicationRejected(reason),
      () => {
        if (this.snapshot.status !== 'uninitialized') {
          return this.applicationRejected('already-initialized')
        }

        const unsubscribe = this.store.onExternalChange(this.handleExternalChange)
        this.unsubscribeExternalChange = unsubscribe
        try {
          const snapshot = this.snapshotFromLoadResult(this.store.load())
          this.commitSnapshot(snapshot)
          return { status: 'completed', snapshot }
        } catch (error) {
          this.unsubscribeExternalChange = undefined
          try {
            unsubscribe()
          } catch {
            // Preserve the original unexpected initialization failure.
          }
          throw error
        }
      },
    )
  }

  public retryLoad(): InitializeResult {
    return this.runOperation(
      (reason) => this.applicationRejected(reason),
      () => {
        if (this.snapshot.status === 'uninitialized') {
          return this.applicationRejected('session-not-initialized')
        }
        if (this.snapshot.status === 'stale') {
          return this.applicationRejected('stale')
        }
        if (this.snapshot.status !== 'load-failed') {
          return this.applicationRejected('load-not-failed')
        }

        const snapshot = this.snapshotFromLoadResult(this.store.load())
        this.commitSnapshot(snapshot)
        return { status: 'completed', snapshot }
      },
    )
  }

  public getSnapshot(): SessionSnapshot {
    return this.snapshot
  }

  public subscribe(listener: SnapshotListener): () => void {
    if (this.disposed) return () => undefined

    this.listeners.add(listener)
    let subscribed = true
    return () => {
      if (!subscribed) return
      subscribed = false
      this.listeners.delete(listener)
    }
  }

  public startNewGame(): NewGameResult {
    return this.runOperation(
      (reason) => this.applicationRejected(reason),
      () => {
        const stateRejection = this.requireSnapshotStatus('no-game', 'no-game-required')
        if (stateRejection) return stateRejection
        return this.createAndCommitGame()
      },
    )
  }

  public replaceWithNewGame(): NewGameResult {
    return this.runOperation(
      (reason) => this.applicationRejected(reason),
      () => {
        const stateRejection = this.requireSnapshotStatus('active', 'active-game-required')
        if (stateRejection) return stateRejection
        return this.createAndCommitGame()
      },
    )
  }

  public clearUnrecoverableSave(): ClearSaveResult {
    return this.runOperation(
      (reason) => this.applicationRejected(reason),
      () => {
        const stateRejection = this.requireSnapshotStatus(
          'unrecoverable-save',
          'unrecoverable-save-required',
        )
        if (stateRejection) return stateRejection

        const result = this.store.clear()
        if (result.status === 'failed') {
          return {
            status: 'storage-error',
            reason: deepFreeze({ ...result.reason }),
            snapshot: this.snapshot,
          }
        }

        this.commitSnapshot(NO_GAME_SNAPSHOT)
        return { status: 'cleared', snapshot: NO_GAME_SNAPSHOT }
      },
    )
  }

  public execute(intent: PlayerIntent): ExecuteResult {
    return this.runOperation(
      (reason) => ({ ...this.applicationRejected(reason), events: NO_EVENTS }),
      () => {
        const stateRejection = this.requireSnapshotStatus('active', 'active-game-required')
        if (stateRejection) return { ...stateRejection, events: NO_EVENTS }

        const current = this.snapshot as ActiveSessionSnapshot
        const transition = dispatch(asCoreGameState(current.game), intentToCommand(intent))
        if (!transition.accepted) {
          return {
            status: 'rejected',
            reason: transition.reason,
            snapshot: current,
            events: NO_EVENTS,
          }
        }

        const game = deepFreeze(transition.state)
        const events = deepFreeze(transition.events)
        const save = this.store.save(game)
        if (save.status === 'failed') {
          return {
            status: 'storage-error',
            reason: deepFreeze({ ...save.reason }),
            snapshot: current,
            events: NO_EVENTS,
          }
        }

        const snapshot = deepFreeze({ status: 'active', game } as const)
        this.commitSnapshot(snapshot)
        return { status: 'committed', snapshot, events }
      },
    )
  }

  public dispose(): void {
    if (this.disposed) return
    if (this.operationInProgress) {
      this.disposeRequested = true
      return
    }
    this.performDispose()
  }

  private readonly handleExternalChange = (): void => {
    if (this.disposed || this.operationInProgress || this.snapshot.status === 'stale') return
    this.markStale()
  }

  private runOperation<Result>(
    blocked: (reason: ApplicationRejectionReason) => Result,
    operation: () => Result,
  ): Result {
    if (this.disposed) return blocked('disposed')
    if (this.operationInProgress) return blocked('operation-in-progress')

    this.operationInProgress = true
    try {
      return operation()
    } finally {
      this.operationInProgress = false
      if (this.disposeRequested) this.performDispose()
    }
  }

  private applicationRejected(reason: ApplicationRejectionReason): ApplicationRejectedResult {
    return { status: 'application-rejected', reason, snapshot: this.snapshot }
  }

  private requireSnapshotStatus(
    expected: 'no-game' | 'active' | 'unrecoverable-save',
    fallbackReason: ApplicationRejectionReason,
  ): ApplicationRejectedResult | null {
    if (this.snapshot.status === expected) return null
    if (this.snapshot.status === 'uninitialized') {
      return this.applicationRejected('session-not-initialized')
    }
    if (this.snapshot.status === 'stale') return this.applicationRejected('stale')
    return this.applicationRejected(fallbackReason)
  }

  private snapshotFromLoadResult(result: SaveLoadResult): InitializedSessionSnapshot {
    switch (result.status) {
      case 'empty':
        return NO_GAME_SNAPSHOT
      case 'loaded': {
        const restored = restoreSoloGame(result.game)
        if (restored.status !== 'restored') {
          const invalidGameState = restored.status === 'invalid-game-state'
          return deepFreeze({
            status: 'unrecoverable-save',
            reason: {
              code: restored.status,
              message: invalidGameState
                ? 'The save store returned an invalid core game state.'
                : 'Saved game violates the fixed local solo game invariants.',
            },
          } as const)
        }
        return deepFreeze({ status: 'active', game: restored.game } as const)
      }
      case 'unrecoverable':
        return deepFreeze({
          status: 'unrecoverable-save',
          reason: { ...result.reason },
        } as const)
      case 'failed':
        if (
          this.snapshot.status === 'load-failed' &&
          this.snapshot.reason.code === result.reason.code &&
          this.snapshot.reason.message === result.reason.message
        ) {
          return this.snapshot
        }
        return deepFreeze({ status: 'load-failed', reason: { ...result.reason } } as const)
    }
  }

  private createAndCommitGame(): NewGameResult {
    const previous = this.snapshot
    const game = createSoloGame(this.seedSource)
    const save = this.store.save(game)
    if (save.status === 'failed') {
      return {
        status: 'storage-error',
        reason: deepFreeze({ ...save.reason }),
        snapshot: previous,
      }
    }

    const snapshot = deepFreeze({ status: 'active', game } as const)
    this.commitSnapshot(snapshot)
    return { status: 'committed', snapshot }
  }

  private commitSnapshot(snapshot: SessionSnapshot): void {
    if (snapshot === this.snapshot) return
    this.snapshot = snapshot
    for (const listener of [...this.listeners]) {
      try {
        listener()
      } catch {
        // The state is already committed; listener failures must not rewrite the operation result.
      }
    }
  }

  private markStale(): void {
    if (this.disposed || this.snapshot.status === 'stale') return

    const stale =
      this.snapshot.status === 'active'
        ? deepFreeze({ status: 'stale', previousGame: this.snapshot.game } as const)
        : deepFreeze({ status: 'stale' } as const)
    this.commitSnapshot(stale)
  }

  private performDispose(): void {
    this.disposeRequested = false
    this.disposed = true
    const unsubscribe = this.unsubscribeExternalChange
    this.unsubscribeExternalChange = undefined
    this.listeners.clear()
    try {
      unsubscribe?.()
    } catch {
      // Disposal remains final even if an adapter's unsubscribe implementation is faulty.
    }
  }
}
