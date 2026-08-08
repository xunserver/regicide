import type { PersistedSession, StorageLike } from './types.ts'

export const DEFAULT_STORAGE_KEY = 'regicide.solo.v1'

export function saveSession(
  storage: StorageLike,
  key: string,
  session: PersistedSession,
): void {
  storage.setItem(key, JSON.stringify(session))
}

export function loadSession(
  storage: StorageLike,
  key: string,
): PersistedSession | null {
  const raw = storage.getItem(key)
  if (!raw) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isPersistedSession(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function clearSession(storage: StorageLike, key: string): void {
  storage.removeItem(key)
}

export function memoryStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
    removeItem: (key) => {
      map.delete(key)
    },
  }
}

function isPersistedSession(value: unknown): value is PersistedSession {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    v.version === 1 &&
    typeof v.seed === 'number' &&
    typeof v.rngState === 'number' &&
    typeof v.createdAt === 'number' &&
    typeof v.updatedAt === 'number' &&
    Array.isArray(v.selection) &&
    typeof v.state === 'object' &&
    v.state !== null
  )
}
