import { useEffect, useRef } from 'react'
import { createGame } from '../game/index.ts'

/** Full-viewport Phaser host for mobile H5. */
export function GameCanvas() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let game: ReturnType<typeof createGame> | null = null
    let cancelled = false
    let tries = 0

    const start = (): void => {
      if (cancelled || game) return
      // Some WebViews (incl. MIUI) report 0×0 on the first frame.
      if (host.clientWidth < 2 || host.clientHeight < 2) {
        tries += 1
        if (tries < 60) {
          requestAnimationFrame(start)
        }
        return
      }
      game = createGame(host)
    }

    start()

    return () => {
      cancelled = true
      game?.destroy(true)
      game = null
    }
  }, [])

  return <div ref={hostRef} className="game-host" />
}
