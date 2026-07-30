import { createContext, type Dispatch } from 'react'
import type { GameCommand, GameSession } from '@regicide/game-application'

export interface GameContextValue {
  state: GameSession
  selectedPower: number
  dispatch: Dispatch<GameCommand>
}

export const GameContext = createContext<GameContextValue | null>(null)
