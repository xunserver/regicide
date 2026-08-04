export { LocalGameSession } from './local-game-session'
export type {
  ApplicationRejectedResult,
  ApplicationRejectionReason,
  ClearSaveResult,
  CommittedGameEvent,
  ExecuteResult,
  InitializeResult,
  NewGameResult,
} from './operation-results'
export type { PlayerIntent } from './player-intent'
export type {
  GameSaveStore,
  SaveClearResult,
  SaveLoadResult,
  SaveProblem,
  SaveProblemCode,
  SaveWriteResult,
  StorageProblem,
  StorageProblemCode,
} from './ports/game-save-store'
export type { GameSeedSource } from './ports/game-seed-source'
export type { DeepReadonly } from './readonly'
export {
  getCounterattackDamage,
  getCurrentEnemyStats,
  getEnemyDamage,
  getEnemyShield,
  getLegalPlayerIntents,
  isEnemyImmunityCancelled,
} from './solo-game-queries'
export type {
  ActiveSessionSnapshot,
  InitializedSessionSnapshot,
  LoadFailedSessionSnapshot,
  NoGameSessionSnapshot,
  ReadonlyGameState,
  SessionSnapshot,
  StaleSessionSnapshot,
  UninitializedSessionSnapshot,
  UnrecoverableSaveSessionSnapshot,
} from './session-snapshot'
