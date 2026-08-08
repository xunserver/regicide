import * as Phaser from 'phaser'
import { IMAGE_KEYS, THEME } from '../assets/manifest.ts'
import { FONT_BRAND, FONT_UI, zh } from '../i18n/zh.ts'
import { HudButton } from '../ui/Hud.ts'

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu')
  }

  create(): void {
    const { width, height } = this.scale
    this.add.image(width / 2, height / 2, IMAGE_KEYS.bgTable).setDisplaySize(width, height)

    this.add
      .image(width / 2 - 10, height * 0.26, IMAGE_KEYS.cardBack)
      .setDisplaySize(132, 184)
      .setAngle(-9)
    this.add
      .image(width / 2 + 16, height * 0.28, IMAGE_KEYS.royalKing)
      .setDisplaySize(132, 184)
      .setAngle(7)

    this.add
      .text(width / 2, height * 0.5, zh.brand, {
        fontFamily: FONT_BRAND,
        fontSize: '48px',
        color: THEME.gold,
        fontStyle: 'bold',
      })
      .setOrigin(0.5)

    this.add
      .text(width / 2, height * 0.57, zh.tagline, {
        fontFamily: FONT_UI,
        fontSize: '16px',
        color: THEME.mist,
      })
      .setOrigin(0.5)

    new HudButton(this, {
      x: width / 2,
      y: height * 0.72,
      label: zh.newSolo,
      width: 228,
      height: 50,
      onClick: () => {
        this.scene.start('Table', { seed: Date.now() >>> 0 })
      },
    })

    if (this.canContinue()) {
      new HudButton(this, {
        x: width / 2,
        y: height * 0.81,
        label: zh.continue,
        width: 228,
        height: 46,
        onClick: () => {
          this.scene.start('Table', { resume: true })
        },
      })
    }
  }

  private canContinue(): boolean {
    try {
      return localStorage.getItem('regicide.solo.v1') !== null
    } catch {
      return false
    }
  }
}
