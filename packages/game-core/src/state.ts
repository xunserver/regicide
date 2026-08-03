import { CARD_IDS, getCard, isCardId, isRoyalCard } from './cards'
import type { GameOutcome, GameState, PendingDecision, PlayerState } from './types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fail(message: string): never {
  throw new TypeError(`Invalid GameState: ${message}`)
}

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string') fail(`${field} must be a string`)
}

function assertCardIds(value: unknown, field: string): asserts value is string[] {
  if (!Array.isArray(value) || !value.every(isCardId)) fail(`${field} contains an unknown card`)
}

function assertPlayer(value: unknown, expectedMaxHandSize: number): asserts value is PlayerState {
  if (!isRecord(value)) fail('player must be an object')
  assertString(value.id, 'player.id')
  if (value.id.length === 0) fail('player.id must be non-empty')
  assertCardIds(value.hand, `player ${value.id} hand`)
  if (value.maxHandSize !== expectedMaxHandSize) fail(`player ${value.id} has wrong hand limit`)
  if (value.hand.length > expectedMaxHandSize) fail(`player ${value.id} exceeds hand limit`)
  if (typeof value.yieldedLastTurn !== 'boolean') fail('yieldedLastTurn must be boolean')
}

function assertOutcome(value: unknown, status: GameState['status'], playerIds: string[]): void {
  if (status === 'in-progress') {
    if (value !== null) fail('in-progress game cannot have an outcome')
    return
  }
  const expectedType = status === 'won' ? 'won' : 'lost'
  if (!isRecord(value) || value.type !== expectedType) fail('terminal outcome is missing')

  const outcome = value as unknown as GameOutcome
  if (outcome.type === 'won') {
    if (outcome.rating && !['gold', 'silver', 'bronze'].includes(outcome.rating)) {
      fail('unknown victory rating')
    }
    if (playerIds.length === 1 && !outcome.rating) fail('solo victory requires a rating')
    if (playerIds.length > 1 && outcome.rating) fail('multiplayer victory cannot have a rating')
    return
  }

  if (!['cannot-suffer-damage', 'cannot-play-or-yield'].includes(outcome.reason)) {
    fail('unknown loss reason')
  }
  if (!playerIds.includes(outcome.playerId)) fail('loss references an unknown player')
}

function assertPendingDecision(value: unknown, status: GameState['status']): void {
  const decisions: PendingDecision[] = ['play-or-yield', 'discard-for-damage', 'choose-next-player']
  if (status === 'in-progress' && !decisions.includes(value as PendingDecision)) {
    fail('in-progress game requires a pending decision')
  }
  if (status !== 'in-progress' && value !== null)
    fail('terminal game cannot have a pending decision')
}

function collectAndValidateCards(state: GameState): void {
  const locations: string[] = []
  for (const player of state.players) locations.push(...player.hand)
  locations.push(...state.castleDeck)
  if (state.currentEnemy) {
    locations.push(state.currentEnemy.cardId)
    for (const play of state.currentEnemy.plays) locations.push(...play.cardIds)
  }
  locations.push(...state.tavernDeck)
  locations.push(...state.discardPile)
  locations.push(...state.soloJesters.available)
  locations.push(...state.soloJesters.used)
  locations.push(...state.excludedCards)

  if (locations.length !== CARD_IDS.length || new Set(locations).size !== CARD_IDS.length) {
    fail('every card must appear in exactly one zone')
  }
  if (!CARD_IDS.every((cardId) => locations.includes(cardId))) fail('a card is missing')

  if (!state.castleDeck.every((cardId) => isRoyalCard(getCard(cardId)))) {
    fail('Castle contains a non-Royal Card')
  }
  if (state.currentEnemy && !isRoyalCard(getCard(state.currentEnemy.cardId))) {
    fail('Current Enemy is not a Royal Card')
  }
  const soloJesterIds = [...state.soloJesters.available, ...state.soloJesters.used]
  if (soloJesterIds.some((cardId) => getCard(cardId).kind !== 'jester')) {
    fail('solo Jester zone contains a suited card')
  }
}

function assertGameState(value: unknown): asserts value is GameState {
  if (!isRecord(value)) fail('state must be an object')
  if (value.schemaVersion !== 1) fail('unsupported schemaVersion')
  if (!['in-progress', 'won', 'lost'].includes(value.status as string)) fail('unknown status')
  const status = value.status as GameState['status']
  assertPendingDecision(value.pendingDecision, status)

  if (!Array.isArray(value.players) || value.players.length < 1 || value.players.length > 4) {
    fail('players must contain 1 to 4 entries')
  }
  const expectedMaxHandSize = [0, 8, 7, 6, 5][value.players.length]!
  const playerIds = value.players.map((player) => {
    assertPlayer(player, expectedMaxHandSize)
    return player.id
  })
  if (new Set(playerIds).size !== playerIds.length) fail('player ids must be unique')

  assertString(value.currentPlayerId, 'currentPlayerId')
  if (!playerIds.includes(value.currentPlayerId)) fail('currentPlayerId is unknown')
  assertOutcome(value.outcome, status, playerIds)
  assertCardIds(value.castleDeck, 'castleDeck')
  assertCardIds(value.tavernDeck, 'tavernDeck')
  assertCardIds(value.discardPile, 'discardPile')
  assertCardIds(value.excludedCards, 'excludedCards')

  if (value.currentEnemy !== null) {
    if (!isRecord(value.currentEnemy)) fail('currentEnemy must be an object')
    if (!isCardId(value.currentEnemy.cardId)) fail('currentEnemy has an unknown card')
    if (!Array.isArray(value.currentEnemy.plays)) fail('currentEnemy.plays must be an array')
    for (const play of value.currentEnemy.plays) {
      if (!isRecord(play)) fail('play must be an object')
      assertString(play.playerId, 'play.playerId')
      if (!playerIds.includes(play.playerId)) fail('play references an unknown player')
      assertCardIds(play.cardIds, 'play.cardIds')
      if (play.cardIds.length === 0) fail('play cannot be empty')
    }
  } else if (status !== 'won') {
    fail('only a won game may omit the Current Enemy')
  }

  if (!isRecord(value.soloJesters)) fail('soloJesters must be an object')
  assertCardIds(value.soloJesters.available, 'soloJesters.available')
  assertCardIds(value.soloJesters.used, 'soloJesters.used')
  if (value.players.length === 1) {
    if (value.soloJesters.available.length + value.soloJesters.used.length !== 2) {
      fail('solo game must account for two solo Jesters')
    }
  } else if (value.soloJesters.available.length + value.soloJesters.used.length !== 0) {
    fail('multiplayer game cannot have solo Jesters')
  }

  if (!isRecord(value.random) || value.random.algorithm !== 'xorshift32') {
    fail('unknown random algorithm')
  }
  if (
    !Number.isInteger(value.random.state) ||
    (value.random.state as number) <= 0 ||
    (value.random.state as number) > 0xffff_ffff
  ) {
    fail('random state must be a non-zero uint32')
  }

  collectAndValidateCards(value as unknown as GameState)
}

export function parseGameState(input: unknown): GameState {
  assertGameState(input)
  return JSON.parse(JSON.stringify(input)) as GameState
}
