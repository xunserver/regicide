import * as Phaser from 'phaser'
import type { Card, GameEvent, Suit } from '../../core/index.ts'
import {
  sfxAttack,
  sfxBossAppear,
  sfxDefeat,
  sfxEnemyDefeated,
  sfxPlayCard,
  sfxVictory,
} from '../audio/Sfx.ts'
import { speakBossLine } from '../audio/Voice.ts'
import { IMAGE_KEYS, THEME } from '../assets/manifest.ts'
import { du, textStyle } from '../dpr.ts'
import { pickBossLine } from '../i18n/bossLines.ts'
import { FONT_UI } from '../i18n/zh.ts'

export type SuitFxAnchors = {
  enemyX: number
  enemyY: number
  handY: number
  centerX: number
}

type SuitFxOptions = {
  scene: Phaser.Scene
  events: readonly GameEvent[]
  anchors: SuitFxAnchors
}

const SUIT_TEX: Record<Suit, string> = {
  H: IMAGE_KEYS.suitH,
  D: IMAGE_KEYS.suitD,
  C: IMAGE_KEYS.suitC,
  S: IMAGE_KEYS.suitS,
}

const DEPTH = 90

/** Play suit-power and combat feedback after a successful dispatch. */
export function playSuitFx(options: SuitFxOptions): void {
  const { scene, events, anchors } = options
  if (events.length === 0) return

  const played = events.find((e) => e.type === 'CARDS_PLAYED')
  const hasAce = played?.type === 'CARDS_PLAYED' && played.cards.some((c) => c.rank === 'A')

  let delay = 0
  const queue = (ms: number, fn: () => void): void => {
    scene.time.delayedCall(delay, fn)
    delay += ms
  }

  for (const event of events) {
    switch (event.type) {
      case 'POWER_SPADES':
        queue(420, () => fxSpades(scene, anchors, event.shieldAdded))
        break
      case 'POWER_CLUBS':
        queue(480, () => fxClubs(scene, anchors, event.damage))
        break
      case 'POWER_HEARTS':
        queue(420, () => fxHearts(scene, anchors, event.moved.length))
        break
      case 'POWER_DIAMONDS':
        queue(420, () => fxDiamonds(scene, anchors, event.drawn.length))
        break
      case 'DAMAGE_DEALT':
        queue(hasAce ? 560 : 420, () => {
          sfxAttack({ heavy: hasAce || hasClubs(events) || event.damage >= 10 })
          fxDamage(scene, anchors, event.damage, { ace: hasAce, doubled: hasClubs(events) })
        })
        break
      case 'DAMAGE_BLOCKED':
        queue(360, () => fxBlocked(scene, anchors, event.damage))
        break
      case 'CARDS_PLAYED':
        queue(40, () => sfxPlayCard())
        if (hasAce) {
          queue(280, () => fxAceCompanion(scene, anchors, event.cards))
        }
        break
      case 'ENEMY_DEFEATED': {
        queue(520, () => sfxEnemyDefeated())
        const next = event.nextEnemy
        if (next) {
          queue(420, () => announceBoss(scene, anchors, next))
        }
        break
      }
      case 'GAME_WON':
        queue(640, () => sfxVictory())
        break
      case 'GAME_LOST':
        queue(360, () => sfxDefeat())
        break
      default:
        break
    }
  }
}

function hasClubs(events: readonly GameEvent[]): boolean {
  return events.some((e) => e.type === 'POWER_CLUBS')
}

/** Sting + Chinese taunt voice + on-screen caption. */
export function announceBoss(scene: Phaser.Scene, anchors: SuitFxAnchors, card: Card): void {
  const line = pickBossLine(card)
  sfxBossAppear(card.rank)
  speakBossLine(line, card.rank)
  fxBossTaunt(scene, anchors, line)
}

