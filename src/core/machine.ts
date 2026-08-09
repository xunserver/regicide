import { HAND_LIMIT_SOLO } from './constants.ts'
import {
  handleDefend,
  handleFlipJester,
  handlePlay,
  handleYield,
} from './handlers.ts'
import { defendDamageNeeded } from './play.ts'
import { fail } from './transitions.ts'
import type {
  Action,
  ApplyResult,
  Card,
  GameState,
  Phase,
  Rng,
} from './types.ts'

/**
 * Solo Regicide — explicit finite state machine.
 *
 * 完整说明与 Mermaid 图见仓库根目录 README「Core 状态机」。
 *
 * States (`phase`): play | defend | won | lost
 *
 *                   PLAY (敌死 · 城堡空)
 *              ┌──────────────────────────────────► won
 *              │
 *              │ PLAY (敌死 · 还有下一敌)
 *              │ PLAY / YIELD (伤害被盾减到 0)
 *              │ DEFEND
 *  ┌──────┐    │         ┌────────┐
 *  │ play │◄───┴─────────│ defend │
 *  └──┬───┘              └───┬────┘
 *     │                      │
 *     │ PLAY / YIELD         │ FLIP_JESTER 后仍挡不住
 *     │ (敌存活且需挡伤)      │ 或无法行动
 *     └──────────────────────┘
 *              │
 *              ▼
 *             lost
 *
 * 合法动作见下方 PHASE_ACTIONS；守卫在本文件，规则在 handlers，换 phase 在 transitions。
 */
export const PHASE_ACTIONS: Record<Phase, readonly Action['type'][]> = {
  play: ['PLAY', 'YIELD', 'FLIP_JESTER'],
  defend: ['DEFEND', 'FLIP_JESTER'],
  won: [],
  lost: [],
}

type PhaseHandler = (
  state: GameState,
  action: Action,
  rng: Rng,
) => ApplyResult

const phaseHandlers: Record<Phase, PhaseHandler> = {
  play: dispatchPlay,
  defend: dispatchDefend,
  won: rejectTerminal,
  lost: rejectTerminal,
}

export function applyAction(state: GameState, action: Action, rng: Rng): ApplyResult {
  if (!isActionAllowed(state.phase, action.type)) {
    return rejectIllegal(state, action)
  }
  return phaseHandlers[state.phase](state, action, rng)
}

export function isActionAllowed(phase: Phase, type: Action['type']): boolean {
  return (PHASE_ACTIONS[phase] as readonly Action['type'][]).includes(type)
}

function dispatchPlay(state: GameState, action: Action, rng: Rng): ApplyResult {
  switch (action.type) {
    case 'PLAY':
      return handlePlay(state, action.cardIds, rng)
    case 'YIELD':
      return handleYield(state)
    case 'FLIP_JESTER':
      return handleFlipJester(state, rng)
    default:
      return fail(state, `Action ${action.type} is not valid in play phase`)
  }
}

function dispatchDefend(state: GameState, action: Action, rng: Rng): ApplyResult {
  switch (action.type) {
    case 'DEFEND':
      return handleDefend(state, action.cardIds)
    case 'FLIP_JESTER':
      return handleFlipJester(state, rng)
    default:
      return fail(state, `Action ${action.type} is not valid in defend phase`)
  }
}

function rejectTerminal(state: GameState, _action: Action, _rng: Rng): ApplyResult {
  return fail(state, 'Game is already over')
}

function rejectIllegal(state: GameState, action: Action): ApplyResult {
  if (state.phase === 'won' || state.phase === 'lost') {
    return fail(state, 'Game is already over')
  }
  if (action.type === 'PLAY' || action.type === 'YIELD') {
    return fail(state, 'Not in play phase')
  }
  if (action.type === 'DEFEND') {
    return fail(state, 'Not in defend phase')
  }
  if (action.type === 'FLIP_JESTER') {
    return fail(state, 'Cannot flip a Jester now')
  }
  return fail(state, `Unknown action: ${JSON.stringify(action)}`)
}

export function getDefendDamage(state: GameState): number {
  if (!state.enemy) return 0
  return defendDamageNeeded(state.enemy.attack, state.enemy.shield)
}

export function canFlipJester(state: GameState): boolean {
  return isActionAllowed(state.phase, 'FLIP_JESTER') && state.jestersRemaining > 0
}

export function canYield(state: GameState): boolean {
  return isActionAllowed(state.phase, 'YIELD') && !state.lastTurnYielded
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
