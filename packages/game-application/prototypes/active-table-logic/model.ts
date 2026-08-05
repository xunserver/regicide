import {
  CARD_IDS,
  dispatch,
  getAttackValue,
  getCard,
  getCardValue,
  getCounterattackDamage,
  getCurrentEnemyStats,
  getLegalCommands,
  parseGameState,
} from '@regicide/game-core'
import type { CardId, GameCommand, GameEvent, GameState, Suit } from '@regicide/game-core'

export type Blocker =
  'session' | 'renderer' | 'animation' | 'modal' | 'background' | 'orientation' | 'viewport'

export interface FixtureDefinition {
  readonly id: string
  readonly name: string
  readonly question: string
  readonly hand: readonly CardId[]
  readonly enemy: CardId
  readonly plays: readonly { readonly playerId: string; readonly cardIds: readonly CardId[] }[]
  readonly pendingDecision: GameState['pendingDecision']
  readonly castleDeck: readonly CardId[]
  readonly tavernDeck: readonly CardId[]
  readonly alternateTavernDeck?: readonly CardId[]
  readonly discardPile: readonly CardId[]
  readonly soloAvailable: readonly CardId[]
  readonly soloUsed: readonly CardId[]
  readonly commitMode: 'committed' | 'storage-error'
}

export type PlayerIntent =
  | { readonly type: 'play-cards'; readonly cardIds: readonly CardId[] }
  | { readonly type: 'yield' }
  | { readonly type: 'discard-for-damage'; readonly cardIds: readonly CardId[] }
  | { readonly type: 'use-solo-jester'; readonly cardId: CardId }

export type IntentPreview =
  | {
      readonly type: 'play-cards'
      readonly attackValue: number
      readonly activeSuits: readonly Suit[]
      readonly enemyHealth: number
      readonly enemyHealthAfter: number
      readonly counterattackDamage: number
      readonly enemyResult: 'damaged' | 'defeated-exact' | 'defeated-over'
      readonly next: string
      readonly resolution: 'known' | 'hidden-dependent'
    }
  | {
      readonly type: 'yield'
      readonly counterattackDamage: number
      readonly handValue: number
      readonly next: string
      readonly resolution: 'known'
    }
  | {
      readonly type: 'discard-for-damage'
      readonly required: number
      readonly selectedValue: number
      readonly overage: number
      readonly next: string
      readonly resolution: 'known'
    }
  | {
      readonly type: 'use-solo-jester'
      readonly discardedCount: number
      readonly drawCount: number
      readonly remainingJesters: number
      readonly counterattackDamage: number
      readonly next: string
      readonly resolution: 'known' | 'hidden-dependent'
    }

export interface Capabilities {
  readonly canSelectCards: boolean
  readonly canSubmitIntent: boolean
  readonly canFastForward: boolean
}

export interface LastResult {
  readonly status: 'committed' | 'storage-error' | 'rejected' | 'blocked' | 'not-ready'
  readonly detail: string
  readonly events: readonly GameEvent[]
}

export interface PrototypeState {
  readonly game: GameState
  readonly selectedCardIds: readonly CardId[]
  readonly intent: PlayerIntent | null
  readonly blockers: readonly Blocker[]
  readonly animationCues: readonly string[]
  readonly lastResult: LastResult | null
  readonly showOracle: boolean
}

export type PrototypeAction =
  | { readonly type: 'toggle-card'; readonly cardId: CardId }
  | { readonly type: 'set-intent'; readonly intent: PlayerIntent }
  | { readonly type: 'clear-selection' }
  | { readonly type: 'toggle-blocker'; readonly blocker: Blocker }
  | { readonly type: 'external-stale' }
  | { readonly type: 'commit' }
  | { readonly type: 'fast-forward' }
  | { readonly type: 'toggle-oracle' }
  | { readonly type: 'reset'; readonly game: GameState }

export interface PrototypeEnvironment {
  readonly commitMode: FixtureDefinition['commitMode']
}

const BLOCKING_REASONS: readonly Blocker[] = [
  'session',
  'renderer',
  'animation',
  'modal',
  'background',
  'orientation',
  'viewport',
]

const emptyEvents: readonly GameEvent[] = []

