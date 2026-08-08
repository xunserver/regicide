import * as Phaser from 'phaser'
import { IMAGE_KEYS, THEME } from '../assets/manifest.ts'
import { applyHiDpiCamera, du, lockHiDpiCamera, textStyle, viewSize } from '../dpr.ts'
import { buildGalleryCatalog, type GalleryEntry } from '../gallery/catalog.ts'
import { FONT_BRAND, FONT_UI, zh } from '../i18n/zh.ts'
import { CardView } from '../objects/CardView.ts'
import { HudButton } from '../ui/Hud.ts'

/** Card appreciation: fullscreen single-card browser. */
export class GalleryScene extends Phaser.Scene {
  private readonly catalog = buildGalleryCatalog()
  private index = 0

  private bg!: Phaser.GameObjects.Image
  private title!: Phaser.GameObjects.Text
  private hint!: Phaser.GameObjects.Text
  private captionTitle!: Phaser.GameObjects.Text
  private captionSub!: Phaser.GameObjects.Text
  private captionBody!: Phaser.GameObjects.Text
  private counter!: Phaser.GameObjects.Text

  private btnBack!: HudButton
  private btnPrev!: HudButton
  private btnNext!: HudButton

  private focusRoot!: Phaser.GameObjects.Container
  private focusCardHost!: Phaser.GameObjects.Container

  private dragStartX = 0
  private dragging = false

  constructor() {
    super('Gallery')
  }

  create(): void {
    lockHiDpiCamera(this)

    this.bg = this.add.image(0, 0, IMAGE_KEYS.bgTable)
    this.title = this.add
      .text(0, 0, zh.gallery, textStyle({
        fontFamily: FONT_BRAND,
        fontSize: '26px',
        color: THEME.gold,
        fontStyle: 'bold',
      }, this))
      .setOrigin(0.5)
      .setDepth(30)

    this.hint = this.add
      .text(0, 0, zh.galleryHint, textStyle({
        fontFamily: FONT_UI,
        fontSize: '13px',
        color: THEME.mist,
      }, this))
      .setOrigin(0.5)
      .setDepth(30)
      .setAlpha(0.8)

    this.btnBack = new HudButton(this, {
      x: 0,
      y: 0,
      label: zh.back,
      width: 108,
      height: 40,
      onClick: () => this.scene.start('Menu'),
    })
    this.btnBack.setDepth(30)

    this.btnPrev = new HudButton(this, {
      x: 0,
      y: 0,
      label: '‹',
      width: 56,
      height: 44,
      onClick: () => this.step(-1),
    })
    this.btnPrev.setDepth(30)

    this.btnNext = new HudButton(this, {
      x: 0,
      y: 0,
      label: '›',
      width: 56,
      height: 44,
      onClick: () => this.step(1),
    })
    this.btnNext.setDepth(30)

    this.focusRoot = this.add.container(0, 0).setDepth(10)
    this.focusCardHost = this.add.container(0, 0)
    this.focusRoot.add(this.focusCardHost)

    this.captionTitle = this.add
      .text(0, 0, '', textStyle({
        fontFamily: FONT_UI,
        fontSize: '22px',
        color: THEME.gold,
        fontStyle: 'bold',
        align: 'center',
      }, this))
      .setOrigin(0.5)
    this.captionSub = this.add
      .text(0, 0, '', textStyle({
        fontFamily: FONT_UI,
        fontSize: '14px',
        color: THEME.mist,
        align: 'center',
      }, this))
      .setOrigin(0.5)
    this.captionBody = this.add
      .text(0, 0, '', textStyle({
        fontFamily: FONT_UI,
        fontSize: '14px',
        color: THEME.parchment,
        align: 'center',
        lineSpacing: 5,
        wordWrap: { width: du(320, this) },
      }, this))
      .setOrigin(0.5, 0)
    this.counter = this.add
      .text(0, 0, '', textStyle({
        fontFamily: FONT_UI,
        fontSize: '13px',
        color: THEME.mist,
      }, this))
      .setOrigin(0.5)

    this.focusRoot.add([this.captionTitle, this.captionSub, this.captionBody, this.counter])

    this.layout()
    this.showCard()
    this.scale.on('resize', this.layout, this)

    this.input.on('pointerdown', this.onPointerDown, this)
    this.input.on('pointerup', this.onPointerUp, this)
  }

