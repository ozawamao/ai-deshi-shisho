'use client'

// Web Speech API helpers. SSR-safe (all access guarded by typeof window).

type SR = any

export function getRecognition(): SR | null {
  if (typeof window === 'undefined') return null
  const w = window as any
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  if (!Ctor) return null
  const r = new Ctor()
  r.lang = 'ja-JP'
  // タップでトグル運用なので連続録音、interim も拾って話しながら表示できるように
  r.continuous = true
  r.interimResults = true
  return r
}

/** Web Speech 対応判定 */
export function isSpeechSupported(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as any
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition)
}

/**
 * マイク権限を事前に確保する。
 * iOS Safari は getUserMedia 経由で許可を取らないと SpeechRecognition が無音で失敗するため。
 * 成功で true、拒否/失敗で false
 */
export async function ensureMicPermission(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false
  if (!navigator.mediaDevices?.getUserMedia) return true
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}

export function speak(text: string, opts?: { rate?: number; onend?: () => void }) {
  if (typeof window === 'undefined') return
  const synth = window.speechSynthesis
  if (!synth) return
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.rate = opts?.rate ?? 0.9
  if (opts?.onend) u.onend = opts.onend
  // 日本語の声があれば優先
  const jaVoice = synth.getVoices().find(v => v.lang.startsWith('ja'))
  if (jaVoice) u.voice = jaVoice
  synth.speak(u)
}

export function cancelSpeak() {
  if (typeof window === 'undefined') return
  window.speechSynthesis?.cancel()
}
