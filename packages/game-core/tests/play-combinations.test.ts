import { describe, expect, it } from 'vitest'
import { dispatch, parseGameState } from '../src'
import type { GameCommand, GameEvent, GameState } from '../src'
import { createFixture } from './fixtures'

function assertAccepted(
  initial: GameState,
  command: GameCommand,
  expectedState: GameState,
  expectedEvents: GameEvent[],
): void {
  const original = parseGameState(initial)
  expect(dispatch(initial, command)).toEqual({
    accepted: true,
    state: expectedState,
    events: expectedEvents,
  })
  expect(initial).toEqual(original)
}

describe('complete legal play combinations', () => {
  it('plays an Animal Companion by itself at value one', () => {
    const initial = createFixture({
      players: [
        { id: 'p1', hand: ['clubs-animal-companion', 'clubs-8', 'hearts-6'] },
        { id: 'p2' },
      ],
      currentEnemyId: 'clubs-jack',
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-8', 'hearts-6'] }, { id: 'p2' }],
      currentEnemyId: 'clubs-jack',
      plays: [{ playerId: 'p1', cardIds: ['clubs-animal-companion'] }],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['clubs-animal-companion'] },
      expected,
      [
        {
          type: 'cards-played',
          playerId: 'p1',
          cardIds: ['clubs-animal-companion'],
          attackValue: 1,
        },
        { type: 'enemy-damaged', enemyId: 'clubs-jack', amount: 1, totalDamage: 1 },
        { type: 'counterattack-required', playerId: 'p1', amount: 10 },
      ],
    )
  })

  it('pairs an Animal Companion with a recovered Royal', () => {
    const initial = createFixture({
      players: [
        { id: 'p1', hand: ['hearts-animal-companion', 'clubs-jack', 'spades-king'] },
        { id: 'p2' },
      ],
      currentEnemyId: 'diamonds-queen',
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['spades-king'] }, { id: 'p2' }],
      currentEnemyId: 'diamonds-queen',
      plays: [{ playerId: 'p1', cardIds: ['hearts-animal-companion', 'clubs-jack'] }],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(
      initial,
      {
        type: 'play-cards',
        actorId: 'p1',
        cardIds: ['hearts-animal-companion', 'clubs-jack'],
      },
      expected,
      [
        {
          type: 'cards-played',
          playerId: 'p1',
          cardIds: ['hearts-animal-companion', 'clubs-jack'],
          attackValue: 11,
        },
        { type: 'hearts-resolved', cardIds: [] },
        { type: 'enemy-damaged', enemyId: 'diamonds-queen', amount: 22, totalDamage: 22 },
        { type: 'counterattack-required', playerId: 'p1', amount: 15 },
      ],
    )
  })

  it('plays two fives totaling exactly ten', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-5', 'clubs-5', 'spades-king'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-queen',
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['spades-king'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-queen',
      plays: [{ playerId: 'p1', cardIds: ['hearts-5', 'clubs-5'] }],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['hearts-5', 'clubs-5'] },
      expected,
      [
        { type: 'cards-played', playerId: 'p1', cardIds: ['hearts-5', 'clubs-5'], attackValue: 10 },
        { type: 'enemy-damaged', enemyId: 'hearts-queen', amount: 20, totalDamage: 20 },
        { type: 'counterattack-required', playerId: 'p1', amount: 15 },
      ],
    )
  })

  it('plays three threes and resolves every represented suit', () => {
    const initial = createFixture({
      players: [
        { id: 'p1', hand: ['hearts-3', 'diamonds-3', 'spades-3', 'clubs-8'] },
        { id: 'p2' },
      ],
      currentEnemyId: 'clubs-queen',
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-8'] }, { id: 'p2' }],
      currentEnemyId: 'clubs-queen',
      plays: [{ playerId: 'p1', cardIds: ['hearts-3', 'diamonds-3', 'spades-3'] }],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(
      initial,
      {
        type: 'play-cards',
        actorId: 'p1',
        cardIds: ['hearts-3', 'diamonds-3', 'spades-3'],
      },
      expected,
      [
        {
          type: 'cards-played',
          playerId: 'p1',
          cardIds: ['hearts-3', 'diamonds-3', 'spades-3'],
          attackValue: 9,
        },
        { type: 'hearts-resolved', cardIds: [] },
        { type: 'diamonds-resolved', draws: [] },
        { type: 'enemy-damaged', enemyId: 'clubs-queen', amount: 9, totalDamage: 9 },
        { type: 'counterattack-required', playerId: 'p1', amount: 6 },
      ],
    )
  })

  it('plays all four twos and combines the active suit effects', () => {
    const initial = createFixture({
      players: [
        {
          id: 'p1',
          hand: ['hearts-2', 'diamonds-2', 'clubs-2', 'spades-2', 'clubs-king'],
        },
        { id: 'p2' },
      ],
      currentEnemyId: 'hearts-king',
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-king'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-king',
      plays: [{ playerId: 'p1', cardIds: ['hearts-2', 'diamonds-2', 'clubs-2', 'spades-2'] }],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(
      initial,
      {
        type: 'play-cards',
        actorId: 'p1',
        cardIds: ['hearts-2', 'diamonds-2', 'clubs-2', 'spades-2'],
      },
      expected,
      [
        {
          type: 'cards-played',
          playerId: 'p1',
          cardIds: ['hearts-2', 'diamonds-2', 'clubs-2', 'spades-2'],
          attackValue: 8,
        },
        { type: 'diamonds-resolved', draws: [] },
        { type: 'enemy-damaged', enemyId: 'hearts-king', amount: 16, totalDamage: 16 },
        { type: 'counterattack-required', playerId: 'p1', amount: 12 },
      ],
    )
  })
})

describe('Solo Jester boundaries', () => {
  it('replaces the hand with an empty hand when Tavern is empty', () => {
    const initial = createFixture({ players: [{ id: 'p1', hand: ['hearts-2'] }] })
    const expected = createFixture({
      players: [{ id: 'p1' }],
      discardPile: ['hearts-2'],
      soloJestersAvailable: ['jester-2'],
      soloJestersUsed: ['jester-1'],
    })
    assertAccepted(
      initial,
      { type: 'use-solo-jester', actorId: 'p1', cardId: 'jester-1' },
      expected,
      [
        {
          type: 'solo-jester-used',
          playerId: 'p1',
          cardId: 'jester-1',
          discardedCardIds: ['hearts-2'],
          drawnCardIds: [],
        },
      ],
    )
  })

  it('draws only to the solo hand limit and leaves the rest in Tavern', () => {
    const tavernDeck = [
      'hearts-3',
      'hearts-4',
      'hearts-5',
      'hearts-6',
      'hearts-7',
      'hearts-8',
      'hearts-9',
      'hearts-10',
      'clubs-3',
      'clubs-4',
    ]
    const drawn = tavernDeck.slice(0, 8)
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2'] }],
      tavernDeck,
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: drawn }],
      tavernDeck: ['clubs-3', 'clubs-4'],
      discardPile: ['hearts-2'],
      soloJestersAvailable: ['jester-2'],
      soloJestersUsed: ['jester-1'],
    })
    assertAccepted(
      initial,
      { type: 'use-solo-jester', actorId: 'p1', cardId: 'jester-1' },
      expected,
      [
        {
          type: 'solo-jester-used',
          playerId: 'p1',
          cardId: 'jester-1',
          discardedCardIds: ['hearts-2'],
          drawnCardIds: drawn,
        },
      ],
    )
  })

  it('loses when the final Solo Jester leaves no legal action', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2'], yieldedLastTurn: true }],
      soloJestersAvailable: ['jester-2'],
      soloJestersUsed: ['jester-1'],
    })
    const expected = createFixture({
      players: [{ id: 'p1', yieldedLastTurn: true }],
      discardPile: ['hearts-2'],
      soloJestersAvailable: [],
      soloJestersUsed: ['jester-1', 'jester-2'],
      status: 'lost',
      outcome: { type: 'lost', reason: 'cannot-play-or-yield', playerId: 'p1' },
    })
    assertAccepted(
      initial,
      { type: 'use-solo-jester', actorId: 'p1', cardId: 'jester-2' },
      expected,
      [
        {
          type: 'solo-jester-used',
          playerId: 'p1',
          cardId: 'jester-2',
          discardedCardIds: ['hearts-2'],
          drawnCardIds: [],
        },
        { type: 'game-lost', reason: 'cannot-play-or-yield', playerId: 'p1' },
      ],
    )
  })
})
