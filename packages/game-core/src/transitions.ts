import { getCard } from './cards'
import { getLegalCommands, isLegalPlay } from './legality'
import {
  assertCurrentEnemy,
  getAttackValue,
  getCounterattackDamage,
  getCurrentEnemyStats,
  getDistinctSuits,
  getEnemyDamage,
  isEnemyImmunityCancelled,
} from './queries'
import { shuffle } from './random'
import type {
  CardId,
  GameCommand,
  GameEvent,
  GameOutcome,
  GameState,
  PlayerId,
  PlayerState,
  RejectionReason,
  TransitionResult,
} from './types'

function cloneState(state: GameState): GameState {
  return {
    ...state,
    outcome: state.outcome ? { ...state.outcome } : null,
    players: state.players.map((player) => ({ ...player, hand: [...player.hand] })),
    castleDeck: [...state.castleDeck],
    currentEnemy: state.currentEnemy
      ? {
          ...state.currentEnemy,
          plays: state.currentEnemy.plays.map((play) => ({
            ...play,
            cardIds: [...play.cardIds],
          })),
        }
      : null,
    tavernDeck: [...state.tavernDeck],
    discardPile: [...state.discardPile],
    soloJesters: {
      available: [...state.soloJesters.available],
      used: [...state.soloJesters.used],
    },
    excludedCards: [...state.excludedCards],
    random: { ...state.random },
  }
}

function replacePlayer(
  state: GameState,
  playerId: PlayerId,
  update: (player: PlayerState) => PlayerState,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.id === playerId ? update(player) : player)),
  }
}

function reject(state: GameState, reason: RejectionReason): TransitionResult {
  return { accepted: false, state, events: [], reason }
}

function accept(state: GameState, events: GameEvent[]): TransitionResult {
  return { accepted: true, state, events }
}

function lose(
  state: GameState,
  events: GameEvent[],
  reason: 'cannot-suffer-damage' | 'cannot-play-or-yield',
  playerId: PlayerId,
): GameState {
  const outcome: GameOutcome = { type: 'lost', reason, playerId }
  events.push({ type: 'game-lost', reason, playerId })
  return { ...state, status: 'lost', outcome, pendingDecision: null }
}

function ensurePlayerCanAct(state: GameState, events: GameEvent[]): GameState {
  if (state.status !== 'in-progress' || state.pendingDecision !== 'play-or-yield') return state
  if (getLegalCommands(state, state.currentPlayerId).length > 0) return state
  return lose(state, events, 'cannot-play-or-yield', state.currentPlayerId)
}

function nextPlayerId(state: GameState, playerId: PlayerId): PlayerId {
  const index = state.players.findIndex((player) => player.id === playerId)
  if (index < 0) throw new Error(`Unknown current player: ${playerId}`)
  return state.players[(index + 1) % state.players.length]!.id
}

function startTurn(state: GameState, events: GameEvent[], playerId: PlayerId): GameState {
  events.push({ type: 'turn-started', playerId })
  return ensurePlayerCanAct(
    { ...state, currentPlayerId: playerId, pendingDecision: 'play-or-yield' },
    events,
  )
}

function prepareCounterattack(
  state: GameState,
  events: GameEvent[],
  emitRequired: boolean,
): GameState {
  const amount = getCounterattackDamage(state)
  if (emitRequired) {
    events.push({ type: 'counterattack-required', playerId: state.currentPlayerId, amount })
  }

  // Zero damage completes immediately; otherwise the player must cover it atomically or lose.
  if (amount === 0) {
    events.push({
      type: 'damage-suffered',
      playerId: state.currentPlayerId,
      amount,
      cardIds: [],
    })
    return startTurn(state, events, nextPlayerId(state, state.currentPlayerId))
  }

  const player = state.players.find((candidate) => candidate.id === state.currentPlayerId)!
  if (getAttackValue(player.hand) >= amount || state.soloJesters.available.length > 0) {
    return { ...state, pendingDecision: 'discard-for-damage' }
  }

  return lose(state, events, 'cannot-suffer-damage', player.id)
}

function drawForDiamonds(
  state: GameState,
  playerId: PlayerId,
  amount: number,
): { readonly state: GameState; readonly draws: { playerId: PlayerId; cardId: CardId }[] } {
  let nextState = state
  const draws: { playerId: PlayerId; cardId: CardId }[] = []
  let index = state.players.findIndex((player) => player.id === playerId)

  // Drawing proceeds clockwise and skips full hands until the effect or Tavern is exhausted.
  while (draws.length < amount && nextState.tavernDeck.length > 0) {
    const hasCapacity = nextState.players.some((player) => player.hand.length < player.maxHandSize)
    if (!hasCapacity) break

    const player = nextState.players[index]!
    if (player.hand.length < player.maxHandSize) {
      const [cardId, ...remaining] = nextState.tavernDeck
      nextState = {
        ...replacePlayer(nextState, player.id, (candidate) => ({
          ...candidate,
          hand: [...candidate.hand, cardId!],
        })),
        tavernDeck: remaining,
      }
      draws.push({ playerId: player.id, cardId: cardId! })
    }
    index = (index + 1) % nextState.players.length
  }

  return { state: nextState, draws }
}

