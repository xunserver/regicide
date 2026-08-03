import { CARD_IDS, JESTER_IDS, parseGameState } from '../src'
import type { CardId, GameOutcome, GameState, PendingDecision, PlayRecord, PlayerId } from '../src'

interface FixturePlayer {
  readonly id: PlayerId
  readonly hand?: CardId[]
  readonly yieldedLastTurn?: boolean
}

interface FixtureOptions {
  readonly players?: FixturePlayer[]
  readonly currentPlayerId?: PlayerId
  readonly currentEnemyId?: CardId
  readonly plays?: PlayRecord[]
  readonly castleDeck?: CardId[]
  readonly tavernDeck?: CardId[]
  readonly discardPile?: CardId[]
  readonly pendingDecision?: PendingDecision
  readonly soloJestersAvailable?: CardId[]
  readonly soloJestersUsed?: CardId[]
  readonly status?: GameState['status']
  readonly outcome?: GameOutcome | null
}

export function createFixture(options: FixtureOptions = {}): GameState {
  const players = options.players ?? [{ id: 'p1', hand: ['hearts-2'] }, { id: 'p2' }]
  const maxHandSize = [0, 8, 7, 6, 5][players.length]!
  const status = options.status ?? 'in-progress'
  const currentEnemyId = options.currentEnemyId ?? 'spades-jack'
  const plays = options.plays ?? []
  const castleDeck = options.castleDeck ?? []
  const tavernDeck = options.tavernDeck ?? []
  const discardPile = options.discardPile ?? []
  const soloAvailable =
    options.soloJestersAvailable ?? (players.length === 1 ? [...JESTER_IDS] : [])
  const soloUsed = options.soloJestersUsed ?? []
  const occupied = new Set([
    ...players.flatMap((player) => player.hand ?? []),
    ...(status === 'won' ? [] : [currentEnemyId]),
    ...plays.flatMap((play) => play.cardIds),
    ...castleDeck,
    ...tavernDeck,
    ...discardPile,
    ...soloAvailable,
    ...soloUsed,
  ])

  const state: GameState = {
    schemaVersion: 1,
    status,
    outcome: options.outcome ?? null,
    pendingDecision: status === 'in-progress' ? (options.pendingDecision ?? 'play-or-yield') : null,
    players: players.map((player) => ({
      id: player.id,
      hand: [...(player.hand ?? [])],
      maxHandSize,
      yieldedLastTurn: player.yieldedLastTurn ?? false,
    })),
    currentPlayerId: options.currentPlayerId ?? players[0]!.id,
    castleDeck: [...castleDeck],
    currentEnemy:
      status === 'won'
        ? null
        : { cardId: currentEnemyId, plays: plays.map((play) => ({ ...play })) },
    tavernDeck: [...tavernDeck],
    discardPile: [...discardPile],
    soloJesters: { available: soloAvailable, used: soloUsed },
    excludedCards: CARD_IDS.filter((cardId) => !occupied.has(cardId)),
    random: { algorithm: 'xorshift32', state: 123_456_789 },
  }

  return parseGameState(state)
}
