'use client'

import { useEffect, useRef, useState } from 'react'
import { getRecognition, speak, cancelSpeak, ensureMicPermission, isSpeechSupported } from '../lib/speech'

type Msg = { role: 'user' | 'assistant'; content: string }

type Craftsman = { id: string; name: string; craft: string; profile: string | null }

export default function DeshiPage() {
  const [step, setStep] = useState<'pick' | 'setup' | 'chat' | 'ended'>('pick')
  const [existing, setExisting] = useState<Craftsman[]>([])
  const [name, setName] = useState('')
  const [craft, setCraft] = useState('')
  const [profile, setProfile] = useState('')
  const [craftsmanId, setCraftsmanId] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [recording, setRecording] = useState(false)
  const [thinking, setThinking] = useState(false)
  const [endResult, setEndResult] = useState<string>('')
  const [textInput, setTextInput] = useState('')
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [interimText, setInterimText] = useState('') // 録音中の途中認識テキスト
  const recRef = useRef<any>(null)
  const interimRef = useRef<string>('')
  const finalRef = useRef<string>('')
  const sendingRef = useRef(false) // 再入防止 (StrictMode / 連打対策)
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastInteraction = useRef<number>(Date.now())

  // 既存職人をロード
  useEffect(() => {
    fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'list_craftsmen' }),
    })
      .then(r => r.json())
      .then(d => setExisting(d.craftsmen || []))
  }, [])

  async function startWithExisting(c: Craftsman) {
    const res = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'create', craftsmanId: c.id }),
    })
    const { sessionId, craftsmanId } = await res.json()
    setSessionId(sessionId)
    setCraftsmanId(craftsmanId)
    setName(c.name)
    setCraft(c.craft)
    setStep('chat')
    setTimeout(() => sendToAI('こんにちは。', true), 300)
  }

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
    if (sendingRef.current) return  // 二重送信防止
    sendingRef.current = true
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
      if (autoSpeak) speak(text)
    } catch {
      setMsgs(m => [...m, { role: 'assistant', content: 'すみません、うまく聞こえませんでした。' }])
    } finally {
      setThinking(false)
      sendingRef.current = false
    }
  }

  // タップでトグル: 押すと録音開始、もう一度押すと停止 → AI送信
  // (押し続け方式はスマホで一瞬で終わるため不採用)
  async function startRec() {
    if (recording) return // 既に録音中なら無視
    if (!isSpeechSupported()) {
      alert('お使いのブラウザは音声入力に対応していません。Chrome または Safari (最新版) でお試しください。')
      return
    }
    // iOS Safari 向けに先にマイク許可を取る
    const ok = await ensureMicPermission()
    if (!ok) {
      alert('マイクの使用が許可されていません。ブラウザの設定でマイクを許可してください。')
      return
    }
    const rec = getRecognition()
    if (!rec) return
    cancelSpeak()
    interimRef.current = ''
    finalRef.current = ''
    setInterimText('')
    recRef.current = rec
    setRecording(true)
    rec.onresult = (e: any) => {
      let interim = ''
      let final = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) final += r[0]?.transcript || ''
        else interim += r[0]?.transcript || ''
      }
      if (final) finalRef.current += final
      interimRef.current = interim
      setInterimText((finalRef.current + ' ' + interim).trim())
    }
    rec.onerror = (e: any) => {
      console.warn('SpeechRecognition error', e?.error)
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        alert('マイクが許可されていません。設定から許可してください。')
      } else if (e?.error === 'no-speech') {
        // 何も言わなくても閉じない (ユーザーが再度話す可能性)
      } else if (e?.error) {
        // network 等
        console.warn('speech error:', e.error)
      }
    }
    rec.onend = () => {
      // continuous=true でも勝手に止まることがある → recording 中なら自動再開
      if (recRef.current && (recRef.current as any).__keepGoing) {
        try { rec.start() } catch {}
      } else {
        setRecording(false)
      }
    }
    ;(rec as any).__keepGoing = true
    try {
      rec.start()
    } catch (err) {
      console.warn('rec.start failed', err)
      setRecording(false)
    }
  }

  function stopRec() {
    if (!recording) return // 既に停止中なら無視
    if (recRef.current) {
      ;(recRef.current as any).__keepGoing = false
      try { recRef.current.stop() } catch {}
      recRef.current = null
    }
    setRecording(false)
    const text = (finalRef.current + ' ' + interimRef.current).trim()
    finalRef.current = ''
    interimRef.current = ''
    setInterimText('')
    if (text) sendToAI(text)
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

  if (step === 'pick') {
    return (
      <main className="min-h-screen p-8 bg-amber-50 guild-bg">
        <header className="max-w-3xl mx-auto mb-6 flex justify-between items-center">
          <a href="/" className="text-sm text-amber-700 underline">← トップへ</a>
          <h1 className="font-serif text-2xl text-amber-900">どの師匠から聞き取りますか？</h1>
        </header>

        <div className="max-w-3xl mx-auto space-y-3">
          {existing.length > 0 && (
            <>
              <h2 className="font-serif text-lg text-amber-900 mt-4">続きから聞く</h2>
              <ul className="grid sm:grid-cols-2 gap-3">
                {existing.map(c => (
                  <li key={c.id}>
                    <button
                      onClick={() => startWithExisting(c)}
                      className="w-full text-left p-5 bg-white/90 border-2 border-amber-300 rounded-lg hover:border-amber-700 hover:shadow"
                    >
                      <div className="text-xl font-bold text-amber-900">{c.name}</div>
                      <div className="text-base text-stone-700">{c.craft}</div>
                      {c.profile && (
                        <div className="text-sm text-stone-500 mt-1 line-clamp-2">{c.profile}</div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="pt-6">
            <h2 className="font-serif text-lg text-amber-900 mb-2">新しい師匠から聞く</h2>
            <button
              onClick={() => setStep('setup')}
              className="px-6 py-3 bg-amber-700 text-white text-lg rounded-lg hover:bg-amber-800"
            >
              + 新しく登録して始める
            </button>
            <p className="text-sm text-stone-600 mt-3">
              事前知識など細かい設定は<a href="/admin/deshi" className="underline">管理画面</a>からも編集できます。
            </p>
          </div>
        </div>
      </main>
    )
  }

  if (step === 'setup') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-amber-50 guild-bg">
        <button
          onClick={() => setStep('pick')}
          className="self-start text-sm text-amber-700 underline"
        >
          ← 一覧に戻る
        </button>
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
      <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8 bg-amber-50 guild-bg">
        <h1 className="text-3xl font-bold text-amber-900">本日はありがとうございました</h1>
        <pre className="whitespace-pre-wrap text-lg text-stone-700 bg-white p-6 rounded-lg max-w-xl">
          {endResult}
        </pre>
        <a href="/" className="text-amber-700 underline text-lg">トップに戻る</a>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col bg-amber-50 guild-bg">
      <header className="p-4 bg-amber-100 flex justify-between items-center gap-3 flex-wrap">
        <h2 className="text-xl text-amber-900">{name} 師匠 — {craft}</h2>
        <div className="flex gap-3 items-center">
          <label className="flex items-center gap-2 text-base text-stone-700">
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={e => setAutoSpeak(e.target.checked)}
              className="w-5 h-5"
            />
            読み上げ
          </label>
          <button
            onClick={endSession}
            className="px-4 py-2 bg-stone-600 text-white rounded-lg text-base"
          >
            セッションを終える
          </button>
        </div>
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

      <footer className="p-6 flex flex-col items-center gap-4 bg-amber-100">
        <button
          onClick={() => (recording ? stopRec() : startRec())}
          disabled={thinking}
          className={`w-32 h-32 rounded-full text-white text-xl shadow-2xl transition ${
            recording ? 'bg-red-600 scale-110 animate-pulse' : 'bg-amber-700 hover:bg-amber-800'
          } disabled:bg-stone-400`}
        >
          {recording ? '⏹\n停止' : '🎙\n話す'}
        </button>
        <p className="text-base text-stone-600">
          {recording
            ? 'タップで停止 → 認識した内容を送ります'
            : 'タップで録音開始。終わったらもう一度タップ'}
        </p>
        {recording && interimText && (
          <div className="w-full max-w-2xl p-3 rounded-lg border-2 border-amber-400 bg-white text-lg text-stone-700 italic">
            {interimText}
          </div>
        )}

        <div className="w-full max-w-2xl flex items-center gap-2 mt-2">
          <div className="flex-1 h-px bg-amber-300" />
          <span className="text-sm text-stone-500">または文字で</span>
          <div className="flex-1 h-px bg-amber-300" />
        </div>

        <div className="w-full max-w-2xl flex gap-2">
          <input
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            onKeyDown={e => {
              // IME 変換確定の Enter は誤送信させない
              if (e.key !== 'Enter' || e.shiftKey) return
              if (e.nativeEvent.isComposing || (e as any).keyCode === 229) return
              e.preventDefault()
              if (textInput.trim() && !thinking) {
                const t = textInput.trim()
                setTextInput('')
                sendToAI(t)
              }
            }}
            placeholder="文字で入力する場合はこちら"
            className="flex-1 p-3 text-lg rounded-lg border-2 border-amber-300 bg-white"
          />
          <button
            onClick={() => {
              if (textInput.trim() && !thinking) {
                const t = textInput.trim()
                setTextInput('')
                sendToAI(t)
              }
            }}
            disabled={!textInput.trim() || thinking}
            className="px-5 py-3 bg-amber-700 text-white text-lg rounded-lg disabled:bg-stone-400"
          >
            送る
          </button>
        </div>
      </footer>
    </main>
  )
}
