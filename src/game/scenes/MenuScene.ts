import * as Phaser from 'phaser'
import { IMAGE_KEYS, THEME } from '../assets/manifest.ts'
import { applyHiDpiCamera, du, lockHiDpiCamera, textStyle, viewSize } from '../dpr.ts'
import { FONT_BRAND, FONT_UI, zh } from '../i18n/zh.ts'
import { HudButton } from '../ui/Hud.ts'

export class MenuScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Image
  private cardBack!: Phaser.GameObjects.Image
  private royal!: Phaser.GameObjects.Image
  private title!: Phaser.GameObjects.Text
  private tagline!: Phaser.GameObjects.Text
  private btnNew!: HudButton
  private btnContinue: HudButton | null = null
  private btnCodex!: HudButton
  private btnGallery!: HudButton

  constructor() {
    super('Menu')
  }

  create(): void {
    lockHiDpiCamera(this)

    this.bg = this.add.image(0, 0, IMAGE_KEYS.bgTable)
    this.cardBack = this.add.image(0, 0, IMAGE_KEYS.cardBack)
    this.royal = this.add.image(0, 0, IMAGE_KEYS.royalKing)

    this.title = this.add
      .text(
        0,
        0,
        zh.brand,
        textStyle(
          {
            fontFamily: FONT_BRAND,
            fontSize: '44px',
            color: THEME.gold,
            fontStyle: 'bold',
          },
          this,
        ),
      )
      .setOrigin(0.5)

    this.tagline = this.add
      .text(
        0,
        0,
        zh.tagline,
        textStyle(
          {
            fontFamily: FONT_UI,
            fontSize: '15px',
            color: THEME.mist,
          },
          this,
        ),
      )
      .setOrigin(0.5)

    this.btnNew = new HudButton(this, {
      x: 0,
      y: 0,
      label: zh.newSolo,
      width: 220,
      height: 46,
      onClick: () => {
        this.scene.start('Table', { seed: Date.now() >>> 0 })
      },
    })

    if (this.canContinue()) {
      this.btnContinue = new HudButton(this, {
        x: 0,
        y: 0,
        label: zh.continue,
        width: 220,
        height: 42,
        onClick: () => {
          this.scene.start('Table', { resume: true })
        },
      })
    }

    this.btnCodex = new HudButton(this, {
      x: 0,
      y: 0,
      label: zh.codex,
      width: 220,
      height: 42,
      onClick: () => {
        this.scene.start('Codex')
      },
    })

    this.btnGallery = new HudButton(this, {
      x: 0,
      y: 0,
      label: zh.gallery,
      width: 220,
      height: 42,
      onClick: () => {
        this.scene.start('Gallery')
      },
    })

    this.layout()
    this.scale.on('resize', this.layout, this)
  }

  private layout = (): void => {
    applyHiDpiCamera(this)
    const { width, height } = viewSize(this)
    this.bg.setPosition(width / 2, height / 2).setDisplaySize(width, height)

    const cardW = du(108, this)
    const cardH = du(150, this)
    this.cardBack.setDisplaySize(cardW, cardH).setAngle(-9)
    this.royal.setDisplaySize(cardW, cardH).setAngle(7)
    this.cardBack.setPosition(width / 2 - du(10, this), height * 0.2)
    this.royal.setPosition(width / 2 + du(14, this), height * 0.22)

    this.title.setPosition(width / 2, height * 0.4)
    this.tagline.setPosition(width / 2, height * 0.46)

    const buttons = [this.btnNew, this.btnContinue, this.btnCodex, this.btnGallery].filter(
      (b): b is HudButton => b !== null,
    )
    const startY = height * 0.56
    const gap = Math.min(du(58, this), (height * 0.38) / Math.max(buttons.length, 1))
    buttons.forEach((btn, i) => {
      btn.setPosition(width / 2, startY + i * gap)
    })
  }

  shutdown(): void {
    this.scale.off('resize', this.layout, this)
  }

  private canContinue(): boolean {
    try {
      return localStorage.getItem('regicide.solo.v1') !== null
    } catch {
      return false
    }
  }
}
