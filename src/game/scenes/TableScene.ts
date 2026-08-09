import * as Phaser from 'phaser'
import {
  createController,
  type GameController,
  type SessionView,
} from '../../orchestration/index.ts'
import {
  ENEMY_CARD_H,
  ENEMY_CARD_W,
  IMAGE_KEYS,
  THEME,
} from '../assets/manifest.ts'
import { applyHiDpiCamera, du, getDpr, lockHiDpiCamera, textStyle, viewSize } from '../dpr.ts'
import {
  FONT_UI,
  phaseNameZh,
  rankNameZh,
  suitCodeZh,
  suitNameZh,
  tError,
  victoryNameZh,
  zh,
} from '../i18n/zh.ts'
import { bindSfxUnlock } from '../audio/Sfx.ts'
import { cancelSpeech } from '../audio/Voice.ts'
import { announceBoss, playSuitFx } from '../fx/SuitFx.ts'
import { CardView } from '../objects/CardView.ts'
import { HudButton, StatusPlaque } from '../ui/Hud.ts'

type TableData = {
  seed?: number
  resume?: boolean
}

/** Fan card centers across width without clipping left/right card edges. */
function fanCenters(
  count: number,
  width: number,
  cardW: number,
  maxStep: number,
  edgePad = 10,
): { step: number; startX: number } {
  if (count <= 1) return { step: 0, startX: width / 2 }
  const sideInset = cardW / 2 + edgePad
  const maxSpan = Math.max(0, width - sideInset * 2)
  const step = Math.min(maxStep, maxSpan / (count - 1))
  const span = step * (count - 1)
  return { step, startX: width / 2 - span / 2 }
}

export class TableScene extends Phaser.Scene {
  private controller!: GameController
  private unsubscribe: (() => void) | null = null
  private handViews: CardView[] = []
  private enemyView: CardView | null = null
  private bg!: Phaser.GameObjects.Image
  private plaque!: StatusPlaque
  private menuBtn!: HudButton
  private enemyStats!: Phaser.GameObjects.Text
  private hpBarBg!: Phaser.GameObjects.Rectangle
  private hpBarFill!: Phaser.GameObjects.Rectangle
  private metaText!: Phaser.GameObjects.Text
  private previewText!: Phaser.GameObjects.Text
  private jesterIcons: Phaser.GameObjects.Image[] = []
  private btnPlay!: HudButton
  private btnYield!: HudButton
  private btnDefend!: HudButton
  private btnJester!: HudButton
  private btnClear!: HudButton
  private overlayText: Phaser.GameObjects.Text | null = null
  private overlayBtn: HudButton | null = null
  private enemyCenterY = 180
  private enemyCenterX = 195
  private jesterIconY = 400
  private handY = 600
  private resizeTimer: number | null = null

  constructor() {
    super('Table')
  }

  init(data: TableData): void {
    this.controller = createController({
      seed: data.seed,
      storage: typeof localStorage !== 'undefined' ? localStorage : null,
    })
    if (data.resume) {
      this.controller.load()
    }
  }

