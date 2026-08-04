import {
  createGame,
  dispatch,
  getLegalCommands,
  parseGameState,
  type GameCommand,
  type GameState,
} from '@regicide/game-core'

export const LOCAL_PLAYER_ID = 'local-player'

export function createSoloGameState(seed: string | number = 'saved-game'): GameState {
  return createGame({
    playerIds: [LOCAL_PLAYER_ID],
    startingPlayerId: LOCAL_PLAYER_ID,
    seed,
  })
}

export function createOtherPlayerSoloGame(seed: string | number = 'other-player'): GameState {
  return createGame({ playerIds: ['other-player'], startingPlayerId: 'other-player', seed })
}

export function createTerminalSoloGame(seed: string | number = 'terminal'): GameState {
  const game = createSoloGameState(seed)
  return parseGameState({
    ...game,
    status: 'lost',
    outcome: {
      type: 'lost',
      reason: 'cannot-play-or-yield',
      playerId: LOCAL_PLAYER_ID,
    },
    pendingDecision: null,
  })
}

export function createChoosingPlayerSoloGame(seed: string | number = 'choosing'): GameState {
  const game = createSoloGameState(seed)
  return parseGameState({ ...game, pendingDecision: 'choose-next-player' })
}

export function createConsecutiveYieldGame(seed: string | number = 'yielded'): GameState {
  const game = createSoloGameState(seed)
  return parseGameState({
    ...game,
    players: game.players.map((player) => ({ ...player, yieldedLastTurn: true })),
  })
}

export function createMalformedGameState(): GameState {
  const game = createSoloGameState('malformed')
  const malformed = JSON.parse(JSON.stringify(game)) as GameState
  malformed.tavernDeck.push(malformed.players[0]!.hand[0]!)
  return malformed
}

export function findPlayCommand(game: GameState): Extract<GameCommand, { type: 'play-cards' }> {
  const command = getLegalCommands(game, LOCAL_PLAYER_ID).find(
    (candidate): candidate is Extract<GameCommand, { type: 'play-cards' }> =>
      candidate.type === 'play-cards',
  )
  if (!command) throw new Error('Expected a legal play command')
  return command
}

export function createPendingDiscardGame(): GameState {
  const game = createSoloGameState('pending-discard')
  for (const command of getLegalCommands(game, LOCAL_PLAYER_ID)) {
    if (command.type !== 'play-cards') continue
    const transition = dispatch(game, command)
    if (!transition.accepted || transition.state.pendingDecision !== 'discard-for-damage') continue
    const hasDiscard = getLegalCommands(transition.state, LOCAL_PLAYER_ID).some(
      (candidate) => candidate.type === 'discard-for-damage',
    )
    if (hasDiscard) return transition.state
  }
  throw new Error('Expected to construct a pending discard game')
}

export function findDiscardCommand(
  game: GameState,
): Extract<GameCommand, { type: 'discard-for-damage' }> {
  const command = getLegalCommands(game, LOCAL_PLAYER_ID).find(
    (candidate): candidate is Extract<GameCommand, { type: 'discard-for-damage' }> =>
      candidate.type === 'discard-for-damage',
  )
  if (!command) throw new Error('Expected a legal discard command')
  return command
}
