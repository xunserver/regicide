import * as Phaser from 'phaser'
import { IMAGE_KEYS, THEME } from '../assets/manifest.ts'
import { FONT_UI } from '../i18n/zh.ts'

export type HudButtonConfig = {
  x: number
  y: number
  label: string
  width?: number
  height?: number
  enabled?: boolean
  /** false = 无底板金框，仅文字+热区（用于顶栏菜单等） */
  framed?: boolean
  onClick: () => void
}

/**
 * 动作按钮。默认金框；framed:false 时无框，热区仍覆盖整块点击范围。
 */
export class HudButton extends Phaser.GameObjects.Container {
  private readonly plate: Phaser.GameObjects.Rectangle | null
  private readonly label: Phaser.GameObjects.Text
  private readonly hitZone: Phaser.GameObjects.Zone
  private readonly framed: boolean
  private enabled = true

  constructor(scene: Phaser.Scene, config: HudButtonConfig) {
    super(scene, config.x, config.y)
    const w = config.width ?? 108
    const h = config.height ?? 44
    this.framed = config.framed !== false

    this.plate = this.framed
      ? scene.add
          .rectangle(0, 0, w, h, 0x1a1510, 0.9)
          .setStrokeStyle(1.5, 0xc9a227, 0.95)
      : null

    this.label = scene.add
      .text(0, 0, config.label, {
        fontFamily: FONT_UI,
        fontSize: this.framed ? '15px' : '14px',
        color: THEME.parchment,
        align: 'center',
      })
      .setOrigin(0.5)

    const children: Phaser.GameObjects.GameObject[] = []
    if (this.plate) children.push(this.plate)

    if (this.framed) {
      const icon = scene.add.image(0, 0, IMAGE_KEYS.uiButton).setDisplaySize(18, 18)
      const gap = 8
      const contentW = icon.displayWidth + gap + this.label.width
      icon.setPosition(-contentW / 2 + icon.displayWidth / 2, 0)
      this.label.setPosition(contentW / 2 - this.label.width / 2, 0)
      children.push(icon, this.label)
    } else {
      this.label.setPosition(0, 0)
      children.push(this.label)
    }

    this.hitZone = scene.add.zone(0, 0, w, h).setOrigin(0.5)
    this.hitZone.setInteractive({ useHandCursor: true })
    children.push(this.hitZone)
    this.add(children)

    this.hitZone.on('pointerdown', () => {
      if (!this.enabled) return
      this.setScale(0.97)
    })
    this.hitZone.on('pointerup', () => {
      this.setScale(1)
      if (!this.enabled) return
      config.onClick()
    })
    this.hitZone.on('pointerover', () => {
      if (!this.enabled) return
      if (this.plate) this.plate.setStrokeStyle(2, 0xe0c35a, 1)
      else this.label.setColor(THEME.gold)
    })
    this.hitZone.on('pointerout', () => {
      this.setScale(1)
      if (this.plate) this.plate.setStrokeStyle(1.5, 0xc9a227, 0.95)
      else this.label.setColor(THEME.parchment)
    })

    this.setEnabled(config.enabled ?? true)
    scene.add.existing(this)
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    this.setAlpha(on ? 1 : 0.38)
    this.plate?.setFillStyle(0x1a1510, on ? 0.9 : 0.55)
    if (on) {
      this.hitZone.setInteractive({ useHandCursor: true })
    } else {
      this.hitZone.disableInteractive()
    }
  }

  setLabel(text: string): void {
    this.label.setText(text)
  }
}

/** 无框状态文案，仅文字 + 轻阴影，默认水平居中放置。 */
export class StatusPlaque extends Phaser.GameObjects.Container {
  private readonly text: Phaser.GameObjects.Text

  constructor(scene: Phaser.Scene, x: number, y: number, _width = 340) {
    super(scene, x, y)
    this.text = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_UI,
        fontSize: '17px',
        color: THEME.parchment,
        align: 'center',
        stroke: '#1a1510',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
    this.add(this.text)
    scene.add.existing(this)
  }

  setMessage(message: string): void {
    this.text.setText(message)
  }
}
