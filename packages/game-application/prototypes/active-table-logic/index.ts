import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import {
  dispatch,
  getCard,
  getCardValue,
  getCurrentEnemyStats,
  getCounterattackDamage,
  getAttackValue,
} from '@regicide/game-core'
import type { CardId, GameEvent, GameState } from '@regicide/game-core'
import {
  createGameFromFixture,
  getCapabilities,
  getSelectionIntent,
  initialState,
  intentFromSelection,
  legalCardIds,
  previewIntent,
  publicProjection,
  reduce,
  stateFingerprint,
  type Blocker,
  type FixtureDefinition,
  type IntentPreview,
  type PrototypeAction,
  type PrototypeState,
} from './model'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
const fixtures = JSON.parse(
  readFileSync(resolve(root, 'prototypes/active-table-fixtures.json'), 'utf8'),
) as FixtureDefinition[]

const suitNames = { hearts: '红桃', diamonds: '方块', clubs: '梅花', spades: '黑桃' } as const
const rankNames = {
  jack: '侍从',
  queen: '王后',
  king: '国王',
  'animal-companion': '伙伴',
  jester: '小丑',
} as const
const blockerNames: Record<Blocker, string> = {
  session: '会话',
  renderer: '渲染器',
  animation: '动画',
  modal: '弹窗',
  background: '后台',
  orientation: '横屏',
  viewport: '视口',
}
const decisionNames: Record<string, string> = {
  'play-or-yield': '出牌或让牌',
  'discard-for-damage': '承伤弃牌',
  'choose-next-player': '选择下一位玩家',
}

function cardLabel(cardId: CardId): string {
  const card = getCard(cardId)
  if (card.kind === 'jester')
    return `${card.id.replace('jester-', '小丑 ')}（${getCardValue(cardId)}）`
  const rank = typeof card.rank === 'number' ? String(card.rank) : rankNames[card.rank]
  const value = getCardValue(cardId)
  return `${suitNames[card.suit]}-${rank}（${value}）`
}

function bold(text: string): string {
  return `\x1b[1m${text}\x1b[0m`
}

function dim(text: string): string {
  return `\x1b[2m${text}\x1b[0m`
}

function compact(value: unknown): string {
  return JSON.stringify(value)
}

function enemyLabel(game: GameState): string {
  if (!game.currentEnemy) return '无'
  const stats = getCurrentEnemyStats(game)
  return `${cardLabel(game.currentEnemy.cardId)} 生命 ${stats?.healthRemaining ?? 0}/${stats?.health ?? 0} 攻击 ${stats?.attack ?? 0} 护盾 ${stats?.shield ?? 0}`
}

function previewLabel(preview: IntentPreview | null): string {
  if (!preview) return '无（当前选择不是完整合法意图）'
  switch (preview.type) {
    case 'play-cards':
      return `${preview.type} 攻击 ${preview.attackValue}，${preview.enemyResult}，反击 ${preview.counterattackDamage}，下一步 ${preview.next}，${preview.resolution}`
    case 'yield':
      return `${preview.type} 反击 ${preview.counterattackDamage}，手牌总点数 ${preview.handValue}，下一步 ${preview.next}`
    case 'discard-for-damage':
      return `${preview.type} 需要 ${preview.required}，已选 ${preview.selectedValue}，超出 ${preview.overage}，下一步 ${preview.next}`
    case 'use-solo-jester':
      return `${preview.type} 弃 ${preview.discardedCount} 张、抽 ${preview.drawCount} 张，剩余 ${preview.remainingJesters} 次，${preview.resolution}`
  }
}

