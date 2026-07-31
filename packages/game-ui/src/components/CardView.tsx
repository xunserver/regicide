import type { Card, Suit } from '@regicide/game-application'

const suitSymbol: Record<Suit, string> = {
  heart: '♥',
  diamond: '♦',
  club: '♣',
  spade: '♠',
}

interface CardViewProps {
  card: Card
  selected: boolean
  onToggle: () => void
}

export function CardView({ card, selected, onToggle }: CardViewProps) {
  return (
    <button
      className={`card card--${card.suit}${selected ? ' is-selected' : ''}`}
      type="button"
      aria-pressed={selected}
      aria-label={`${card.name}，力量 ${card.power}`}
      onClick={onToggle}
    >
      <span className="card__corner">
        <strong>{card.power}</strong>
        <span>{suitSymbol[card.suit]}</span>
      </span>
      <span className="card__sigil" aria-hidden="true">
        {suitSymbol[card.suit]}
      </span>
      <span className="card__content">
        <strong>{card.name}</strong>
        <small>{card.description}</small>
      </span>
    </button>
  )
}
