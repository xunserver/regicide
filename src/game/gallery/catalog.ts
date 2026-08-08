import {
  ENEMY_STATS,
  NUMBER_RANKS,
  ROYAL_RANKS,
  SUITS,
  makeCard,
  type Card,
  type Rank,
  type Suit,
} from '../../core/index.ts'
import { rankNameZh, suitCodeZh, suitNameZh } from '../i18n/zh.ts'

export type GalleryKind = 'card' | 'back' | 'jester'

export type GalleryEntry = {
  id: string
  kind: GalleryKind
  card?: Card
  title: string
  subtitle: string
  blurb: string
}

function suitPowerBlurb(suit: Suit): string {
  switch (suit) {
    case 'H':
      return '花色能力：红心 — 将弃牌洗回酒馆牌库底'
    case 'D':
      return '花色能力：方块 — 从酒馆抽牌'
    case 'C':
      return '花色能力：梅花 — 伤害翻倍'
    case 'S':
      return '花色能力：黑桃 — 获得护盾'
  }
}

function rankBlurb(rank: Rank, suit: Suit): string {
  if (rank === 'A') {
    return `动物伙伴（A）。可与任意一张牌配对出。\n${suitPowerBlurb(suit)}`
  }
  if (rank === 'J' || rank === 'Q' || rank === 'K') {
    const stats = ENEMY_STATS[rank]
    return [
      `城堡敌人 · ${rankNameZh(rank)}`,
      `攻击 ${stats.attack}　生命 ${stats.health}`,
      `同花色能力对该敌人免疫。`,
      suitPowerBlurb(suit),
    ].join('\n')
  }
  const n = Number(rank)
  const comboHint =
    n >= 2 && n <= 5 ? `\n可与同点数 2～5 组合出牌（总和≤10）。` : ''
  return `攻击 / 弃牌点数：${n}。${comboHint}\n${suitPowerBlurb(suit)}`
}

/** Full showcase list: card back, 52 faces, jester. */
export function buildGalleryCatalog(): GalleryEntry[] {
  const entries: GalleryEntry[] = [
    {
      id: 'back',
      kind: 'back',
      title: '牌背',
      subtitle: '酒馆与城堡的暗面',
      blurb: '未揭示的牌使用牌背。单人模式下小丑不进入酒馆牌库。',
    },
  ]

  for (const suit of SUITS) {
    for (const rank of [...NUMBER_RANKS, ...ROYAL_RANKS]) {
      const card = makeCard(suit, rank)
      entries.push({
        id: card.id,
        kind: 'card',
        card,
        title: `${suitNameZh(suit)}${rankNameZh(rank)}`,
        subtitle: `${suitCodeZh(suit)} · ${card.id}`,
        blurb: rankBlurb(rank, suit),
      })
    }
  }

  entries.push({
    id: 'jester',
    kind: 'jester',
    title: '小丑',
    subtitle: '单人专属 · 共 2 张',
    blurb: '弃掉全部手牌，再从酒馆抽满至 8 张。\n使用次数影响通关评级（金 / 银 / 铜）。',
  })

  return entries
}
