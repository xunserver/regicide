import * as Phaser from 'phaser'
import type { Card, Rank, Suit } from '../../core/index.ts'
import {
  CARD_H,
  CARD_W,
  IMAGE_KEYS,
  SUIT_COLOR,
} from '../assets/manifest.ts'
import { du, getDpr } from '../dpr.ts'
import { FONT_UI } from '../i18n/zh.ts'

function royalKey(rank: Rank): string | null {
  if (rank === 'J') return IMAGE_KEYS.royalJack
  if (rank === 'Q') return IMAGE_KEYS.royalQueen
  if (rank === 'K') return IMAGE_KEYS.royalKing
  return null
}

function suitKey(suit: Suit): string {
  switch (suit) {
    case 'H':
      return IMAGE_KEYS.suitH
    case 'D':
      return IMAGE_KEYS.suitD
    case 'C':
      return IMAGE_KEYS.suitC
    case 'S':
      return IMAGE_KEYS.suitS
  }
}

function aceKey(suit: Suit): string {
  switch (suit) {
    case 'H':
      return IMAGE_KEYS.aceH
    case 'D':
      return IMAGE_KEYS.aceD
    case 'C':
      return IMAGE_KEYS.aceC
    case 'S':
      return IMAGE_KEYS.aceS
  }
}

export type CardViewOptions = {
  width?: number
  height?: number
  interactive?: boolean
  /**
   * 点击条带宽度。扇形重叠时设为牌间距，只点左侧露出部分；
   * 末张牌应传满宽。
   */
  hitWidth?: number
}

/** Composed card: portrait royals / frame+emblem for others. */
export class CardView extends Phaser.GameObjects.Container {
  readonly cardId: string
  private readonly frameBg: Phaser.GameObjects.Image
  private readonly hitZone: Phaser.GameObjects.Zone | null = null
  private selected = false
  private readonly widthPx: number
  private readonly heightPx: number

  constructor(scene: Phaser.Scene, card: Card, options: CardViewOptions = {}) {
    super(scene, 0, 0)
    this.cardId = card.id
    // width/height are design CSS pixels; convert to device pixels.
    const dpr = getDpr(scene)
    this.widthPx = (options.width ?? CARD_W) * dpr
    this.heightPx = (options.height ?? CARD_H) * dpr

    const royal = royalKey(card.rank)
    const textureKey = royal ?? IMAGE_KEYS.cardFrame
    this.frameBg = scene.add
      .image(0, 0, textureKey)
      .setDisplaySize(this.widthPx, this.heightPx)
    this.add(this.frameBg)

    if (royal) {
      this.addSuitBadge(card.suit, -this.widthPx * 0.32, -this.heightPx * 0.38, 0.22)
      this.addRankLabel(card.rank, card.suit, -this.widthPx * 0.32, -this.heightPx * 0.18)
    } else if (card.rank === 'A') {
      const emblem = scene.add
        .image(0, this.heightPx * 0.06, aceKey(card.suit))
        .setDisplaySize(this.widthPx * 0.55, this.widthPx * 0.55)
      this.add(emblem)
      this.addRankLabel('A', card.suit, -this.widthPx * 0.3, -this.heightPx * 0.34)
      this.addSuitBadge(card.suit, this.widthPx * 0.3, this.heightPx * 0.34, 0.2)
    } else {
      this.addRankLabel(card.rank, card.suit, -this.widthPx * 0.28, -this.heightPx * 0.34)
      const pip = scene.add
        .image(0, this.heightPx * 0.08, suitKey(card.suit))
        .setDisplaySize(this.widthPx * 0.42, this.widthPx * 0.42)
      this.add(pip)
      this.addSuitBadge(card.suit, this.widthPx * 0.28, this.heightPx * 0.34, 0.18)
    }

    if (options.interactive !== false) {
      const hitDesign = options.hitWidth ?? options.width ?? CARD_W
      const hitW = Math.max(du(24, scene), Math.min(this.widthPx, hitDesign * dpr))
      // 条带贴左：与下层牌的可见露出区域对齐
      const hitCenterX = -this.widthPx / 2 + hitW / 2
      this.hitZone = scene.add.zone(hitCenterX, 0, hitW, this.heightPx).setOrigin(0.5)
      this.hitZone.setInteractive({ useHandCursor: true })
      this.add(this.hitZone)

      this.hitZone.on('pointerdown', (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation()
        this.emit('card-tap', this.cardId)
      })
    }

    scene.add.existing(this)
  }

  setSelected(on: boolean): void {
    this.selected = on
    this.setScale(on ? 1.06 : 1)
    this.frameBg.setTint(on ? 0xffe08a : 0xffffff)
  }

  isSelected(): boolean {
    return this.selected
  }

  private addSuitBadge(suit: Suit, x: number, y: number, scale: number): void {
    const badge = this.scene.add
      .image(x, y, suitKey(suit))
      .setDisplaySize(this.widthPx * scale, this.widthPx * scale)
    this.add(badge)
  }

  private addRankLabel(rank: string, suit: Suit, x: number, y: number): void {
    // widthPx already device pixels — font size matches card, no extra DPR multiply.
    const label = this.scene.add
      .text(x, y, rank, {
        fontFamily: FONT_UI,
        fontSize: `${Math.round(this.widthPx * 0.26)}px`,
        color: SUIT_COLOR[suit],
        fontStyle: 'bold',
        resolution: 1,
      })
      .setOrigin(0.5)
    this.add(label)
  }
}

export function createCardBack(
  scene: Phaser.Scene,
  width = CARD_W,
  height = CARD_H,
): Phaser.GameObjects.Image {
  return scene.add.image(0, 0, IMAGE_KEYS.cardBack).setDisplaySize(width, height)
}

export function rankTitle(rank: Rank): string {
  if (rank === 'J') return '杰克'
  if (rank === 'Q') return '王后'
  if (rank === 'K') return '国王'
  return rank
}
