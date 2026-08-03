import { getCard, getCardValue, getEnemyStats, isRoyalCard } from './cards'
import type { CardId, CurrentEnemy, GameState, PlayRecord, Suit } from './types'

export function assertCurrentEnemy(state: GameState): CurrentEnemy {
  if (!state.currentEnemy) throw new Error('In-progress game has no current enemy')
  return state.currentEnemy
}

function currentEnemyCard(state: GameState) {
  const card = getCard(assertCurrentEnemy(state).cardId)
  if (!isRoyalCard(card)) throw new Error('Current enemy is not a Royal Card')
  return card
}

export function getAttackValue(cardIds: readonly CardId[]): number {
  return cardIds.reduce((total, cardId) => total + getCardValue(cardId), 0)
}

export function getDistinctSuits(cardIds: readonly CardId[]): Suit[] {
  const suits = new Set<Suit>()
  for (const cardId of cardIds) {
    const card = getCard(cardId)
    if (card.kind === 'suited') suits.add(card.suit)
  }
  return [...suits]
}

function includesSuit(play: PlayRecord, suit: Suit): boolean {
  return play.cardIds.some((cardId) => {
    const card = getCard(cardId)
    return card.kind === 'suited' && card.suit === suit
  })
}

function isJesterPlay(play: PlayRecord): boolean {
  return play.cardIds.length === 1 && getCard(play.cardIds[0]!).kind === 'jester'
}

export function isEnemyImmunityCancelled(state: GameState): boolean {
  return assertCurrentEnemy(state).plays.some(isJesterPlay)
}

export function getEnemyDamage(state: GameState): number {
  const enemy = assertCurrentEnemy(state)
  const enemySuit = currentEnemyCard(state).suit
  let immunityCancelled = false
  let total = 0

  // Damage is replayed in order because a Jester changes how all following plays resolve.
  for (const play of enemy.plays) {
    if (isJesterPlay(play)) {
      immunityCancelled = true
      continue
    }

    const attackValue = getAttackValue(play.cardIds)
    const clubsActive = includesSuit(play, 'clubs') && (enemySuit !== 'clubs' || immunityCancelled)
    total += clubsActive ? attackValue * 2 : attackValue
  }

  return total
}

export function getEnemyShield(state: GameState): number {
  const enemy = assertCurrentEnemy(state)
  const enemySuit = currentEnemyCard(state).suit
  if (enemySuit === 'spades' && !isEnemyImmunityCancelled(state)) return 0

  return enemy.plays.reduce(
    (total, play) => total + (includesSuit(play, 'spades') ? getAttackValue(play.cardIds) : 0),
    0,
  )
}

export function getCurrentEnemyStats(state: GameState): {
  readonly attack: number
  readonly health: number
  readonly damage: number
  readonly shield: number
  readonly healthRemaining: number
} | null {
  if (!state.currentEnemy) return null
  const card = currentEnemyCard(state)
  const stats = getEnemyStats(card.rank)
  const damage = getEnemyDamage(state)
  const shield = getEnemyShield(state)
  return {
    ...stats,
    damage,
    shield,
    healthRemaining: Math.max(0, stats.health - damage),
  }
}

export function getCounterattackDamage(state: GameState): number {
  const stats = getCurrentEnemyStats(state)
  if (!stats) return 0
  return Math.max(0, stats.attack - stats.shield)
}
