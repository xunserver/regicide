import { describe, expect, it } from 'vitest'
import { dispatch, parseGameState } from '../src'
import type { GameCommand, GameEvent, GameState } from '../src'
import { createFixture } from './fixtures'

function assertAccepted(
  initial: GameState,
  command: GameCommand,
  expectedState: GameState,
  expectedEvents: GameEvent[],
): GameState {
  const original = parseGameState(initial)
  const result = dispatch(initial, command)

  expect(result).toEqual({ accepted: true, state: expectedState, events: expectedEvents })
  expect(initial).toEqual(original)
  if (!result.accepted) throw new Error(result.reason)
  return result.state
}

function assertRejected(initial: GameState, command: GameCommand, reason: string): void {
  const original = parseGameState(initial)
  const result = dispatch(initial, command)

  expect(result).toEqual({ accepted: false, state: initial, events: [], reason })
  expect(result.state).toEqual(original)
}

describe('rule transitions', () => {
  it('resolves Clubs as doubled damage and requests a counterattack', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['clubs-2', 'hearts-6', 'clubs-8'] }, { id: 'p2' }],
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['hearts-6', 'clubs-8'] }, { id: 'p2' }],
      plays: [{ playerId: 'p1', cardIds: ['clubs-2'] }],
      pendingDecision: 'discard-for-damage',
    })

    assertAccepted(initial, { type: 'play-cards', actorId: 'p1', cardIds: ['clubs-2'] }, expected, [
      { type: 'cards-played', playerId: 'p1', cardIds: ['clubs-2'], attackValue: 2 },
      { type: 'enemy-damaged', enemyId: 'spades-jack', amount: 4, totalDamage: 4 },
      { type: 'counterattack-required', playerId: 'p1', amount: 10 },
    ])
  })

  it('resolves Spades as a shield that reduces the counterattack', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['spades-5', 'clubs-8'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-jack',
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-8'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-jack',
      plays: [{ playerId: 'p1', cardIds: ['spades-5'] }],
      pendingDecision: 'discard-for-damage',
    })

    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['spades-5'] },
      expected,
      [
        { type: 'cards-played', playerId: 'p1', cardIds: ['spades-5'], attackValue: 5 },
        { type: 'enemy-damaged', enemyId: 'hearts-jack', amount: 5, totalDamage: 5 },
        { type: 'counterattack-required', playerId: 'p1', amount: 5 },
      ],
    )
  })

  it('resolves Hearts and restores cards to the Tavern', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2', 'clubs-8', 'hearts-6'] }, { id: 'p2' }],
      discardPile: ['clubs-4'],
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-8', 'hearts-6'] }, { id: 'p2' }],
      plays: [{ playerId: 'p1', cardIds: ['hearts-2'] }],
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
        { type: 'enemy-damaged', enemyId: 'spades-jack', amount: 2, totalDamage: 2 },
        { type: 'counterattack-required', playerId: 'p1', amount: 10 },
      ],
    )
  })

  it('resolves Diamonds clockwise and records each draw', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['diamonds-2', 'clubs-8', 'hearts-6'] }, { id: 'p2' }],
      tavernDeck: ['clubs-4'],
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-8', 'hearts-6', 'clubs-4'] }, { id: 'p2' }],
      plays: [{ playerId: 'p1', cardIds: ['diamonds-2'] }],
      pendingDecision: 'discard-for-damage',
    })

    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['diamonds-2'] },
      expected,
      [
        { type: 'cards-played', playerId: 'p1', cardIds: ['diamonds-2'], attackValue: 2 },
        { type: 'diamonds-resolved', draws: [{ playerId: 'p1', cardId: 'clubs-4' }] },
        { type: 'enemy-damaged', enemyId: 'spades-jack', amount: 2, totalDamage: 2 },
        { type: 'counterattack-required', playerId: 'p1', amount: 10 },
      ],
    )
  })

  it('uses a Jester to cancel immunity and pause for a player choice', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['jester-1'] }, { id: 'p2' }, { id: 'p3' }],
    })
    const expected = createFixture({
      players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
      plays: [{ playerId: 'p1', cardIds: ['jester-1'] }],
      pendingDecision: 'choose-next-player',
    })

    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['jester-1'] },
      expected,
      [
        { type: 'cards-played', playerId: 'p1', cardIds: ['jester-1'], attackValue: 0 },
        { type: 'enemy-immunity-cancelled', enemyId: 'spades-jack' },
      ],
    )
  })

  it('defeats a Royal exactly, recruits it, and reveals the next enemy', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['clubs-10'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-jack',
      castleDeck: ['diamonds-queen'],
    })
    const expected = createFixture({
      players: [{ id: 'p1' }, { id: 'p2' }],
      currentEnemyId: 'diamonds-queen',
      plays: [],
      tavernDeck: ['hearts-jack'],
      discardPile: ['clubs-10'],
      pendingDecision: 'play-or-yield',
    })

    assertAccepted(
      initial,
      { type: 'play-cards', actorId: 'p1', cardIds: ['clubs-10'] },
      expected,
      [
        { type: 'cards-played', playerId: 'p1', cardIds: ['clubs-10'], attackValue: 10 },
        { type: 'enemy-damaged', enemyId: 'hearts-jack', amount: 20, totalDamage: 20 },
        { type: 'enemy-defeated', enemyId: 'hearts-jack', exact: true },
        { type: 'enemy-revealed', enemyId: 'diamonds-queen' },
        { type: 'turn-started', playerId: 'p1' },
      ],
    )
  })

  it('discards an over-defeated Royal and its played cards', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['clubs-10', 'spades-animal-companion'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-jack',
      castleDeck: ['diamonds-queen'],
    })
    const expected = createFixture({
      players: [{ id: 'p1' }, { id: 'p2' }],
      currentEnemyId: 'diamonds-queen',
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
        { type: 'enemy-revealed', enemyId: 'diamonds-queen' },
        { type: 'turn-started', playerId: 'p1' },
      ],
    )
  })

  it('accepts Yield and waits for the counterattack discard', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2', 'clubs-8'] }, { id: 'p2' }],
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2', 'clubs-8'], yieldedLastTurn: true }, { id: 'p2' }],
      pendingDecision: 'discard-for-damage',
    })

    assertAccepted(initial, { type: 'yield', actorId: 'p1' }, expected, [
      { type: 'player-yielded', playerId: 'p1' },
      { type: 'counterattack-required', playerId: 'p1', amount: 10 },
    ])
  })

  it('moves to the next player when Yield causes zero damage', () => {
    const initial = createFixture({
      players: [
        { id: 'p1', hand: ['hearts-2'] },
        { id: 'p2', hand: ['clubs-2'] },
      ],
      currentEnemyId: 'hearts-jack',
      plays: [{ playerId: 'p2', cardIds: ['spades-10'] }],
    })
    const expected = createFixture({
      players: [
        { id: 'p1', hand: ['hearts-2'], yieldedLastTurn: true },
        { id: 'p2', hand: ['clubs-2'] },
      ],
      currentEnemyId: 'hearts-jack',
      plays: [{ playerId: 'p2', cardIds: ['spades-10'] }],
      currentPlayerId: 'p2',
    })

    assertAccepted(initial, { type: 'yield', actorId: 'p1' }, expected, [
      { type: 'player-yielded', playerId: 'p1' },
      { type: 'counterattack-required', playerId: 'p1', amount: 0 },
      { type: 'damage-suffered', playerId: 'p1', amount: 0, cardIds: [] },
      { type: 'turn-started', playerId: 'p2' },
    ])
  })

  it('loses when Yield cannot be covered by the hand', () => {
    const initial = createFixture({ players: [{ id: 'p1', hand: ['hearts-2'] }, { id: 'p2' }] })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2'], yieldedLastTurn: true }, { id: 'p2' }],
      status: 'lost',
      outcome: { type: 'lost', reason: 'cannot-suffer-damage', playerId: 'p1' },
    })

    assertAccepted(initial, { type: 'yield', actorId: 'p1' }, expected, [
      { type: 'player-yielded', playerId: 'p1' },
      { type: 'counterattack-required', playerId: 'p1', amount: 10 },
      { type: 'game-lost', reason: 'cannot-suffer-damage', playerId: 'p1' },
    ])
  })

  it('discards enough cards and starts the next player turn', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2', 'clubs-8'] }, { id: 'p2' }],
      pendingDecision: 'discard-for-damage',
    })
    const expected = createFixture({
      players: [{ id: 'p1' }, { id: 'p2' }],
      currentPlayerId: 'p2',
      discardPile: ['hearts-2', 'clubs-8'],
    })

    assertAccepted(
      initial,
      { type: 'discard-for-damage', actorId: 'p1', cardIds: ['hearts-2', 'clubs-8'] },
      expected,
      [
        { type: 'damage-suffered', playerId: 'p1', amount: 10, cardIds: ['hearts-2', 'clubs-8'] },
        { type: 'turn-started', playerId: 'p2' },
      ],
    )
  })

  it('chooses the next player after a Jester', () => {
    const initial = createFixture({
      players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
      plays: [{ playerId: 'p1', cardIds: ['jester-1'] }],
      pendingDecision: 'choose-next-player',
    })
    const expected = createFixture({
      players: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
      plays: [{ playerId: 'p1', cardIds: ['jester-1'] }],
      currentPlayerId: 'p3',
    })

    assertAccepted(
      initial,
      { type: 'choose-next-player', actorId: 'p1', playerId: 'p3' },
      expected,
      [
        { type: 'next-player-chosen', playerId: 'p3', chosenBy: 'p1' },
        { type: 'turn-started', playerId: 'p3' },
      ],
    )
  })

  it('uses a solo Jester during the normal phase', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2'] }],
      tavernDeck: ['clubs-10', 'diamonds-10', 'spades-10'],
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-10', 'diamonds-10', 'spades-10'] }],
      soloJestersAvailable: ['jester-2'],
      soloJestersUsed: ['jester-1'],
      discardPile: ['hearts-2'],
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
          drawnCardIds: ['clubs-10', 'diamonds-10', 'spades-10'],
        },
      ],
    )
  })

  it('uses a solo Jester while waiting to discard for damage', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2'] }],
      pendingDecision: 'discard-for-damage',
      tavernDeck: ['clubs-10', 'diamonds-10', 'spades-10'],
    })
    const expected = createFixture({
      players: [{ id: 'p1', hand: ['clubs-10', 'diamonds-10', 'spades-10'] }],
      pendingDecision: 'discard-for-damage',
      soloJestersAvailable: ['jester-2'],
      soloJestersUsed: ['jester-1'],
      discardPile: ['hearts-2'],
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
          drawnCardIds: ['clubs-10', 'diamonds-10', 'spades-10'],
        },
      ],
    )
  })
})

