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
  r.continuous = false
  r.interimResults = false
  return r
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
