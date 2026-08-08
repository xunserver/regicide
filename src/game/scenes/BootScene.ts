import * as Phaser from 'phaser'
import { IMAGE_FILES } from '../assets/manifest.ts'
import { FONT_UI, zh } from '../i18n/zh.ts'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    this.scene.start('Preload')
  }
}

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload')
  }

  preload(): void {
    const { width, height } = this.scale
    this.add.rectangle(width / 2, height / 2, 240, 14, 0x2a2420)
    const bar = this.add
      .rectangle(width / 2 - 118, height / 2, 4, 10, 0xc9a227)
      .setOrigin(0, 0.5)
    this.add
      .text(width / 2, height / 2 - 36, zh.loading, {
        fontFamily: FONT_UI,
        fontSize: '18px',
        color: '#e8dcc4',
      })
      .setOrigin(0.5)

    this.load.on('progress', (value: number) => {
      bar.width = 236 * value
    })

    for (const [key, url] of Object.entries(IMAGE_FILES)) {
      this.load.image(key, url)
    }
  }

  create(): void {
    this.scene.start('Menu')
  }
}
