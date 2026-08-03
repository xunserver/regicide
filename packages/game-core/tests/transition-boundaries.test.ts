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

function assertRejected(initial: GameState, command: GameCommand, reason: string): void {
  expect(dispatch(initial, command)).toEqual({
    accepted: false,
    state: initial,
    events: [],
    reason,
  })
}

describe('suit effects and immunity', () => {
  it('suppresses Hearts against a Hearts enemy', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2', 'clubs-8', 'spades-5'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-jack',
      discardPile: ['clubs-4'],
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-8', 'spades-5'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-jack',
      plays: [{ playerId: 'p1', cardIds: ['hearts-2'] }],
      discardPile: ['clubs-4'],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['hearts-2'] },
      expected,
      [
        { type: 'cards-played', playerId: 'p1', cardIds: ['hearts-2'], attackValue: 2 },
        { type: 'enemy-damaged', enemyId: 'hearts-jack', amount: 2, totalDamage: 2 },
        { type: 'counterattack-required', playerId: 'p1', amount: 10 },
      ],
    )
  })

  it('suppresses Diamonds against a Diamonds enemy', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['diamonds-2', 'clubs-8', 'spades-5'] }, { id: 'p2' }],
      currentEnemyId: 'diamonds-jack',
      tavernDeck: ['clubs-4'],
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-8', 'spades-5'] }, { id: 'p2' }],
      currentEnemyId: 'diamonds-jack',
      plays: [{ playerId: 'p1', cardIds: ['diamonds-2'] }],
      tavernDeck: ['clubs-4'],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['diamonds-2'] },
      expected,
      [
        { type: 'cards-played', playerId: 'p1', cardIds: ['diamonds-2'], attackValue: 2 },
        { type: 'enemy-damaged', enemyId: 'diamonds-jack', amount: 2, totalDamage: 2 },
        { type: 'counterattack-required', playerId: 'p1', amount: 10 },
      ],
    )
  })

  it('suppresses Clubs doubling against a Clubs enemy', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['clubs-2', 'clubs-8', 'spades-5'] }, { id: 'p2' }],
      currentEnemyId: 'clubs-jack',
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-8', 'spades-5'] }, { id: 'p2' }],
      currentEnemyId: 'clubs-jack',
      plays: [{ playerId: 'p1', cardIds: ['clubs-2'] }],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(initial, { type: 'play-cards', actorId: 'p1', cardIds: ['clubs-2'] }, expected, [
      { type: 'cards-played', playerId: 'p1', cardIds: ['clubs-2'], attackValue: 2 },
      { type: 'enemy-damaged', enemyId: 'clubs-jack', amount: 2, totalDamage: 2 },
      { type: 'counterattack-required', playerId: 'p1', amount: 10 },
    ])
  })

  it('suppresses Spades shielding against a Spades enemy', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['spades-2', 'clubs-8'] }, { id: 'p2' }],
      currentEnemyId: 'spades-jack',
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-8'] }, { id: 'p2' }],
      currentEnemyId: 'spades-jack',
      plays: [{ playerId: 'p1', cardIds: ['spades-2'] }],
      status: 'lost',
      outcome: { type: 'lost', reason: 'cannot-suffer-damage', playerId: 'p1' },
    })
    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['spades-2'] },
      expected,
      [
        { type: 'cards-played', playerId: 'p1', cardIds: ['spades-2'], attackValue: 2 },
        { type: 'enemy-damaged', enemyId: 'spades-jack', amount: 2, totalDamage: 2 },
        { type: 'counterattack-required', playerId: 'p1', amount: 10 },
        { type: 'game-lost', reason: 'cannot-suffer-damage', playerId: 'p1' },
      ],
    )
  })

  it('allows a formerly immune Hearts effect after Jester cancellation', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2', 'clubs-8', 'spades-5'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-jack',
      plays: [{ playerId: 'p2', cardIds: ['jester-1'] }],
      discardPile: ['clubs-4'],
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-8', 'spades-5'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-jack',
      plays: [
        { playerId: 'p2', cardIds: ['jester-1'] },
        { playerId: 'p1', cardIds: ['hearts-2'] },
      ],
      tavernDeck: ['clubs-4'],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['hearts-2'] },
      expected,
      [
        { type: 'cards-played', playerId: 'p1', cardIds: ['hearts-2'], attackValue: 2 },
        { type: 'hearts-resolved', cardIds: ['clubs-4'] },
        { type: 'enemy-damaged', enemyId: 'hearts-jack', amount: 2, totalDamage: 2 },
        { type: 'counterattack-required', playerId: 'p1', amount: 10 },
      ],
    )
  })

  it('resolves Hearts before Diamonds in a multi-suit companion play', () => {
    const initial = createFixture({
      players: [
        { id: 'p1', hand: ['hearts-animal-companion', 'diamonds-2', 'clubs-8'] },
        { id: 'p2' },
      ],
      discardPile: ['clubs-5'],
      tavernDeck: ['clubs-4'],
    })
    const expected = createFixture({
      players: [
        { id: 'p1', hand: ['clubs-8', 'clubs-4'] },
        { id: 'p2', hand: ['clubs-5'] },
      ],
      plays: [{ playerId: 'p1', cardIds: ['hearts-animal-companion', 'diamonds-2'] }],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(
      initial,
      {
        type: 'play-cards',
        actorId: 'p1',
        cardIds: ['hearts-animal-companion', 'diamonds-2'],
      },
      expected,
      [
        {
          type: 'cards-played',
          playerId: 'p1',
          cardIds: ['hearts-animal-companion', 'diamonds-2'],
          attackValue: 3,
        },
        { type: 'hearts-resolved', cardIds: ['clubs-5'] },
        {
          type: 'diamonds-resolved',
          draws: [
            { playerId: 'p1', cardId: 'clubs-4' },
            { playerId: 'p2', cardId: 'clubs-5' },
          ],
        },
        { type: 'enemy-damaged', enemyId: 'spades-jack', amount: 3, totalDamage: 3 },
        { type: 'counterattack-required', playerId: 'p1', amount: 10 },
      ],
    )
  })

  it('combines Clubs damage and Spades shield in one companion play', () => {
    const initial = createFixture({
      players: [
        { id: 'p1', hand: ['clubs-animal-companion', 'spades-9', 'clubs-8'] },
        { id: 'p2' },
      ],
      currentEnemyId: 'hearts-queen',
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-8'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-queen',
      plays: [{ playerId: 'p1', cardIds: ['clubs-animal-companion', 'spades-9'] }],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(
      initial,
      {
        type: 'play-cards',
        actorId: 'p1',
        cardIds: ['clubs-animal-companion', 'spades-9'],
      },
      expected,
      [
        {
          type: 'cards-played',
          playerId: 'p1',
          cardIds: ['clubs-animal-companion', 'spades-9'],
          attackValue: 10,
        },
        { type: 'enemy-damaged', enemyId: 'hearts-queen', amount: 20, totalDamage: 20 },
        { type: 'counterattack-required', playerId: 'p1', amount: 5 },
      ],
    )
  })

  it('resolves a repeated Hearts suit only once at total Attack Value', () => {
    const initial = createFixture({
      players: [
        { id: 'p1', hand: ['hearts-animal-companion', 'hearts-9', 'clubs-10'] },
        { id: 'p2' },
      ],
      discardPile: ['clubs-4'],
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-10'] }, { id: 'p2' }],
      plays: [{ playerId: 'p1', cardIds: ['hearts-animal-companion', 'hearts-9'] }],
      tavernDeck: ['clubs-4'],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(
      initial,
      {
        type: 'play-cards',
        actorId: 'p1',
        cardIds: ['hearts-animal-companion', 'hearts-9'],
      },
      expected,
      [
        {
          type: 'cards-played',
          playerId: 'p1',
          cardIds: ['hearts-animal-companion', 'hearts-9'],
          attackValue: 10,
        },
        { type: 'hearts-resolved', cardIds: ['clubs-4'] },
        { type: 'enemy-damaged', enemyId: 'spades-jack', amount: 10, totalDamage: 10 },
        { type: 'counterattack-required', playerId: 'p1', amount: 10 },
      ],
    )
  })

  it('allows a formerly immune Diamonds effect after Jester cancellation', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['diamonds-2', 'clubs-8', 'spades-5'] }, { id: 'p2' }],
      currentEnemyId: 'diamonds-jack',
      plays: [{ playerId: 'p2', cardIds: ['jester-1'] }],
      tavernDeck: ['clubs-4'],
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-8', 'spades-5', 'clubs-4'] }, { id: 'p2' }],
      currentEnemyId: 'diamonds-jack',
      plays: [
        { playerId: 'p2', cardIds: ['jester-1'] },
        { playerId: 'p1', cardIds: ['diamonds-2'] },
      ],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['diamonds-2'] },
      expected,
      [
        { type: 'cards-played', playerId: 'p1', cardIds: ['diamonds-2'], attackValue: 2 },
        { type: 'diamonds-resolved', draws: [{ playerId: 'p1', cardId: 'clubs-4' }] },
        { type: 'enemy-damaged', enemyId: 'diamonds-jack', amount: 2, totalDamage: 2 },
        { type: 'counterattack-required', playerId: 'p1', amount: 10 },
      ],
    )
  })
})

