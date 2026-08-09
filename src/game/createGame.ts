import * as Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH, THEME } from './assets/manifest.ts'
import { bindHiDpiScaler, getDpr } from './dpr.ts'
import { BootScene, PreloadScene } from './scenes/BootScene.ts'
import { TableScene } from './scenes/TableScene.ts'

export type CreateGameOptions = {
  seed?: number
  resume?: boolean
  onExitToMenu?: () => void
}

export function createGame(parent: HTMLElement, options: CreateGameOptions = {}): Phaser.Game {
  const dpr = getDpr()
  const cssW = Math.max(1, parent.clientWidth || GAME_WIDTH)
  const cssH = Math.max(1, parent.clientHeight || GAME_HEIGHT)

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    // High-DPI backing store; camera zoom keeps layout in CSS pixels.
    width: Math.round(cssW * dpr),
    height: Math.round(cssH * dpr),
    backgroundColor: THEME.ink,
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      expandParent: false,
    },
    scene: [BootScene, PreloadScene, TableScene],
    input: {
      activePointers: 2,
    },
    render: {
      antialias: true,
      antialiasGL: true,
      powerPreference: 'high-performance',
      roundPixels: false,
    },
  }

  const game = new Phaser.Game(config)
  game.registry.set('dpr', dpr)
  game.registry.set('cssWidth', cssW)
  game.registry.set('cssHeight', cssH)
  game.registry.set('tableData', {
    seed: options.resume ? undefined : (options.seed ?? (Date.now() >>> 0)),
    resume: Boolean(options.resume),
  })
  game.registry.set('onExitToMenu', options.onExitToMenu)

  const unbind = bindHiDpiScaler(game, parent)
  game.events.once(Phaser.Core.Events.DESTROY, unbind)

  ;(window as unknown as { __REGICIDE_GAME__?: Phaser.Game }).__REGICIDE_GAME__ = game
  return game
}
