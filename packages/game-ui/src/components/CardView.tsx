import { getCardValue, type Card, type Suit } from '@regicide/game-application'

const suitSymbol: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const suitName: Record<Suit, string> = {
  hearts: '红心',
  diamonds: '方块',
  clubs: '梅花',
  spades: '黑桃',
}

function rankLabel(card: Card): string {
  if (card.kind === 'jester') return 'J'
  if (typeof card.rank === 'number') return String(card.rank)
  if (card.rank === 'animal-companion') return 'A'
  return { jack: 'J', queen: 'Q', king: 'K' }[card.rank]
}

interface CardViewProps {
  readonly card: Card
  readonly selected: boolean
  readonly onToggle: () => void
}

export function CardView({ card, selected, onToggle }: CardViewProps) {
  const value = getCardValue(card.id)
  const symbol = card.kind === 'suited' ? suitSymbol[card.suit] : '✦'
  const name = card.kind === 'suited' ? `${suitName[card.suit]} ${rankLabel(card)}` : 'Jester'
  const suitClass = card.kind === 'suited' ? card.suit : 'jester'

  return (
    <button
      className={`card card--${suitClass}${selected ? ' is-selected' : ''}`}
      type="button"
      aria-pressed={selected}
      aria-label={`${name}，牌值 ${value}`}
      onClick={onToggle}
    >
      <span className="card__corner">
        <strong>{rankLabel(card)}</strong>
        <span>{symbol}</span>
      </span>
      <span className="card__sigil" aria-hidden="true">
        {symbol}
      </span>
      <span className="card__content">
        <strong>{name}</strong>
        <small>牌值 {value}</small>
      </span>
    </button>
  )
}
