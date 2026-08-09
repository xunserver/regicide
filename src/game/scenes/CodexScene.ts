import * as Phaser from 'phaser'
import { IMAGE_KEYS, THEME } from '../assets/manifest.ts'
import { applyHiDpiCamera, du, lockHiDpiCamera, textStyle, viewSize } from '../dpr.ts'
import { CODEX_SECTIONS } from '../i18n/codexZh.ts'
import { FONT_BRAND, FONT_UI, zh } from '../i18n/zh.ts'
import { HudButton } from '../ui/Hud.ts'

/** Scrollable solo-rules encyclopedia. */
export class CodexScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Image
  private title!: Phaser.GameObjects.Text
  private hint!: Phaser.GameObjects.Text
  private backBtn!: HudButton
  private panel!: Phaser.GameObjects.Rectangle
  private content!: Phaser.GameObjects.Container
  private maskGfx!: Phaser.GameObjects.Graphics
  private scrollY = 0
  private contentHeight = 0
  private viewTop = 0
  private viewHeight = 0
  private contentX = 0
  private dragStartY = 0
  private dragStartScroll = 0
  private dragging = false
  private lastTextWidth = 0

  constructor() {
    super('Codex')
  }

  create(): void {
    lockHiDpiCamera(this)

    this.bg = this.add.image(0, 0, IMAGE_KEYS.bgTable)
    this.title = this.add
      .text(0, 0, zh.codex, textStyle({
        fontFamily: FONT_BRAND,
        fontSize: '28px',
        color: THEME.gold,
        fontStyle: 'bold',
      }, this))
      .setOrigin(0.5)
      .setDepth(20)

    this.hint = this.add
      .text(0, 0, zh.codexHint, textStyle({
        fontFamily: FONT_UI,
        fontSize: '13px',
        color: THEME.mist,
      }, this))
      .setOrigin(0.5)
      .setDepth(20)
      .setAlpha(0.75)

    this.backBtn = new HudButton(this, {
      x: 0,
      y: 0,
      label: zh.back,
      width: 120,
      height: 44,
      onClick: () => this.scene.start('Menu'),
    })
    this.backBtn.setDepth(20)

    this.panel = this.add
      .rectangle(0, 0, 100, 100, 0x1a1510, 0.72)
      .setStrokeStyle(1.5, 0xc9a227, 0.55)
      .setDepth(5)

    this.maskGfx = this.make.graphics({ x: 0, y: 0 })
    this.maskGfx.setDepth(6)
    this.content = this.add.container(0, 0).setDepth(7)

    this.layout()
    this.scale.on('resize', this.layout, this)

    this.input.on('pointerdown', this.onPointerDown, this)
    this.input.on('pointermove', this.onPointerMove, this)
    this.input.on('pointerup', this.onPointerUp, this)
    this.input.on('wheel', this.onWheel, this)
  }

  private rebuildContent(textWidth: number): void {
    this.content.removeAll(true)
    let y = 0

    for (const section of CODEX_SECTIONS) {
      const heading = this.add
        .text(0, y, section.title, textStyle({
          fontFamily: FONT_UI,
          fontSize: '18px',
          color: THEME.gold,
          fontStyle: 'bold',
        }, this))
        .setOrigin(0, 0)
      this.content.add(heading)
      y += heading.height + 8

      const body = this.add
        .text(0, y, section.body, textStyle({
          fontFamily: FONT_UI,
          fontSize: '14px',
          color: THEME.parchment,
          lineSpacing: 6,
          wordWrap: { width: textWidth },
          align: 'left',
        }, this))
        .setOrigin(0, 0)
      this.content.add(body)
      y += body.height + 22
    }

    this.contentHeight = y
    this.lastTextWidth = textWidth
  }

  private layout = (): void => {
    applyHiDpiCamera(this)
    const { width, height } = viewSize(this)

    this.bg.setPosition(width / 2, height / 2).setDisplaySize(width, height)
    this.title.setPosition(width / 2, du(36, this))
    this.hint.setPosition(width / 2, du(62, this))
    this.backBtn.setPosition(width / 2, height - du(40, this))

    const marginX = du(18, this)
    const panelTop = du(84, this)
    const panelBottom = height - du(78, this)
    const panelW = width - marginX * 2
    const panelH = Math.max(120, panelBottom - panelTop)
    const textWidth = Math.max(du(160, this), panelW - du(28, this))

    this.panel.setPosition(width / 2, panelTop + panelH / 2)
    this.panel.setSize(panelW, panelH)

    this.viewTop = panelTop + du(14, this)
    this.viewHeight = panelH - du(28, this)
    this.contentX = marginX + du(14, this)

    if (Math.abs(textWidth - this.lastTextWidth) > 1 || this.content.list.length === 0) {
      this.rebuildContent(textWidth)
    }

    this.maskGfx.clear()
    this.maskGfx.fillStyle(0xffffff)
    this.maskGfx.fillRect(marginX + du(8, this), this.viewTop, panelW - du(16, this), this.viewHeight)
    this.content.setMask(this.maskGfx.createGeometryMask())

    this.scrollY = Phaser.Math.Clamp(this.scrollY, this.minScroll(), 0)
    this.content.setPosition(this.contentX, this.viewTop + this.scrollY)
  }

  private minScroll(): number {
    return Math.min(0, this.viewHeight - this.contentHeight)
  }

  private onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    const y = pointer.worldY
    if (y < this.viewTop || y > this.viewTop + this.viewHeight) return
    this.dragging = true
    this.dragStartY = y
    this.dragStartScroll = this.scrollY
  }

  private onPointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.dragging || !pointer.isDown) return
    const dy = pointer.worldY - this.dragStartY
    this.scrollY = Phaser.Math.Clamp(this.dragStartScroll + dy, this.minScroll(), 0)
    this.content.y = this.viewTop + this.scrollY
  }

  private onPointerUp = (): void => {
    this.dragging = false
  }

  private onWheel = (
    _pointer: Phaser.Input.Pointer,
    _over: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void => {
    this.scrollY = Phaser.Math.Clamp(this.scrollY - deltaY * 0.45, this.minScroll(), 0)
    this.content.y = this.viewTop + this.scrollY
  }

  shutdown(): void {
    this.scale.off('resize', this.layout, this)
    this.input.off('pointerdown', this.onPointerDown, this)
    this.input.off('pointermove', this.onPointerMove, this)
    this.input.off('pointerup', this.onPointerUp, this)
    this.input.off('wheel', this.onWheel, this)
  }
}