function eventLabel(event: GameEvent): string {
  switch (event.type) {
    case 'cards-played':
      return `出牌 ${event.cardIds.join('+')}（攻击 ${event.attackValue}）`
    case 'enemy-damaged':
      return `敌人受伤 ${event.amount}（累计 ${event.totalDamage}）`
    case 'counterattack-required':
      return `要求承受反击 ${event.amount}`
    case 'damage-suffered':
      return `承伤弃 ${event.cardIds.length} 张`
    case 'enemy-defeated':
      return `敌人被${event.exact ? '精确' : '过量'}击败`
    case 'enemy-revealed':
      return `揭示 ${event.enemyId}`
    case 'player-yielded':
      return '玩家让牌'
    case 'solo-jester-used':
      return `使用 ${event.cardId}，抽 ${event.drawnCardIds.length} 张`
    case 'game-won':
      return `胜利${event.rating ? `（${event.rating}）` : ''}`
    case 'game-lost':
      return `失败（${event.reason}）`
    case 'hearts-resolved':
      return `红桃回收 ${event.cardIds.length} 张`
    case 'diamonds-resolved':
      return `方块抽取 ${event.draws.length} 张`
    case 'enemy-immunity-cancelled':
      return '取消敌方免疫'
    case 'next-player-chosen':
      return `选择下一位 ${event.playerId}`
    case 'turn-started':
      return `轮到 ${event.playerId}`
  }
}

function actionForLine(line: string, state: PrototypeState): PrototypeAction | null {
  const command = line.trim().toLowerCase()
  if (command === 'x') return { type: 'clear-selection' }
  if (command === 'y') return { type: 'set-intent', intent: { type: 'yield' } }
  if (command === 'j') {
    const cardId = state.game.soloJesters.available.slice().sort()[0]
    if (cardId) return { type: 'set-intent', intent: { type: 'use-solo-jester', cardId } }
    return { type: 'set-intent', intent: { type: 'use-solo-jester', cardId: 'jester-1' } }
  }
  if (command === 'enter' || command === '') return { type: 'commit' }
  if (command === 'f') return { type: 'fast-forward' }
  if (command === 'h') return { type: 'toggle-oracle' }
  if (command === 'r') return { type: 'reset', game: state.game }
  if (command === 'e') return { type: 'external-stale' }
  const blockers: Record<string, Blocker> = {
    b: 'background',
    m: 'modal',
    g: 'renderer',
    o: 'orientation',
    v: 'viewport',
  }
  if (blockers[command]) return { type: 'toggle-blocker', blocker: blockers[command]! }
  const index = Number(command) - 1
  const cardId = state.game.players[0]?.hand[index]
  if (cardId) return { type: 'toggle-card', cardId }
  return null
}

function renderOracle(fixture: FixtureDefinition, game: GameState): string[] {
  if (!fixture.alternateTavernDeck) return []
  const alternate = createGameFromFixture(fixture, fixture.alternateTavernDeck)
  const jesterId = fixture.soloAvailable.slice().sort()[0] ?? 'jester-1'
  const intent = { type: 'use-solo-jester' as const, cardId: jesterId }
  const actual = previewIntent(game, intent)
  const hidden = previewIntent(alternate, intent)
  const actualResult = dispatchForOracle(game, intent)
  const hiddenResult = dispatchForOracle(alternate, intent)
  return [
    `${bold('暗牌 oracle（仅原型调试）')}:`,
    `  公开投影相同：${compact(publicProjection(game)) === compact(publicProjection(alternate)) ? '是' : '否'}`,
    `  预览相同：${compact(actual) === compact(hidden) ? '是' : '否'}`,
    `  顶牌 A=${fixture.tavernDeck[0]} -> ${actualResult}`,
    `  顶牌 B=${fixture.alternateTavernDeck[0]} -> ${hiddenResult}`,
  ]
}

function dispatchForOracle(
  game: GameState,
  intent: { type: 'use-solo-jester'; cardId: CardId },
): string {
  const result = dispatch(game, {
    type: 'use-solo-jester',
    actorId: 'local-player',
    cardId: intent.cardId,
  })
  return result.accepted
    ? `${result.state.status}/${result.state.pendingDecision ?? 'terminal'}`
    : `rejected/${result.reason}`
}

