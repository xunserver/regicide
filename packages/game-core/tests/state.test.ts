import { describe, expect, it } from 'vitest'
import { parseGameState } from '../src'
import type { GameState } from '../src'
import { createFixture } from './fixtures'

function clone(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState
}

function expectInvalid(input: unknown, message: string): void {
  expect(() => parseGameState(input)).toThrow(message)
}

describe('game state parsing', () => {
  it('returns a detached copy of a valid snapshot', () => {
    const state = createFixture()
    const parsed = parseGameState(state)
    expect(parsed).toEqual(state)
    expect(parsed).not.toBe(state)
    expect(parsed.players).not.toBe(state.players)
    expect(parsed.currentEnemy).not.toBe(state.currentEnemy)
  })

  it('rejects invalid top-level state and schema fields', () => {
    const state = createFixture()
    expectInvalid(null, 'state must be an object')
    expectInvalid([], 'state must be an object')
    expectInvalid({ ...state, schemaVersion: 2 }, 'unsupported schemaVersion')
    expectInvalid({ ...state, status: 'paused' }, 'unknown status')
    expectInvalid({ ...state, pendingDecision: null }, 'requires a pending decision')
    expectInvalid(
      {
        ...state,
        status: 'lost',
        outcome: { type: 'lost', reason: 'cannot-suffer-damage', playerId: 'p1' },
      },
      'terminal game cannot have a pending decision',
    )
  })

  it('rejects invalid player collections and current players', () => {
    const state = createFixture()
    expectInvalid({ ...state, players: [] }, 'players must contain 1 to 4 entries')
    expectInvalid(
      {
        ...state,
        players: [
          ...state.players,
          { id: 'p3', hand: [], maxHandSize: 7, yieldedLastTurn: false },
          { id: 'p4', hand: [], maxHandSize: 7, yieldedLastTurn: false },
          { id: 'p5', hand: [], maxHandSize: 7, yieldedLastTurn: false },
        ],
      },
      'players must contain 1 to 4 entries',
    )
    expectInvalid({ ...state, players: [null, state.players[1]!] }, 'player must be an object')
    expectInvalid(
      { ...state, players: [{ ...state.players[0]!, id: '' }, state.players[1]!] },
      'player.id must be non-empty',
    )
    expectInvalid(
      { ...state, players: [state.players[0]!, { ...state.players[1]!, id: 'p1' }] },
      'player ids must be unique',
    )
    expectInvalid({ ...state, currentPlayerId: 'missing' }, 'currentPlayerId is unknown')
  })

  it('rejects invalid player hand metadata', () => {
    const state = createFixture()
    expectInvalid(
      { ...state, players: [{ ...state.players[0]!, maxHandSize: 8 }, state.players[1]!] },
      'wrong hand limit',
    )
    expectInvalid(
      {
        ...state,
        players: [
          {
            ...state.players[0]!,
            hand: [
              'hearts-2',
              'hearts-3',
              'hearts-4',
              'hearts-5',
              'hearts-6',
              'hearts-7',
              'hearts-8',
              'hearts-9',
            ],
          },
          state.players[1]!,
        ],
      },
      'exceeds hand limit',
    )
    expectInvalid(
      { ...state, players: [{ ...state.players[0]!, yieldedLastTurn: 'no' }, state.players[1]!] },
      'yieldedLastTurn must be boolean',
    )
  })

  it('rejects outcomes that do not match status or player count', () => {
    const multiplayer = createFixture()
    const solo = createFixture({ players: [{ id: 'p1', hand: ['hearts-2'] }] })
    expectInvalid(
      { ...multiplayer, outcome: { type: 'won' } },
      'in-progress game cannot have an outcome',
    )
    expectInvalid(
      { ...multiplayer, status: 'won', pendingDecision: null, outcome: null, currentEnemy: null },
      'terminal outcome is missing',
    )
    expectInvalid(
      {
        ...multiplayer,
        status: 'won',
        pendingDecision: null,
        outcome: { type: 'won', rating: 'gold' },
        currentEnemy: null,
      },
      'multiplayer victory cannot have a rating',
    )
    expectInvalid(
      {
        ...solo,
        status: 'won',
        pendingDecision: null,
        outcome: { type: 'won', rating: 'platinum' },
        currentEnemy: null,
      },
      'unknown victory rating',
    )
    expectInvalid(
      {
        ...solo,
        status: 'won',
        pendingDecision: null,
        outcome: { type: 'won' },
        currentEnemy: null,
      },
      'solo victory requires a rating',
    )
    expectInvalid(
      {
        ...multiplayer,
        status: 'lost',
        pendingDecision: null,
        outcome: { type: 'lost', reason: 'unknown', playerId: 'p1' },
      },
      'unknown loss reason',
    )
    expectInvalid(
      {
        ...multiplayer,
        status: 'lost',
        pendingDecision: null,
        outcome: { type: 'lost', reason: 'cannot-suffer-damage', playerId: 'missing' },
      },
      'loss references an unknown player',
    )
  })

  it('rejects invalid enemies and play records', () => {
    const state = createFixture()
    expectInvalid({ ...state, currentEnemy: null }, 'only a won game may omit the Current Enemy')
    expectInvalid({ ...state, currentEnemy: 'hearts-jack' }, 'currentEnemy must be an object')
    expectInvalid(
      { ...state, currentEnemy: { cardId: 'unknown', plays: [] } },
      'currentEnemy has an unknown card',
    )
    expectInvalid(
      { ...state, currentEnemy: { cardId: state.currentEnemy!.cardId, plays: 'invalid' } },
      'currentEnemy.plays must be an array',
    )
    expectInvalid(
      { ...state, currentEnemy: { cardId: state.currentEnemy!.cardId, plays: [{}] } },
      'play.playerId must be a string',
    )
    expectInvalid(
      { ...state, currentEnemy: { cardId: state.currentEnemy!.cardId, plays: [null] } },
      'play must be an object',
    )
    expectInvalid(
      {
        ...state,
        currentEnemy: {
          cardId: state.currentEnemy!.cardId,
          plays: [{ playerId: 'missing', cardIds: ['clubs-2'] }],
        },
      },
      'play references an unknown player',
    )
    expectInvalid(
      {
        ...state,
        currentEnemy: {
          cardId: state.currentEnemy!.cardId,
          plays: [{ playerId: 'p1', cardIds: [] }],
        },
      },
      'play cannot be empty',
    )
  })

  it('rejects invalid Solo Jester zones', () => {
    const multiplayer = createFixture()
    const solo = createFixture({ players: [{ id: 'p1', hand: ['hearts-2'] }] })
    expectInvalid({ ...multiplayer, soloJesters: null }, 'soloJesters must be an object')
    expectInvalid(
      { ...multiplayer, soloJesters: { available: ['jester-1'], used: [] } },
      'multiplayer game cannot have solo Jesters',
    )
    expectInvalid(
      { ...solo, soloJesters: { available: ['jester-1'], used: [] } },
      'solo game must account for two solo Jesters',
    )
    expectInvalid(
      {
        ...solo,
        soloJesters: { available: ['hearts-3', 'jester-1'], used: [] },
        excludedCards: [
          ...solo.excludedCards.filter((cardId) => cardId !== 'hearts-3'),
          'jester-2',
        ],
      },
      'solo Jester zone contains a suited card',
    )
  })

  it('rejects invalid random state', () => {
    const state = createFixture()
    expectInvalid({ ...state, random: null }, 'unknown random algorithm')
    expectInvalid(
      { ...state, random: { algorithm: 'other', state: 1 } },
      'unknown random algorithm',
    )
    for (const value of [0, -1, 1.5, 0x1_0000_0000]) {
      expectInvalid(
        { ...state, random: { algorithm: 'xorshift32', state: value } },
        'non-zero uint32',
      )
    }
  })

  it('rejects missing, duplicate, and unknown cards', () => {
    const state = createFixture()
    expectInvalid({ ...state, tavernDeck: ['unknown'] }, 'contains an unknown card')
    expectInvalid({ ...state, excludedCards: state.excludedCards.slice(1) }, 'exactly one zone')
    expectInvalid({ ...state, discardPile: [state.players[0]!.hand[0]!] }, 'exactly one zone')
  })

  it('rejects non-Royal cards in Castle and Current Enemy zones', () => {
    const state = createFixture()
    const castle = clone(state)
    castle.castleDeck.push('hearts-3')
    castle.excludedCards.splice(castle.excludedCards.indexOf('hearts-3'), 1)
    expectInvalid(castle, 'Castle contains a non-Royal Card')

    const enemy = {
      ...clone(state),
      currentEnemy: { cardId: 'hearts-3', plays: [] },
      excludedCards: [
        ...state.excludedCards.filter((cardId) => cardId !== 'hearts-3'),
        state.currentEnemy!.cardId,
      ],
    }
    expectInvalid(enemy, 'Current Enemy is not a Royal Card')
  })
})
