import { HAND_LIMIT_SOLO } from './constants.ts'
import type { Card, GameEvent, Rng } from './types.ts'

export type Zones = {
  tavern: Card[]
  discard: Card[]
  hand: Card[]
}

/** Hearts: shuffle discard, move N cards under the tavern. */
export function resolveHearts(
  zones: Zones,
  count: number,
  rng: Rng,
): { zones: Zones; moved: Card[]; event: GameEvent | null } {
  if (count <= 0 || zones.discard.length === 0) {
    return { zones, moved: [], event: null }
  }

  const shuffled = rng.shuffle(zones.discard)
  const take = Math.min(count, shuffled.length)
  const moved = shuffled.slice(0, take)
  const remaining = shuffled.slice(take)

  return {
    zones: {
      ...zones,
      discard: remaining,
      tavern: [...zones.tavern, ...moved],
    },
    moved,
    event: { type: 'POWER_HEARTS', moved },
  }
}

/** Diamonds: draw up to N cards for the solo player, respecting hand limit. */
export function resolveDiamonds(
  zones: Zones,
  count: number,
): { zones: Zones; drawn: Card[]; event: GameEvent | null } {
  if (count <= 0) {
    return { zones, drawn: [], event: null }
  }

  const hand = [...zones.hand]
  const tavern = [...zones.tavern]
  const drawn: Card[] = []

  for (let i = 0; i < count; i += 1) {
    if (hand.length >= HAND_LIMIT_SOLO) break
    if (tavern.length === 0) break
    const card = tavern.shift()!
    hand.push(card)
    drawn.push(card)
  }

  return {
    zones: { ...zones, hand, tavern },
    drawn,
    event: drawn.length > 0 ? { type: 'POWER_DIAMONDS', drawn } : null,
  }
}

/** Solo jester: discard hand, redraw to hand limit (not a Diamond draw). */
export function resolveJesterRefill(
  zones: Zones,
): { zones: Zones; discarded: Card[]; drawn: Card[] } {
  const discarded = [...zones.hand]
  const discard = [...zones.discard, ...discarded]
  const tavern = [...zones.tavern]
  const hand: Card[] = []

  while (hand.length < HAND_LIMIT_SOLO && tavern.length > 0) {
    hand.push(tavern.shift()!)
  }

  return {
    zones: { tavern, discard, hand },
    discarded,
    drawn: [...hand],
  }
}
