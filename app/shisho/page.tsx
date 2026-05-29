'use client'

import { useEffect, useRef, useState } from 'react'
import { getRecognition, speak, cancelSpeak, ensureMicPermission, isSpeechSupported } from '../lib/speech'

type Craftsman = { id: string; name: string; craft: string; profile: string | null }
type Msg = { role: 'user' | 'assistant'; content: string }

export default function ShishoPage() {
  const [craftsmen, setCraftsmen] = useState<Craftsman[]>([])
  const [selected, setSelected] = useState<Craftsman | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [recording, setRecording] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(true)
  const [interimText, setInterimText] = useState('')
  const recRef = useRef<any>(null)
  const interimRef = useRef<string>('')
  const finalRef = useRef<string>('')
  const sendingRef = useRef(false)

  useEffect(() => {
    fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'list_craftsmen' }),
    })
      .then(r => r.json())
      .then(d => setCraftsmen(d.craftsmen || []))
  }, [])

  async function send(userText: string) {
    if (!selected || !userText.trim()) return
    if (sendingRef.current) return // 二重送信防止
    sendingRef.current = true
    setThinking(true)
    const history = msgs
    setMsgs(m => [...m, { role: 'user', content: userText }])
    setInput('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          mode: 'shisho',
          craftsmanId: selected.id,
          userText,
          history,
        }),
      })
      const { text } = await res.json()
      setMsgs(m => [...m, { role: 'assistant', content: text }])
      if (autoSpeak) speak(text)
    } finally {
      setThinking(false)
      sendingRef.current = false
    }
  }

  // タップでトグル
  async function startRec() {
    if (recording) return
    if (!isSpeechSupported()) {
      alert('お使いのブラウザは音声入力に対応していません。Chrome または Safari (最新版) でお試しください。')
      return
    }
    const ok = await ensureMicPermission()
    if (!ok) {
      alert('マイクの使用が許可されていません。ブラウザの設定で許可してください。')
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
        alert('マイクが許可されていません。')
      }
    }
    rec.onend = () => {
      if (recRef.current && (recRef.current as any).__keepGoing) {
        try { rec.start() } catch {}
      } else {
        setRecording(false)
      }
    }
    ;(rec as any).__keepGoing = true
    try { rec.start() } catch { setRecording(false) }
  }

  function stopRec() {
    if (!recording) return
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
    if (text) send(text)
  }

  if (!selected) {
    return (
      <main className="min-h-screen p-8 bg-stone-50 guild-bg-stone">
        <h1 className="text-3xl font-bold text-stone-800 mb-8">どの師匠から学びますか？</h1>
        {craftsmen.length === 0 ? (
          <p className="text-stone-600">
            まだ師匠が登録されていません。<a href="/deshi" className="text-amber-700 underline">AI弟子</a> で対話を行ってください。
          </p>
        ) : (
          <ul className="grid sm:grid-cols-2 gap-4 max-w-3xl">
            {craftsmen.map(c => (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c)}
                  className="w-full text-left p-6 bg-white rounded-2xl shadow hover:shadow-lg border-2 border-stone-200"
                >
                  <div className="text-xl font-bold text-stone-800">{c.name}</div>
                  <div className="text-base text-stone-600">{c.craft}</div>
                  {c.profile && <div className="text-sm text-stone-500 mt-2">{c.profile}</div>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-8"><a href="/" className="text-stone-600 underline">トップに戻る</a></div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col bg-stone-50 guild-bg-stone">
      <header className="p-4 bg-stone-200 flex justify-between items-center">
        <div>
          <div className="text-lg font-bold text-stone-800">{selected.name} 師匠</div>
          <div className="text-sm text-stone-600">{selected.craft}</div>
        </div>
        <div className="flex gap-2 items-center">
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={e => setAutoSpeak(e.target.checked)}
            />
            音声で読み上げる
          </label>
          <button
            onClick={() => { setSelected(null); setMsgs([]) }}
            className="px-3 py-1 text-sm bg-stone-500 text-white rounded"
          >
            別の師匠
          </button>
        </div>
      </header>

      <section className="flex-1 overflow-y-auto p-6 space-y-3 max-w-3xl w-full mx-auto">
        {msgs.length === 0 && (
          <p className="text-stone-500">質問を書いて「送る」を押してください。</p>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={`p-4 rounded-2xl ${
              m.role === 'user'
                ? 'bg-white border border-stone-300 ml-auto max-w-[80%]'
                : 'bg-stone-700 text-white mr-auto max-w-[80%]'
            }`}
          >
            <div className="whitespace-pre-wrap">{m.content}</div>
            {m.role === 'assistant' && (
              <button
                onClick={() => speak(m.content)}
                className="mt-2 text-xs underline opacity-75"
              >
                ▶ 読み上げ
              </button>
            )}
          </div>
        ))}
        {thinking && <div className="text-stone-500">師匠が考えています…</div>}
      </section>

      <footer className="p-4 bg-stone-100 max-w-3xl w-full mx-auto space-y-2">
        {recording && interimText && (
          <div className="p-2 rounded border border-stone-300 bg-white text-stone-700 italic text-sm">
            {interimText}
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => (recording ? stopRec() : startRec())}
            className={`px-4 rounded-lg text-white text-xl ${recording ? 'bg-red-600 animate-pulse' : 'bg-stone-600 hover:bg-stone-700'}`}
            title="タップで録音開始 / もう一度タップで停止して送信"
          >
            {recording ? '⏹' : '🎤'}
          </button>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter' || e.shiftKey) return
              // IME変換確定 Enter で誤送信させない
              if (e.nativeEvent.isComposing || (e as any).keyCode === 229) return
              e.preventDefault()
              send(input)
            }}
            placeholder="質問を書く…"
            className="flex-1 p-3 rounded-lg border border-stone-300"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || thinking}
            className="px-5 py-3 bg-stone-700 text-white rounded-lg disabled:bg-stone-400"
          >
            送る
          </button>
        </div>
      </footer>
    </main>
  )
}
