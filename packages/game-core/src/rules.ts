import { starterHand } from './cards'
import type { Card, GameState } from './types'

export function createInitialGame(): GameState {
  return {
    phase: 'player-turn',
    turn: 1,
    enemy: {
      name: '黑曜守卫',
      health: 24,
      maxHealth: 24,
    },
    hand: starterHand.map((card) => ({ ...card })),
    discard: [],
    log: ['战斗开始。选择一张或多张牌，发动攻击。'],
  }
}

export function calculatePower(cards: Card[]): number {
  return cards.reduce((total, card) => total + card.power, 0)
}

export function playCards(state: GameState, cardIds: string[]): GameState {
  if (state.phase !== 'player-turn' || cardIds.length === 0) {
    return state
  }

  const selected = new Set(cardIds)
  const playedCards = state.hand.filter((card) => selected.has(card.id))
  if (playedCards.length === 0) {
    return state
  }

  const damage = calculatePower(playedCards)
  const nextHealth = Math.max(0, state.enemy.health - damage)
  const isVictory = nextHealth === 0

  return {
    ...state,
    phase: isVictory ? 'victory' : 'player-turn',
    turn: isVictory ? state.turn : state.turn + 1,
    enemy: { ...state.enemy, health: nextHealth },
    hand: state.hand.filter((card) => !selected.has(card.id)),
    discard: [...state.discard, ...playedCards],
    log: [
      `${playedCards.map((card) => card.name).join('、')}造成 ${damage} 点伤害。`,
      ...(isVictory ? ['黑曜守卫倒下了，你赢得了胜利！'] : []),
      ...state.log,
    ].slice(0, 5),
  }
}