function fxBossTaunt(scene: Phaser.Scene, a: SuitFxAnchors, line: string): void {
  const x = a.enemyX
  const y = a.enemyY + du(128, scene)

  const label = scene.add
    .text(
      x,
      y,
      `「${line}」`,
      textStyle(
        {
          fontFamily: FONT_UI,
          fontSize: '17px',
          color: THEME.gold,
          align: 'center',
          backgroundColor: '#1a1510ee',
          padding: { x: 12, y: 8 },
          wordWrap: { width: du(280, scene) },
        },
        scene,
      ),
    )
    .setOrigin(0.5)
    .setDepth(DEPTH + 4)
    .setAlpha(0)
    .setScale(0.92)

  scene.tweens.add({
    targets: label,
    alpha: 1,
    scale: 1,
    y: y - du(10, scene),
    duration: 220,
    ease: 'Back.Out',
    onComplete: () => {
      scene.tweens.add({
        targets: label,
        alpha: 0,
        y: y - du(28, scene),
        duration: 420,
        delay: Math.min(2800, 900 + line.length * 90),
        ease: 'Quad.In',
        onComplete: () => label.destroy(),
      })
    },
  })
}

function fxSpades(scene: Phaser.Scene, a: SuitFxAnchors, shieldAdded: number): void {
  const x = a.centerX
  const y = a.handY - du(40, scene)

  // Steel shield rings
  for (let i = 0; i < 3; i += 1) {
    const ring = scene.add.graphics().setDepth(DEPTH)
    const r0 = du(18 + i * 10, scene)
    ring.lineStyle(du(2.5, scene), 0x2a3540, 0.85 - i * 0.15)
    ring.strokeCircle(0, 0, r0)
    ring.setPosition(x, y)
    scene.tweens.add({
      targets: ring,
      scaleX: 2.4 + i * 0.35,
      scaleY: 2.4 + i * 0.35,
      alpha: 0,
      duration: 520 + i * 80,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    })
  }

  // Dark plate flash behind emblem
  const plate = scene.add
    .ellipse(x, y, du(72, scene), du(56, scene), 0x1a1f28, 0.55)
    .setDepth(DEPTH)
  scene.tweens.add({
    targets: plate,
    alpha: 0,
    scaleX: 1.35,
    scaleY: 1.35,
    duration: 480,
    ease: 'Quad.Out',
    onComplete: () => plate.destroy(),
  })

  burstSuit(scene, x, y, 'S', du(42, scene), 0xd7dee8)
  floatLabel(scene, x, y - du(36, scene), `+${shieldAdded} 护盾`, '#c5d0dc')
}

function fxClubs(scene: Phaser.Scene, a: SuitFxAnchors, _damage: number): void {
  const { enemyX: x, enemyY: y } = a

  // Twin strikes — left then right
  slash(scene, x - du(18, scene), y - du(8, scene), -28, 0x1c1c1c)
  scene.time.delayedCall(140, () => {
    slash(scene, x + du(16, scene), y + du(6, scene), 32, 0x2a2a2a)
  })

  burstSuit(scene, x, y - du(48, scene), 'C', du(36, scene), 0x2a2a2a)

  const badge = scene.add
    .text(
      x,
      y + du(52, scene),
      '×2',
      textStyle(
        {
          fontFamily: FONT_UI,
          fontSize: '34px',
          color: THEME.gold,
          fontStyle: 'bold',
          stroke: THEME.ink,
          strokeThickness: 5,
        },
        scene,
      ),
    )
    .setOrigin(0.5)
    .setDepth(DEPTH + 2)
    .setScale(0.4)
    .setAlpha(0)

  scene.tweens.add({
    targets: badge,
    scale: 1.15,
    alpha: 1,
    duration: 180,
    ease: 'Back.Out',
    yoyo: true,
    hold: 160,
    onComplete: () => badge.destroy(),
  })
}

