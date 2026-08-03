#!/usr/bin/env node

import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import {
  createGame,
  dispatch,
  getCard,
  getCurrentEnemyStats,
  getLegalCommands,
} from '@regicide/game-core'
import type { GameCommand, GameEvent, GameState } from '@regicide/game-core'

const suitNames = { hearts: '红桃', diamonds: '方块', clubs: '梅花', spades: '黑桃' } as const
const rankNames = {
  jack: '侍从',
  queen: '王后',
  king: '国王',
  'animal-companion': '伙伴',
  jester: '小丑',
} as const
const decisionNames = {
  'play-or-yield': '出牌或跳过',
  'discard-for-damage': '弃牌抵挡反击',
  'choose-next-player': '选择下一位玩家',
} as const
const outcomeNames = { won: '胜利', lost: '失败', 'in-progress': '进行中' } as const
const lossReasonNames = {
  'cannot-suffer-damage': '手牌不足以抵挡反击伤害',
  'cannot-play-or-yield': '无法出牌或跳过回合',
} as const
const rejectionNames: Record<string, string> = {
  'game-over': '游戏已经结束',
  'wrong-player': '还没有轮到这名玩家',
  'wrong-decision': '当前阶段不能执行这个操作',
  'card-not-in-hand': '所选牌不在手牌中',
  'duplicate-card': '不能重复选择同一张牌',
  'illegal-play': '这组牌不符合出牌规则',
  'yield-not-allowed': '当前不能跳过回合',
  'insufficient-discard': '弃牌点数不足',
  'invalid-next-player': '选择的玩家无效',
  'solo-jester-unavailable': 'Solo Jester 当前不可用',
}

function cardLabel(cardId: string): string {
  const card = getCard(cardId)
  if (card.kind === 'jester') return card.id.replace('jester-', '小丑 ')
  const rank = typeof card.rank === 'number' ? String(card.rank) : rankNames[card.rank]
  return `${suitNames[card.suit]}-${rank}`
}

function parseArgs(args: readonly string[]): { players: string[]; seed: string } {
  const playersArg = args.find((arg) => arg.startsWith('--players='))?.slice('--players='.length)
  const seed =
    args.find((arg) => arg.startsWith('--seed='))?.slice('--seed='.length) ?? String(Date.now())
  const count = playersArg ? Number(playersArg) : 1
  if (!Number.isInteger(count) || count < 1 || count > 4) {
    throw new Error('--players 必须是 1 到 4 之间的整数')
  }
  return { players: Array.from({ length: count }, (_, index) => `Player ${index + 1}`), seed }
}

function renderEnemy(state: GameState): string {
  if (!state.currentEnemy) return '没有剩余敌人'
  const enemy = getCard(state.currentEnemy.cardId)
  const stats = getCurrentEnemyStats(state)
  if (!stats || enemy.kind !== 'suited') return cardLabel(enemy.id)
  return `${cardLabel(enemy.id)}  生命 ${stats.healthRemaining}/${stats.health}  攻击 ${stats.attack}  护盾 ${stats.shield}`
}

function renderState(state: GameState): void {
  console.log(`\n当前敌人：${renderEnemy(state)}`)
  console.log(
    `城堡牌：${state.castleDeck.length}  酒馆牌：${state.tavernDeck.length}  弃牌：${state.discardPile.length}`,
  )
  const player = state.players.find((candidate) => candidate.id === state.currentPlayerId)
  if (!player) return
  console.log(
    `\n轮到 ${player.id}（${state.pendingDecision ? decisionNames[state.pendingDecision] : '无'}）`,
  )
  console.log(
    player.hand.map((cardId, index) => `${index + 1}:${cardLabel(cardId)}`).join('  ') ||
      '(empty hand)',
  )
}

function commandLabel(command: GameCommand): string {
  switch (command.type) {
    case 'play-cards':
      return `出牌：${command.cardIds.map(cardLabel).join(' + ')}`
    case 'yield':
      return '跳过本回合'
    case 'discard-for-damage':
      return `弃掉 ${command.cardIds.map(cardLabel).join(' + ')}`
    case 'choose-next-player':
      return `选择 ${command.playerId}`
    case 'use-solo-jester':
      return `使用 ${cardLabel(command.cardId)}`
  }
}

