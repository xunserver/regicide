import * as Phaser from 'phaser'
import {
  createController,
  type GameController,
  type SessionView,
} from '../../orchestration/index.ts'
import {
  CARD_H,
  CARD_W,
  ENEMY_CARD_H,
  ENEMY_CARD_W,
  IMAGE_KEYS,
  THEME,
} from '../assets/manifest.ts'
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
import { CardView } from '../objects/CardView.ts'
import { HudButton, StatusPlaque } from '../ui/Hud.ts'

type TableData = {
  seed?: number
  resume?: boolean
}

export class TableScene extends Phaser.Scene {
  private controller!: GameController
  private unsubscribe: (() => void) | null = null
  private handViews: CardView[] = []
  private playAreaViews: CardView[] = []
  private enemyView: CardView | null = null
  private plaque!: StatusPlaque
  private enemyStats!: Phaser.GameObjects.Text
  private hpBarBg!: Phaser.GameObjects.Rectangle
  private hpBarFill!: Phaser.GameObjects.Rectangle
  private metaText!: Phaser.GameObjects.Text
  private previewText!: Phaser.GameObjects.Text
  private playAreaHint!: Phaser.GameObjects.Text
  private jesterIcons: Phaser.GameObjects.Image[] = []
  private btnPlay!: HudButton
  private btnYield!: HudButton
  private btnDefend!: HudButton
  private btnJester!: HudButton
  private overlayText: Phaser.GameObjects.Text | null = null
  private overlayBtn: HudButton | null = null
  private enemyCenterY = 180
  private enemyCenterX = 195
  private jesterIconY = 400
  private playAreaY = 430

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

    const { width, height } = this.scale
    this.add.image(width / 2, height / 2, IMAGE_KEYS.bgTable).setDisplaySize(width, height)

    // 顶栏：状态文案屏幕居中；菜单无框靠右
    const topY = 28
    const menuW = 72
    const menuX = width - menuW / 2 - 10

    this.plaque = new StatusPlaque(this, width / 2, topY)
    this.plaque.setDepth(30)

    const menuBtn = new HudButton(this, {
      x: menuX,
      y: topY,
      label: zh.menu,
      width: menuW,
      height: 36,
      framed: false,
      onClick: () => {
        this.cleanup()
        this.scene.stop('Table')
        this.scene.start('Menu')
      },
    })
    menuBtn.setDepth(30)

    // 顶栏仅文字高度约 20；状态文案贴敌人卡左侧，属性在右侧
    const topBarBottom = topY + 14
    const enemyCenterY = topBarBottom + 16 + ENEMY_CARD_H / 2
    const metaX = 10
    const metaColW = 108
    const enemyCenterX = metaX + metaColW + 4 + ENEMY_CARD_W / 2
    const enemyBottom = enemyCenterY + ENEMY_CARD_H / 2
    const enemyRight = enemyCenterX + ENEMY_CARD_W / 2
    const hpY = enemyBottom + 10
    const statsX = enemyRight + 8
    const statsY = enemyCenterY
    // 手牌中心 y = height - 236；预览高于选中上浮牌顶（−24），避免被遮
    const handY = height - 236
    const previewY = handY - 96
    const playAreaY = Math.round((hpY + 28 + previewY - 36) / 2)

    this.hpBarBg = this.add
      .rectangle(enemyCenterX, hpY, ENEMY_CARD_W, 8, 0x2a2420, 0.95)
      .setDepth(6)
    this.hpBarFill = this.add
      .rectangle(enemyCenterX - ENEMY_CARD_W / 2, hpY, ENEMY_CARD_W, 8, 0x8f1d1d, 1)
      .setOrigin(0, 0.5)
      .setDepth(7)

    this.enemyStats = this.add
      .text(statsX, statsY, '', {
        fontFamily: FONT_UI,
        fontSize: '13px',
        color: THEME.parchment,
        align: 'left',
        lineSpacing: 6,
        wordWrap: { width: Math.max(72, width - statsX - 10) },
      })
      .setOrigin(0, 0.5)
      .setDepth(8)

    this.metaText = this.add
      .text(metaX, enemyCenterY, '', {
        fontFamily: FONT_UI,
        fontSize: '14px',
        color: THEME.mist,
        lineSpacing: 6,
        wordWrap: { width: metaColW },
      })
      .setOrigin(0, 0.5)
      .setDepth(8)

    this.playAreaHint = this.add
      .text(width / 2, playAreaY, zh.playAreaEmpty, {
        fontFamily: FONT_UI,
        fontSize: '13px',
        color: THEME.mist,
        align: 'center',
      })
      .setOrigin(0.5)
      .setAlpha(0.35)
      .setDepth(4)

