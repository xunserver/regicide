import { useEffect, useRef } from 'react'
import { createGame } from '../game/index.ts'

/** Full-viewport Phaser host for mobile H5. */
export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const game = createGame(host)
    return () => {
      game.destroy(true)
    }
  }, [])

  return <div ref={hostRef} className="game-host" />
}
