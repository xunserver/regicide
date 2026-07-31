import {
  JESTER_IDS,
  ROYAL_RANKS,
  getCard,
  getCardValue,
  getCardsByRank,
  getEnemyStats,
  getTavernCardIds,
  isRoyalCard,
} from './cards'
import { createRandomState, shuffle } from './random'
import type {
  CardId,
  CreateGameConfig,
  CurrentEnemy,
  GameCommand,
  GameEvent,
  GameOutcome,
  GameState,
  PlayRecord,
  PlayerId,
  PlayerState,
  RejectionReason,
  Suit,
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

function assertCurrentEnemy(state: GameState): CurrentEnemy {
  if (!state.currentEnemy) throw new Error('In-progress game has no current enemy')
  return state.currentEnemy
}

function currentEnemyCard(state: GameState) {
  const card = getCard(assertCurrentEnemy(state).cardId)
  if (!isRoyalCard(card)) throw new Error('Current enemy is not a Royal Card')
  return card
}

export function getAttackValue(cardIds: readonly CardId[]): number {
  return cardIds.reduce((total, cardId) => total + getCardValue(cardId), 0)
}

function getDistinctSuits(cardIds: readonly CardId[]): Suit[] {
  const suits = new Set<Suit>()
  for (const cardId of cardIds) {
    const card = getCard(cardId)
    if (card.kind === 'suited') suits.add(card.suit)
  }
  return [...suits]
}

function includesSuit(play: PlayRecord, suit: Suit): boolean {
  return play.cardIds.some((cardId) => {
    const card = getCard(cardId)
    return card.kind === 'suited' && card.suit === suit
  })
}

function isJesterPlay(play: PlayRecord): boolean {
  return play.cardIds.length === 1 && getCard(play.cardIds[0]!).kind === 'jester'
}

export function isEnemyImmunityCancelled(state: GameState): boolean {
  return assertCurrentEnemy(state).plays.some(isJesterPlay)
}

export function getEnemyDamage(state: GameState): number {
  const enemy = assertCurrentEnemy(state)
  const enemySuit = currentEnemyCard(state).suit
  let immunityCancelled = false
  let total = 0

  for (const play of enemy.plays) {
    if (isJesterPlay(play)) {
      immunityCancelled = true
      continue
    }

    const attackValue = getAttackValue(play.cardIds)
    const clubsActive = includesSuit(play, 'clubs') && (enemySuit !== 'clubs' || immunityCancelled)
    total += clubsActive ? attackValue * 2 : attackValue
  }

  return total
}

export function getEnemyShield(state: GameState): number {
  const enemy = assertCurrentEnemy(state)
  const enemySuit = currentEnemyCard(state).suit
  if (enemySuit === 'spades' && !isEnemyImmunityCancelled(state)) return 0

  return enemy.plays.reduce(
    (total, play) => total + (includesSuit(play, 'spades') ? getAttackValue(play.cardIds) : 0),
    0,
  )
}

export function getCurrentEnemyStats(state: GameState): {
  readonly attack: number
  readonly health: number
  readonly damage: number
  readonly shield: number
  readonly healthRemaining: number
} | null {
  if (!state.currentEnemy) return null
  const card = currentEnemyCard(state)
  const stats = getEnemyStats(card.rank)
  const damage = getEnemyDamage(state)
  const shield = getEnemyShield(state)
  return {
    ...stats,
    damage,
    shield,
    healthRemaining: Math.max(0, stats.health - damage),
  }
}

export function getCounterattackDamage(state: GameState): number {
  const stats = getCurrentEnemyStats(state)
  if (!stats) return 0
  return Math.max(0, stats.attack - stats.shield)
}

export function isLegalPlay(cardIds: readonly CardId[]): boolean {
  if (cardIds.length === 0 || new Set(cardIds).size !== cardIds.length) return false

  const cards = cardIds.map(getCard)
  if (cards.length === 1) return true
  if (cards.some((card) => card.kind === 'jester')) return false

  if (cards.length === 2 && cards.some((card) => card.rank === 'animal-companion')) {
    return true
  }

  if (cards.length < 2 || cards.length > 4) return false
  if (cards.some((card) => typeof card.rank !== 'number')) return false
  const rank = cards[0]!.rank
  return cards.every((card) => card.rank === rank) && getAttackValue(cardIds) <= 10
}

function combinations<T>(items: readonly T[], maxSize: number): T[][] {
  const result: T[][] = []

  function visit(start: number, selected: T[]): void {
    if (selected.length > 0) result.push([...selected])
    if (selected.length === maxSize) return
    for (let index = start; index < items.length; index += 1) {
      selected.push(items[index]!)
      visit(index + 1, selected)
      selected.pop()
    }
  }

  visit(0, [])
  return result
}

function canYield(state: GameState): boolean {
  if (state.players.length === 1) return !state.players[0]!.yieldedLastTurn
  return !state.players
    .filter((player) => player.id !== state.currentPlayerId)
    .every((player) => player.yieldedLastTurn)
}

function legalPlayCommands(state: GameState, actorId: PlayerId): GameCommand[] {
  const player = state.players.find((candidate) => candidate.id === actorId)
  if (!player) return []
  const commands: GameCommand[] = combinations(player.hand, 4)
    .filter(isLegalPlay)
    .map((cardIds) => ({ type: 'play-cards', actorId, cardIds }))

  if (canYield(state)) commands.push({ type: 'yield', actorId })
  for (const cardId of state.soloJesters.available) {
    commands.push({ type: 'use-solo-jester', actorId, cardId })
  }
  return commands
}

function legalDiscardCommands(state: GameState, actorId: PlayerId): GameCommand[] {
  const player = state.players.find((candidate) => candidate.id === actorId)
  if (!player) return []
  const required = getCounterattackDamage(state)
  const commands: GameCommand[] = combinations(player.hand, player.hand.length)
    .filter((cardIds) => getAttackValue(cardIds) >= required)
    .map((cardIds) => ({ type: 'discard-for-damage', actorId, cardIds }))

  for (const cardId of state.soloJesters.available) {
    commands.push({ type: 'use-solo-jester', actorId, cardId })
  }
  return commands
}

export function getLegalCommands(state: GameState, actorId: PlayerId): GameCommand[] {
  if (
    state.status !== 'in-progress' ||
    state.currentPlayerId !== actorId ||
    !state.pendingDecision
  ) {
    return []
  }

  switch (state.pendingDecision) {
    case 'play-or-yield':
      return legalPlayCommands(state, actorId)
    case 'discard-for-damage':
      return legalDiscardCommands(state, actorId)
    case 'choose-next-player':
      return state.players.map((player) => ({
        type: 'choose-next-player',
        actorId,
        playerId: player.id,
      }))
  }
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
  if (legalPlayCommands(state, state.currentPlayerId).length > 0) return state
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

function dispatchPlay(state: GameState, command: Extract<GameCommand, { type: 'play-cards' }>) {
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

  const enemySuit = currentEnemyCard(nextState).suit
  const activeSuits = getDistinctSuits(command.cardIds).filter(
    (suit) => suit !== enemySuit || immunityCancelledBefore,
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

function dispatchYield(state: GameState, command: Extract<GameCommand, { type: 'yield' }>) {
  if (state.pendingDecision !== 'play-or-yield') return reject(state, 'wrong-decision')
  if (!canYield(state)) return reject(state, 'yield-not-allowed')

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
) {
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
) {
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
) {
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

  let random = createRandomState(config.seed)
  const castleDeck: CardId[] = []
  for (const rank of ROYAL_RANKS) {
    const [royals, nextRandom] = shuffle(getCardsByRank(rank), random)
    castleDeck.push(...royals)
    random = nextRandom
  }

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
