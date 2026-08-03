import { describe, expect, it } from 'vitest'
import { CARD_IDS, createGame, getCard, isRoyalCard, parseGameState } from '../src'

function allLocatedCards(game: ReturnType<typeof createGame>): string[] {
  return [
    ...game.players.flatMap((player) => player.hand),
    ...game.castleDeck,
    game.currentEnemy!.cardId,
    ...game.tavernDeck,
    ...game.discardPile,
    ...game.soloJesters.available,
    ...game.soloJesters.used,
    ...game.excludedCards,
  ]
}

describe('game setup', () => {
  it.each([
    { count: 1, handSize: 8, tavernJesters: 0, soloJesters: 2, excluded: 0 },
    { count: 2, handSize: 7, tavernJesters: 0, soloJesters: 0, excluded: 2 },
    { count: 3, handSize: 6, tavernJesters: 1, soloJesters: 0, excluded: 1 },
    { count: 4, handSize: 5, tavernJesters: 2, soloJesters: 0, excluded: 0 },
  ])('creates the official $count-player deck configuration', (scenario) => {
    const playerIds = Array.from({ length: scenario.count }, (_, index) => `p${index + 1}`)
    const game = createGame({ playerIds, startingPlayerId: playerIds[0]!, seed: 'setup' })

    expect(game.players.every((player) => player.hand.length === scenario.handSize)).toBe(true)
    expect(game.soloJesters.available).toHaveLength(scenario.soloJesters)
    expect(game.excludedCards).toHaveLength(scenario.excluded)
    const tavernSystemCards = [...game.players.flatMap((player) => player.hand), ...game.tavernDeck]
    expect(tavernSystemCards.filter((cardId) => getCard(cardId).kind === 'jester')).toHaveLength(
      scenario.tavernJesters,
    )
    expect(allLocatedCards(game)).toHaveLength(CARD_IDS.length)
    expect(new Set(allLocatedCards(game)).size).toBe(CARD_IDS.length)
  })

  it('builds the Castle in Jack, Queen, King order', () => {
    const game = createGame({ playerIds: ['p1'], startingPlayerId: 'p1', seed: 'castle' })
    const ranks = [game.currentEnemy!.cardId, ...game.castleDeck].map((cardId) => {
      const card = getCard(cardId)
      expect(isRoyalCard(card)).toBe(true)
      return card.kind === 'suited' ? card.rank : 'invalid'
    })

    expect(ranks).toEqual([
      'jack',
      'jack',
      'jack',
      'jack',
      'queen',
      'queen',
      'queen',
      'queen',
      'king',
      'king',
      'king',
      'king',
    ])
  })

  it('reproduces a game from the same seed', () => {
    const config = { playerIds: ['p1', 'p2'], startingPlayerId: 'p2', seed: 'repeatable' }
    expect(createGame(config)).toEqual(createGame(config))
    expect(createGame({ ...config, seed: 'different' })).not.toEqual(createGame(config))
  })

  it('deals clockwise starting with the chosen first player', () => {
    const firstP1 = createGame({
      playerIds: ['p1', 'p2'],
      startingPlayerId: 'p1',
      seed: 'deal-order',
    })
    const firstP2 = createGame({
      playerIds: ['p1', 'p2'],
      startingPlayerId: 'p2',
      seed: 'deal-order',
    })

    expect(firstP1.players[0]!.hand).toEqual(firstP2.players[1]!.hand)
    expect(firstP1.players[1]!.hand).toEqual(firstP2.players[0]!.hand)
  })

  it('validates configuration and restored snapshots', () => {
    expect(() => createGame({ playerIds: ['p1', 'p1'], startingPlayerId: 'p1', seed: 1 })).toThrow(
      'unique',
    )
    const game = createGame({ playerIds: ['p1'], startingPlayerId: 'p1', seed: 1 })
    expect(parseGameState(game)).toEqual(game)

    const damaged = JSON.parse(JSON.stringify(game)) as typeof game
    damaged.tavernDeck.push(damaged.players[0]!.hand[0]!)
    expect(() => parseGameState(damaged)).toThrow('exactly one zone')
  })

  it.each([
    {
      name: 'zero players',
      config: { playerIds: [], startingPlayerId: 'p1', seed: 1 },
      message: 'between 1 and 4 players',
    },
    {
      name: 'five players',
      config: {
        playerIds: ['p1', 'p2', 'p3', 'p4', 'p5'],
        startingPlayerId: 'p1',
        seed: 1,
      },
      message: 'between 1 and 4 players',
    },
    {
      name: 'an empty player id',
      config: { playerIds: ['p1', ''], startingPlayerId: 'p1', seed: 1 },
      message: 'non-empty and unique',
    },
    {
      name: 'duplicate player ids',
      config: { playerIds: ['p1', 'p1'], startingPlayerId: 'p1', seed: 1 },
      message: 'non-empty and unique',
    },
    {
      name: 'a starting player outside the game',
      config: { playerIds: ['p1', 'p2'], startingPlayerId: 'p3', seed: 1 },
      message: 'Starting player must be in playerIds',
    },
  ])('rejects $name', ({ config, message }) => {
    expect(() => createGame(config)).toThrow(message)
  })
})