function render(fixture: FixtureDefinition, state: PrototypeState, index: number): void {
  console.clear()
  const player = state.game.players[0]!
  const capabilities = getCapabilities(state)
  const intent = intentFromSelection(state)
  const beforePreview = stateFingerprint(state.game)
  const preview = intent ? previewIntent(state.game, intent) : null
  const afterPreview = stateFingerprint(state.game)
  const legal = new Set(legalCardIds(state))
  const blockers = state.blockers.length
    ? state.blockers.map((blocker) => blockerNames[blocker]).join('、')
    : '无'

  console.log(
    `${bold('PROTOTYPE — 进行中的牌桌逻辑')}  ${dim(`场景 ${index + 1}/${fixtures.length}`)}`,
  )
  console.log(`${bold(fixture.name)}  ${dim(fixture.question)}`)
  console.log('')
  console.log(`${bold('公开快照')}`)
  console.log(
    `  status=${state.game.status}  decision=${decisionNames[state.game.pendingDecision ?? ''] ?? '无'}`,
  )
  console.log(`  敌人：${enemyLabel(state.game)}`)
  console.log(
    `  牌区：城堡 ${state.game.castleDeck.length}  酒馆 ${state.game.tavernDeck.length}  弃牌 ${state.game.discardPile.length}`,
  )
  console.log(
    `  反击伤害=${getCounterattackDamage(state.game)}  手牌总点数=${getAttackValue(player.hand)}  random=${state.game.random.state}`,
  )
  console.log(
    `  手牌：${player.hand.map((cardId, cardIndex) => `${cardIndex + 1}:${cardLabel(cardId)}${legal.has(cardId) ? '' : dim('*')}`).join('  ') || '空'}`,
  )
  console.log('')
  console.log(`${bold('瞬时表现状态')}`)
  console.log(
    `  selected=[${state.selectedCardIds.join(', ')}]  intent=${intent ? compact(intent) : 'null'}`,
  )
  console.log(`  preview=${previewLabel(preview)}`)
  console.log(`  blockers=${blockers}`)
  console.log(`  capabilities=${compact(capabilities)}`)
  console.log(`  animation=${state.animationCues.length ? state.animationCues.join(' | ') : '空'}`)
  if (state.lastResult) {
    console.log(`  last=${state.lastResult.status}: ${state.lastResult.detail}`)
    if (state.lastResult.events.length)
      console.log(`  events=${state.lastResult.events.map(eventLabel).join(' -> ')}`)
  }
  console.log(`  preview purity=${beforePreview === afterPreview ? 'input unchanged' : 'CHANGED'}`)
  if (state.showOracle) {
    console.log('')
    for (const line of renderOracle(fixture, state.game)) console.log(line)
  }
  console.log('')
  console.log(
    `${bold('操作')} ${dim('[1-8] 选牌  [x] 清空  [y] 让牌预览  [j] Solo Jester  [Enter] 提交')}`,
  )
  console.log(
    `${dim('[b]后台 [m]弹窗 [g]渲染器 [o]横屏 [v]视口 [e]外部失效 [f]快进 [h]oracle [r]重置 [n]/[p]场景 [q]退出')}`,
  )
}

async function main(): Promise<void> {
  let index = 0
  let state = initialState(createGameFromFixture(fixtures[index]!))
  const readline = createInterface({ input, output })
  render(fixtures[index]!, state, index)
  for await (const line of readline) {
    const command = line.trim().toLowerCase()
    if (command === 'q' || command === 'quit') break
    if (command === 'n' || command === 'p') {
      index =
        command === 'n'
          ? (index + 1) % fixtures.length
          : (index - 1 + fixtures.length) % fixtures.length
      state = initialState(createGameFromFixture(fixtures[index]!))
    } else if (command === 'r') {
      state = initialState(createGameFromFixture(fixtures[index]!))
    } else {
      const action = actionForLine(command, state)
      if (action) state = reduce(state, action, { commitMode: fixtures[index]!.commitMode })
    }
    render(fixtures[index]!, state, index)
  }
  readline.close()
}

await main()