describe('draw, recovery, and turn boundaries', () => {
  it('draws clockwise across all players and wraps to the actor', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['diamonds-5', 'clubs-8'] }, { id: 'p2' }, { id: 'p3' }],
      tavernDeck: ['hearts-2', 'diamonds-3', 'clubs-4', 'spades-5', 'hearts-6'],
    })
    const expected = createFixture({
      players: [
        { id: 'p1', hand: ['clubs-8', 'hearts-2', 'spades-5'] },
        { id: 'p2', hand: ['diamonds-3', 'hearts-6'] },
        { id: 'p3', hand: ['clubs-4'] },
      ],
      plays: [{ playerId: 'p1', cardIds: ['diamonds-5'] }],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['diamonds-5'] },
      expected,
      [
        { type: 'cards-played', playerId: 'p1', cardIds: ['diamonds-5'], attackValue: 5 },
        {
          type: 'diamonds-resolved',
          draws: [
            { playerId: 'p1', cardId: 'hearts-2' },
            { playerId: 'p2', cardId: 'diamonds-3' },
            { playerId: 'p3', cardId: 'clubs-4' },
            { playerId: 'p1', cardId: 'spades-5' },
            { playerId: 'p2', cardId: 'hearts-6' },
          ],
        },
        { type: 'enemy-damaged', enemyId: 'spades-jack', amount: 5, totalDamage: 5 },
        { type: 'counterattack-required', playerId: 'p1', amount: 10 },
      ],
    )
  })

  it('skips full hands and stops with Tavern cards when every hand becomes full', () => {
    const initial = createFixture({
      players: [
        {
          id: 'p1',
          hand: ['diamonds-3', 'hearts-2', 'clubs-4', 'spades-5', 'hearts-6', 'clubs-7'],
        },
        {
          id: 'p2',
          hand: ['hearts-3', 'clubs-3', 'spades-3', 'hearts-4', 'diamonds-4', 'spades-4'],
        },
        { id: 'p3', hand: ['hearts-5', 'diamonds-5', 'clubs-5', 'hearts-7', 'diamonds-7'] },
      ],
      tavernDeck: ['diamonds-8', 'clubs-8', 'spades-8'],
    })
    const expected = createFixture({
      players: [
        {
          id: 'p1',
          hand: ['hearts-2', 'clubs-4', 'spades-5', 'hearts-6', 'clubs-7', 'diamonds-8'],
        },
        {
          id: 'p2',
          hand: ['hearts-3', 'clubs-3', 'spades-3', 'hearts-4', 'diamonds-4', 'spades-4'],
        },
        {
          id: 'p3',
          hand: ['hearts-5', 'diamonds-5', 'clubs-5', 'hearts-7', 'diamonds-7', 'clubs-8'],
        },
      ],
      plays: [{ playerId: 'p1', cardIds: ['diamonds-3'] }],
      tavernDeck: ['spades-8'],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['diamonds-3'] },
      expected,
      [
        { type: 'cards-played', playerId: 'p1', cardIds: ['diamonds-3'], attackValue: 3 },
        {
          type: 'diamonds-resolved',
          draws: [
            { playerId: 'p1', cardId: 'diamonds-8' },
            { playerId: 'p3', cardId: 'clubs-8' },
          ],
        },
        { type: 'enemy-damaged', enemyId: 'spades-jack', amount: 3, totalDamage: 3 },
        { type: 'counterattack-required', playerId: 'p1', amount: 10 },
      ],
    )
  })

  it('emits an empty Hearts recovery when the discard pile is empty', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2', 'clubs-8', 'spades-5'] }, { id: 'p2' }],
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-8', 'spades-5'] }, { id: 'p2' }],
      plays: [{ playerId: 'p1', cardIds: ['hearts-2'] }],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['hearts-2'] },
      expected,
      [
        { type: 'cards-played', playerId: 'p1', cardIds: ['hearts-2'], attackValue: 2 },
        { type: 'hearts-resolved', cardIds: [] },
        { type: 'enemy-damaged', enemyId: 'spades-jack', amount: 2, totalDamage: 2 },
        { type: 'counterattack-required', playerId: 'p1', amount: 10 },
      ],
    )
  })

  it('loses when the next player cannot play or Yield', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2', 'clubs-8'], yieldedLastTurn: true }, { id: 'p2' }],
      pendingDecision: 'discard-for-damage',
    })
    const expected = createFixture({
      players: [{ id: 'p1', yieldedLastTurn: true }, { id: 'p2' }],
      currentPlayerId: 'p2',
      discardPile: ['hearts-2', 'clubs-8'],
      status: 'lost',
      outcome: { type: 'lost', reason: 'cannot-play-or-yield', playerId: 'p2' },
    })
    assertAccepted(
      initial,
      { type: 'discard-for-damage', actorId: 'p1', cardIds: ['hearts-2', 'clubs-8'] },
      expected,
      [
        { type: 'damage-suffered', playerId: 'p1', amount: 10, cardIds: ['hearts-2', 'clubs-8'] },
        { type: 'turn-started', playerId: 'p2' },
        { type: 'game-lost', reason: 'cannot-play-or-yield', playerId: 'p2' },
      ],
    )
  })

  it('allows over-discarding and preserves the selected order', () => {
    const initial = createFixture({
      players: [
        { id: 'p1', hand: ['hearts-5', 'clubs-8'] },
        { id: 'p2', hand: ['spades-2'] },
      ],
      pendingDecision: 'discard-for-damage',
    })
    const expected = createFixture({
      players: [{ id: 'p1' }, { id: 'p2', hand: ['spades-2'] }],
      currentPlayerId: 'p2',
      discardPile: ['clubs-8', 'hearts-5'],
    })
    assertAccepted(
      initial,
      { type: 'discard-for-damage', actorId: 'p1', cardIds: ['clubs-8', 'hearts-5'] },
      expected,
      [
        { type: 'damage-suffered', playerId: 'p1', amount: 10, cardIds: ['clubs-8', 'hearts-5'] },
        { type: 'turn-started', playerId: 'p2' },
      ],
    )
  })

  it('resets the current player Yield flag after playing', () => {
    const initial = createFixture({
      players: [
        { id: 'p1', hand: ['clubs-2', 'clubs-8', 'hearts-6'], yieldedLastTurn: true },
        { id: 'p2' },
      ],
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-8', 'hearts-6'] }, { id: 'p2' }],
      plays: [{ playerId: 'p1', cardIds: ['clubs-2'] }],
      pendingDecision: 'discard-for-damage',
    })
    assertAccepted(initial, { type: 'play-cards', actorId: 'p1', cardIds: ['clubs-2'] }, expected, [
      { type: 'cards-played', playerId: 'p1', cardIds: ['clubs-2'], attackValue: 2 },
      { type: 'enemy-damaged', enemyId: 'spades-jack', amount: 4, totalDamage: 4 },
      { type: 'counterattack-required', playerId: 'p1', amount: 10 },
    ])
  })
})