    this.previewText = this.add
      .text(width / 2, previewY, '', {
        fontFamily: FONT_UI,
        fontSize: '14px',
        color: THEME.gold,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(8)

    this.enemyCenterX = enemyCenterX
    this.enemyCenterY = enemyCenterY
    this.jesterIconY = enemyBottom - 22
    this.playAreaY = playAreaY

    // 上排：次要操作；最底一排：出牌 / 防御（主操作）
    const ySecondary = height - 122
    const yPrimary = height - 66
    this.btnYield = new HudButton(this, {
      x: width * 0.18,
      y: ySecondary,
      label: zh.yield,
      width: 108,
      onClick: () => this.intent({ type: 'YIELD' }),
    })
    this.btnJester = new HudButton(this, {
      x: width * 0.5,
      y: ySecondary,
      label: zh.jester,
      width: 108,
      onClick: () => this.intent({ type: 'FLIP_JESTER' }),
    })
    new HudButton(this, {
      x: width * 0.82,
      y: ySecondary,
      label: zh.clear,
      width: 108,
      onClick: () => this.intent({ type: 'CLEAR_SELECTION' }),
    })
    this.btnPlay = new HudButton(this, {
      x: width * 0.32,
      y: yPrimary,
      label: zh.play,
      width: 108,
      onClick: () => this.intent({ type: 'CONFIRM_PLAY' }),
    })
    this.btnDefend = new HudButton(this, {
      x: width * 0.68,
      y: yPrimary,
      label: zh.defend,
      width: 108,
      onClick: () => this.intent({ type: 'CONFIRM_DEFEND' }),
    })

    this.unsubscribe = this.controller.subscribe(() => this.renderView())
    this.renderView()
  }

  private intent(intent: Parameters<GameController['dispatch']>[0]): void {
    const result = this.controller.dispatch(intent)
    if (!result.ok) {
      this.plaque.setMessage(tError(result.error))
      this.cameras.main.shake(80, 0.004)
    }
  }

  private renderView(): void {
    const view = this.controller.getView()
    this.renderEnemy(view)
    this.renderPlayArea(view)
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
    this.hpBarFill.width = ENEMY_CARD_W * ratio
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

  private renderPlayArea(view: SessionView): void {
    for (const v of this.playAreaViews) v.destroy(true)
    this.playAreaViews = []

    const cards = view.playArea
    const n = cards.length
    this.playAreaHint.setVisible(n === 0 && view.phase !== 'won' && view.phase !== 'lost')
    if (n === 0) return

    const { width } = this.scale
    const cardW = CARD_W
    const cardH = CARD_H
    const step = n <= 1 ? 0 : Math.min(42, (width - 48) / (n - 1))
    const span = step * Math.max(n - 1, 0)
    const startX = width / 2 - span / 2
    const y = this.playAreaY

    cards.forEach((card, index) => {
      const viewCard = new CardView(this, card, {
        width: cardW,
        height: cardH,
        interactive: false,
      })
      const x = n === 1 ? width / 2 : startX + index * step
      // 轻微扇形：中间平、两侧微仰
      const t = n <= 1 ? 0 : index / (n - 1) - 0.5
      viewCard.setPosition(x, y + Math.abs(t) * 6)
      viewCard.setAngle(t * 14)
      viewCard.setDepth(10 + index)
      this.playAreaViews.push(viewCard)
    })
  }

  private renderHand(view: SessionView): void {
    for (const v of this.handViews) v.destroy(true)
    this.handViews = []

    const { width, height } = this.scale
    const cards = view.hand
    const n = cards.length
    if (n === 0) return

    const cardW = 58
    const cardH = 84
    // 牌心间距：保证点选条带互不重叠
    const step = n <= 1 ? 0 : Math.min(54, (width - 32) / (n - 1))
    const span = step * Math.max(n - 1, 0)
    const startX = width / 2 - span / 2
    // 抬高手牌，远离底部按钮
    const y = height - 236

    cards.forEach((card, index) => {
      const isLast = index === n - 1
      const hitWidth = isLast ? cardW : Math.max(28, Math.min(cardW, step))
      const viewCard = new CardView(this, card, {
        width: cardW,
        height: cardH,
        hitWidth,
      })
      const x = n === 1 ? width / 2 : startX + index * step
      viewCard.setPosition(x, y)
      viewCard.setDepth(20 + index)
      if (view.selection.includes(card.id)) {
        viewCard.y = y - 24
        viewCard.setSelected(true)
      }
      viewCard.on('card-tap', (cardId: string) => {
        this.intent({ type: 'TOGGLE_CARD', cardId })
      })
      this.handViews.push(viewCard)
    })
  }

  private renderMeta(view: SessionView): void {
    const { width } = this.scale
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
        .image(width - 34 - i * 36, this.jesterIconY, IMAGE_KEYS.jester)
        .setDisplaySize(32, 44)
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
      this.previewText.setText(zh.selectHint)
      this.plaque.setMessage(zh.yourTurn)
    } else {
      this.previewText.setText('')
    }
  }

  private renderCommands(view: SessionView): void {
    const c = view.commands
    this.btnPlay.setEnabled(c.canConfirmPlay)
    this.btnDefend.setEnabled(c.canConfirmDefend)
    this.btnYield.setEnabled(c.canYield)
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
    const { width, height } = this.scale
    const msg =
      view.phase === 'won' && view.victory
        ? `${zh.victory}\n${victoryNameZh(view.victory)}`
        : `${zh.defeat}\n${tError(view.defeatReason ?? '')}`

    this.overlayText = this.add
      .text(width / 2, height * 0.4, msg, {
        fontFamily: FONT_UI,
        fontSize: '28px',
        color: THEME.gold,
        align: 'center',
        backgroundColor: '#000000aa',
        padding: { x: 18, y: 14 },
      })
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
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  shutdown(): void {
    this.cleanup()
  }
}
