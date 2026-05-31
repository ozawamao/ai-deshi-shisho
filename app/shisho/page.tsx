'use client'

import { useEffect, useRef, useState } from 'react'
import { getRecognition, speak, cancelSpeak, ensureMicPermission, isSpeechSupported } from '../lib/speech'
import { computeLevel } from '../lib/levels'

type Craftsman = {
  id: string
  name: string
  craft: string
  profile: string | null
  knowledge_count?: number
  categories?: string[]
}
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
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [msgs.length, thinking])

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
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const msg = data?.error || `HTTP ${res.status}`
        throw new Error(msg)
      }
      const text = (data?.text || '').trim()
      if (!text) throw new Error('AIから空の応答が返ってきた')
      setMsgs(m => [...m, { role: 'assistant', content: text }])
    } catch (err: any) {
      console.warn('[shisho chat] error:', err)
      setMsgs(m => [...m, {
        role: 'assistant',
        content: `⚠ エラー: ${err?.message || '通信に失敗しました'}`,
      }])
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
            {craftsmen.map(c => {
              const cats = c.categories || []
              const extra = Math.max(0, (c.knowledge_count || 0) - cats.length)
              const lvNodes: Array<{ category?: string | null }> = [
                ...cats.map(cat => ({ category: cat })),
                ...Array.from({ length: extra }, () => ({ category: null })),
              ]
              const lv = computeLevel(lvNodes)
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelected(c)}
                    className="w-full text-left p-6 bg-white rounded-2xl shadow hover:shadow-lg border-2 border-stone-200"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xl font-bold text-stone-800">{c.name}</span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded ${lv.badge}`}
                        title={lv.progressNote}
                      >
                        {lv.emoji} Lv.{lv.rank} {lv.name}
                      </span>
                    </div>
                    <div className="text-base text-stone-600 mt-1">{c.craft}</div>
                    {c.profile && <div className="text-sm text-stone-500 mt-2">{c.profile}</div>}
                    <div className="text-[11px] text-stone-400 mt-2">
                      ナレッジ {c.knowledge_count || 0} 件 / 分野 {c.categories?.length || 0}/5
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        <div className="mt-8"><a href="/" className="text-stone-600 underline">トップに戻る</a></div>
      </main>
    )
  }

  return (
    <main className="relative h-[100dvh] flex flex-col"
      style={{ backgroundImage: "url(/icons/workshop-bg.jpg)", backgroundSize: "cover", backgroundPosition: "center" }}>
      {/* 背景を薄く見せるためのオーバーレイ */}
      <div aria-hidden className="absolute inset-0 bg-stone-50/85 pointer-events-none" />
      {/* ヘッダー: 固定 */}
      <header className="relative z-10 shrink-0 px-4 py-3 bg-white/90 backdrop-blur border-b border-stone-200 flex justify-between items-center gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src="/icons/master.png"
            alt="AI師匠"
            className="w-20 h-20 rounded-full object-cover bg-amber-50 shrink-0"
          />
          <div className="min-w-0">
            <div className="font-bold text-stone-800 truncate text-base">{selected.name} 師匠</div>
            <div className="text-xs text-stone-500 truncate">{selected.craft}</div>
          </div>
        </div>
        <button
          onClick={() => { setSelected(null); setMsgs([]) }}
          className="px-3 py-1.5 bg-stone-600 hover:bg-stone-700 text-white rounded-lg text-sm shrink-0"
        >
          別の師匠
        </button>
      </header>

      {/* メッセージ領域: 残り高さ、自動下スクロール */}
      <section
        ref={scrollRef}
        className="relative z-10 flex-1 overflow-y-auto px-3 sm:px-6 py-4 space-y-3"
      >
        <div className="max-w-2xl w-full mx-auto space-y-3">
          {msgs.length === 0 && (
            <p className="text-center text-stone-500 text-sm py-8">質問を書いて送信してください。</p>
          )}
          {msgs.map((m, i) => (
            <ShishoBubble key={i} role={m.role} content={m.content} onSpeak={() => speak(m.content)} />
          ))}
          {thinking && (
            <div className="flex gap-2 items-end">
              <img
                src="/icons/master.png"
                alt="AI師匠"
                className="w-20 h-20 rounded-full object-cover bg-amber-50 shrink-0"
              />
              <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-md px-4 py-2.5 text-stone-500 text-sm">
                師匠が考えています…
              </div>
            </div>
          )}
        </div>
      </section>

      <footer className="relative z-10 shrink-0 px-3 sm:px-6 py-3 bg-white/90 backdrop-blur border-t border-stone-200">
        <div className="w-full max-w-2xl mx-auto flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key !== 'Enter' || e.shiftKey) return
              if (e.nativeEvent.isComposing || (e as any).keyCode === 229) return
              e.preventDefault()
              send(input)
            }}
            rows={1}
            placeholder="メッセージを書く"
            className="flex-1 p-3 text-lg rounded-2xl border border-stone-300 bg-stone-50 focus:bg-white focus:border-stone-500 outline-none resize-none max-h-32"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || thinking}
            className="w-14 h-14 rounded-full bg-stone-700 hover:bg-stone-800 text-white flex items-center justify-center text-xl disabled:bg-stone-300 shrink-0"
            aria-label="送信"
          >
            ➤
          </button>
        </div>
      </footer>
    </main>
  )
}

/** LINE風メッセージバブル (師匠側用) */
function ShishoBubble({
  role,
  content,
  onSpeak,
}: {
  role: 'user' | 'assistant'
  content: string
  onSpeak: () => void
}) {
  const isMe = role === 'user'
  if (isMe) {
    return (
      <div className="flex gap-2 items-end justify-end">
        <div className="max-w-[80%] bg-stone-700 text-white rounded-2xl rounded-br-md px-4 py-2.5 text-[19px] leading-relaxed whitespace-pre-wrap shadow-sm">
          {content}
        </div>
        <div className="w-20 h-20 rounded-full bg-stone-700 text-white flex items-center justify-center text-base font-bold shrink-0">
          You
        </div>
      </div>
    )
  }
  return (
    <div className="flex gap-2 items-end">
      <img
        src="/icons/master.png"
        alt="AI師匠"
        className="w-20 h-20 rounded-full object-cover bg-amber-50 shrink-0"
      />
      <div className="max-w-[80%] bg-white border border-stone-200 rounded-2xl rounded-bl-md px-4 py-2.5 text-[19px] leading-relaxed whitespace-pre-wrap shadow-sm text-stone-800">
        {content}
        <button onClick={onSpeak} className="block mt-2 text-xs text-stone-400 hover:text-amber-700 underline">
          ▶ 読み上げ
        </button>
      </div>
    </div>
  )
}
