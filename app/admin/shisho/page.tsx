'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Craftsman = {
  id: string
  name: string
  craft: string
  teaching_style: string | null
}

export default function ShishoAdminPage() {
  const [list, setList] = useState<Craftsman[]>([])
  const [sel, setSel] = useState<Craftsman | null>(null)
  const [md, setMd] = useState('')
  const [savingMd, setSavingMd] = useState(false)
  const [savingStyle, setSavingStyle] = useState(false)
  const [msg, setMsg] = useState('')

  async function refresh() {
    const r = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'list_craftsmen' }),
    })
    const d = await r.json()
    setList(d.craftsmen || [])
  }
  useEffect(() => { refresh() }, [])

  async function pick(c: Craftsman) {
    setSel(c)
    setMsg('')
    const r = await fetch(`/api/knowledge?craftsmanId=${c.id}`)
    const d = await r.json()
    setMd(d.md || '')
  }

  async function saveStyle() {
    if (!sel) return
    setSavingStyle(true)
    await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update_craftsman',
        craftsmanId: sel.id,
        teaching_style: sel.teaching_style ?? '',
      }),
    })
    setSavingStyle(false)
    setMsg(`教え方を保存しました (${new Date().toLocaleTimeString()})`)
  }

  async function saveMd() {
    if (!sel) return
    setSavingMd(true)
    await fetch('/api/knowledge', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ craftsmanId: sel.id, md }),
    })
    setSavingMd(false)
    setMsg(`知識ベース(md)を保存しました (${new Date().toLocaleTimeString()})`)
  }

  return (
    <main className="min-h-screen bg-stone-100 guild-bg-stone">
      <header className="bg-stone-800 text-stone-50 p-4 flex justify-between items-center border-b-4 border-stone-600">
        <div>
          <Link href="/" className="text-sm underline opacity-75">← トップへ</Link>
          <h1 className="font-serif text-2xl tracking-wider">師匠の伝授 — 知識と教え方の管理</h1>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-4 p-6 max-w-6xl mx-auto">
        <aside className="md:w-64 flex-shrink-0">
          <h2 className="font-serif text-lg text-stone-800 mb-2">職人一覧</h2>
          <ul className="space-y-1">
            {list.map(c => (
              <li key={c.id}>
                <button
                  onClick={() => pick(c)}
                  className={`w-full text-left p-3 rounded border-2 ${
                    sel?.id === c.id
                      ? 'bg-stone-700 text-white border-stone-900'
                      : 'bg-white border-stone-200 hover:border-stone-500'
                  }`}
                >
                  <div className="font-bold">{c.name}</div>
                  <div className="text-xs opacity-80">{c.craft}</div>
                </button>
              </li>
            ))}
            {list.length === 0 && (
              <li className="text-stone-500 text-sm">
                まだ登録なし。<Link href="/admin/deshi" className="underline">弟子側</Link>で登録してください。
              </li>
            )}
          </ul>
        </aside>

        <section className="flex-1 bg-white/90 backdrop-blur p-6 rounded-lg border-2 border-stone-400 shadow-lg space-y-6">
          {!sel ? (
            <p className="text-stone-500">左から職人を選んでください。</p>
          ) : (
            <>
              <div>
                <h2 className="font-serif text-xl text-stone-800 mb-2">教え方の指示</h2>
                <p className="text-xs text-stone-500 mb-2">
                  師匠AIの口調・対象レベル・教える順序など。空欄なら「学習者のレベルに合わせて噛み砕く」がデフォルト。
                </p>
                <textarea
                  value={sel.teaching_style ?? ''}
                  onChange={e => setSel({ ...sel, teaching_style: e.target.value })}
                  rows={6}
                  placeholder="例：完全な初心者向け。専門用語は必ず「これは○○のことだ」と言い換える。手順を聞かれたら必ず1→2→3で順序立てて説明する。長い説教はしない、3文以内で1つだけ伝える。"
                  className="w-full p-3 border-2 border-stone-300 rounded text-sm font-mono"
                />
                <button
                  onClick={saveStyle}
                  disabled={savingStyle}
                  className="mt-2 px-5 py-2 bg-stone-700 text-white rounded disabled:bg-stone-400"
                >
                  {savingStyle ? '保存中…' : '教え方を保存'}
                </button>
              </div>

              <hr className="border-stone-300" />

              <div>
                <h2 className="font-serif text-xl text-stone-800 mb-2">知識ベース (Markdown)</h2>
                <p className="text-xs text-stone-500 mb-2">
                  弟子のセッション終了時に自動で更新されるファイル。直接編集して職人の知見を追加・修正できる。
                </p>
                <textarea
                  value={md}
                  onChange={e => setMd(e.target.value)}
                  rows={24}
                  placeholder="まだ知識が記録されていません。弟子側で対話を行うか、ここに直接書き込んでください。"
                  className="w-full p-3 border-2 border-stone-300 rounded text-sm font-mono"
                />
                <button
                  onClick={saveMd}
                  disabled={savingMd}
                  className="mt-2 px-5 py-2 bg-stone-700 text-white rounded disabled:bg-stone-400"
                >
                  {savingMd ? '保存中…' : '知識ベースを保存'}
                </button>
              </div>

              {msg && <p className="text-sm text-green-700">{msg}</p>}

              <Link
                href="/shisho"
                className="inline-block text-stone-700 underline text-sm"
              >
                この設定で師匠として対話を始める →
              </Link>
            </>
          )}
        </section>
      </div>
    </main>
  )
}
