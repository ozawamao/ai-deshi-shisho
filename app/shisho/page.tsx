'use client'

import { useEffect, useRef, useState } from 'react'
import { getRecognition, speak, cancelSpeak } from '../lib/speech'

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
  const recRef = useRef<any>(null)

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
    }
  }

  function startRec() {
    const rec = getRecognition()
    if (!rec) {
      alert('音声入力に対応していないブラウザです。')
      return
    }
    cancelSpeak()
    recRef.current = rec
    setRecording(true)
    rec.onresult = (e: any) => {
      const text = e.results[0]?.[0]?.transcript
      if (text) {
        setInput(text)
        // 音声入力したらそのまま送る
        send(text)
      }
    }
    rec.onerror = () => setRecording(false)
    rec.onend = () => setRecording(false)
    rec.start()
  }

  function stopRec() {
    try { recRef.current?.stop() } catch {}
    setRecording(false)
  }

  if (!selected) {
    return (
      <main className="min-h-screen p-8 bg-stone-50">
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
    <main className="min-h-screen flex flex-col bg-stone-50">
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

      <footer className="p-4 bg-stone-100 max-w-3xl w-full mx-auto flex gap-2">
        <button
          onMouseDown={startRec}
          onMouseUp={stopRec}
          onTouchStart={startRec}
          onTouchEnd={stopRec}
          className={`px-4 rounded-lg text-white text-xl ${recording ? 'bg-red-600 animate-pulse' : 'bg-stone-600 hover:bg-stone-700'}`}
          title="押している間だけ音声入力"
        >
          🎤
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
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
      </footer>
    </main>
  )
}