function resolveDefeat(state: GameState, events: GameEvent[]): GameState {
  const enemy = assertCurrentEnemy(state)
  const stats = getCurrentEnemyStats(state)!
  const exact = stats.damage === stats.health
  const playedCardIds = enemy.plays.flatMap((play) => play.cardIds)
  let tavernDeck = [...state.tavernDeck]
  const discardPile = [...state.discardPile]

  // Exact damage recruits the Royal to the Tavern; excess damage discards it permanently.
  if (exact) tavernDeck = [enemy.cardId, ...tavernDeck]
  else discardPile.push(enemy.cardId)
  discardPile.push(...playedCardIds)
  events.push({ type: 'enemy-defeated', enemyId: enemy.cardId, exact })

  if (state.castleDeck.length === 0) {
    const rating =
      state.players.length === 1
        ? (['gold', 'silver', 'bronze'] as const)[state.soloJesters.used.length]
        : undefined
    const outcome: GameOutcome = rating ? { type: 'won', rating } : { type: 'won' }
    events.push(rating ? { type: 'game-won', rating } : { type: 'game-won' })
    return {
      ...state,
      status: 'won',
      outcome,
      pendingDecision: null,
      currentEnemy: null,
      tavernDeck,
      discardPile,
    }
  }

  const [enemyId, ...castleDeck] = state.castleDeck
  events.push({ type: 'enemy-revealed', enemyId: enemyId! })
  return startTurn(
    {
      ...state,
      castleDeck,
      currentEnemy: { cardId: enemyId!, plays: [] },
      tavernDeck,
      discardPile,
    },
    events,
    state.currentPlayerId,
  )
}

function dispatchPlay(
  state: GameState,
  command: Extract<GameCommand, { type: 'play-cards' }>,
): TransitionResult {
  // Validate the command completely before cloning or changing any state.
  if (state.pendingDecision !== 'play-or-yield') return reject(state, 'wrong-decision')
  if (new Set(command.cardIds).size !== command.cardIds.length) {
    return reject(state, 'duplicate-card')
  }

  const player = state.players.find((candidate) => candidate.id === command.actorId)!
  if (!command.cardIds.every((cardId) => player.hand.includes(cardId))) {
    return reject(state, 'card-not-in-hand')
  }
  if (!isLegalPlay(command.cardIds)) return reject(state, 'illegal-play')

  let nextState = cloneState(state)
  const events: GameEvent[] = []
  const enemyBefore = assertCurrentEnemy(nextState)
  const immunityCancelledBefore = isEnemyImmunityCancelled(nextState)
  const damageBefore = getEnemyDamage(nextState)
  const attackValue = getAttackValue(command.cardIds)

  nextState = replacePlayer(nextState, command.actorId, (candidate) => ({
    ...candidate,
    yieldedLastTurn: false,
    hand: candidate.hand.filter((cardId) => !command.cardIds.includes(cardId)),
  }))
  nextState = {
    ...nextState,
    currentEnemy: {
      ...enemyBefore,
      plays: [...enemyBefore.plays, { playerId: command.actorId, cardIds: [...command.cardIds] }],
    },
  }
  events.push({
    type: 'cards-played',
    playerId: command.actorId,
    cardIds: [...command.cardIds],
    attackValue,
  })

  if (command.cardIds.length === 1 && getCard(command.cardIds[0]!).kind === 'jester') {
    events.push({ type: 'enemy-immunity-cancelled', enemyId: enemyBefore.cardId })
    return accept({ ...nextState, pendingDecision: 'choose-next-player' }, events)
  }

  // Suit effects resolve before damage, in the official Hearts-then-Diamonds order.
  const enemySuit = getCard(enemyBefore.cardId)
  const activeSuits = getDistinctSuits(command.cardIds).filter(
    (suit) => enemySuit.kind === 'suited' && (suit !== enemySuit.suit || immunityCancelledBefore),
  )

  if (activeSuits.includes('hearts')) {
    const [shuffledDiscard, random] = shuffle(nextState.discardPile, nextState.random)
    const recovered = shuffledDiscard.slice(0, attackValue)
    nextState = {
      ...nextState,
      discardPile: shuffledDiscard.slice(recovered.length),
      tavernDeck: [...nextState.tavernDeck, ...recovered],
      random,
    }
    events.push({ type: 'hearts-resolved', cardIds: recovered })
  }

  if (activeSuits.includes('diamonds')) {
    const drawn = drawForDiamonds(nextState, command.actorId, attackValue)
    nextState = drawn.state
    events.push({ type: 'diamonds-resolved', draws: drawn.draws })
  }

  const damage = getEnemyDamage(nextState) - damageBefore
  const totalDamage = getEnemyDamage(nextState)
  events.push({ type: 'enemy-damaged', enemyId: enemyBefore.cardId, amount: damage, totalDamage })

  const enemyStats = getCurrentEnemyStats(nextState)!
  if (enemyStats.damage >= enemyStats.health) {
    return accept(resolveDefeat(nextState, events), events)
  }

  return accept(prepareCounterattack(nextState, events, true), events)
}