function fxHearts(scene: Phaser.Scene, a: SuitFxAnchors, moved: number): void {
  const startY = a.handY
  const endY = a.enemyY + du(120, scene)
  const x = a.centerX

  for (let i = 0; i < Math.min(6, Math.max(3, moved)); i += 1) {
    const ox = (i - 2.5) * du(14, scene)
    const mote = scene.add
      .circle(x + ox, startY, du(4, scene), 0x9b2c2c, 0.9)
      .setDepth(DEPTH)
    scene.tweens.add({
      targets: mote,
      y: endY - du(20, scene) - i * du(8, scene),
      x: x + ox * 0.35,
      alpha: 0,
      scale: 0.3,
      duration: 520 + i * 40,
      delay: i * 35,
      ease: 'Cubic.Out',
      onComplete: () => mote.destroy(),
    })
  }

  burstSuit(scene, x, a.enemyY + du(90, scene), 'H', du(38, scene), 0x9b2c2c)
  floatLabel(scene, x, a.enemyY + du(54, scene), `回库 ${moved}`, '#c45c5c')
}

function fxDiamonds(scene: Phaser.Scene, a: SuitFxAnchors, drawn: number): void {
  const fromX = a.centerX
  const fromY = a.enemyY + du(100, scene)
  const toY = a.handY

  for (let i = 0; i < Math.min(6, Math.max(3, drawn)); i += 1) {
    const spark = scene.add
      .rectangle(fromX, fromY, du(8, scene), du(8, scene), 0xc9a227, 0.95)
      .setDepth(DEPTH)
      .setAngle(45)
    const spread = (i - 2.5) * du(22, scene)
    scene.tweens.add({
      targets: spark,
      x: fromX + spread,
      y: toY,
      alpha: 0.15,
      scale: 0.4,
      duration: 480 + i * 30,
      delay: i * 40,
      ease: 'Cubic.In',
      onComplete: () => spark.destroy(),
    })
  }

  burstSuit(scene, fromX, fromY, 'D', du(38, scene), 0xc9a227)
  floatLabel(scene, fromX, fromY - du(36, scene), `抽牌 ${drawn}`, '#c9a227')
}

function fxDamage(
  scene: Phaser.Scene,
  a: SuitFxAnchors,
  damage: number,
  opts: { ace: boolean; doubled: boolean },
): void {
  const { enemyX: x, enemyY: y } = a

  // Hit flash over enemy
  const flash = scene.add
    .rectangle(x, y, du(168, scene), du(236, scene), opts.ace ? 0xc9a227 : 0x8f1d1d, 0.35)
    .setDepth(DEPTH)
  scene.tweens.add({
    targets: flash,
    alpha: 0,
    duration: opts.ace ? 320 : 220,
    ease: 'Quad.Out',
    onComplete: () => flash.destroy(),
  })

  if (opts.ace) {
    clawMarks(scene, x, y)
  } else if (!opts.doubled) {
    slash(scene, x, y, -12, 0x8f1d1d)
  } else {
    // Clubs already threw twin slashes — finish with a centered impact line.
    slash(scene, x, y, 8, 0x8f1d1d)
  }

  // Shock rings
  const ring = scene.add.graphics().setDepth(DEPTH)
  ring.lineStyle(du(3, scene), opts.ace ? 0xc9a227 : 0x8f1d1d, 0.9)
  ring.strokeCircle(0, 0, du(28, scene))
  ring.setPosition(x, y)
  scene.tweens.add({
    targets: ring,
    scaleX: 2.8,
    scaleY: 2.8,
    alpha: 0,
    duration: 380,
    ease: 'Cubic.Out',
    onComplete: () => ring.destroy(),
  })

  floatLabel(scene, x + du(48, scene), y - du(20, scene), `-${damage}`, '#e8b4b4', {
    fontSize: opts.ace || opts.doubled ? '28px' : '24px',
  })

  scene.cameras.main.shake(opts.ace ? 110 : 70, opts.ace ? 0.006 : 0.0035)
}

