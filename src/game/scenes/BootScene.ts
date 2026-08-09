import * as Phaser from 'phaser'
import { IMAGE_FILES } from '../assets/manifest.ts'
import { du, lockHiDpiCamera, textStyle, viewSize } from '../dpr.ts'
import { FONT_UI, zh } from '../i18n/zh.ts'

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    lockHiDpiCamera(this)
    this.scene.start('Preload')
  }
}

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload')
  }

  preload(): void {
    lockHiDpiCamera(this)
    const { width, height } = viewSize(this)
    this.add.rectangle(width / 2, height / 2, du(240, this), du(14, this), 0x2a2420)
    const bar = this.add
      .rectangle(width / 2 - du(118, this), height / 2, du(4, this), du(10, this), 0xc9a227)
      .setOrigin(0, 0.5)
    this.add
      .text(
        width / 2,
        height / 2 - du(36, this),
        zh.loading,
        textStyle(
          {
            fontFamily: FONT_UI,
            fontSize: '18px',
            color: '#e8dcc4',
          },
          this,
        ),
      )
      .setOrigin(0.5)

    this.load.on('progress', (value: number) => {
      bar.width = du(236, this) * value
    })

    for (const [key, url] of Object.entries(IMAGE_FILES)) {
      this.load.image(key, url)
    }
  }

  create(): void {
    this.scene.start('Menu')
  }
}
