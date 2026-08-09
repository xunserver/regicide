import type { Rank } from '../../core/index.ts'

let hooked = false

function warmVoices(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis || hooked) return
  hooked = true
  // Chrome populates voices asynchronously; touching the list kicks the event.
  void window.speechSynthesis.getVoices()
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    void window.speechSynthesis.getVoices()
  })
}

/** Cancel any in-flight boss line. */
export function cancelSpeech(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
}

/**
 * Speak a Chinese boss taunt via Web Speech API.
 * Falls back silently if speechSynthesis is unavailable.
 */
export function speakBossLine(text: string, rank?: Rank): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  warmVoices()
  cancelSpeech()

  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = 'zh-CN'
  utter.volume = 1

  if (rank === 'K') {
    utter.rate = 0.82
    utter.pitch = 0.65
  } else if (rank === 'Q') {
    utter.rate = 0.92
    utter.pitch = 0.95
  } else {
    utter.rate = 1.05
    utter.pitch = 1.12
  }

  const voice = pickZhVoice()
  if (voice) utter.voice = voice

  // Some browsers need a tick after cancel before speak.
  window.setTimeout(() => {
    try {
      window.speechSynthesis.speak(utter)
    } catch {
      // ignore autoplay / unsupported
    }
  }, 40)
}

function pickZhVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null

  const preferred = [
    (v: SpeechSynthesisVoice) => /zh[-_]?CN/i.test(v.lang) && /xiaoxiao|xiaoyi|tingting|huihui/i.test(v.name),
    (v: SpeechSynthesisVoice) => /zh[-_]?CN/i.test(v.lang),
    (v: SpeechSynthesisVoice) => /^zh/i.test(v.lang),
    (v: SpeechSynthesisVoice) => /chinese|中文|普通话|国语/i.test(v.name),
  ]

  for (const match of preferred) {
    const found = voices.find(match)
    if (found) return found
  }
  return null
}
