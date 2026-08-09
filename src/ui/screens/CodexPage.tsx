import { IMAGE_FILES } from '../../game/assets/manifest.ts'
import { CODEX_SECTIONS } from '../../game/i18n/codexZh.ts'
import { zh } from '../../game/i18n/zh.ts'
import { UiButton } from '../UiButton.tsx'

type Props = {
  onBack: () => void
}

export function CodexPage({ onBack }: Props) {
  return (
    <div
      className="shell-page shell-page--codex"
      style={{ backgroundImage: `url(${IMAGE_FILES.bg_table})` }}
    >
      <header className="shell-header">
        <h1 className="shell-header__title">{zh.codex}</h1>
        <p className="shell-header__hint">{zh.codexHint}</p>
      </header>

      <article className="codex-panel">
        {CODEX_SECTIONS.map((section) => (
          <section key={section.title} className="codex-section">
            <h2 className="codex-section__title">{section.title}</h2>
            <p className="codex-section__body">{section.body}</p>
          </section>
        ))}
      </article>

      <footer className="shell-footer">
        <UiButton onClick={onBack}>{zh.back}</UiButton>
      </footer>
    </div>
  )
}
