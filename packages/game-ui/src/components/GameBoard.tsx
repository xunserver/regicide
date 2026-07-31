import {
  getCard,
  getCounterattackDamage,
  getCurrentEnemyStats,
  getCurrentPlayer,
  getLegalCommands,
  getSelectedSubmitCommand,
  type GameEvent,
  type RoyalRank,
  type Suit,
} from '@regicide/game-application'
import { useGame } from '../react/useGame'
import { CardView } from './CardView'

const rankName: Record<RoyalRank, string> = {
  jack: 'JACK',
  queen: 'QUEEN',
  king: 'KING',
}

const suitName: Record<Suit, string> = {
  hearts: 'HEARTS',
  diamonds: 'DIAMONDS',
  clubs: 'CLUBS',
  spades: 'SPADES',
}

function eventMessage(event: GameEvent | undefined): string {
  if (!event) return '王庭已经开启。'
  switch (event.type) {
    case 'cards-played':
      return `打出 ${event.cardIds.length} 张牌，攻击值 ${event.attackValue}。`
    case 'hearts-resolved':
      return `Hearts 恢复了 ${event.cardIds.length} 张牌。`
    case 'diamonds-resolved':
      return `Diamonds 抽取了 ${event.draws.length} 张牌。`
    case 'enemy-immunity-cancelled':
      return 'Jester 解除了当前敌人的花色免疫。'
    case 'enemy-damaged':
      return `造成 ${event.amount} 点伤害，累计 ${event.totalDamage} 点。`
    case 'enemy-defeated':
      return event.exact ? '精准击败敌人，王室牌回到 Tavern 顶。' : '敌人被超额击败。'
    case 'enemy-revealed':
      return '下一位王室敌人现身。'
    case 'counterattack-required':
      return `敌人反击，需要承受 ${event.amount} 点伤害。`
    case 'damage-suffered':
      return `弃置 ${event.cardIds.length} 张牌承受反击。`
    case 'player-yielded':
      return '本回合选择 Yield。'
    case 'next-player-chosen':
      return 'Jester 已指定下一位玩家。'
    case 'solo-jester-used':
      return `Jester 重整手牌，抽取 ${event.drawnCardIds.length} 张牌。`
    case 'turn-started':
      return '新的玩家回合开始。'
    case 'game-won':
      return event.rating ? `${event.rating.toUpperCase()} VICTORY` : 'VICTORY'
    case 'game-lost':
      return '本次进攻宣告失败。'
  }
}

export function GameBoard() {
  const { state, selectedValue, dispatch } = useGame()
  const { game, selectedCardIds } = state
  const player = getCurrentPlayer(state)
  const enemyCard = game.currentEnemy ? getCard(game.currentEnemy.cardId) : null
  const enemyStats = getCurrentEnemyStats(game)
  const legalCommands = getLegalCommands(game, game.currentPlayerId)
  const selectedCommand = getSelectedSubmitCommand(state)
  const yieldAvailable = legalCommands.some((command) => command.type === 'yield')
  const soloJester = legalCommands.find((command) => command.type === 'use-solo-jester')
  const counterattack = getCounterattackDamage(game)
  const enemyNumber = game.currentEnemy ? 12 - game.castleDeck.length : 12
  const healthPercent = enemyStats ? (enemyStats.healthRemaining / enemyStats.health) * 100 : 0
  const isTerminal = game.status !== 'in-progress'
  const isDiscarding = game.pendingDecision === 'discard-for-damage'
  const lastMessage = eventMessage(state.lastEvents.at(-1))

  const enemyTitle =
    enemyCard?.kind === 'suited' && typeof enemyCard.rank !== 'number'
      ? enemyCard.rank === 'animal-companion'
        ? 'ANIMAL COMPANION'
        : `${rankName[enemyCard.rank]} OF ${suitName[enemyCard.suit]}`
      : 'FALLEN COURT'

  return (
    <main className="game-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">R</span>
          <div>
            <strong>REGICIDE</strong>
            <small>THE FALLEN COURT</small>
          </div>
        </div>
        <div className="turn-indicator">
          <span>敌人</span>
          <strong>{enemyNumber.toString().padStart(2, '0')}</strong>
        </div>
      </header>

      <section className="battlefield" aria-label="战场">
        <div className="enemy-aura" aria-hidden="true" />
        <div className="enemy">
          <div className="enemy__crown">♛</div>
          <p>堕落王庭 · 当前敌人</p>
          <h1>{enemyTitle}</h1>
          {enemyStats && (
            <>
              <div className="health">
                <div className="health__labels">
                  <span>生命</span>
                  <strong>
                    {enemyStats.healthRemaining} / {enemyStats.health}
                  </strong>
                </div>
                <div className="health__track">
                  <span style={{ width: `${healthPercent}%` }} />
                </div>
              </div>
              <div className="enemy__stats">
                <span>反击 {counterattack}</span>
                <span>护盾 {enemyStats.shield}</span>
              </div>
            </>
          )}
        </div>

        <aside className="battle-log" aria-label="战斗日志">
          <span>战况</span>
          <p>{lastMessage}</p>
        </aside>
      </section>

      <section className="player-area">
        <div className="hand-heading">
          <div>
            <span>{isDiscarding ? '选择承伤牌' : '你的手牌'}</span>
            <small>{player.hand.length} 张可用</small>
          </div>
          <p>
            已选牌值 <strong>{selectedValue}</strong>
          </p>
        </div>

        <div className="hand" role="group" aria-label="选择手牌">
          {player.hand.map((cardId) => (
            <CardView
              key={cardId}
              card={getCard(cardId)}
              selected={selectedCardIds.includes(cardId)}
              onToggle={() => dispatch({ type: 'card/toggle', cardId })}
            />
          ))}
          {player.hand.length === 0 && !isTerminal && <p className="empty-hand">手牌已耗尽。</p>}
        </div>

        <div className="actions">
          {isTerminal ? (
            <button
              className="primary-action"
              type="button"
              onClick={() => dispatch({ type: 'game/restart' })}
            >
              <span>{game.status === 'won' ? '再次挑战' : '重新开始'}</span>
              <small>
                {game.outcome?.type === 'won' && game.outcome.rating
                  ? `${game.outcome.rating.toUpperCase()} VICTORY`
                  : game.status.toUpperCase()}
              </small>
            </button>
          ) : (
            <>
              {yieldAvailable && (
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => dispatch({ type: 'game/yield' })}
                >
                  Yield
                </button>
              )}
              {soloJester?.type === 'use-solo-jester' && (
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => dispatch({ type: 'solo-jester/use', cardId: soloJester.cardId })}
                >
                  使用 Jester
                </button>
              )}
              <button
                className="primary-action"
                type="button"
                disabled={!selectedCommand}
                onClick={() => dispatch({ type: 'cards/submit' })}
              >
                <span>{isDiscarding ? '弃牌承伤' : '打出卡牌'}</span>
                <small>
                  {selectedCardIds.length === 0
                    ? '先选择卡牌'
                    : selectedCommand
                      ? isDiscarding
                        ? `承受 ${counterattack} 点伤害`
                        : `攻击值 ${selectedValue}`
                      : '当前组合不合法'}
                </small>
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