  create(): void {
    // 防止 Menu 未正确关闭导致双场景抢输入
    if (this.scene.isActive('Menu')) {
      this.scene.stop('Menu')
    }

    bindSfxUnlock(this.game.canvas ?? window)
    lockHiDpiCamera(this)
    const { width, height } = viewSize(this)
    this.bg = this.add.image(width / 2, height / 2, IMAGE_KEYS.bgTable)

    this.plaque = new StatusPlaque(this, width / 2, du(28, this))
    this.plaque.setDepth(30)

    this.menuBtn = new HudButton(this, {
      x: width - du(46, this),
      y: du(28, this),
      label: zh.menu,
      width: 72,
      height: 36,
      framed: false,
      onClick: () => {
        this.cleanup()
        this.scene.stop('Table')
        const onExit = this.game.registry.get('onExitToMenu') as (() => void) | undefined
        onExit?.()
      },
    })
    this.menuBtn.setDepth(30)

    this.hpBarBg = this.add
      .rectangle(0, 0, du(ENEMY_CARD_W, this), du(8, this), 0x2a2420, 0.95)
      .setDepth(6)
    this.hpBarFill = this.add
      .rectangle(0, 0, du(ENEMY_CARD_W, this), du(8, this), 0x8f1d1d, 1)
      .setOrigin(0, 0.5)
      .setDepth(7)

    this.enemyStats = this.add
      .text(
        0,
        0,
        '',
        textStyle(
          {
            fontFamily: FONT_UI,
            fontSize: '15px',
            color: THEME.parchment,
            align: 'left',
            lineSpacing: 6,
          },
          this,
        ),
      )
      .setOrigin(0, 0.5)
      .setDepth(8)

    this.metaText = this.add
      .text(
        0,
        0,
        '',
        textStyle(
          {
            fontFamily: FONT_UI,
            fontSize: '15px',
            color: THEME.mist,
            lineSpacing: 6,
          },
          this,
        ),
      )
      .setOrigin(0, 0.5)
      .setDepth(8)

    this.previewText = this.add
      .text(
        0,
        0,
        '',
        textStyle(
          {
            fontFamily: FONT_UI,
            fontSize: '15px',
            color: THEME.gold,
            align: 'center',
          },
          this,
        ),
      )
      .setOrigin(0.5)
      .setDepth(8)

    this.btnYield = new HudButton(this, {
      x: 0,
      y: 0,
      label: zh.yield,
      width: 108,
      onClick: () => {
        const commands = this.controller.getView().commands
        if (commands.canEndTurn) {
          this.intent({ type: 'END_TURN' })
          return
        }
        this.intent({ type: 'YIELD' })
      },
    })
    this.btnJester = new HudButton(this, {
      x: 0,
      y: 0,
      label: zh.jester,
      width: 108,
      onClick: () => this.intent({ type: 'FLIP_JESTER' }),
    })
    this.btnClear = new HudButton(this, {
      x: 0,
      y: 0,
      label: zh.clear,
      width: 108,
      onClick: () => this.intent({ type: 'CLEAR_SELECTION' }),
    })
    this.btnPlay = new HudButton(this, {
      x: 0,
      y: 0,
      label: zh.play,
      width: 108,
      onClick: () => this.intent({ type: 'CONFIRM_PLAY' }),
    })
    this.btnDefend = new HudButton(this, {
      x: 0,
      y: 0,
      label: zh.defend,
      width: 108,
      onClick: () => this.intent({ type: 'CONFIRM_DEFEND' }),
    })

    this.layoutChrome()
    this.scale.on('resize', this.onResize, this)

    this.unsubscribe = this.controller.subscribe(() => this.renderView())
    this.renderView()

    // Opening royal entrance (menu/play-again click usually unlocked audio already).
    const opening = this.controller.getView().enemy?.card
    if (opening) {
      this.time.delayedCall(280, () =>
        announceBoss(
          this,
          {
            enemyX: this.enemyCenterX,
            enemyY: this.enemyCenterY,
            handY: this.handY,
            centerX: this.enemyCenterX,
          },
          opening,
        ),
      )
    }
  }

