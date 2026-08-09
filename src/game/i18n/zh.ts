import type { Rank, Suit, VictoryRank } from '../../core/index.ts'

/** UI 统一中文字体栈 */
export const FONT_UI = '"Noto Serif SC", "Source Han Serif SC", Songti SC, serif'
export const FONT_BRAND = '"Noto Serif SC", "Cinzel", Songti SC, serif'

export const zh = {
  brand: '弑君者',
  tagline: '肃清腐化的王冠',
  loading: '加载中…',
  newSolo: '开始单人',
  continue: '继续对局',
  codex: '游玩百科',
  codexHint: '上下滑动阅读规则',
  gallery: '卡牌鉴赏',
  galleryHint: '左右滑动或点两侧切换卡牌',
  back: '返回',
  menu: '菜单',
  play: '出牌',
  defend: '防御',
  yield: '弃权',
  endTurn: '结束',
  jester: '小丑',
  clear: '清除',
  playAgain: '再来一局',

  yourTurn: '轮到你了',
  enemyStrikes: '敌人反击 — 弃牌抵挡伤害',
  selectHint: '可连续出牌，打完后点「结束」；或选择弃权',
  keepPlayingHint: '可继续出牌，或点「结束」让敌人反击',
  noEnemy: '没有敌人',

  phasePlay: '出牌',
  phaseDefend: '防御',
  phaseWon: '胜利',
  phaseLost: '失败',

  tavern: '酒馆',
  discard: '弃牌',
  castleLeft: '城堡剩余',
  fallen: '已击败',
  jesters: '小丑',
  playAreaEmpty: '已出牌将落在此处',

  hp: '生命',
  atk: '攻击',
  base: '基础',
  shield: '护盾',

  attack: '攻击力',
  damage: '伤害',
  immune: '免疫',
  block: '抵挡',
  ready: '可以确认',
  needMore: '还差',

  victory: '胜利',
  defeat: '战败',
  gold: '金胜',
  silver: '银胜',
  bronze: '铜胜',
} as const

const ERROR_ZH: Record<string, string> = {
  'Game is already over': '对局已结束',
  'Cannot flip a Jester now': '现在不能使用小丑',
  'No Jesters remaining': '没有剩余的小丑',
  'Not in play phase': '当前不是出牌阶段',
  'No enemy to attack': '没有可攻击的敌人',
  'Selected cards are not all in hand': '所选卡牌不在手牌中',
  'Cannot yield twice in a row (solo)': '单人模式不能连续弃权',
  'Already played this turn; end the turn instead': '本回合已出过牌，请点「结束」',
  'Play at least one card before ending the turn': '请先出至少一张牌再结束回合',
  'No enemy': '没有敌人',
  'Not in defend phase': '当前不是防御阶段',
  'No damage to block; discard nothing': '无需抵挡，请不要弃牌',
  'Unable to discard enough cards to cover enemy damage': '无法弃出足够点数抵挡伤害',
  'Unable to play a card or yield': '无法出牌或弃权',
  'Play at least one card': '请至少选择一张牌',
  'Duplicate cards in play': '出牌中有重复卡牌',
  'Animal Companions may only be paired with one other card': '动物伙伴只能与另一张牌配对',
  'Combo must contain 2 to 4 cards': '同点数组合须为 2～4 张',
  'Combo cards must be ranks 2–5': '同点数组合只能是 2～5',
  'Combo cards must share the same rank': '组合牌必须点数相同',
  'Combo total must be 10 or less': '组合总点数不能超过 10',
  'Cannot select cards now': '现在不能选牌',
  'Card is not in hand': '该牌不在手牌中',
}

export function tError(message: string): string {
  if (ERROR_ZH[message]) return ERROR_ZH[message]
  const discardMatch = /^Discarded value (\d+) is less than required damage (\d+)$/.exec(
    message,
  )
  if (discardMatch) {
    return `弃牌点数 ${discardMatch[1]} 不足，需要 ${discardMatch[2]}`
  }
  return message
}

export function suitNameZh(suit: Suit): string {
  switch (suit) {
    case 'H':
      return '红心'
    case 'D':
      return '方块'
    case 'C':
      return '梅花'
    case 'S':
      return '黑桃'
  }
}

export function rankNameZh(rank: Rank): string {
  switch (rank) {
    case 'J':
      return '杰克'
    case 'Q':
      return '王后'
    case 'K':
      return '国王'
    case 'A':
      return 'A'
    default:
      return rank
  }
}

export function victoryNameZh(v: VictoryRank): string {
  switch (v) {
    case 'gold':
      return zh.gold
    case 'silver':
      return zh.silver
    case 'bronze':
      return zh.bronze
  }
}

export function phaseNameZh(phase: string): string {
  switch (phase) {
    case 'play':
      return zh.phasePlay
    case 'defend':
      return zh.phaseDefend
    case 'won':
      return zh.phaseWon
    case 'lost':
      return zh.phaseLost
    default:
      return phase
  }
}

export function suitCodeZh(suit: Suit): string {
  switch (suit) {
    case 'H':
      return '♥'
    case 'D':
      return '♦'
    case 'C':
      return '♣'
    case 'S':
      return '♠'
  }
}
