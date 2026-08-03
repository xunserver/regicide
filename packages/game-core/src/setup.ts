import { JESTER_IDS, ROYAL_RANKS, getCardsByRank, getTavernCardIds } from './cards'
import { createRandomState, shuffle } from './random'
import type { CardId, CreateGameConfig, GameState, PlayerState } from './types'

export function createGame(config: CreateGameConfig): GameState {
  if (config.playerIds.length < 1 || config.playerIds.length > 4) {
    throw new RangeError('Regicide requires between 1 and 4 players')
  }
  if (
    config.playerIds.some((playerId) => playerId.length === 0) ||
    new Set(config.playerIds).size !== config.playerIds.length
  ) {
    throw new RangeError('Player ids must be non-empty and unique')
  }
  if (!config.playerIds.includes(config.startingPlayerId)) {
    throw new RangeError('Starting player must be in playerIds')
  }

  // Shuffle each Royal rank separately so Castle order always remains Jacks, Queens, then Kings.
  let random = createRandomState(config.seed)
  const castleDeck: CardId[] = []
  for (const rank of ROYAL_RANKS) {
    const [royals, nextRandom] = shuffle(getCardsByRank(rank), random)
    castleDeck.push(...royals)
    random = nextRandom
  }

  // Jesters belong to different zones depending on player count under the official setup rules.
  const tavernJesters =
    config.playerIds.length === 3
      ? [JESTER_IDS[0]!]
      : config.playerIds.length === 4
        ? [...JESTER_IDS]
        : []
  const [tavernDeck, nextRandom] = shuffle([...getTavernCardIds(), ...tavernJesters], random)
  random = nextRandom

  const maxHandSize = [0, 8, 7, 6, 5][config.playerIds.length]!
  const players: PlayerState[] = config.playerIds.map((id) => ({
    id,
    hand: [],
    maxHandSize,
    yieldedLastTurn: false,
  }))

  // Deal one card at a time clockwise, beginning with the configured starting player.
  const firstIndex = players.findIndex((player) => player.id === config.startingPlayerId)
  let dealIndex = firstIndex
  while (tavernDeck.length > 0 && players.some((player) => player.hand.length < maxHandSize)) {
    const player = players[dealIndex]!
    if (player.hand.length < maxHandSize) player.hand.push(tavernDeck.shift()!)
    dealIndex = (dealIndex + 1) % players.length
  }

  const [enemyId, ...remainingCastle] = castleDeck
  const soloJesters = config.playerIds.length === 1 ? [...JESTER_IDS] : []
  const excludedCards = JESTER_IDS.filter(
    (cardId) => !tavernJesters.includes(cardId) && !soloJesters.includes(cardId),
  )

  return {
    schemaVersion: 1,
    status: 'in-progress',
    outcome: null,
    pendingDecision: 'play-or-yield',
    players,
    currentPlayerId: config.startingPlayerId,
    castleDeck: remainingCastle,
    currentEnemy: { cardId: enemyId!, plays: [] },
    tavernDeck,
    discardPile: [],
    soloJesters: { available: soloJesters, used: [] },
    excludedCards,
    random,
  }
}
