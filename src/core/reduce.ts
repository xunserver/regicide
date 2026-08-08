import { findCards, removeCards, sumValues } from './cards.ts'
import { HAND_LIMIT_SOLO } from './constants.ts'
import {
  activeSuits,
  canCoverDamage,
  damageForPlay,
  defendDamageNeeded,
  validatePlay,
} from './play.ts'
import { resolveDiamonds, resolveHearts, resolveJesterRefill } from './powers.ts'
import { makeEnemy } from './setup.ts'
import type {
  Action,
  ApplyResult,
  Card,
  GameEvent,
  GameState,
  Rng,
  VictoryRank,
} from './types.ts'

type Mutable = {
  state: GameState
  events: GameEvent[]
  rng: Rng
}

export function applyAction(state: GameState, action: Action, rng: Rng): ApplyResult {
  if (state.phase === 'won' || state.phase === 'lost') {
    return fail(state, 'Game is already over')
  }

  switch (action.type) {
    case 'FLIP_JESTER':
      return flipJester(state, rng)
    case 'PLAY':
      return playCards(state, action.cardIds, rng)
    case 'YIELD':
      return yieldTurn(state)
    case 'DEFEND':
      return defend(state, action.cardIds)
    default: {
      const _exhaustive: never = action
      return fail(state, `Unknown action: ${JSON.stringify(_exhaustive)}`)
    }
  }
}

function flipJester(state: GameState, rng: Rng): ApplyResult {
  if (state.phase !== 'play' && state.phase !== 'defend') {
    return fail(state, 'Cannot flip a Jester now')
  }
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
      return lose(
        { state: next, events, rng },
        'Unable to discard enough cards to cover enemy damage',
      )
    }
  }

  return ok(next, events)
}

function playCards(state: GameState, cardIds: string[], rng: Rng): ApplyResult {
  if (state.phase !== 'play') {
    return fail(state, 'Not in play phase')
  }
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

function yieldTurn(state: GameState): ApplyResult {
  if (state.phase !== 'play') {
    return fail(state, 'Not in play phase')
  }
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

function defend(state: GameState, cardIds: string[]): ApplyResult {
  if (state.phase !== 'defend') {
    return fail(state, 'Not in defend phase')
  }
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
    // Must be able to cover; over-discarding is allowed by rules ("at least").
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

  return finalizePlayPhaseStart(next, events)
}

function resolveSuitPowers(
  ctx: Mutable,
  attackValue: number,
  suits: readonly import('./types.ts').Suit[],
): void {
  const enemy = ctx.state.enemy!
  // Solo has no playable Jester to cancel immunity.
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
  suits: readonly import('./types.ts').Suit[],
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

function defeatEnemy(ctx: Mutable, exact: boolean): ApplyResult {
  const enemyCard = ctx.state.enemy!.card
  let tavern = [...ctx.state.tavern]
  let discard = [...ctx.state.discard, ...ctx.state.playArea]
  let castle = [...ctx.state.castle]

  if (exact) {
    tavern = [enemyCard, ...tavern]
  } else {
    discard = [...discard, enemyCard]
  }

  const nextEnemyCard = castle.shift() ?? null
  ctx.events.push({
    type: 'ENEMY_DEFEATED',
    enemy: enemyCard,
    exact,
    nextEnemy: nextEnemyCard,
  })

  if (!nextEnemyCard) {
    const victory = victoryFor(ctx.state.jestersUsed)
    const won: GameState = {
      ...ctx.state,
      phase: 'won',
      tavern,
      discard,
      castle: [],
      playArea: [],
      enemy: null,
      victory,
    }
    ctx.events.push({ type: 'GAME_WON', victory })
    return ok(won, ctx.events)
  }

  const next: GameState = {
    ...ctx.state,
    phase: 'play',
    tavern,
    discard,
    castle,
    playArea: [],
    enemy: makeEnemy(nextEnemyCard),
    lastTurnYielded: false,
  }
  ctx.events.push({ type: 'TURN_STARTED' })
  return finalizePlayPhaseStart(next, ctx.events)
}

function enterDefendOrFinish(ctx: Mutable): ApplyResult {
  const enemy = ctx.state.enemy!
  const needed = defendDamageNeeded(enemy.attack, enemy.shield)

  if (needed === 0) {
    const next: GameState = {
      ...ctx.state,
      phase: 'play',
    }
    ctx.events.push({ type: 'DEFEND_REQUIRED', damage: 0 })
    ctx.events.push({ type: 'DAMAGE_BLOCKED', cards: [], damage: 0 })
    ctx.events.push({ type: 'TURN_STARTED' })
    return finalizePlayPhaseStart(next, ctx.events)
  }

  if (!canCoverDamage(ctx.state.hand, needed)) {
    return lose(ctx, 'Unable to discard enough cards to cover enemy damage')
  }

  const next: GameState = {
    ...ctx.state,
    phase: 'defend',
  }
  ctx.events.push({ type: 'DEFEND_REQUIRED', damage: needed })
  return ok(next, ctx.events)
}

/** After arriving at play phase, lose if no legal action remains. */
function finalizePlayPhaseStart(state: GameState, events: GameEvent[]): ApplyResult {
  if (state.phase !== 'play') {
    return ok(state, events)
  }

  if (state.hand.length === 0 && state.lastTurnYielded) {
    return lose(
      { state, events, rng: dummyRng },
      'Unable to play a card or yield',
    )
  }

  return ok(state, events)
}

function victoryFor(jestersUsed: number): VictoryRank {
  if (jestersUsed <= 0) return 'gold'
  if (jestersUsed === 1) return 'silver'
  return 'bronze'
}

function lose(ctx: Mutable, reason: string): ApplyResult {
  const lost: GameState = {
    ...ctx.state,
    phase: 'lost',
    defeatReason: reason,
  }
  ctx.events.push({ type: 'GAME_LOST', reason })
  return ok(lost, ctx.events)
}

function ok(state: GameState, events: GameEvent[]): ApplyResult {
  return { ok: true, state, events }
}

function fail(state: GameState, error: string): ApplyResult {
  return { ok: false, error, state }
}

/** Yield path does not shuffle; placeholder satisfies typing. */
const dummyRng: Rng = {
  next: () => 0,
  shuffle: <T>(items: readonly T[]) => [...items],
}

export function getDefendDamage(state: GameState): number {
  if (!state.enemy) return 0
  return defendDamageNeeded(state.enemy.attack, state.enemy.shield)
}

export function canFlipJester(state: GameState): boolean {
  return (
    (state.phase === 'play' || state.phase === 'defend') &&
    state.jestersRemaining > 0
  )
}

export function canYield(state: GameState): boolean {
  return state.phase === 'play' && !state.lastTurnYielded
}

export function handLimit(): number {
  return HAND_LIMIT_SOLO
}

export function cloneState(state: GameState): GameState {
  return {
    ...state,
    tavern: [...state.tavern],
    castle: [...state.castle],
    discard: [...state.discard],
    playArea: [...state.playArea],
    hand: [...state.hand],
    enemy: state.enemy ? { ...state.enemy, card: { ...state.enemy.card } } : null,
  }
}

export type { Card }
