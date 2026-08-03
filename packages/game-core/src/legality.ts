import { getCard } from './cards'
import { getAttackValue, getCounterattackDamage } from './queries'
import type { CardId, GameCommand, GameState, PlayerId } from './types'

export function isLegalPlay(cardIds: readonly CardId[]): boolean {
  if (cardIds.length === 0 || new Set(cardIds).size !== cardIds.length) return false

  const cards = cardIds.map(getCard)
  if (cards.length === 1) return true
  if (cards.some((card) => card.kind === 'jester')) return false

  if (cards.length === 2 && cards.some((card) => card.rank === 'animal-companion')) {
    return true
  }

  if (cards.length < 2 || cards.length > 4) return false
  if (cards.some((card) => typeof card.rank !== 'number')) return false
  const rank = cards[0]!.rank
  return cards.every((card) => card.rank === rank) && getAttackValue(cardIds) <= 10
}

function combinations<T>(items: readonly T[], maxSize: number): T[][] {
  const result: T[][] = []

  function visit(start: number, selected: T[]): void {
    if (selected.length > 0) result.push([...selected])
    if (selected.length === maxSize) return
    for (let index = start; index < items.length; index += 1) {
      selected.push(items[index]!)
      visit(index + 1, selected)
      selected.pop()
    }
  }

  visit(0, [])
  return result
}

function canYield(state: GameState): boolean {
  if (state.players.length === 1) return !state.players[0]!.yieldedLastTurn
  return !state.players
    .filter((player) => player.id !== state.currentPlayerId)
    .every((player) => player.yieldedLastTurn)
}

function legalPlayCommands(state: GameState, actorId: PlayerId): GameCommand[] {
  const player = state.players.find((candidate) => candidate.id === actorId)
  if (!player) return []
  const commands: GameCommand[] = combinations(player.hand, 4)
    .filter(isLegalPlay)
    .map((cardIds) => ({ type: 'play-cards', actorId, cardIds }))

  if (canYield(state)) commands.push({ type: 'yield', actorId })
  for (const cardId of state.soloJesters.available) {
    commands.push({ type: 'use-solo-jester', actorId, cardId })
  }
  return commands
}

function legalDiscardCommands(state: GameState, actorId: PlayerId): GameCommand[] {
  const player = state.players.find((candidate) => candidate.id === actorId)
  if (!player) return []
  const required = getCounterattackDamage(state)
  const commands: GameCommand[] = combinations(player.hand, player.hand.length)
    .filter((cardIds) => getAttackValue(cardIds) >= required)
    .map((cardIds) => ({ type: 'discard-for-damage', actorId, cardIds }))

  for (const cardId of state.soloJesters.available) {
    commands.push({ type: 'use-solo-jester', actorId, cardId })
  }
  return commands
}

export function getLegalCommands(state: GameState, actorId: PlayerId): GameCommand[] {
  if (
    state.status !== 'in-progress' ||
    state.currentPlayerId !== actorId ||
    !state.pendingDecision
  ) {
    return []
  }

  // The pending decision is the state-machine gate: commands from other phases are never offered.
  switch (state.pendingDecision) {
    case 'play-or-yield':
      return legalPlayCommands(state, actorId)
    case 'discard-for-damage':
      return legalDiscardCommands(state, actorId)
    case 'choose-next-player':
      return state.players.map((player) => ({
        type: 'choose-next-player',
        actorId,
        playerId: player.id,
      }))
  }
}
