import { canCoverDamage, defendDamageNeeded } from './play.ts'
import { makeEnemy } from './setup.ts'
import type {
  ApplyResult,
  Card,
  GameEvent,
  GameState,
  Rng,
  VictoryRank,
} from './types.ts'

/** Mutable scratch pad while resolving a multi-step action. */
export type Mutable = {
  state: GameState
  events: GameEvent[]
  rng: Rng
}

/**
 * 状态机「箭头」：只在这里写入下一 phase。
 *
 * 对应关系（详见 README「Core 状态机」）：
 * - enterDefendOrFinish → play→defend | play→play(伤害 0) | →lost
 * - defeatEnemy         → play→play(下一敌) | →won
 * - arriveAtPlay        → 进入 play 后检查是否立刻 lost
 * - transitionToWon/Lost → 终态
 */

/** After an attack/yield that did not kill the enemy: defend, auto-pass, or lose. */
export function enterDefendOrFinish(ctx: Mutable): ApplyResult {
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
    return arriveAtPlay(next, ctx.events)
  }

  if (!canCoverDamage(ctx.state.hand, needed)) {
    return transitionToLost(ctx, 'Unable to discard enough cards to cover enemy damage')
  }

  const next: GameState = {
    ...ctx.state,
    phase: 'defend',
  }
  ctx.events.push({ type: 'DEFEND_REQUIRED', damage: needed })
  return ok(next, ctx.events)
}

/** Enemy HP depleted: win, or advance castle and return to play. */
export function defeatEnemy(ctx: Mutable, exact: boolean): ApplyResult {
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
    return transitionToWon(ctx, tavern, discard)
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
  return arriveAtPlay(next, ctx.events)
}

/** Enter play; lose immediately if the player has no legal follow-up. */
export function arriveAtPlay(state: GameState, events: GameEvent[]): ApplyResult {
  if (state.phase !== 'play') {
    return ok(state, events)
  }

  if (state.hand.length === 0 && state.lastTurnYielded) {
    return transitionToLost(
      { state, events, rng: dummyRng },
      'Unable to play a card or yield',
    )
  }

  return ok(state, events)
}

export function transitionToWon(
  ctx: Mutable,
  tavern: Card[],
  discard: Card[],
): ApplyResult {
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

export function transitionToLost(ctx: Mutable, reason: string): ApplyResult {
  const lost: GameState = {
    ...ctx.state,
    phase: 'lost',
    defeatReason: reason,
  }
  ctx.events.push({ type: 'GAME_LOST', reason })
  return ok(lost, ctx.events)
}

export function victoryFor(jestersUsed: number): VictoryRank {
  if (jestersUsed <= 0) return 'gold'
  if (jestersUsed === 1) return 'silver'
  return 'bronze'
}

export function ok(state: GameState, events: GameEvent[]): ApplyResult {
  return { ok: true, state, events }
}

export function fail(state: GameState, error: string): ApplyResult {
  return { ok: false, error, state }
}

/** Yield path does not shuffle; placeholder satisfies typing. */
export const dummyRng: Rng = {
  next: () => 0,
  shuffle: <T>(items: readonly T[]) => [...items],
}
