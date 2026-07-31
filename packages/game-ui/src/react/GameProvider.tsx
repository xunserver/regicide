import { useMemo, useReducer, type PropsWithChildren } from 'react'
import { createInitialSession, gameReducer, getSelectedValue } from '@regicide/game-application'
import { GameContext } from './game-context'

export function GameProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialSession)
  const selectedValue = useMemo(() => getSelectedValue(state), [state])

  return (
    <GameContext.Provider value={{ state, selectedValue, dispatch }}>
      {children}
    </GameContext.Provider>
  )
}
