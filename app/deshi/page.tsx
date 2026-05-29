'use client'

import { useEffect, useRef, useState } from 'react'
import { getRecognition, speak, cancelSpeak } from '../lib/speech'

type Msg = { role: 'user' | 'assistant'; content: string }

export default function DeshiPage() {
  const [step, setStep] = useState<'setup' | 'chat' | 'ended'>('setup')
  const [name, setName] = useState('')
  const [craft, setCraft] = useState('')
  const [profile, setProfile] = useState('')
  const [craftsmanId, setCraftsmanId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [recording, setRecording] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [endResult, setEndResult] = useState<string>('')
  const recRef = useRef<any>(null)
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastInteraction = useRef<number>(Date.now())

  // 沈黙5秒で促し
  useEffect(() => {
    if (step !== 'chat') return
    const id = setInterval(() => {
      if (thinking || recording) {
        lastInteraction.current = Date.now()
        return
      }
      if (Date.now() - lastInteraction.current > 5000 && msgs.length > 0) {
        speak('ゆっくりで大丈夫です。')
        lastInteraction.current = Date.now() + 10000 // 一度言ったら少し休む
      }
    }, 1000)
    return () => clearInterval(id)
  }, [step, thinking, recording, msgs.length])

  async function start() {
    if (!name.trim() || !craft.trim()) return
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create', craftsmanName: name, craft, profile }),
    })
    const { sessionId, craftsmanId } = await res.json()
    setSessionId(sessionId)
    setCraftsmanId(craftsmanId)
    setStep('chat')
    // 挨拶
    setTimeout(() => sendToAI('こんにちは。', true), 300)
  }

  async function sendToAI(userText: string, isGreeting = false) {
    setThinking(true)
    const historyForApi = msgs
    if (!isGreeting) {
      setMsgs(m => [...m, { role: 'user', content: userText }])
    }
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'deshi',
          sessionId,
          craftsmanId,
          userText,
          history: historyForApi,
        }),
      })
      const { text } = await res.json()
      setMsgs(m => [...m, { role: 'assistant', content: text }])
      lastInteraction.current = Date.now()
      speak(text)
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: 'すみません、うまく聞こえませんでした。' }])
    } finally {
      setThinking(false)
    }
  }

  function startRec() {
    const rec = getRecognition()
    if (!rec) {
      alert('お使いのブラウザは音声入力に対応していません。Chrome または Safari でお試しください。')
      return
    }
    cancelSpeak()
    recRef.current = rec
    setRecording(true)
    rec.onresult = (e: any) => {
      const text = e.results[0]?.[0]?.transcript
      if (text) sendToAI(text)
    }
    rec.onerror = () => setRecording(false)
    rec.onend = () => setRecording(false)
    rec.start()
  }

  function stopRec() {
    if (recRef.current) {
      try { recRef.current.stop() } catch {}
    }
    setRecording(false)
  }

  async function endSession() {
    if (!sessionId || !craftsmanId) return
    setThinking(true)
    cancelSpeak()
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'end', sessionId, craftsmanId }),
    })
    const data = await res.json()
    setEndResult(`知識を ${data.nodesAdded ?? 0} 件 まとめました。\n保存先: ${data.filePath ?? '-'}`)
    setStep('ended')
    setThinking(false)
  }

  if (step === 'setup') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-amber-50">
        <h1 className="text-3xl font-bold text-amber-900">師匠の情報を教えてください</h1>
        <div className="flex flex-col gap-4 w-full max-w-md">
          <label className="flex flex-col gap-2 text-lg">
            お名前
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="p-4 text-xl rounded-lg border-2 border-amber-300 bg-white"
              placeholder="例：山田 一郎"
            />
          </label>
          <label className="flex flex-col gap-2 text-lg">
            ご職業・お仕事
            <input
              value={craft}
              onChange={e => setCraft(e.target.value)}
              className="p-4 text-xl rounded-lg border-2 border-amber-300 bg-white"
              placeholder="例：宮大工"
            />
          </label>
          <label className="flex flex-col gap-2 text-lg">
            プロフィール（任意）
            <textarea
              value={profile}
              onChange={e => setProfile(e.target.value)}
              rows={3}
              className="p-4 text-xl rounded-lg border-2 border-amber-300 bg-white"
              placeholder="経歴・得意な分野など"
            />
          </label>
          <button
            onClick={start}
            disabled={!name.trim() || !craft.trim()}
            className="mt-4 p-4 text-xl bg-amber-700 text-white rounded-lg disabled:bg-stone-300"
          >
            はじめる
          </button>
        </div>
      </main>
    )
  }

  if (step === 'ended') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-amber-50">
        <h1 className="text-3xl font-bold text-amber-900">本日はありがとうございました</h1>
        <pre className="whitespace-pre-wrap text-lg text-stone-700 bg-white p-6 rounded-lg max-w-xl">
          {endResult}
        </pre>
        <a href="/" className="text-amber-700 underline text-lg">トップに戻る</a>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col bg-amber-50">
      <header className="p-4 bg-amber-100 flex justify-between items-center">
        <h2 className="text-xl text-amber-900">{name} 師匠 — {craft}</h2>
        <button
          onClick={endSession}
          className="px-4 py-2 bg-stone-600 text-white rounded-lg text-base"
        >
          セッションを終える
        </button>
      </header>

      <section className="flex-1 overflow-y-auto p-6 space-y-4 max-w-3xl w-full mx-auto">
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`p-4 rounded-2xl text-lg leading-relaxed ${
              m.role === 'user'
                ? 'bg-white border-2 border-amber-200 ml-auto max-w-[80%]'
                : 'bg-amber-700 text-white mr-auto max-w-[80%]'
            }`}
            style={{ fontSize: '18px' }}
          >
            {m.content}
          </div>
        ))}
        {thinking && <div className="text-stone-500 text-lg">考えています…</div>}
      </section>

      <footer className="p-6 flex flex-col items-center gap-3 bg-amber-100">
        <button
          onMouseDown={startRec}
          onMouseUp={stopRec}
          onTouchStart={startRec}
          onTouchEnd={stopRec}
          disabled={thinking}
          className={`w-32 h-32 rounded-full text-white text-xl shadow-2xl transition ${
            recording ? 'bg-red-600 scale-110' : 'bg-amber-700 hover:bg-amber-800'
          } disabled:bg-stone-400`}
        >
          {recording ? '聞いています…' : '押して話す'}
        </button>
        <p className="text-base text-stone-600">ボタンを押している間、お話しください</p>
      </footer>
    </main>
  )
}
