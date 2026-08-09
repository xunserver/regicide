import type { Card, Suit } from '../../core/index.ts'

type RoyalRank = 'J' | 'Q' | 'K'

/** Intimidating Chinese taunts when a royal steps onto the table. */
const LINES: Record<RoyalRank, Record<Suit, readonly string[]>> = {
  J: {
    H: ['血色已至，凡人退开！', '红心开刃——今日要见血！', '挡我者，血溅当场！'],
    D: ['黄金之路，只许王者通行！', '方块闪起，尔等也配？', '财富与锋芒，皆在我手！'],
    C: ['梅花利刃，专砍不识抬举的！', '骑士在此，叛贼跪好！', '一击之下，休想还手！'],
    S: ['黑桃开路，谁敢拦我？', '阴影里的刀，已对准你了！', '来啊——让我送你上路！'],
  },
  Q: {
    H: ['王后驾到——跪，或死。', '红心王后不容挑衅！', '血色王冠，已为你备好坟墓。'],
    D: ['珠宝与权柄，皆在我掌中。', '方块王后，笑看蝼蚁挣扎。', '想碰我的财？先交出性命。'],
    C: ['温柔？那是留给死人的。', '梅花王后的裁断——死刑。', '再敢抬头，便成枯骨。'],
    S: ['寒锋之下，无人可逃。', '黑桃王后——夜色即刑场。', '你的末日，由我宣布。'],
  },
  K: {
    H: ['吾乃红心之王，血与火皆听命于我！', '王座之上，唯血可证忠诚！', '弑君者？先问问这片血海！'],
    D: ['王冠在此，尔等蝼蚁，俯首！', '方块之王——天下皆是我的筹码！', '抗命者，连骨灰都不配留下！'],
    C: ['王座不空，叛贼当诛！', '梅花之王在此——谁敢再进一步！', '吾之律令，便是生死！'],
    S: ['弑君？先问问我的剑！', '黑桃之王——阴影即是王座！', '来吧，让王冠见证你的覆灭！'],
  },
}

const FALLBACK: Record<RoyalRank, readonly string[]> = {
  J: ['骑士驾到——让开！'],
  Q: ['王后驾到——跪，或死。'],
  K: ['国王驾到——俯首称臣！'],
}

function isRoyal(rank: string): rank is RoyalRank {
  return rank === 'J' || rank === 'Q' || rank === 'K'
}

/** Pick a taunt for this royal; stable per card id. */
export function pickBossLine(card: Card): string {
  if (!isRoyal(card.rank)) return '王室驾到！'
  const pool = LINES[card.rank][card.suit] ?? FALLBACK[card.rank]
  return pool[hashId(card.id) % pool.length]!
}

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i += 1) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0
  }
  return h
}
