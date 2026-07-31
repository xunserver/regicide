import { describe, expect, it } from 'vitest'
import { createGame, dispatch, getLegalCommands, parseGameState } from '../src'
import type { GameEvent, GameState } from '../src'

function playToCompletion(
  playerCount: number,
  seed: string,
): {
  readonly state: GameState
  readonly events: GameEvent[]
} {
  const playerIds = Array.from({ length: playerCount }, (_, index) => `p${index + 1}`)
  let state = createGame({ playerIds, startingPlayerId: playerIds[0]!, seed })
  const events: GameEvent[] = []

  for (let step = 0; step < 500 && state.status === 'in-progress'; step += 1) {
    const commands = getLegalCommands(state, state.currentPlayerId)
    expect(commands.length).toBeGreaterThan(0)
    const result = dispatch(state, commands[0]!)
    expect(result.accepted).toBe(true)
    if (!result.accepted) throw new Error(result.reason)
    state = parseGameState(result.state)
    events.push(...result.events)
  }

  expect(state.status).not.toBe('in-progress')
  return { state, events }
}

describe('complete deterministic games', () => {
  it.each([1, 2, 3, 4])('preserves a valid snapshot through a %i-player game', (playerCount) => {
    const first = playToCompletion(playerCount, `simulation-${playerCount}`)
    const second = playToCompletion(playerCount, `simulation-${playerCount}`)

    expect(first).toEqual(second)
  })
})