describe('victory outcomes', () => {
  it('wins a multiplayer game after defeating the final Royal', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['clubs-10'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-jack',
    })
    const expected = createFixture({
      players: [{ id: 'p1' }, { id: 'p2' }],
      status: 'won',
      outcome: { type: 'won' },
      tavernDeck: ['hearts-jack'],
      discardPile: ['clubs-10'],
    })
    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['clubs-10'] },
      expected,
      [
        { type: 'cards-played', playerId: 'p1', cardIds: ['clubs-10'], attackValue: 10 },
        { type: 'enemy-damaged', enemyId: 'hearts-jack', amount: 20, totalDamage: 20 },
        { type: 'enemy-defeated', enemyId: 'hearts-jack', exact: true },
        { type: 'game-won' },
      ],
    )
  })

  it('wins after over-defeating the final Royal and discards it', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['clubs-10', 'spades-animal-companion'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-jack',
    })
    const expected = createFixture({
      players: [{ id: 'p1' }, { id: 'p2' }],
      status: 'won',
      outcome: { type: 'won' },
      discardPile: ['hearts-jack', 'clubs-10', 'spades-animal-companion'],
    })
    assertAccepted(
      initial,
      {
        type: 'play-cards',
        actorId: 'p1',
        cardIds: ['clubs-10', 'spades-animal-companion'],
      },
      expected,
      [
        {
          type: 'cards-played',
          playerId: 'p1',
          cardIds: ['clubs-10', 'spades-animal-companion'],
          attackValue: 11,
        },
        { type: 'enemy-damaged', enemyId: 'hearts-jack', amount: 22, totalDamage: 22 },
        { type: 'enemy-defeated', enemyId: 'hearts-jack', exact: false },
        { type: 'game-won' },
      ],
    )
  })

  it.each([
    { rating: 'gold', available: ['jester-1', 'jester-2'], used: [] },
    { rating: 'silver', available: ['jester-2'], used: ['jester-1'] },
    { rating: 'bronze', available: [], used: ['jester-1', 'jester-2'] },
  ] as const)('records a $rating solo victory', ({ rating, available, used }) => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['clubs-10'] }],
      currentEnemyId: 'hearts-jack',
      soloJestersAvailable: [...available],
      soloJestersUsed: [...used],
    })
    const expected = createFixture({
      players: [{ id: 'p1' }],
      status: 'won',
      outcome: { type: 'won', rating },
      tavernDeck: ['hearts-jack'],
      discardPile: ['clubs-10'],
      soloJestersAvailable: [...available],
      soloJestersUsed: [...used],
    })
    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['clubs-10'] },
      expected,
      [
        { type: 'cards-played', playerId: 'p1', cardIds: ['clubs-10'], attackValue: 10 },
        { type: 'enemy-damaged', enemyId: 'hearts-jack', amount: 20, totalDamage: 20 },
        { type: 'enemy-defeated', enemyId: 'hearts-jack', exact: true },
        { type: 'game-won', rating },
      ],
    )
  })
})

