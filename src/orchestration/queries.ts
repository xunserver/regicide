import {
  activeSuits,
  canFlipJester,
  canYield,
  cardValue,
  findCards,
  getDefendDamage,
  sumValues,
  validatePlay,
  damageForPlay,
} from '../core/index.ts'
import type { Card, GameState, Suit } from '../core/index.ts'
import type {
  AvailableCommands,
  DefendPreview,
  EnemyView,
  PlayPreview,
  SessionView,
} from './types.ts'

export type SessionModel = {
  seed: number
  state: GameState
  selection: string[]
  createdAt: number
  updatedAt: number
}

export function buildView(session: SessionModel): SessionView {
  const { state, selection, seed, createdAt, updatedAt } = session
  const selectedCards = selection
    .map((id) => state.hand.find((card) => card.id === id))
    .filter((card): card is Card => card !== undefined)

  const commands = getAvailableCommands(state, selectedCards)
  const playPreview =
    state.phase === 'play' && selectedCards.length > 0
      ? previewPlay(state, selectedCards)
      : null
  const defendPreview =
    state.phase === 'defend' ? previewDefend(state, selectedCards) : null

  return {
    phase: state.phase,
    hand: state.hand,
    playArea: state.playArea,
    discardCount: state.discard.length,
    tavernCount: state.tavern.length,
    castleRemaining: state.castle.length + (state.enemy ? 1 : 0),
    enemiesDefeated: 12 - (state.castle.length + (state.enemy ? 1 : 0)),
    enemy: state.enemy ? toEnemyView(state) : null,
    jestersRemaining: state.jestersRemaining,
    jestersUsed: state.jestersUsed,
    selection: [...selection],
    selectedCards,
    commands,
    playPreview,
    defendPreview,
    victory: state.victory,
    defeatReason: state.defeatReason,
    seed,
    createdAt,
    updatedAt,
  }
}

export function getAvailableCommands(
  state: GameState,
  selectedCards: readonly Card[],
): AvailableCommands {
  const playPreview =
    state.phase === 'play' && selectedCards.length > 0
      ? previewPlay(state, selectedCards)
      : null
  const defendPreview =
    state.phase === 'defend' ? previewDefend(state, selectedCards) : null

  return {
    canToggleCards: state.phase === 'play' || state.phase === 'defend',
    canConfirmPlay: playPreview?.ok === true,
    canConfirmDefend:
      state.phase === 'defend' &&
      defendPreview !== null &&
      (defendPreview.required === 0
        ? selectedCards.length === 0
        : defendPreview.enough),
    canYield: canYield(state),
    canFlipJester: canFlipJester(state),
    canNewGame: true,
  }
}

export function previewPlay(state: GameState, cards: readonly Card[]): PlayPreview {
  if (!state.enemy) {
    return { ok: false, error: 'No enemy' }
  }

  const validation = validatePlay(cards)
  if (!validation.ok) {
    return { ok: false, error: validation.error }
  }

  const immunityActive = true
  const active = activeSuits(
    validation.plan,
    state.enemy.card.suit,
    immunityActive,
  )
  const immuneSuits = validation.plan.suits.filter(
    (suit) => !active.includes(suit),
  )
  const damage = damageForPlay(validation.plan, active)

  return {
    ok: true,
    attackValue: validation.plan.attackValue,
    suits: validation.plan.suits,
    activeSuits: active,
    damage,
    immuneSuits,
  }
}

export function previewDefend(
  state: GameState,
  selectedCards: readonly Card[],
): DefendPreview {
  const required = getDefendDamage(state)
  const selectedValue = sumValues(selectedCards)
  return {
    required,
    selectedValue,
    remaining: Math.max(0, required - selectedValue),
    enough: selectedValue >= required,
  }
}

function toEnemyView(state: GameState): EnemyView {
  const enemy = state.enemy!
  return {
    card: enemy.card,
    health: enemy.health,
    attack: enemy.attack,
    damageDealt: enemy.damageDealt,
    shield: enemy.shield,
    remainingHealth: Math.max(0, enemy.health - enemy.damageDealt),
    incomingDamage: getDefendDamage(state),
  }
}

export function sanitizeSelection(
  state: GameState,
  selection: readonly string[],
): string[] {
  const handIds = new Set(state.hand.map((card) => card.id))
  return selection.filter((id) => handIds.has(id))
}

export function toggleSelection(
  state: GameState,
  selection: readonly string[],
  cardId: string,
): { selection: string[]; error?: string } {
  if (state.phase !== 'play' && state.phase !== 'defend') {
    return { selection: [...selection], error: 'Cannot select cards now' }
  }

  if (!state.hand.some((card) => card.id === cardId)) {
    return { selection: [...selection], error: 'Card is not in hand' }
  }

  if (selection.includes(cardId)) {
    return { selection: selection.filter((id) => id !== cardId) }
  }

  return { selection: [...selection, cardId] }
}

export function selectionCards(
  state: GameState,
  selection: readonly string[],
): Card[] | null {
  return findCards(state.hand, selection)
}

export function selectedValue(cards: readonly Card[]): number {
  return cards.reduce((total, card) => total + cardValue(card), 0)
}

export function suitLabel(suit: Suit): string {
  switch (suit) {
    case 'H':
      return 'Hearts'
    case 'D':
      return 'Diamonds'
    case 'C':
      return 'Clubs'
    case 'S':
      return 'Spades'
  }
}
