import type { Card, Rank, Suit } from '../core/index.ts'
import { IMAGE_FILES, SUIT_COLOR } from '../game/assets/manifest.ts'

function royalUrl(rank: Rank): string | null {
  if (rank === 'J') return IMAGE_FILES.royal_jack
  if (rank === 'Q') return IMAGE_FILES.royal_queen
  if (rank === 'K') return IMAGE_FILES.royal_king
  return null
}

function suitUrl(suit: Suit): string {
  switch (suit) {
    case 'H':
      return IMAGE_FILES.suit_heart
    case 'D':
      return IMAGE_FILES.suit_diamond
    case 'C':
      return IMAGE_FILES.suit_club
    case 'S':
      return IMAGE_FILES.suit_spade
  }
}

function aceUrl(suit: Suit): string {
  switch (suit) {
    case 'H':
      return IMAGE_FILES.ace_heart
    case 'D':
      return IMAGE_FILES.ace_diamond
    case 'C':
      return IMAGE_FILES.ace_club
    case 'S':
      return IMAGE_FILES.ace_spade
  }
}

type CardFaceProps = {
  card: Card
  className?: string
}

/** HTML twin of Phaser CardView for shell screens. */
export function CardFace({ card, className = '' }: CardFaceProps) {
  const royal = royalUrl(card.rank)
  const color = SUIT_COLOR[card.suit]

  if (royal) {
    return (
      <div className={`card-face ${className}`.trim()} style={{ color }}>
        <img className="card-face__bg" src={royal} alt="" draggable={false} />
        <img
          className="card-face__suit card-face__suit--tl"
          src={suitUrl(card.suit)}
          alt=""
          draggable={false}
        />
        <span className="card-face__rank card-face__rank--royal">{card.rank}</span>
      </div>
    )
  }

  if (card.rank === 'A') {
    return (
      <div className={`card-face ${className}`.trim()} style={{ color }}>
        <img className="card-face__bg" src={IMAGE_FILES.card_frame} alt="" draggable={false} />
        <img className="card-face__ace" src={aceUrl(card.suit)} alt="" draggable={false} />
        <span className="card-face__rank card-face__rank--tl">A</span>
        <img
          className="card-face__suit card-face__suit--br"
          src={suitUrl(card.suit)}
          alt=""
          draggable={false}
        />
      </div>
    )
  }

  return (
    <div className={`card-face ${className}`.trim()} style={{ color }}>
      <img className="card-face__bg" src={IMAGE_FILES.card_frame} alt="" draggable={false} />
      <span className="card-face__rank card-face__rank--tl">{card.rank}</span>
      <img className="card-face__pip" src={suitUrl(card.suit)} alt="" draggable={false} />
      <img
        className="card-face__suit card-face__suit--br"
        src={suitUrl(card.suit)}
        alt=""
        draggable={false}
      />
    </div>
  )
}

type GalleryVisualProps = {
  kind: 'card' | 'back' | 'jester'
  card?: Card
  className?: string
}

export function GalleryVisual({ kind, card, className = '' }: GalleryVisualProps) {
  if (kind === 'card' && card) {
    return <CardFace card={card} className={className} />
  }
  if (kind === 'jester') {
    return (
      <div className={`card-face card-face--plain ${className}`.trim()}>
        <img className="card-face__jester" src={IMAGE_FILES.jester} alt="" draggable={false} />
      </div>
    )
  }
  return (
    <div className={`card-face card-face--plain ${className}`.trim()}>
      <img className="card-face__bg" src={IMAGE_FILES.card_back} alt="" draggable={false} />
    </div>
  )
}
