import { describe, expect, it } from 'vitest'
import {
  dispatch,
  getCardValue,
  getCounterattackDamage,
  getCurrentEnemyStats,
  getEnemyDamage,
  getEnemyShield,
  getLegalCommands,
} from '../src'
import { createFixture } from './fixtures'

function accepted(result: ReturnType<typeof dispatch>) {
  expect(result.accepted).toBe(true)
  if (!result.accepted) throw new Error(result.reason)
  return result
}

describe('rule transitions', () => {
  it('resolves Hearts before Diamonds and draws clockwise', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-animal-companion', 'diamonds-2'] }, { id: 'p2' }],
      currentEnemyId: 'spades-jack',
      discardPile: ['clubs-4', 'clubs-5', 'clubs-6'],
    })
    const result = accepted(
      dispatch(initial, {
        type: 'play-cards',
        actorId: 'p1',
        cardIds: ['hearts-animal-companion', 'diamonds-2'],
      }),
    )

    expect(result.events.map((event) => event.type).slice(0, 4)).toEqual([
      'cards-played',
      'hearts-resolved',
      'diamonds-resolved',
      'enemy-damaged',
    ])
    expect(result.state.players[0]!.hand).toHaveLength(2)
    expect(result.state.players[1]!.hand).toHaveLength(1)
    expect(result.state.discardPile).toHaveLength(0)
  })

  it('resolves a repeated suit once at the total Attack Value', () => {
    const state = createFixture({
      players: [{ id: 'p1', hand: ['hearts-animal-companion', 'hearts-9'] }, { id: 'p2' }],
      currentEnemyId: 'spades-jack',
      discardPile: [
        'diamonds-2',
        'diamonds-3',
        'diamonds-4',
        'diamonds-5',
        'diamonds-6',
        'diamonds-7',
        'diamonds-8',
        'diamonds-9',
        'diamonds-10',
        'clubs-2',
        'clubs-3',
        'clubs-4',
      ],
    })
    const result = accepted(
      dispatch(state, {
        type: 'play-cards',
        actorId: 'p1',
        cardIds: ['hearts-animal-companion', 'hearts-9'],
      }),
    )
    const hearts = result.events.find((event) => event.type === 'hearts-resolved')
    expect(hearts?.type).toBe('hearts-resolved')
    if (hearts?.type === 'hearts-resolved') expect(hearts.cardIds).toHaveLength(10)
  })

  it('applies enemy immunity and Jester retroactivity correctly', () => {
    const beforeJester = createFixture({
      currentEnemyId: 'spades-jack',
      plays: [{ playerId: 'p1', cardIds: ['spades-5'] }],
    })
    const afterJester = createFixture({
      currentEnemyId: 'spades-jack',
      plays: [
        { playerId: 'p1', cardIds: ['spades-5'] },
        { playerId: 'p2', cardIds: ['jester-1'] },
      ],
    })
    const clubs = createFixture({
      currentEnemyId: 'clubs-jack',
      plays: [
        { playerId: 'p1', cardIds: ['clubs-5'] },
        { playerId: 'p2', cardIds: ['jester-1'] },
      ],
    })

    expect(getEnemyShield(beforeJester)).toBe(0)
    expect(getEnemyShield(afterJester)).toBe(5)
    expect(getEnemyDamage(clubs)).toBe(5)
  })

  it('pauses after a Jester until its player chooses who acts next', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['jester-1'] }, { id: 'p2' }, { id: 'p3' }],
    })
    const played = accepted(
      dispatch(initial, { type: 'play-cards', actorId: 'p1', cardIds: ['jester-1'] }),
    )
    expect(played.state.pendingDecision).toBe('choose-next-player')
    expect(played.state.currentPlayerId).toBe('p1')

    const chosen = accepted(
      dispatch(played.state, { type: 'choose-next-player', actorId: 'p1', playerId: 'p3' }),
    )
    expect(chosen.state.currentPlayerId).toBe('p3')
    expect(chosen.state.pendingDecision).toBe('play-or-yield')
  })

  it('recovers an exactly defeated Royal and discards an over-defeated Royal', () => {
    const exact = createFixture({
      players: [{ id: 'p1', hand: ['clubs-10'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-jack',
      castleDeck: ['diamonds-queen'],
    })
    const exactResult = accepted(
      dispatch(exact, { type: 'play-cards', actorId: 'p1', cardIds: ['clubs-10'] }),
    )
    expect(exactResult.state.tavernDeck[0]).toBe('hearts-jack')
    expect(exactResult.state.discardPile).toContain('clubs-10')
    expect(exactResult.state.currentPlayerId).toBe('p1')

    const over = createFixture({
      players: [{ id: 'p1', hand: ['clubs-10', 'spades-animal-companion'] }, { id: 'p2' }],
      currentEnemyId: 'hearts-jack',
      castleDeck: ['diamonds-queen'],
    })
    const overResult = accepted(
      dispatch(over, {
        type: 'play-cards',
        actorId: 'p1',
        cardIds: ['clubs-10', 'spades-animal-companion'],
      }),
    )
    expect(overResult.state.discardPile).toContain('hearts-jack')
    expect(overResult.state.tavernDeck).not.toContain('hearts-jack')
  })

  it('requires an atomic discard that covers the counterattack', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2', 'clubs-8'] }, { id: 'p2' }],
      pendingDecision: 'discard-for-damage',
    })
    const rejected = dispatch(initial, {
      type: 'discard-for-damage',
      actorId: 'p1',
      cardIds: ['hearts-2'],
    })
    expect(rejected).toMatchObject({ accepted: false, reason: 'insufficient-discard' })
    expect(rejected.state).toBe(initial)
    expect(rejected.events).toEqual([])

    const result = accepted(
      dispatch(initial, {
        type: 'discard-for-damage',
        actorId: 'p1',
        cardIds: ['hearts-2', 'clubs-8'],
      }),
    )
    expect(result.state.currentPlayerId).toBe('p2')
    expect(result.state.discardPile).toEqual(['hearts-2', 'clubs-8'])
  })

  it('loses automatically when damage cannot be satisfied', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2'] }, { id: 'p2' }],
    })
    const result = accepted(dispatch(initial, { type: 'yield', actorId: 'p1' }))
    expect(result.state.status).toBe('lost')
    expect(result.state.outcome).toMatchObject({
      type: 'lost',
      reason: 'cannot-suffer-damage',
      playerId: 'p1',
    })
  })

  it('uses a solo Jester before suffering damage and remains at the decision', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2'] }],
      pendingDecision: 'discard-for-damage',
      tavernDeck: ['clubs-10', 'diamonds-10', 'spades-10'],
    })
    const result = accepted(
      dispatch(initial, { type: 'use-solo-jester', actorId: 'p1', cardId: 'jester-1' }),
    )

    expect(result.state.pendingDecision).toBe('discard-for-damage')
    expect(result.state.players[0]!.hand).toEqual(['clubs-10', 'diamonds-10', 'spades-10'])
    expect(result.state.soloJesters.used).toEqual(['jester-1'])
    expect(result.state.discardPile).toContain('hearts-2')
  })

  it('enforces multiplayer and solo Yield limits', () => {
    const multiplayer = createFixture({
      players: [
        { id: 'p1', hand: ['hearts-2'] },
        { id: 'p2', yieldedLastTurn: true },
      ],
    })
    expect(dispatch(multiplayer, { type: 'yield', actorId: 'p1' })).toMatchObject({
      accepted: false,
      reason: 'yield-not-allowed',
    })

    const solo = createFixture({
      players: [{ id: 'p1', hand: ['hearts-2'], yieldedLastTurn: true }],
    })
    expect(getLegalCommands(solo, 'p1')).not.toContainEqual({ type: 'yield', actorId: 'p1' })
  })

  it('derives Royal values and effective enemy statistics', () => {
    expect(getCardValue('hearts-jack')).toBe(10)
    expect(getCardValue('hearts-queen')).toBe(15)
    expect(getCardValue('hearts-king')).toBe(20)
    const game = createFixture({
      currentEnemyId: 'hearts-queen',
      plays: [{ playerId: 'p1', cardIds: ['spades-5'] }],
    })
    expect(getCurrentEnemyStats(game)).toMatchObject({
      attack: 15,
      health: 30,
      damage: 5,
      shield: 5,
      healthRemaining: 25,
    })
    expect(getCounterattackDamage(game)).toBe(10)
  })

  it('stores the official solo victory rating', () => {
    const initial = createFixture({
      players: [{ id: 'p1', hand: ['diamonds-2'] }],
      currentEnemyId: 'spades-king',
      plays: [{ playerId: 'p1', cardIds: ['hearts-king', 'clubs-9'] }],
      soloJestersAvailable: ['jester-2'],
      soloJestersUsed: ['jester-1'],
    })
    const result = accepted(
      dispatch(initial, {
        type: 'play-cards',
        actorId: 'p1',
        cardIds: ['diamonds-2'],
      }),
    )
    expect(result.state.outcome).toEqual({ type: 'won', rating: 'silver' })
  })
})
