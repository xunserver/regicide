import {
  applyAction,
  createSeededRng,
  createSeededRngFromState,
  createSoloGame,
} from '../core/index.ts'
import type { GameEvent, GameState, SeededRng } from '../core/index.ts'
import {
  clearSession,
  DEFAULT_STORAGE_KEY,
  loadSession,
  saveSession,
} from './persist.ts'
import {
  buildView,
  sanitizeSelection,
  toggleSelection,
} from './queries.ts'
import type {
  CreateControllerOptions,
  DispatchResult,
  Intent,
  PersistedSession,
  SessionView,
  StorageLike,
} from './types.ts'

export type GameController = {
  getView: () => SessionView
  getState: () => GameState
  dispatch: (intent: Intent) => DispatchResult
  subscribe: (listener: () => void) => () => void
  save: () => boolean
  load: () => boolean
  clearSave: () => void
  hasSave: () => boolean
}

type Internal = {
  seed: number
  rng: SeededRng
  state: GameState
  selection: string[]
  createdAt: number
  updatedAt: number
}

export function createController(options: CreateControllerOptions = {}): GameController {
  const now = options.now ?? Date.now
  const storage = resolveStorage(options.storage)
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY
  const listeners = new Set<() => void>()

  let session = bootSession(options.seed, now)

  const api: GameController = {
    getView: () => viewOf(session),
    getState: () => session.state,
    dispatch: (intent) => {
      const result = handleIntent(session, intent, now)
      session = result.session
      notify(listeners)
      autoSave(storage, storageKey, session)
      return result.dispatch
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    save: () => {
      if (!storage) return false
      saveSession(storage, storageKey, toPersisted(session))
      return true
    },
    load: () => {
      if (!storage) return false
      const saved = loadSession(storage, storageKey)
      if (!saved) return false
      session = fromPersisted(saved)
      notify(listeners)
      return true
    },
    clearSave: () => {
      if (!storage) return
      clearSession(storage, storageKey)
    },
    hasSave: () => {
      if (!storage) return false
      return loadSession(storage, storageKey) !== null
    },
  }

  return api
}

function bootSession(seed: number | undefined, now: () => number): Internal {
  const resolvedSeed = seed ?? (Math.floor(Math.random() * 0xffffffff) >>> 0)
  const rng = createSeededRng(resolvedSeed)
  const { state } = createSoloGame({ seed: resolvedSeed, rng })
  const timestamp = now()
  return {
    seed: resolvedSeed,
    rng,
    state,
    selection: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function handleIntent(
  session: Internal,
  intent: Intent,
  now: () => number,
): { session: Internal; dispatch: DispatchResult } {
  switch (intent.type) {
    case 'NEW_GAME': {
      const next = bootSession(intent.seed, now)
      return {
        session: next,
        dispatch: success(next, []),
      }
    }
    case 'CLEAR_SELECTION': {
      const next = touch(session, { selection: [] }, now)
      return { session: next, dispatch: success(next, []) }
    }
    case 'TOGGLE_CARD': {
      const toggled = toggleSelection(session.state, session.selection, intent.cardId)
      if (toggled.error) {
        return { session, dispatch: failure(session, toggled.error) }
      }
      const next = touch(session, { selection: toggled.selection }, now)
      return { session: next, dispatch: success(next, []) }
    }
    case 'CONFIRM_PLAY':
      return commitAction(session, { type: 'PLAY', cardIds: session.selection }, now, true)
    case 'CONFIRM_DEFEND':
      return commitAction(session, { type: 'DEFEND', cardIds: session.selection }, now, true)
    case 'YIELD':
      return commitAction(session, { type: 'YIELD' }, now, true)
    case 'END_TURN':
      return commitAction(session, { type: 'END_TURN' }, now, true)
    case 'FLIP_JESTER':
      return commitAction(session, { type: 'FLIP_JESTER' }, now, true)
    default: {
      const _exhaustive: never = intent
      return {
        session,
        dispatch: failure(session, `Unknown intent: ${JSON.stringify(_exhaustive)}`),
      }
    }
  }
}

function commitAction(
  session: Internal,
  action: Parameters<typeof applyAction>[1],
  now: () => number,
  clearSelectionOnSuccess: boolean,
): { session: Internal; dispatch: DispatchResult } {
  const result = applyAction(session.state, action, session.rng)
  if (!result.ok) {
    return { session, dispatch: failure(session, result.error) }
  }

  const selection = clearSelectionOnSuccess
    ? []
    : sanitizeSelection(result.state, session.selection)

  const next = touch(
    session,
    {
      state: result.state,
      selection,
    },
    now,
  )

  return { session: next, dispatch: success(next, result.events) }
}

function touch(
  session: Internal,
  patch: Partial<Pick<Internal, 'state' | 'selection'>>,
  now: () => number,
): Internal {
  return {
    ...session,
    ...patch,
    updatedAt: now(),
  }
}

function viewOf(session: Internal): SessionView {
  return buildView({
    seed: session.seed,
    state: session.state,
    selection: session.selection,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  })
}

function success(session: Internal, events: GameEvent[]): DispatchResult {
  return { ok: true, events, view: viewOf(session) }
}

function failure(session: Internal, error: string): DispatchResult {
  return { ok: false, error, view: viewOf(session) }
}

function toPersisted(session: Internal): PersistedSession {
  return {
    version: 1,
    seed: session.seed,
    rngState: session.rng.getState(),
    state: session.state,
    selection: session.selection,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  }
}

function fromPersisted(saved: PersistedSession): Internal {
  return {
    seed: saved.seed,
    rng: createSeededRngFromState(saved.rngState),
    state: {
      ...saved.state,
      // Migrate saves created before multi-play turns.
      playedThisTurn: saved.state.playedThisTurn ?? false,
    },
    selection: sanitizeSelection(saved.state, saved.selection),
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  }
}

function autoSave(
  storage: StorageLike | null,
  key: string,
  session: Internal,
): void {
  if (!storage) return
  // Keep finished games saved so UI can show result after refresh;
  // NEW_GAME / clearSave replaces or removes them.
  saveSession(storage, key, toPersisted(session))
}

function resolveStorage(
  storage: CreateControllerOptions['storage'],
): StorageLike | null {
  if (storage === null) return null
  if (storage) return storage
  if (typeof localStorage !== 'undefined') return localStorage
  return null
}

function notify(listeners: Set<() => void>): void {
  for (const listener of listeners) listener()
}

export function peekSelectionValidity(sessionView: SessionView): {
  canPlay: boolean
  canDefend: boolean
} {
  return {
    canPlay: sessionView.commands.canConfirmPlay,
    canDefend: sessionView.commands.canConfirmDefend,
  }
}
