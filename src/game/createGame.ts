import * as Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from './assets/manifest.ts'
import { BootScene, PreloadScene } from './scenes/BootScene.ts'
import { MenuScene } from './scenes/MenuScene.ts'
import { TableScene } from './scenes/TableScene.ts'

export function createGame(parent: HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#1a1510',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [BootScene, PreloadScene, MenuScene, TableScene],
    input: {
      activePointers: 2,
    },
    render: {
      antialias: true,
      powerPreference: 'high-performance',
    },
  }

  const game = new Phaser.Game(config)
  // Debug hook for Playwright / browser QA
  ;(window as unknown as { __REGICIDE_GAME__?: Phaser.Game }).__REGICIDE_GAME__ = game
  return game
}