export function createGameFromFixture(
  fixture: FixtureDefinition,
  tavernDeck = fixture.tavernDeck,
): GameState {
  const players = [
    {
      id: 'local-player',
      hand: [...fixture.hand],
      maxHandSize: 8,
      yieldedLastTurn: false,
    },
  ]
  const plays = fixture.plays.map((play) => ({
    playerId: play.playerId,
    cardIds: [...play.cardIds],
  }))
  const occupied = new Set<CardId>([
    ...fixture.hand,
    fixture.enemy,
    ...plays.flatMap((play) => play.cardIds),
    ...fixture.castleDeck,
    ...tavernDeck,
    ...fixture.discardPile,
    ...fixture.soloAvailable,
    ...fixture.soloUsed,
  ])

  return parseGameState({
    schemaVersion: 1,
    status: 'in-progress',
    outcome: null,
    pendingDecision: fixture.pendingDecision,
    players,
    currentPlayerId: 'local-player',
    castleDeck: [...fixture.castleDeck],
    currentEnemy: { cardId: fixture.enemy, plays },
    tavernDeck: [...tavernDeck],
    discardPile: [...fixture.discardPile],
    soloJesters: {
      available: [...fixture.soloAvailable],
      used: [...fixture.soloUsed],
    },
    excludedCards: CARD_IDS.filter((cardId) => !occupied.has(cardId)),
    random: { algorithm: 'xorshift32', state: 246_813_579 },
  })
}

