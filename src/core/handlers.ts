import { findCards, removeCards, sumValues } from './cards.ts'
import {
  activeSuits,
  canCoverDamage,
  damageForPlay,
  defendDamageNeeded,
  validatePlay,
} from './play.ts'
import { resolveDiamonds, resolveHearts, resolveJesterRefill } from './powers.ts'
import type { ApplyResult, GameEvent, GameState, Rng, Suit } from './types.ts'
import {
  arriveAtPlay,
  defeatEnemy,
  dummyRng,
  enterDefendOrFinish,
  fail,
  ok,
  transitionToLost,
  type Mutable,
} from './transitions.ts'

/**
 * 各 phase 下的 action 处理（由 machine 按 PHASE_ACTIONS 分发过来）。
 * 不直接乱改 phase；需要换阶段时调用 transitions。
 */

/** play — PLAY：出牌 → 花色能力 → 伤害 → 击杀或进入防御 */
export function handlePlay(state: GameState, cardIds: string[], rng: Rng): ApplyResult {
  if (!state.enemy) {
    return fail(state, 'No enemy to attack')
  }

  const selected = findCards(state.hand, cardIds)
  if (!selected) {
    return fail(state, 'Selected cards are not all in hand')
  }

  const validation = validatePlay(selected)
  if (!validation.ok) {
    return fail(state, validation.error)
  }

  const ctx: Mutable = {
    state: {
      ...state,
      hand: removeCards(state.hand, cardIds),
      playArea: [...state.playArea, ...selected],
      lastTurnYielded: false,
    },
    events: [
      {
        type: 'CARDS_PLAYED',
        cards: selected,
        attackValue: validation.plan.attackValue,
      },
    ],
    rng,
  }

  resolveSuitPowers(ctx, validation.plan.attackValue, validation.plan.suits)
  return resolveDamageAndAftermath(ctx, validation.plan.attackValue, validation.plan.suits)
}

/** play — YIELD：跳过出牌，直接结算敌军反击 */
export function handleYield(state: GameState): ApplyResult {
  if (state.lastTurnYielded) {
    return fail(state, 'Cannot yield twice in a row (solo)')
  }
  if (!state.enemy) {
    return fail(state, 'No enemy')
  }

  const ctx: Mutable = {
    state: {
      ...state,
      lastTurnYielded: true,
    },
    events: [{ type: 'YIELDED' }],
    rng: dummyRng,
  }

  return enterDefendOrFinish(ctx)
}

/** defend — DEFEND：弃牌挡伤，回到 play */
export function handleDefend(state: GameState, cardIds: string[]): ApplyResult {
  if (!state.enemy) {
    return fail(state, 'No enemy')
  }

  const needed = defendDamageNeeded(state.enemy.attack, state.enemy.shield)
  const selected = findCards(state.hand, cardIds)
  if (!selected) {
    return fail(state, 'Selected cards are not all in hand')
  }

  if (needed === 0) {
    if (cardIds.length > 0) {
      return fail(state, 'No damage to block; discard nothing')
    }
  } else {
    const total = sumValues(selected)
    if (total < needed) {
      return fail(
        state,
        `Discarded value ${total} is less than required damage ${needed}`,
      )
    }
  }

  const next: GameState = {
    ...state,
    hand: removeCards(state.hand, cardIds),
    discard: [...state.discard, ...selected],
    phase: 'play',
  }

  const events: GameEvent[] = [
    { type: 'DAMAGE_BLOCKED', cards: selected, damage: needed },
    { type: 'TURN_STARTED' },
  ]

  return arriveAtPlay(next, events)
}

/** play | defend — FLIP_JESTER：弃空手牌再抽满；防御阶段可能因此战败 */
export function handleFlipJester(state: GameState, rng: Rng): ApplyResult {
  if (state.jestersRemaining <= 0) {
    return fail(state, 'No Jesters remaining')
  }

  const refill = resolveJesterRefill({
    tavern: state.tavern,
    discard: state.discard,
    hand: state.hand,
  })

  const next: GameState = {
    ...state,
    tavern: refill.zones.tavern,
    discard: refill.zones.discard,
    hand: refill.zones.hand,
    jestersRemaining: state.jestersRemaining - 1,
    jestersUsed: state.jestersUsed + 1,
  }

  const events: GameEvent[] = [
    {
      type: 'JESTER_FLIPPED',
      discarded: refill.discarded,
      drawn: refill.drawn,
    },
  ]

  // Flipping at Step 4 can leave the hand unable to cover damage.
  if (next.phase === 'defend' && next.enemy) {
    const needed = defendDamageNeeded(next.enemy.attack, next.enemy.shield)
    if (!canCoverDamage(next.hand, needed)) {
      return transitionToLost(
        { state: next, events, rng },
        'Unable to discard enough cards to cover enemy damage',
      )
    }
  }

  return ok(next, events)
}

function resolveSuitPowers(
  ctx: Mutable,
  attackValue: number,
  suits: readonly Suit[],
): void {
  const enemy = ctx.state.enemy!
  const immunityActive = true
  const active = activeSuits(
    { cards: [], attackValue, suits: [...suits] },
    enemy.card.suit,
    immunityActive,
  )

  let zones = {
    tavern: ctx.state.tavern,
    discard: ctx.state.discard,
    hand: ctx.state.hand,
  }

  // Hearts before Diamonds when both resolve.
  if (active.includes('H')) {
    const hearts = resolveHearts(zones, attackValue, ctx.rng)
    zones = hearts.zones
    if (hearts.event) ctx.events.push(hearts.event)
  }

  if (active.includes('D')) {
    const diamonds = resolveDiamonds(zones, attackValue)
    zones = diamonds.zones
    if (diamonds.event) ctx.events.push(diamonds.event)
  }

  ctx.state = {
    ...ctx.state,
    tavern: zones.tavern,
    discard: zones.discard,
    hand: zones.hand,
  }

  if (active.includes('S')) {
    const shieldAdded = attackValue
    const shieldTotal = enemy.shield + shieldAdded
    ctx.state = {
      ...ctx.state,
      enemy: { ...enemy, shield: shieldTotal },
    }
    ctx.events.push({
      type: 'POWER_SPADES',
      shieldAdded,
      shieldTotal,
    })
  }
}

function resolveDamageAndAftermath(
  ctx: Mutable,
  attackValue: number,
  suits: readonly Suit[],
): ApplyResult {
  const enemy = ctx.state.enemy!
  const immunityActive = true
  const active = activeSuits(
    { cards: [], attackValue, suits: [...suits] },
    enemy.card.suit,
    immunityActive,
  )

  const damage = damageForPlay(
    { cards: [], attackValue, suits: [...suits] },
    active,
  )

  if (active.includes('C')) {
    ctx.events.push({ type: 'POWER_CLUBS', damage })
  }

  const damageDealt = enemy.damageDealt + damage
  ctx.state = {
    ...ctx.state,
    enemy: { ...enemy, damageDealt },
  }
  ctx.events.push({ type: 'DAMAGE_DEALT', damage, damageDealt })

  if (damageDealt >= enemy.health) {
    return defeatEnemy(ctx, damageDealt === enemy.health)
  }

  return enterDefendOrFinish(ctx)
}
