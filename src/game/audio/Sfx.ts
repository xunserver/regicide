/**
 * Lightweight synthesized SFX via Web Audio.
 * No asset files required; unlocks on first user gesture.
 */

type RankTone = 'J' | 'Q' | 'K' | string

let ctx: AudioContext | null = null
let unlockBound = false

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  return ctx
}

/** Resume AudioContext; also bind a one-shot gesture unlock for autoplay policy. */
export function bindSfxUnlock(target: HTMLElement | Window = window): void {
  if (typeof window === 'undefined') return
  const c = getCtx()
  if (c?.state === 'suspended') void c.resume()
  if (unlockBound) return
  unlockBound = true
  const unlock = () => {
    const audio = getCtx()
    if (!audio) return
    void audio.resume()
  }
  target.addEventListener('pointerdown', unlock, { once: true, capture: true })
  target.addEventListener('keydown', unlock, { once: true, capture: true })
}

function now(): number {
  return getCtx()?.currentTime ?? 0
}

function gain(node: AudioNode, peak: number, attack: number, release: number, start: number): GainNode {
  const c = getCtx()!
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, start)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), start + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, start + attack + release)
  node.connect(g)
  g.connect(c.destination)
  return g
}

function osc(
  type: OscillatorType,
  freq: number,
  start: number,
  dur: number,
  peak: number,
  opts?: { endFreq?: number; attack?: number },
): void {
  const c = getCtx()
  if (!c || c.state === 'suspended') return
  const o = c.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, start)
  if (opts?.endFreq != null) {
    o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.endFreq), start + dur)
  }
  const attack = opts?.attack ?? 0.008
  gain(o, peak, attack, Math.max(0.02, dur - attack), start)
  o.start(start)
  o.stop(start + dur + 0.02)
}

function noiseBurst(start: number, dur: number, peak: number, hpHz = 800): void {
  const c = getCtx()
  if (!c || c.state === 'suspended') return
  const len = Math.max(1, Math.floor(c.sampleRate * dur))
  const buffer = c.createBuffer(1, len, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < len; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len)
  }
  const src = c.createBufferSource()
  src.buffer = buffer
  const filter = c.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = hpHz
  src.connect(filter)
  gain(filter, peak, 0.004, dur * 0.9, start)
  src.start(start)
  src.stop(start + dur + 0.02)
}

/** Soft card flick when confirming a play. */
export function sfxPlayCard(): void {
  ensureReady()
  const t = now()
  noiseBurst(t, 0.06, 0.18, 1200)
  osc('triangle', 420, t, 0.09, 0.08, { endFreq: 280 })
  osc('sine', 180, t + 0.02, 0.08, 0.05)
}

/** Blade / impact when damage is dealt. */
export function sfxAttack(opts?: { heavy?: boolean }): void {
  ensureReady()
  const t = now()
  const heavy = Boolean(opts?.heavy)
  noiseBurst(t, heavy ? 0.14 : 0.09, heavy ? 0.28 : 0.2, heavy ? 400 : 700)
  osc('sawtooth', heavy ? 220 : 320, t, heavy ? 0.16 : 0.1, heavy ? 0.12 : 0.09, {
    endFreq: 70,
    attack: 0.004,
  })
  osc('square', heavy ? 90 : 140, t, 0.12, heavy ? 0.08 : 0.05, { endFreq: 40 })
}

/** Enemy falls — combat settlement. */
export function sfxEnemyDefeated(): void {
  ensureReady()
  const t = now()
  noiseBurst(t, 0.18, 0.16, 300)
  osc('sawtooth', 180, t, 0.28, 0.11, { endFreq: 55 })
  osc('triangle', 240, t + 0.04, 0.32, 0.08, { endFreq: 70 })
  osc('sine', 90, t + 0.08, 0.35, 0.1, { endFreq: 40 })
}

/** Next royal (or opening enemy) steps onto the table. */
export function sfxBossAppear(rank?: RankTone): void {
  ensureReady()
  const t = now()
  const weight = rank === 'K' ? 1.15 : rank === 'Q' ? 1.05 : 1
  const base = rank === 'K' ? 110 : rank === 'Q' ? 130 : 150

  // Rising dread sting
  osc('sawtooth', base, t, 0.22 * weight, 0.07 * weight, { endFreq: base * 1.8 })
  osc('triangle', base * 1.5, t + 0.04, 0.28 * weight, 0.06 * weight, {
    endFreq: base * 2.4,
  })
  osc('sine', base * 0.5, t + 0.1, 0.35 * weight, 0.09 * weight)
  noiseBurst(t + 0.12, 0.1, 0.12 * weight, 500)

  // Final hit
  osc('square', base * 2, t + 0.22, 0.12, 0.05 * weight, { endFreq: base })
}

/** Player cleared the castle. */
export function sfxVictory(): void {
  ensureReady()
  const t = now()
  const notes = [392, 494, 587, 784]
  notes.forEach((f, i) => {
    osc('triangle', f, t + i * 0.09, 0.22, 0.09)
    osc('sine', f * 0.5, t + i * 0.09, 0.24, 0.04)
  })
}

/** Player lost — settlement. */
export function sfxDefeat(): void {
  ensureReady()
  const t = now()
  osc('sawtooth', 220, t, 0.45, 0.1, { endFreq: 70 })
  osc('triangle', 277, t + 0.05, 0.5, 0.07, { endFreq: 90 })
  osc('sine', 110, t + 0.1, 0.55, 0.1, { endFreq: 45 })
  noiseBurst(t + 0.15, 0.2, 0.1, 200)
}

function ensureReady(): void {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
}