function fxAceCompanion(scene: Phaser.Scene, a: SuitFxAnchors, cards: readonly Card[]): void {
  const ace = cards.find((c) => c.rank === 'A')
  if (!ace) return
  const { enemyX: x, enemyY: y } = a

  const emblem = scene.add
    .image(x, y, SUIT_TEX[ace.suit])
    .setDisplaySize(du(56, scene), du(56, scene))
    .setDepth(DEPTH + 1)
    .setAlpha(0)
    .setScale(0.2)

  scene.tweens.add({
    targets: emblem,
    alpha: 1,
    scale: 1.35,
    duration: 200,
    ease: 'Back.Out',
    yoyo: true,
    hold: 60,
    onComplete: () => emblem.destroy(),
  })

  floatLabel(scene, x, y + du(78, scene), '动物伙伴', THEME.gold)
}

function fxBlocked(scene: Phaser.Scene, a: SuitFxAnchors, damage: number): void {
  const x = a.centerX
  const y = a.handY - du(28, scene)

  const plate = scene.add
    .ellipse(x, y, du(90, scene), du(48, scene), 0x2a2420, 0.5)
    .setDepth(DEPTH)
  scene.tweens.add({
    targets: plate,
    alpha: 0,
    scaleX: 1.25,
    duration: 400,
    onComplete: () => plate.destroy(),
  })
  floatLabel(scene, x, y - du(24, scene), `抵挡 ${damage}`, THEME.mist)
}

function burstSuit(
  scene: Phaser.Scene,
  x: number,
  y: number,
  suit: Suit,
  size: number,
  tint: number,
): void {
  const img = scene.add
    .image(x, y, SUIT_TEX[suit])
    .setDisplaySize(size, size)
    .setTint(tint)
    .setDepth(DEPTH + 1)
    .setAlpha(0)
    .setScale(0.35)

  scene.tweens.add({
    targets: img,
    alpha: 1,
    scale: 1.2,
    duration: 160,
    ease: 'Back.Out',
    yoyo: true,
    hold: 120,
    onComplete: () => img.destroy(),
  })
}

function slash(
  scene: Phaser.Scene,
  x: number,
  y: number,
  angle: number,
  color: number,
): void {
  const g = scene.add.graphics().setDepth(DEPTH + 1)
  const len = du(70, scene)
  const thick = du(4, scene)
  g.lineStyle(thick, color, 0.95)
  g.beginPath()
  g.moveTo(-len / 2, 0)
  g.lineTo(len / 2, 0)
  g.strokePath()
  g.setPosition(x, y)
  g.setAngle(angle)
  g.setAlpha(0)
  g.setScale(0.4, 1)

  scene.tweens.add({
    targets: g,
    alpha: 1,
    scaleX: 1.15,
    duration: 90,
    yoyo: true,
    hold: 40,
    onComplete: () => g.destroy(),
  })
}

function clawMarks(scene: Phaser.Scene, x: number, y: number): void {
  for (let i = 0; i < 3; i += 1) {
    const ox = (i - 1) * du(16, scene)
    slash(scene, x + ox, y + (i - 1) * du(6, scene), -38 + i * 8, 0xc9a227)
  }
}

function floatLabel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: string,
  extra?: { fontSize?: string },
): void {
  const label = scene.add
    .text(
      x,
      y,
      text,
      textStyle(
        {
          fontFamily: FONT_UI,
          fontSize: extra?.fontSize ?? '18px',
          color,
          fontStyle: 'bold',
          stroke: THEME.ink,
          strokeThickness: 4,
        },
        scene,
      ),
    )
    .setOrigin(0.5)
    .setDepth(DEPTH + 3)
    .setAlpha(0)

  scene.tweens.add({
    targets: label,
    y: y - du(32, scene),
    alpha: 1,
    duration: 180,
    ease: 'Quad.Out',
    onComplete: () => {
      scene.tweens.add({
        targets: label,
        alpha: 0,
        y: y - du(48, scene),
        duration: 280,
        delay: 220,
        ease: 'Quad.In',
        onComplete: () => label.destroy(),
      })
    },
  })
}
