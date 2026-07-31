import { createContext, type Dispatch } from 'react'
import type { GameCommand, GameSession } from '@regicide/game-application'

export interface GameContextValue {
  readonly state: GameSession
  readonly selectedValue: number
  readonly dispatch: Dispatch<GameCommand>
}

export const GameContext = createContext<GameContextValue | null>(null)
