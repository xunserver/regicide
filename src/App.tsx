import { useState } from 'react'
import { GameCanvas, type TableLaunch } from './ui/GameCanvas.tsx'
import { CodexPage } from './ui/screens/CodexPage.tsx'
import { GalleryPage } from './ui/screens/GalleryPage.tsx'
import { MenuPage, type MenuAction } from './ui/screens/MenuPage.tsx'

type Screen = 'menu' | 'codex' | 'gallery' | 'table'

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [tableLaunch, setTableLaunch] = useState<TableLaunch>({ seed: Date.now() >>> 0 })

  const onMenuAction = (action: MenuAction): void => {
    switch (action) {
      case 'new':
        setTableLaunch({ seed: Date.now() >>> 0 })
        setScreen('table')
        break
      case 'continue':
        setTableLaunch({ resume: true })
        setScreen('table')
        break
      case 'codex':
        setScreen('codex')
        break
      case 'gallery':
        setScreen('gallery')
        break
    }
  }

  return (
    <div className="app-shell">
      {screen === 'menu' ? <MenuPage onAction={onMenuAction} /> : null}
      {screen === 'codex' ? <CodexPage onBack={() => setScreen('menu')} /> : null}
      {screen === 'gallery' ? <GalleryPage onBack={() => setScreen('menu')} /> : null}
      {screen === 'table' ? (
        <GameCanvas launch={tableLaunch} onExitToMenu={() => setScreen('menu')} />
      ) : null}
    </div>
  )
}
