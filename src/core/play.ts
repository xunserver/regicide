import { cardValue, isAce, sumValues } from './cards.ts'
import type { Card, Suit } from './types.ts'

export type PlayPlan = {
  cards: Card[]
  attackValue: number
  /** Suits whose powers should resolve (unique; same-suit Ace pair counts once). */
  suits: Suit[]
}

export type PlayValidation =
  | { ok: true; plan: PlayPlan }
  | { ok: false; error: string }

/**
 * Legal Step-1 plays:
 * - single card
 * - Ace paired with exactly one other non-jester card (Ace or otherwise)
 * - combo of 2–4 same-rank cards from {2,3,4,5} with total value ≤ 10
 */
export function validatePlay(cards: readonly Card[]): PlayValidation {
  if (cards.length === 0) {
    return { ok: false, error: 'Play at least one card' }
  }

  const ids = new Set(cards.map((card) => card.id))
  if (ids.size !== cards.length) {
    return { ok: false, error: 'Duplicate cards in play' }
  }

  if (cards.length === 1) {
    return okPlan(cards)
  }

  const aces = cards.filter(isAce)
  if (aces.length > 0) {
    if (cards.length !== 2) {
      return {
        ok: false,
        error: 'Animal Companions may only be paired with one other card',
      }
    }
    return okPlan(cards)
  }

  return validateCombo(cards)
}

function validateCombo(cards: readonly Card[]): PlayValidation {
  if (cards.length < 2 || cards.length > 4) {
    return { ok: false, error: 'Combo must contain 2 to 4 cards' }
  }

  const rank = cards[0]!.rank
  if (rank !== '2' && rank !== '3' && rank !== '4' && rank !== '5') {
    return { ok: false, error: 'Combo cards must be ranks 2–5' }
  }

  if (!cards.every((card) => card.rank === rank)) {
    return { ok: false, error: 'Combo cards must share the same rank' }
  }

  const attackValue = sumValues(cards)
  if (attackValue > 10) {
    return { ok: false, error: 'Combo total must be 10 or less' }
  }

  return okPlan(cards)
}

function okPlan(cards: readonly Card[]): PlayValidation {
  const attackValue = sumValues(cards)
  const suits = uniqueSuits(cards)
  return {
    ok: true,
    plan: { cards: [...cards], attackValue, suits },
  }
}

function uniqueSuits(cards: readonly Card[]): Suit[] {
  const seen = new Set<Suit>()
  const suits: Suit[] = []
  for (const card of cards) {
    if (!seen.has(card.suit)) {
      seen.add(card.suit)
      suits.push(card.suit)
    }
  }
  return suits
}

export function activeSuits(plan: PlayPlan, enemySuit: Suit, immunityActive: boolean): Suit[] {
  if (!immunityActive) return plan.suits
  return plan.suits.filter((suit) => suit !== enemySuit)
}

export function damageForPlay(plan: PlayPlan, active: readonly Suit[]): number {
  const doubled = active.includes('C')
  return doubled ? plan.attackValue * 2 : plan.attackValue
}

export function canCoverDamage(hand: readonly Card[], damage: number): boolean {
  if (damage <= 0) return true
  return sumValues(hand) >= damage
}

export function defendDamageNeeded(attack: number, shield: number): number {
  return Math.max(0, attack - shield)
}

export function describePlay(cards: readonly Card[]): string {
  return cards.map((card) => `${cardValue(card)}${card.suit}`).join('+')
}
