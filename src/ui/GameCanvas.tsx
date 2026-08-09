import { useEffect, useRef } from 'react'
import type { createGame } from '../game/index.ts'

export type TableLaunch = {
  seed?: number
  resume?: boolean
}

type Props = {
  launch: TableLaunch
  onExitToMenu: () => void
}

type GameInstance = ReturnType<typeof createGame>

/** Phaser host — only mounted while playing the table. */
export function GameCanvas({ launch, onExitToMenu }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const exitRef = useRef(onExitToMenu)
  exitRef.current = onExitToMenu

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let game: GameInstance | null = null
    let cancelled = false
    let tries = 0

    const start = async (): Promise<void> => {
      if (cancelled || game) return
      // Some WebViews (incl. MIUI) report 0×0 on the first frame.
      if (host.clientWidth < 2 || host.clientHeight < 2) {
        tries += 1
        if (tries < 60) {
          requestAnimationFrame(() => {
            void start()
          })
        }
        return
      }

      const { createGame: boot } = await import('../game/index.ts')
      if (cancelled) return

      game = boot(host, {
        seed: launch.seed,
        resume: launch.resume,
        onExitToMenu: () => exitRef.current(),
      })
    }

    void start()

    return () => {
      cancelled = true
      game?.destroy(true)
      game = null
    }
  }, [launch.resume, launch.seed])

  return <div ref={hostRef} className="game-host" />
}