function sameCardSet(left: readonly CardId[], right: readonly CardId[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((cardId) => rightSet.has(cardId))
}

function commandToIntent(command: GameCommand): PlayerIntent | null {
  switch (command.type) {
    case 'play-cards':
      return { type: 'play-cards', cardIds: [...command.cardIds] }
    case 'yield':
      return { type: 'yield' }
    case 'discard-for-damage':
      return { type: 'discard-for-damage', cardIds: [...command.cardIds] }
    case 'use-solo-jester':
      return { type: 'use-solo-jester', cardId: command.cardId }
    case 'choose-next-player':
      return null
  }
}

function intentToCommand(intent: PlayerIntent): GameCommand {
  switch (intent.type) {
    case 'play-cards':
      return { type: 'play-cards', actorId: 'local-player', cardIds: [...intent.cardIds] }
    case 'yield':
      return { type: 'yield', actorId: 'local-player' }
    case 'discard-for-damage':
      return { type: 'discard-for-damage', actorId: 'local-player', cardIds: [...intent.cardIds] }
    case 'use-solo-jester':
      return { type: 'use-solo-jester', actorId: 'local-player', cardId: intent.cardId }
  }
}

function legalIntentForSelection(
  game: GameState,
  selectedCardIds: readonly CardId[],
): PlayerIntent | null {
  const commands = getLegalCommands(game, 'local-player')
  for (const command of commands) {
    const intent = commandToIntent(command)
    if (!intent) continue
    if (
      (intent.type === 'play-cards' || intent.type === 'discard-for-damage') &&
      sameCardSet(intent.cardIds, selectedCardIds)
    ) {
      return intent
    }
  }
  return null
}

function suitsFor(cardIds: readonly CardId[]): Suit[] {
  const suits: Suit[] = []
  for (const cardId of cardIds) {
    const card = getCard(cardId)
    if (card.kind === 'suited' && !suits.includes(card.suit)) suits.push(card.suit)
  }
  return suits
}

function nextLabel(game: GameState): string {
  if (game.status === 'won') return '胜利结算'
  if (game.status === 'lost')
    return `失败：${game.outcome?.type === 'lost' ? game.outcome.reason : 'unknown'}`
  return game.pendingDecision ?? '无决策'
}

export function previewIntent(game: GameState, intent: PlayerIntent): IntentPreview | null {
  const transition = dispatch(game, intentToCommand(intent))
  if (!transition.accepted) return null

  switch (intent.type) {
    case 'play-cards': {
      const before = getCurrentEnemyStats(game)
      const after = getCurrentEnemyStats(transition.state)
      if (!before) return null
      const defeat = transition.events.find((event) => event.type === 'enemy-defeated')
      const enemyResult = defeat ? (defeat.exact ? 'defeated-exact' : 'defeated-over') : 'damaged'
      const hiddenDependent =
        suitsFor(intent.cardIds).includes('diamonds') && game.tavernDeck.length > 0
      return {
        type: 'play-cards',
        attackValue: getAttackValue(intent.cardIds),
        activeSuits: suitsFor(intent.cardIds),
        enemyHealth: before.healthRemaining,
        enemyHealthAfter: defeat ? 0 : (after?.healthRemaining ?? 0),
        counterattackDamage: defeat ? 0 : getCounterattackDamage(transition.state),
        enemyResult,
        next: hiddenDependent ? '结果取决于暗牌' : nextLabel(transition.state),
        resolution: hiddenDependent ? 'hidden-dependent' : 'known',
      }
    }
    case 'yield': {
      const player = game.players[0]!
      const counterattackDamage = getCounterattackDamage(game)
      return {
        type: 'yield',
        counterattackDamage,
        handValue: getAttackValue(player.hand),
        next: nextLabel(transition.state),
        resolution: 'known',
      }
    }
    case 'discard-for-damage': {
      const required = getCounterattackDamage(game)
      const selectedValue = getAttackValue(intent.cardIds)
      return {
        type: 'discard-for-damage',
        required,
        selectedValue,
        overage: Math.max(0, selectedValue - required),
        next: nextLabel(transition.state),
        resolution: 'known',
      }
    }
    case 'use-solo-jester': {
      const hiddenDependent = game.tavernDeck.length > 0
      return {
        type: 'use-solo-jester',
        discardedCount: game.players[0]!.hand.length,
        drawCount: Math.min(game.players[0]!.maxHandSize, game.tavernDeck.length),
        remainingJesters: Math.max(0, game.soloJesters.available.length - 1),
        counterattackDamage: getCounterattackDamage(game),
        next: hiddenDependent ? '结果取决于暗牌' : nextLabel(transition.state),
        resolution: hiddenDependent ? 'hidden-dependent' : 'known',
      }
    }
  }
}

export function getSelectionIntent(state: PrototypeState): PlayerIntent | null {
  if (state.intent) return state.intent
  return legalIntentForSelection(state.game, state.selectedCardIds)
}

export function getCapabilities(state: PrototypeState): Capabilities {
  const blocked = state.blockers.some((blocker) => BLOCKING_REASONS.includes(blocker))
  const actionable = state.game.status === 'in-progress' && state.game.pendingDecision !== null
  return {
    canSelectCards: actionable && !blocked,
    canSubmitIntent: actionable && !blocked && getSelectionIntent(state) !== null,
    canFastForward: state.blockers.includes('animation'),
  }
}

function result(
  status: LastResult['status'],
  detail: string,
  events: readonly GameEvent[] = emptyEvents,
): LastResult {
  return { status, detail, events }
}

function cueForEvent(event: GameEvent): string {
  switch (event.type) {
    case 'cards-played':
      return `牌面：出牌 ${event.cardIds.join(' + ')}`
    case 'enemy-damaged':
      return `战场：敌人受到 ${event.amount} 点伤害`
    case 'counterattack-required':
      return `反击：需要承受 ${event.amount} 点`
    case 'damage-suffered':
      return `承伤：弃掉 ${event.cardIds.length} 张牌`
    case 'enemy-defeated':
      return `结算：${event.exact ? '精确' : '过量'}击败敌人`
    case 'enemy-revealed':
      return '结算：揭示下一位敌人'
    case 'player-yielded':
      return '操作：让牌'
    case 'solo-jester-used':
      return '操作：使用 Solo Jester'
    case 'game-won':
      return '结算：胜利'
    case 'game-lost':
      return `结算：失败（${event.reason}）`
    case 'hearts-resolved':
      return '花色：红桃回收弃牌'
    case 'diamonds-resolved':
      return `花色：方块抽取 ${event.draws.length} 张`
    case 'enemy-immunity-cancelled':
      return '花色：取消免疫'
    case 'next-player-chosen':
      return '流程：选择下一位玩家'
    case 'turn-started':
      return `流程：轮到 ${event.playerId}`
  }
}

function toggleBlocker(blockers: readonly Blocker[], blocker: Blocker): Blocker[] {
  return blockers.includes(blocker)
    ? blockers.filter((candidate) => candidate !== blocker)
    : [...blockers, blocker]
}

export function initialState(game: GameState): PrototypeState {
  return {
    game,
    selectedCardIds: [],
    intent: null,
    blockers: [],
    animationCues: [],
    lastResult: null,
    showOracle: false,
  }
}

export function reduce(
  state: PrototypeState,
  action: PrototypeAction,
  environment: PrototypeEnvironment,
): PrototypeState {
  switch (action.type) {
    case 'toggle-card': {
      if (!getCapabilities(state).canSelectCards) {
        return { ...state, lastResult: result('blocked', '当前有交互阻断，不能改动选择') }
      }
      const selectedCardIds = state.selectedCardIds.includes(action.cardId)
        ? state.selectedCardIds.filter((cardId) => cardId !== action.cardId)
        : [...state.selectedCardIds, action.cardId]
      return { ...state, selectedCardIds, intent: null, lastResult: null }
    }
    case 'set-intent': {
      if (!getCapabilities(state).canSelectCards) {
        return { ...state, lastResult: result('blocked', '当前有交互阻断，不能设置意图') }
      }
      return { ...state, selectedCardIds: [], intent: action.intent, lastResult: null }
    }
    case 'clear-selection':
      return { ...state, selectedCardIds: [], intent: null, lastResult: null }
    case 'toggle-blocker':
      return { ...state, blockers: toggleBlocker(state.blockers, action.blocker) }
    case 'external-stale': {
      const blockers = state.blockers.filter((blocker) => blocker !== 'animation')
      return {
        ...state,
        selectedCardIds: [],
        intent: null,
        blockers: blockers.includes('session') ? blockers : [...blockers, 'session'],
        animationCues: [],
        lastResult: result('blocked', '外部存档变化：会话已失效，请刷新'),
      }
    }
    case 'fast-forward':
      if (!getCapabilities(state).canFastForward) {
        return { ...state, lastResult: result('not-ready', '当前没有可快进的动画批次') }
      }
      return {
        ...state,
        blockers: state.blockers.filter((blocker) => blocker !== 'animation'),
        animationCues: [],
        lastResult: result('committed', '动画已快进到提交后快照'),
      }
    case 'toggle-oracle':
      return { ...state, showOracle: !state.showOracle }
    case 'reset':
      return initialState(action.game)
    case 'commit': {
      const capabilities = getCapabilities(state)
      if (!capabilities.canSubmitIntent) {
        return {
          ...state,
          lastResult: result(
            state.blockers.length > 0 ? 'blocked' : 'not-ready',
            state.blockers.length > 0 ? '提交被 blocker 拦截' : '还没有完整合法意图',
          ),
        }
      }
      const intent = getSelectionIntent(state)
      if (!intent) return { ...state, lastResult: result('not-ready', '还没有完整合法意图') }
      if (environment.commitMode === 'storage-error') {
        return {
          ...state,
          lastResult: result('storage-error', '模拟存档失败：旧快照和选择均保留'),
        }
      }

      const transition = dispatch(state.game, intentToCommand(intent))
      if (!transition.accepted) {
        return {
          ...state,
          selectedCardIds: [],
          intent: null,
          lastResult: result('rejected', `core 拒绝：${transition.reason}`),
        }
      }
      return {
        ...state,
        game: transition.state,
        selectedCardIds: [],
        intent: null,
        blockers: state.blockers.includes('animation')
          ? state.blockers
          : [...state.blockers, 'animation'],
        animationCues: transition.events.map(cueForEvent),
        lastResult: result('committed', '已保存并提交；事件只在本次结果中交付', transition.events),
      }
    }
  }
}

export function intentFromSelection(state: PrototypeState): PlayerIntent | null {
  return getSelectionIntent(state)
}

export function legalCardIds(state: PrototypeState): readonly CardId[] {
  const commands = getLegalCommands(state.game, 'local-player')
  const candidates = new Set<CardId>()
  for (const command of commands) {
    if (command.type === 'play-cards' || command.type === 'discard-for-damage') {
      for (const cardId of command.cardIds) candidates.add(cardId)
    }
  }
  return [...candidates]
}

export function stateFingerprint(game: GameState): string {
  return JSON.stringify(game)
}

export function publicProjection(game: GameState): Record<string, unknown> {
  const enemyStats = getCurrentEnemyStats(game)
  return {
    status: game.status,
    pendingDecision: game.pendingDecision,
    enemy: game.currentEnemy?.cardId,
    enemyStats,
    hand: game.players[0]?.hand,
    castleCount: game.castleDeck.length,
    tavernCount: game.tavernDeck.length,
    discardCount: game.discardPile.length,
    soloJesters: game.soloJesters.available.length,
  }
}
