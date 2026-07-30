import { useGame } from '../react/useGame'
import { CardView } from './CardView'

export function GameBoard() {
  const { state, selectedPower, dispatch } = useGame()
  const { game, selectedCardIds } = state
  const healthPercent = (game.enemy.health / game.enemy.maxHealth) * 100
  const canPlay = selectedCardIds.length > 0 && game.phase === 'player-turn'

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
          <span>回合</span>
          <strong>{game.turn.toString().padStart(2, '0')}</strong>
        </div>
      </header>

      <section className="battlefield" aria-label="战场">
        <div className="enemy-aura" aria-hidden="true" />
        <div className="enemy">
          <div className="enemy__crown">♛</div>
          <p>堕落王庭 · 守门者</p>
          <h1>{game.enemy.name}</h1>
          <div className="health">
            <div className="health__labels">
              <span>生命</span>
              <strong>
                {game.enemy.health} / {game.enemy.maxHealth}
              </strong>
            </div>
            <div className="health__track">
              <span style={{ width: `${healthPercent}%` }} />
            </div>
          </div>
        </div>

        <aside className="battle-log" aria-label="战斗日志">
          <span>战况</span>
          <p>{game.log[0]}</p>
        </aside>
      </section>

      <section className="player-area">
        <div className="hand-heading">
          <div>
            <span>你的手牌</span>
            <small>{game.hand.length} 张可用</small>
          </div>
          <p>
            已选力量 <strong>{selectedPower}</strong>
          </p>
        </div>

        <div className="hand" role="group" aria-label="选择手牌">
          {game.hand.map((card) => (
            <CardView
              key={card.id}
              card={card}
              selected={selectedCardIds.includes(card.id)}
              onToggle={() => dispatch({ type: 'card/toggle', cardId: card.id })}
            />
          ))}
          {game.hand.length === 0 && game.phase !== 'victory' && (
            <p className="empty-hand">手牌已耗尽。</p>
          )}
        </div>

        <div className="actions">
          {game.phase === 'victory' ? (
            <button
              className="primary-action"
              type="button"
              onClick={() => dispatch({ type: 'game/restart' })}
            >
              再战一次
            </button>
          ) : (
            <button
              className="primary-action"
              type="button"
              disabled={!canPlay}
              onClick={() => dispatch({ type: 'cards/play' })}
            >
              <span>打出卡牌</span>
              <small>{selectedPower > 0 ? `造成 ${selectedPower} 点伤害` : '先选择卡牌'}</small>
            </button>
          )}
        </div>
      </section>
    </main>
  )
}
