import { useRef, useState } from 'react'
import { IMAGE_FILES } from '../../game/assets/manifest.ts'
import { buildGalleryCatalog } from '../../game/gallery/catalog.ts'
import { zh } from '../../game/i18n/zh.ts'
import { GalleryVisual } from '../CardFace.tsx'
import { UiButton } from '../UiButton.tsx'

type Props = {
  onBack: () => void
}

const SWIPE_THRESHOLD = 48
const CATALOG = buildGalleryCatalog()

export function GalleryPage({ onBack }: Props) {
  const [index, setIndex] = useState(0)
  const dragX = useRef<number | null>(null)

  const step = (delta: number): void => {
    const n = CATALOG.length
    setIndex((i) => (i + delta + n) % n)
  }

  const entry = CATALOG[index]!

  return (
    <div
      className="shell-page shell-page--gallery"
      style={{ backgroundImage: `url(${IMAGE_FILES.bg_table})` }}
    >
      <header className="shell-header">
        <h1 className="shell-header__title">{zh.gallery}</h1>
        <p className="shell-header__hint">{zh.galleryHint}</p>
      </header>

      <div className="gallery-stage">
        <UiButton
          variant="nav"
          className="gallery-nav gallery-nav--prev"
          aria-label="上一张"
          onClick={() => step(-1)}
        >
          ‹
        </UiButton>

        <div
          className="gallery-focus"
          onPointerDown={(e) => {
            dragX.current = e.clientX
          }}
          onPointerUp={(e) => {
            if (dragX.current === null) return
            const dx = e.clientX - dragX.current
            dragX.current = null
            if (dx <= -SWIPE_THRESHOLD) step(1)
            else if (dx >= SWIPE_THRESHOLD) step(-1)
          }}
          onPointerCancel={() => {
            dragX.current = null
          }}
        >
          <GalleryVisual kind={entry.kind} card={entry.card} className="gallery-card" />
          <div className="gallery-caption">
            <h2 className="gallery-caption__title">{entry.title}</h2>
            <p className="gallery-caption__sub">{entry.subtitle}</p>
            <p className="gallery-caption__body">{entry.blurb}</p>
          </div>
        </div>

        <UiButton
          variant="nav"
          className="gallery-nav gallery-nav--next"
          aria-label="下一张"
          onClick={() => step(1)}
        >
          ›
        </UiButton>
      </div>

      <p className="gallery-counter">
        {index + 1} / {CATALOG.length}
      </p>

      <footer className="shell-footer">
        <UiButton onClick={onBack}>{zh.back}</UiButton>
      </footer>
    </div>
  )
}
