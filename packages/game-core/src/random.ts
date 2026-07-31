import type { RandomState } from './types'

const NON_ZERO_FALLBACK = 0x6d2b79f5

export function createRandomState(seed: string | number): RandomState {
  const text = String(seed)
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return { algorithm: 'xorshift32', state: hash >>> 0 || NON_ZERO_FALLBACK }
}

function nextUint32(random: RandomState): [number, RandomState] {
  let value = random.state >>> 0
  value ^= value << 13
  value ^= value >>> 17
  value ^= value << 5
  value >>>= 0
  return [value, { algorithm: 'xorshift32', state: value || NON_ZERO_FALLBACK }]
}

export function shuffle<T>(items: readonly T[], initialRandom: RandomState): [T[], RandomState] {
  const shuffled = [...items]
  let random = initialRandom

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const [value, nextRandom] = nextUint32(random)
    random = nextRandom
    const target = Math.floor((value / 0x1_0000_0000) * (index + 1))
    ;[shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!]
  }

  return [shuffled, random]
}
