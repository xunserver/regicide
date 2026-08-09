import * as Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from './assets/manifest.ts'
import { bindHiDpiScaler, getDpr } from './dpr.ts'
import { BootScene, PreloadScene } from './scenes/BootScene.ts'
import { CodexScene } from './scenes/CodexScene.ts'
import { GalleryScene } from './scenes/GalleryScene.ts'
import { MenuScene } from './scenes/MenuScene.ts'
import { TableScene } from './scenes/TableScene.ts'

export function createGame(parent: HTMLElement): Phaser.Game {
  const dpr = getDpr()
  const cssW = Math.max(1, parent.clientWidth || GAME_WIDTH)
  const cssH = Math.max(1, parent.clientHeight || GAME_HEIGHT)

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    // High-DPI backing store; camera zoom keeps layout in CSS pixels.
    width: Math.round(cssW * dpr),
    height: Math.round(cssH * dpr),
    backgroundColor: '#1a1510',
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      expandParent: false,
    },
    scene: [BootScene, PreloadScene, MenuScene, TableScene, CodexScene, GalleryScene],
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

  const unbind = bindHiDpiScaler(game, parent)
  game.events.once(Phaser.Core.Events.DESTROY, unbind)

  ;(window as unknown as { __REGICIDE_GAME__?: Phaser.Game }).__REGICIDE_GAME__ = game
  return game
}