describe('command-specific rejection boundaries', () => {
  it('rejects duplicate and unavailable cards during damage discard', () => {
    const state = createFixture({
      players: [{ id: 'p1', hand: ['hearts-5', 'clubs-8'] }, { id: 'p2' }],
      pendingDecision: 'discard-for-damage',
    })
    assertRejected(
      state,
      { type: 'discard-for-damage', actorId: 'p1', cardIds: ['clubs-8', 'clubs-8'] },
      'duplicate-card',
    )
    assertRejected(
      state,
      { type: 'discard-for-damage', actorId: 'p1', cardIds: ['clubs-10'] },
      'card-not-in-hand',
    )
  })

  it('rejects phase-inappropriate Yield, discard, and player choice commands', () => {
    const play = createFixture()
    const discard = createFixture({ pendingDecision: 'discard-for-damage' })
    assertRejected(discard, { type: 'yield', actorId: 'p1' }, 'wrong-decision')
    assertRejected(
      play,
      { type: 'discard-for-damage', actorId: 'p1', cardIds: ['hearts-2'] },
      'wrong-decision',
    )
    assertRejected(
      play,
      { type: 'choose-next-player', actorId: 'p1', playerId: 'p1' },
      'wrong-decision',
    )
  })

  it('rejects consecutive solo Yield', () => {
    const state = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2'], yieldedLastTurn: true }],
    })
    assertRejected(state, { type: 'yield', actorId: 'p1' }, 'yield-not-allowed')
  })

  it('rejects Solo Jester in multiplayer and during player choice', () => {
    const multiplayer = createFixture()
    const choosing = createFixture({
      players: [{ id: 'p1' }],
      pendingDecision: 'choose-next-player',
    })
    assertRejected(
      multiplayer,
      { type: 'use-solo-jester', actorId: 'p1', cardId: 'jester-1' },
      'solo-jester-unavailable',
    )
    assertRejected(
      choosing,
      { type: 'use-solo-jester', actorId: 'p1', cardId: 'jester-1' },
      'solo-jester-unavailable',
    )
  })
})
