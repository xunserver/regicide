import { GameBoard, GameProvider } from '@regicide/game-ui'

export function App() {
  return (
    <GameProvider>
      <GameBoard />
    </GameProvider>
  )
}