describe('rejected rule transitions', () => {
  it('rejects commands after the game is over', () => {
    const state = createFixture({
      status: 'won',
      outcome: { type: 'won' },
    })
    assertRejected(state, { type: 'yield', actorId: 'p1' }, 'game-over')
  })

  it('rejects a command from the wrong player', () => {
    const state = createFixture({ players: [{ id: 'p1' }, { id: 'p2', hand: ['clubs-2'] }] })
    assertRejected(
      state,
      { type: 'play-cards', actorId: 'p2', cardIds: ['clubs-2'] },
      'wrong-player',
    )
  })

  it('rejects a command from the wrong decision phase', () => {
    const state = createFixture({ pendingDecision: 'discard-for-damage' })
    assertRejected(
      state,
      { type: 'play-cards', actorId: 'p1', cardIds: ['hearts-2'] },
      'wrong-decision',
    )
  })

  it('rejects cards that are not in the hand', () => {
    const state = createFixture({ players: [{ id: 'p1', hand: ['hearts-2'] }, { id: 'p2' }] })
    assertRejected(
      state,
      { type: 'play-cards', actorId: 'p1', cardIds: ['clubs-2'] },
      'card-not-in-hand',
    )
  })

  it('rejects duplicate cards', () => {
    const state = createFixture({ players: [{ id: 'p1', hand: ['hearts-2'] }, { id: 'p2' }] })
    assertRejected(
      state,
      { type: 'play-cards', actorId: 'p1', cardIds: ['hearts-2', 'hearts-2'] },
      'duplicate-card',
    )
  })

  it('rejects an illegal card combination', () => {
    const state = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2', 'clubs-3'] }, { id: 'p2' }],
    })
    assertRejected(
      state,
      { type: 'play-cards', actorId: 'p1', cardIds: ['hearts-2', 'clubs-3'] },
      'illegal-play',
    )
  })

  it('rejects Yield when another player already yielded', () => {
    const state = createFixture({
      players: [
        { id: 'p1', hand: ['hearts-2'] },
        { id: 'p2', yieldedLastTurn: true },
      ],
    })
    assertRejected(state, { type: 'yield', actorId: 'p1' }, 'yield-not-allowed')
  })

  it('rejects a discard that does not cover the counterattack', () => {
    const state = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2', 'clubs-8'] }, { id: 'p2' }],
      pendingDecision: 'discard-for-damage',
    })
    assertRejected(
      state,
      { type: 'discard-for-damage', actorId: 'p1', cardIds: ['hearts-2'] },
      'insufficient-discard',
    )
  })

  it('rejects an unknown next player', () => {
    const state = createFixture({
      players: [{ id: 'p1' }, { id: 'p2' }],
      plays: [{ playerId: 'p1', cardIds: ['jester-1'] }],
      pendingDecision: 'choose-next-player',
    })
    assertRejected(
      state,
      { type: 'choose-next-player', actorId: 'p1', playerId: 'p9' },
      'invalid-next-player',
    )
  })

  it('rejects an unavailable solo Jester', () => {
    const state = createFixture({
      players: [{ id: 'p1' }],
      soloJestersAvailable: ['jester-2'],
      soloJestersUsed: ['jester-1'],
    })
    assertRejected(
      state,
      { type: 'use-solo-jester', actorId: 'p1', cardId: 'jester-1' },
      'solo-jester-unavailable',
    )
  })
})