function dispatchYield(
  state: GameState,
  command: Extract<GameCommand, { type: 'yield' }>,
): TransitionResult {
  if (state.pendingDecision !== 'play-or-yield') return reject(state, 'wrong-decision')
  const yieldAllowed = getLegalCommands(state, command.actorId).some(
    (candidate) => candidate.type === 'yield',
  )
  if (!yieldAllowed) return reject(state, 'yield-not-allowed')

  const events: GameEvent[] = [{ type: 'player-yielded', playerId: command.actorId }]
  const nextState = replacePlayer(cloneState(state), command.actorId, (player) => ({
    ...player,
    yieldedLastTurn: true,
  }))
  return accept(prepareCounterattack(nextState, events, true), events)
}

function dispatchDiscard(
  state: GameState,
  command: Extract<GameCommand, { type: 'discard-for-damage' }>,
): TransitionResult {
  if (state.pendingDecision !== 'discard-for-damage') return reject(state, 'wrong-decision')
  if (new Set(command.cardIds).size !== command.cardIds.length) {
    return reject(state, 'duplicate-card')
  }
  const player = state.players.find((candidate) => candidate.id === command.actorId)!
  if (!command.cardIds.every((cardId) => player.hand.includes(cardId))) {
    return reject(state, 'card-not-in-hand')
  }
  const amount = getCounterattackDamage(state)
  if (getAttackValue(command.cardIds) < amount) return reject(state, 'insufficient-discard')

  const events: GameEvent[] = [
    { type: 'damage-suffered', playerId: player.id, amount, cardIds: [...command.cardIds] },
  ]
  let nextState = cloneState(state)
  nextState = replacePlayer(nextState, player.id, (candidate) => ({
    ...candidate,
    hand: candidate.hand.filter((cardId) => !command.cardIds.includes(cardId)),
  }))
  nextState = { ...nextState, discardPile: [...nextState.discardPile, ...command.cardIds] }
  return accept(startTurn(nextState, events, nextPlayerId(nextState, player.id)), events)
}

function dispatchChooseNextPlayer(
  state: GameState,
  command: Extract<GameCommand, { type: 'choose-next-player' }>,
): TransitionResult {
  if (state.pendingDecision !== 'choose-next-player') return reject(state, 'wrong-decision')
  if (!state.players.some((player) => player.id === command.playerId)) {
    return reject(state, 'invalid-next-player')
  }

  const events: GameEvent[] = [
    { type: 'next-player-chosen', playerId: command.playerId, chosenBy: command.actorId },
  ]
  return accept(startTurn(cloneState(state), events, command.playerId), events)
}

function dispatchSoloJester(
  state: GameState,
  command: Extract<GameCommand, { type: 'use-solo-jester' }>,
): TransitionResult {
  if (
    state.players.length !== 1 ||
    !state.soloJesters.available.includes(command.cardId) ||
    (state.pendingDecision !== 'play-or-yield' && state.pendingDecision !== 'discard-for-damage')
  ) {
    return reject(state, 'solo-jester-unavailable')
  }

  let nextState = cloneState(state)
  const player = nextState.players[0]!
  const discardedCardIds = [...player.hand]
  const drawCount = Math.min(player.maxHandSize, nextState.tavernDeck.length)
  const drawnCardIds = nextState.tavernDeck.slice(0, drawCount)
  nextState = replacePlayer(nextState, player.id, (candidate) => ({
    ...candidate,
    hand: drawnCardIds,
  }))
  nextState = {
    ...nextState,
    tavernDeck: nextState.tavernDeck.slice(drawCount),
    discardPile: [...nextState.discardPile, ...discardedCardIds],
    soloJesters: {
      available: nextState.soloJesters.available.filter((cardId) => cardId !== command.cardId),
      used: [...nextState.soloJesters.used, command.cardId],
    },
  }

  const events: GameEvent[] = [
    {
      type: 'solo-jester-used',
      playerId: player.id,
      cardId: command.cardId,
      discardedCardIds,
      drawnCardIds,
    },
  ]
  nextState =
    state.pendingDecision === 'play-or-yield'
      ? ensurePlayerCanAct(nextState, events)
      : prepareCounterattack(nextState, events, false)
  return accept(nextState, events)
}

export function dispatch(state: GameState, command: GameCommand): TransitionResult {
  // These global guards protect every command before routing into phase-specific rules.
  if (state.status !== 'in-progress') return reject(state, 'game-over')
  if (command.actorId !== state.currentPlayerId) return reject(state, 'wrong-player')

  switch (command.type) {
    case 'play-cards':
      return dispatchPlay(state, command)
    case 'yield':
      return dispatchYield(state, command)
    case 'discard-for-damage':
      return dispatchDiscard(state, command)
    case 'choose-next-player':
      return dispatchChooseNextPlayer(state, command)
    case 'use-solo-jester':
      return dispatchSoloJester(state, command)
  }
}
