'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Craftsman = {
  id: string
  name: string
  craft: string
  profile: string | null
  apprentice_context: string | null
  teaching_style: string | null
}

export default function DeshiAdminPage() {
  const [list, setList] = useState<Craftsman[]>([])
  const [sel, setSel] = useState<Craftsman | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string>('')

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

  async function createNew() {
    const r = await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'create_craftsman',
        name: '新しい師匠',
        craft: '（職業を入力）',
        profile: '',
        apprentice_context: '',
      }),
    })
    const d = await r.json()
    await refresh()
    setSel(d.craftsman)
  }

  async function save() {
    if (!sel) return
    setSaving(true)
    await fetch('/api/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'update_craftsman',
        craftsmanId: sel.id,
        name: sel.name,
        craft: sel.craft,
        profile: sel.profile ?? '',
        apprentice_context: sel.apprentice_context ?? '',
      }),
    })
    setSaving(false)
    setSavedAt(new Date().toLocaleTimeString())
    refresh()
  }

  return (
    <main className="min-h-screen bg-amber-50 guild-bg">
      <header className="bg-amber-900 text-amber-50 p-4 flex justify-between items-center border-b-4 border-amber-700">
        <div>
          <Link href="/" className="text-sm underline opacity-75">← トップへ</Link>
          <h1 className="font-serif text-2xl tracking-wider">弟子の修練 — 事前知識の管理</h1>
        </div>
        <button
          onClick={createNew}
          className="px-4 py-2 bg-amber-700 text-white rounded border-2 border-amber-300"
        >
          + 新しい師匠を登録
        </button>
      </header>

      <div className="flex flex-col md:flex-row gap-4 p-6 max-w-6xl mx-auto">
        <aside className="md:w-64 flex-shrink-0">
          <h2 className="font-serif text-lg text-amber-900 mb-2">職人一覧</h2>
          <ul className="space-y-1">
            {list.map(c => (
              <li key={c.id}>
                <button
                  onClick={() => setSel(c)}
                  className={`w-full text-left p-3 rounded border-2 ${
                    sel?.id === c.id
                      ? 'bg-amber-700 text-white border-amber-900'
                      : 'bg-white border-amber-200 hover:border-amber-500'
                  }`}
                >
                  <div className="font-bold">{c.name}</div>
                  <div className="text-xs opacity-80">{c.craft}</div>
                </button>
              </li>
            ))}
            {list.length === 0 && (
              <li className="text-stone-500 text-sm">まだ登録なし</li>
            )}
          </ul>
        </aside>

        <section className="flex-1 bg-white/90 backdrop-blur p-6 rounded-lg border-2 border-amber-300 shadow-lg">
          {!sel ? (
            <p className="text-stone-500">左から職人を選んでください。</p>
          ) : (
            <div className="space-y-4">
              <Field label="名前">
                <input
                  value={sel.name}
                  onChange={e => setSel({ ...sel, name: e.target.value })}
                  className="w-full p-2 border-2 border-amber-200 rounded"
                />
              </Field>
              <Field label="職業">
                <input
                  value={sel.craft}
                  onChange={e => setSel({ ...sel, craft: e.target.value })}
                  className="w-full p-2 border-2 border-amber-200 rounded"
                />
              </Field>
              <Field label="プロフィール（経歴・得意分野）">
                <textarea
                  value={sel.profile ?? ''}
                  onChange={e => setSel({ ...sel, profile: e.target.value })}
                  rows={3}
                  className="w-full p-2 border-2 border-amber-200 rounded"
                />
              </Field>
              <Field
                label="弟子AIに持たせる事前知識"
                hint="この職業の基礎用語・関連分野・常識。これがあると弟子AIは初歩的すぎる質問を避け、最初から少し踏み込んだ対話ができる。"
              >
                <textarea
                  value={sel.apprentice_context ?? ''}
                  onChange={e => setSel({ ...sel, apprentice_context: e.target.value })}
                  rows={12}
                  placeholder="例：宮大工であれば「継手・仕口の主要な種類」「木材の繊維方向と狂い」「鉋・鑿・玄翁の基本用途」など"
                  className="w-full p-2 border-2 border-amber-200 rounded font-mono text-sm"
                />
              </Field>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-6 py-2 bg-amber-700 text-white rounded font-bold disabled:bg-stone-400"
                >
                  {saving ? '保存中…' : '保存する'}
                </button>
                {savedAt && <span className="text-sm text-stone-500">最終保存: {savedAt}</span>}
                <Link
                  href="/deshi"
                  className="ml-auto text-amber-700 underline text-sm"
                >
                  この設定で弟子として対話を始める →
                </Link>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <div className="font-bold text-amber-900 mb-1">{label}</div>
      {hint && <div className="text-xs text-stone-500 mb-2">{hint}</div>}
      {children}
    </label>
  )
}