function printEvents(events: readonly GameEvent[]): void {
  for (const event of events) {
    switch (event.type) {
      case 'cards-played':
        console.log(
          `  ${event.playerId} 打出了 ${event.cardIds.map(cardLabel).join(' + ')}（攻击力 ${event.attackValue}）`,
        )
        break
      case 'player-yielded':
        console.log(`  ${event.playerId} 跳过了本回合`)
        break
      case 'counterattack-required':
        console.log(`  反击来了：请弃掉总点数至少为 ${event.amount} 的牌`)
        break
      case 'damage-suffered':
        console.log(
          `  ${event.playerId} 弃掉了 ${event.cardIds.map(cardLabel).join(' + ') || '没有牌'}，承受 ${event.amount} 点伤害`,
        )
        break
      case 'enemy-defeated':
        console.log(`  敌人被击败${event.exact ? '（精确击败）' : ''}`)
        break
      case 'enemy-revealed':
        console.log(`  新敌人：${cardLabel(event.enemyId)}`)
        break
      case 'game-won':
        console.log(`  游戏胜利${event.rating ? `（${event.rating}）` : ''}！`)
        break
      case 'game-lost':
        console.log(`  游戏失败：${lossReasonNames[event.reason]}`)
        break
      case 'next-player-chosen':
        console.log(`  ${event.chosenBy} 选择了 ${event.playerId}`)
        break
      case 'solo-jester-used':
        console.log(
          `  ${event.playerId} 使用了 ${cardLabel(event.cardId)}，重新摸了 ${event.drawnCardIds.length} 张牌`,
        )
        break
      case 'diamonds-resolved':
        if (event.draws.length > 0)
          console.log(`  摸到：${event.draws.map((draw) => cardLabel(draw.cardId)).join('、')}`)
        break
      case 'hearts-resolved':
        if (event.cardIds.length > 0)
          console.log(`  从弃牌堆收回：${event.cardIds.map(cardLabel).join('、')}`)
        break
      case 'enemy-damaged':
      case 'enemy-immunity-cancelled':
      case 'turn-started':
        break
    }
  }
}

async function chooseCommand(
  state: GameState,
  readline: ReturnType<typeof createInterface>,
): Promise<GameCommand> {
  const actorId = state.currentPlayerId
  const commands = getLegalCommands(state, actorId)
  console.log('\n可执行操作：')
  commands.forEach((command, index) => console.log(`  ${index + 1}. ${commandLabel(command)}`))
  while (true) {
    const answer = (await readline.question('请输入操作编号（输入 q 退出）：')).trim().toLowerCase()
    if (answer === 'q' || answer === 'quit') throw new QuitGame()
    const index = Number(answer) - 1
    if (Number.isInteger(index) && commands[index]) return commands[index]
    console.log('请输入列表中的操作编号。')
  }
}

class QuitGame extends Error {}

export async function runCli(args = process.argv.slice(2)): Promise<void> {
  const config = parseArgs(args)
  let state = createGame({
    playerIds: config.players,
    startingPlayerId: config.players[0]!,
    seed: config.seed,
  })
  const readline = createInterface({ input, output })
  console.log(`Regicide 命令行版 - ${config.players.length} 名玩家 - seed：${config.seed}`)
  console.log('任何输入提示处都可以输入 q 退出。')
  console.log('牌面示例：梅花-4、红桃-伙伴、黑桃-侍从。')
  try {
    while (state.status === 'in-progress') {
      renderState(state)
      const command = await chooseCommand(state, readline)
      const result = dispatch(state, command)
      if (!result.accepted) {
        console.log(`操作被拒绝：${rejectionNames[result.reason] ?? result.reason}`)
        continue
      }
      state = result.state
      printEvents(result.events)
    }
    const outcome = state.outcome?.type ?? state.status
    console.log(`\n游戏结束：${outcomeNames[outcome]}`)
  } catch (error) {
    if (!(error instanceof QuitGame)) throw error
    console.log('\n已退出游戏。')
  } finally {
    readline.close()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await runCli()
