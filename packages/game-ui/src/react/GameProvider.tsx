import { useMemo, useReducer, type PropsWithChildren } from 'react'
import { createInitialSession, gameReducer, getSelectedPower } from '@regicide/game-application'
import { GameContext } from './game-context'

export function GameProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialSession)
  const selectedPower = useMemo(() => getSelectedPower(state), [state])

  return (
    <GameContext.Provider value={{ state, selectedPower, dispatch }}>
      {children}
    </GameContext.Provider>
  )
}