  private step(delta: number): void {
    const n = this.catalog.length
    this.index = (this.index + delta + n) % n
    this.showCard()
  }

  private showCard(): void {
    const entry = this.catalog[this.index]!
    this.focusCardHost.removeAll(true)
    const { width, height, dpr } = viewSize(this)
    const cardHDesign = Math.min(380, (height / dpr) * 0.44)
    const cardWDesign = cardHDesign * (68 / 96)
    this.focusCardHost.add(this.createEntryVisual(entry, cardWDesign, cardHDesign))

    this.captionTitle.setText(entry.title)
    this.captionSub.setText(entry.subtitle)
    this.captionBody.setText(entry.blurb)
    this.captionBody.setWordWrapWidth(Math.max(du(200, this), width - du(48, this)))
    this.counter.setText(`${this.index + 1} / ${this.catalog.length}`)
  }

  private createEntryVisual(
    entry: GalleryEntry,
    wDesign: number,
    hDesign: number,
  ): Phaser.GameObjects.GameObject {
    if (entry.kind === 'card' && entry.card) {
      return new CardView(this, entry.card, {
        width: wDesign,
        height: hDesign,
        interactive: false,
      })
    }
    const w = du(wDesign, this)
    const h = du(hDesign, this)
    if (entry.kind === 'jester') {
      return this.add.image(0, 0, IMAGE_KEYS.jester).setDisplaySize(w * 0.85, h * 0.85)
    }
    return this.add.image(0, 0, IMAGE_KEYS.cardBack).setDisplaySize(w, h)
  }

  private layout = (): void => {
    applyHiDpiCamera(this)
    const { width, height } = viewSize(this)

    this.bg.setPosition(width / 2, height / 2).setDisplaySize(width, height)
    this.title.setPosition(width / 2, du(32, this))
    this.hint.setPosition(width / 2, du(58, this))
    this.btnBack.setPosition(width / 2, height - du(36, this))

    const cardY = height * 0.36
    this.focusRoot.setPosition(width / 2, 0)
    this.focusCardHost.setPosition(0, cardY)
    this.captionTitle.setPosition(0, cardY + height * 0.24)
    this.captionSub.setPosition(0, cardY + height * 0.24 + du(28, this))
    this.captionBody.setPosition(0, cardY + height * 0.24 + du(52, this))
    this.captionBody.setWordWrapWidth(Math.max(du(200, this), width - du(48, this)))
    this.counter.setPosition(0, height - du(86, this))

    this.btnPrev.setPosition(du(36, this), cardY)
    this.btnNext.setPosition(width - du(36, this), cardY)

    this.showCard()
  }

  private onPointerDown = (pointer: Phaser.Input.Pointer): void => {
    const { height } = viewSize(this)
    const cardY = height * 0.36
    if (Math.abs(pointer.worldY - cardY) > height * 0.22) return
    this.dragging = true
    this.dragStartX = pointer.worldX
  }

  private onPointerUp = (pointer: Phaser.Input.Pointer): void => {
    if (!this.dragging) return
    const dx = pointer.worldX - this.dragStartX
    this.dragging = false
    if (dx <= -48) this.step(1)
    else if (dx >= 48) this.step(-1)
  }

  shutdown(): void {
    this.scale.off('resize', this.layout, this)
    this.input.off('pointerdown', this.onPointerDown, this)
    this.input.off('pointerup', this.onPointerUp, this)
  }
}
