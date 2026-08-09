import { IMAGE_FILES } from '../../game/assets/manifest.ts'
import { zh } from '../../game/i18n/zh.ts'
import { DEFAULT_STORAGE_KEY } from '../../orchestration/persist.ts'
import { UiButton } from '../UiButton.tsx'

export type MenuAction = 'new' | 'continue' | 'codex' | 'gallery'

type Props = {
  onAction: (action: MenuAction) => void
}

function canContinue(): boolean {
  try {
    return localStorage.getItem(DEFAULT_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

export function MenuPage({ onAction }: Props) {
  const showContinue = canContinue()

  return (
    <div
      className="shell-page menu-page"
      style={{ backgroundImage: `url(${IMAGE_FILES.bg_table})` }}
    >
      <div className="menu-page__hero" aria-hidden>
        <img className="menu-page__card menu-page__card--back" src={IMAGE_FILES.card_back} alt="" />
        <img className="menu-page__card menu-page__card--royal" src={IMAGE_FILES.royal_king} alt="" />
      </div>

      <header className="menu-page__brand">
        <h1 className="menu-page__title">{zh.brand}</h1>
        <p className="menu-page__tagline">{zh.tagline}</p>
      </header>

      <nav className="menu-page__actions" aria-label="主菜单">
        <UiButton onClick={() => onAction('new')}>{zh.newSolo}</UiButton>
        {showContinue ? (
          <UiButton onClick={() => onAction('continue')}>{zh.continue}</UiButton>
        ) : null}
        <UiButton onClick={() => onAction('codex')}>{zh.codex}</UiButton>
        <UiButton onClick={() => onAction('gallery')}>{zh.gallery}</UiButton>
      </nav>
    </div>
  )
}