  private onResize = (): void => {
    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer)
    }
    this.resizeTimer = window.setTimeout(() => {
      this.resizeTimer = null
      this.layoutChrome()
      this.renderView()
    }, 50)
  }

  /** Position chrome against current canvas size (device pixels). */
  private layoutChrome(): void {
    applyHiDpiCamera(this)
    const { width, height } = viewSize(this)
    this.bg.setPosition(width / 2, height / 2).setDisplaySize(width, height)

    const topY = du(28, this)
    const menuW = du(72, this)
    this.plaque.setPosition(width / 2, topY)
    this.menuBtn.setPosition(width - menuW / 2 - du(10, this), topY)

    const enemyW = du(ENEMY_CARD_W, this)
    const enemyH = du(ENEMY_CARD_H, this)
    const topBarBottom = topY + du(14, this)
    const enemyCenterY = topBarBottom + du(16, this) + enemyH / 2
    const enemyCenterX = width / 2
    const enemyLeft = enemyCenterX - enemyW / 2
    const enemyRight = enemyCenterX + enemyW / 2
    const enemyBottom = enemyCenterY + enemyH / 2
    const sideGap = du(8, this)
    const metaX = du(10, this)
    const metaColW = Math.max(du(72, this), enemyLeft - sideGap - metaX)
    const statsX = enemyRight + sideGap
    const hpY = enemyBottom + du(10, this)
    const handY = height - du(236, this)
    const previewY = handY - du(96, this)

    this.enemyCenterX = enemyCenterX
    this.enemyCenterY = enemyCenterY
    this.jesterIconY = enemyBottom - du(22, this)
    this.handY = handY

    this.hpBarBg.setPosition(enemyCenterX, hpY)
    this.hpBarBg.setSize(enemyW, du(8, this))
    this.hpBarFill.setPosition(enemyCenterX - enemyW / 2, hpY)
    this.hpBarFill.setSize(enemyW, du(8, this))

    this.enemyStats.setPosition(statsX, enemyCenterY)
    this.enemyStats.setWordWrapWidth(Math.max(du(72, this), width - statsX - du(10, this)))

    this.metaText.setPosition(metaX, enemyCenterY)
    this.metaText.setWordWrapWidth(metaColW)

    this.previewText.setPosition(width / 2, previewY)

    const ySecondary = height - du(122, this)
    const yPrimary = height - du(66, this)
    this.btnYield.setPosition(width * 0.18, ySecondary)
    this.btnJester.setPosition(width * 0.5, ySecondary)
    this.btnClear.setPosition(width * 0.82, ySecondary)
    this.btnPlay.setPosition(width * 0.32, yPrimary)
    this.btnDefend.setPosition(width * 0.68, yPrimary)

    if (this.overlayText) {
      this.overlayText.setPosition(width / 2, height * 0.4)
    }
    if (this.overlayBtn) {
      this.overlayBtn.setPosition(width / 2, height * 0.54)
    }
  }

  private intent(intent: Parameters<GameController['dispatch']>[0]): void {
    const result = this.controller.dispatch(intent)
    if (!result.ok) {
      this.plaque.setMessage(tError(result.error))
      this.cameras.main.shake(80, 0.004)
      return
    }

    // Suit / combat feedback after state has re-rendered via subscribe.
    if (
      intent.type === 'CONFIRM_PLAY' ||
      intent.type === 'CONFIRM_DEFEND' ||
      intent.type === 'YIELD' ||
      intent.type === 'END_TURN' ||
      intent.type === 'FLIP_JESTER'
    ) {
      playSuitFx({
        scene: this,
        events: result.events,
        anchors: {
          enemyX: this.enemyCenterX,
          enemyY: this.enemyCenterY,
          handY: this.handY,
          centerX: this.enemyCenterX,
        },
      })
    }
  }

  private renderView(): void {
    const view = this.controller.getView()
    this.renderEnemy(view)
    this.renderHand(view)
    this.renderMeta(view)
    this.renderCommands(view)
    this.renderEndOverlay(view)
  }

  private renderEnemy(view: SessionView): void {
    if (this.enemyView) {
      this.enemyView.destroy(true)
      this.enemyView = null
    }

    if (!view.enemy) {
      this.enemyStats.setText('')
      this.hpBarBg.setVisible(false)
      this.hpBarFill.setVisible(false)
      if (view.phase === 'won' && view.victory) {
        this.plaque.setMessage(`${zh.victory} — ${victoryNameZh(view.victory)}`)
      } else {
        this.plaque.setMessage(tError(view.defeatReason ?? zh.defeat))
      }
      return
    }

    this.hpBarBg.setVisible(true)
    this.hpBarFill.setVisible(true)

    this.enemyView = new CardView(this, view.enemy.card, {
      width: ENEMY_CARD_W,
      height: ENEMY_CARD_H,
      interactive: false,
    })
    this.enemyView.setPosition(this.enemyCenterX, this.enemyCenterY)
    this.enemyView.setDepth(5)

    const e = view.enemy
    const ratio = Math.max(0, Math.min(1, e.remainingHealth / e.health))
    this.hpBarFill.width = du(ENEMY_CARD_W, this) * ratio
    this.hpBarFill.setFillStyle(ratio > 0.35 ? 0x8f1d1d : 0xb45309)

    this.enemyStats.setText(
      [
        `${suitNameZh(e.card.suit)}·${rankNameZh(e.card.rank)} ${suitCodeZh(e.card.suit)}`,
        `${zh.hp} ${e.remainingHealth} / ${e.health}`,
        `${zh.atk} ${e.incomingDamage}`,
        `${zh.base}${e.attack} − ${zh.shield}${e.shield}`,
      ].join('\n'),
    )
  }

  private renderHand(view: SessionView): void {
    for (const v of this.handViews) v.destroy(true)
    this.handViews = []

    const { width } = viewSize(this)
    const cards = view.hand
    const n = cards.length
    if (n === 0) return

    const cardWDesign = 58
    const cardHDesign = 84
    const cardW = du(cardWDesign, this)
    const { step, startX } = fanCenters(n, width, cardW, du(54, this), du(10, this))
    const y = this.handY

    cards.forEach((card, index) => {
      const isLast = index === n - 1
      const hitDesign = isLast ? cardWDesign : Math.max(28, Math.min(cardWDesign, step / getDpr(this)))
      const viewCard = new CardView(this, card, {
        width: cardWDesign,
        height: cardHDesign,
        hitWidth: hitDesign,
      })
      const x = n === 1 ? width / 2 : startX + index * step
      viewCard.setPosition(x, y)
      viewCard.setDepth(20 + index)
      if (view.selection.includes(card.id)) {
        viewCard.y = y - du(24, this)
        viewCard.setSelected(true)
      }
      viewCard.on('card-tap', (cardId: string) => {
        this.intent({ type: 'TOGGLE_CARD', cardId })
      })
      this.handViews.push(viewCard)
    })
  }

  private renderMeta(view: SessionView): void {
    const { width } = viewSize(this)
    this.metaText.setText(
      [
        `阶段：${phaseNameZh(view.phase)}`,
        `${zh.tavern} ${view.tavernCount}`,
        `${zh.discard} ${view.discardCount}`,
        `${zh.castleLeft} ${view.castleRemaining}`,
        `${zh.fallen} ${view.enemiesDefeated}`,
        `${zh.jesters} ${view.jestersRemaining}/2`,
      ].join('\n'),
    )

    for (const icon of this.jesterIcons) icon.destroy()
    this.jesterIcons = []
    for (let i = 0; i < view.jestersRemaining; i += 1) {
      const icon = this.add
        .image(width - du(34, this) - i * du(36, this), this.jesterIconY, IMAGE_KEYS.jester)
        .setDisplaySize(du(32, this), du(44, this))
        .setAlpha(0.95)
      this.jesterIcons.push(icon)
    }

    if (view.phase === 'play' && view.playPreview) {
      if (view.playPreview.ok) {
        const immune =
          view.playPreview.immuneSuits.length > 0
            ? ` · ${zh.immune}${view.playPreview.immuneSuits.map((s) => suitCodeZh(s)).join('')}`
            : ''
        this.previewText.setText(
          `${zh.attack} ${view.playPreview.attackValue} → ${zh.damage} ${view.playPreview.damage}${immune}`,
        )
      } else {
        this.previewText.setText(tError(view.playPreview.error))
      }
      this.plaque.setMessage(zh.yourTurn)
    } else if (view.phase === 'defend' && view.defendPreview) {
      const d = view.defendPreview
      this.previewText.setText(
        `${zh.block} ${d.selectedValue}/${d.required}` +
          (d.enough ? ` · ${zh.ready}` : ` · ${zh.needMore} ${d.remaining}`),
      )
      this.plaque.setMessage(zh.enemyStrikes)
    } else if (view.phase === 'play') {
      this.previewText.setText(
        view.commands.canEndTurn ? zh.keepPlayingHint : zh.selectHint,
      )
      this.plaque.setMessage(zh.yourTurn)
    } else {
      this.previewText.setText('')
    }
  }

  private renderCommands(view: SessionView): void {
    const c = view.commands
    this.btnPlay.setEnabled(c.canConfirmPlay)
    this.btnDefend.setEnabled(c.canConfirmDefend)
    if (c.canEndTurn) {
      this.btnYield.setLabel(zh.endTurn)
      this.btnYield.setEnabled(true)
    } else {
      this.btnYield.setLabel(zh.yield)
      this.btnYield.setEnabled(c.canYield)
    }
    this.btnJester.setEnabled(c.canFlipJester)
  }

  private renderEndOverlay(view: SessionView): void {
    if (view.phase !== 'won' && view.phase !== 'lost') {
      this.overlayText?.destroy()
      this.overlayBtn?.destroy()
      this.overlayText = null
      this.overlayBtn = null
      return
    }

    if (this.overlayText) return
    const { width, height } = viewSize(this)
    const msg =
      view.phase === 'won' && view.victory
        ? `${zh.victory}\n${victoryNameZh(view.victory)}`
        : `${zh.defeat}\n${tError(view.defeatReason ?? '')}`

    this.overlayText = this.add
      .text(
        width / 2,
        height * 0.4,
        msg,
        textStyle(
          {
            fontFamily: FONT_UI,
            fontSize: '28px',
            color: THEME.gold,
            align: 'center',
            backgroundColor: '#000000aa',
            padding: { x: 18, y: 14 },
          },
          this,
        ),
      )
      .setOrigin(0.5)
      .setDepth(100)

    this.overlayBtn = new HudButton(this, {
      x: width / 2,
      y: height * 0.54,
      label: zh.playAgain,
      width: 180,
      height: 48,
      onClick: () => {
        this.cleanup()
        this.scene.stop('Table')
        this.scene.start('Table', { seed: Date.now() >>> 0 })
      },
    })
    this.overlayBtn.setDepth(101)
  }

  private cleanup(): void {
    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer)
      this.resizeTimer = null
    }
    this.scale.off('resize', this.onResize, this)
    this.unsubscribe?.()
    this.unsubscribe = null
    cancelSpeech()
  }

  shutdown(): void {
    this.cleanup()
  }
}
