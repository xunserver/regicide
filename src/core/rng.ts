import type { Rng, SeededRng } from './types.ts'

/** Mulberry32 — small deterministic PRNG for tests and seeded games. */
export function createSeededRng(seed: number): SeededRng {
  return createSeededRngFromState(seed >>> 0)
}

/** Restore a seeded RNG from a previously captured `getState()` value. */
export function createSeededRngFromState(state: number): SeededRng {
  let t = state >>> 0
  const next = (): number => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    shuffle: <T>(items: readonly T[]) => shuffleWith(items, next),
    getState: () => t >>> 0,
  }
}

export function createMathRng(): Rng {
  return {
    next: () => Math.random(),
    shuffle: <T>(items: readonly T[]) => shuffleWith(items, Math.random),
  }
}

function shuffleWith<T>(items: readonly T[], next: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1))
    const tmp = copy[i]!
    copy[i] = copy[j]!
    copy[j] = tmp
  }
  return copy
}
