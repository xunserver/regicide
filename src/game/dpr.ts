import * as Phaser from 'phaser'

/** Cap DPR to limit GPU memory on 3x/4x phones. */
export const MAX_DPR = 3

export function getDpr(scene?: Phaser.Scene): number {
  if (scene) {
    const fromReg = scene.game.registry.get('dpr') as number | undefined
    if (fromReg && fromReg > 0) return fromReg
  }
  if (typeof window === 'undefined') return 1
  return Math.min(window.devicePixelRatio || 1, MAX_DPR)
}

export type ViewSize = {
  /** Canvas / world width in device pixels (fills the screen). */
  width: number
  /** Canvas / world height in device pixels (fills the screen). */
  height: number
  dpr: number
}

/**
 * Full canvas size in device pixels.
 * With HiDPI buffer + zoom=1, layout in these units fills the phone screen.
 */
export function viewSize(scene: Phaser.Scene): ViewSize {
  return {
    width: scene.scale.width,
    height: scene.scale.height,
    dpr: getDpr(scene),
  }
}

/** Design CSS-pixel length → device pixels. */
export function du(n: number, scene?: Phaser.Scene): number {
  return n * getDpr(scene)
}

/** No camera zoom — world units are device pixels. */
export function applyHiDpiCamera(scene: Phaser.Scene): void {
  scene.cameras.main.setZoom(1)
  scene.cameras.main.setScroll(0, 0)
}

/** Keep zoom at 1 for the scene lifetime (idempotent). */
export function lockHiDpiCamera(scene: Phaser.Scene): void {
  applyHiDpiCamera(scene)
}

/**
 * Text style: font sizes are design CSS px and scaled to device pixels.
 * Canvas is already HiDPI, so text resolution stays 1.
 */
export function textStyle(
  style: Phaser.Types.GameObjects.Text.TextStyle,
  scene?: Phaser.Scene,
): Phaser.Types.GameObjects.Text.TextStyle {
  const dpr = getDpr(scene)
  const next: Phaser.Types.GameObjects.Text.TextStyle = { ...style, resolution: 1 }
  const fs = style.fontSize
  if (typeof fs === 'string' && fs.endsWith('px')) {
    next.fontSize = `${parseFloat(fs) * dpr}px`
  } else if (typeof fs === 'number') {
    next.fontSize = fs * dpr
  }
  if (typeof style.strokeThickness === 'number') {
    next.strokeThickness = style.strokeThickness * dpr
  }
  return next
}

/**
 * Backing store = host CSS size × DPR; CSS size stays 100% of host.
 * Layout uses device pixels (see viewSize / du) with camera zoom 1.
 */
export function bindHiDpiScaler(game: Phaser.Game, parent: HTMLElement): () => void {
  const sync = (): void => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    const cssW = Math.max(1, parent.clientWidth)
    const cssH = Math.max(1, parent.clientHeight)
    const rw = Math.max(1, Math.round(cssW * dpr))
    const rh = Math.max(1, Math.round(cssH * dpr))

    game.registry.set('dpr', dpr)
    game.registry.set('cssWidth', cssW)
    game.registry.set('cssHeight', cssH)

    if (game.scale.width !== rw || game.scale.height !== rh) {
      game.scale.resize(rw, rh)
    }

    const canvas = game.canvas
    if (canvas) {
      canvas.style.width = '100%'
      canvas.style.height = '100%'
      canvas.style.display = 'block'
      canvas.style.margin = '0'
    }

    for (const scene of game.scene.getScenes(true)) {
      applyHiDpiCamera(scene)
    }
  }

  game.events.once(Phaser.Core.Events.READY, sync)

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => sync()) : null
  ro?.observe(parent)
  window.addEventListener('resize', sync)
  window.addEventListener('orientationchange', sync)

  if (game.isBooted) sync()

  return () => {
    ro?.disconnect()
    window.removeEventListener('resize', sync)
    window.removeEventListener('orientationchange', sync)
  }
}
