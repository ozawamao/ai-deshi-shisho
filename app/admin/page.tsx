'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Craftsman {
  id: string
  name: string
  craft: string
  profile: string | null
  apprentice_context: string | null
  teaching_style: string | null
  created_at: string
  session_count?: number
  knowledge_count?: number
}

const LS_PASSWORD_KEY = 'shokunin.admin.pwd'

export default function AdminPage() {
  const [pwd, setPwd] = useState('')
  const [authed, setAuthed] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [list, setList] = useState<Craftsman[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<Craftsman | null>(null)
  const [creating, setCreating] = useState(false)
  const [tab, setTab] = useState<'people' | 'prompts'>('people')

  // --- 自動ログイン (localStorage) ---
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(LS_PASSWORD_KEY) : null
    if (saved) {
      tryAuth(saved)
    }
  }, [])

  async function tryAuth(p: string) {
    setAuthError(null)
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-password': p },
      body: JSON.stringify({ action: 'auth' }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setAuthError(data?.error || 'ログイン失敗')
      localStorage.removeItem(LS_PASSWORD_KEY)
      return
    }
    localStorage.setItem(LS_PASSWORD_KEY, p)
    setPwd(p)
    setAuthed(true)
    loadList(p)
  }

  function logout() {
    localStorage.removeItem(LS_PASSWORD_KEY)
    setPwd('')
    setAuthed(false)
    setList([])
  }

  async function api(action: string, body: Record<string, any> = {}) {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-admin-password': pwd },
      body: JSON.stringify({ action, ...body }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
    return data
  }

  async function loadList(p: string = pwd) {
    setLoading(true)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-password': p },
        body: JSON.stringify({ action: 'list' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      setList(data.craftsmen || [])
    } catch (err: any) {
      alert(`一覧取得失敗: ${err?.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(values: Partial<Craftsman>) {
    try {
      await api('create', values)
      setCreating(false)
      await loadList()
    } catch (err: any) {
      alert(`作成失敗: ${err?.message || err}`)
    }
  }

  async function handleUpdate(values: Partial<Craftsman>) {
    if (!editing) return
    try {
      await api('update', { id: editing.id, ...values })
      setEditing(null)
      await loadList()
    } catch (err: any) {
      alert(`更新失敗: ${err?.message || err}`)
    }
  }

  async function handleDelete(c: Craftsman) {
    if (!confirm(
      `「${c.name}」を削除します。\n関連するセッション・発話・ナレッジも全部消えます。\n本当によろしいですか?`
    )) return
    try {
      await api('delete', { id: c.id })
      await loadList()
    } catch (err: any) {
      alert(`削除失敗: ${err?.message || err}`)
    }
  }

  // ============================================
  // ログイン画面
  // ============================================
  if (!authed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (pwd) tryAuth(pwd)
          }}
          className="w-full max-w-sm bg-white rounded-2xl shadow p-6 space-y-4"
        >
          <div>
            <h1 className="text-xl font-bold text-stone-800">管理画面</h1>
            <p className="text-xs text-stone-500 mt-1">パスワードを入力してください</p>
          </div>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="ADMIN_PASSWORD"
            className="w-full p-3 rounded-lg border border-stone-300 bg-stone-50 focus:bg-white focus:border-amber-500 outline-none"
            autoFocus
          />
          {authError && <p className="text-sm text-red-600">{authError}</p>}
          <button
            type="submit"
            disabled={!pwd}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:bg-stone-300"
          >
            ログイン
          </button>
          <p className="text-[10px] text-stone-400">
            Vercel env の ADMIN_PASSWORD と照合します。
          </p>
        </form>
      </main>
    )
  }

  // ============================================
  // 管理画面本体
  // ============================================
  return (
    <main className="min-h-screen bg-stone-50">
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-bold text-stone-800">弟子・師匠 管理</h1>
          <p className="text-xs text-stone-500">
            ヒアリングされる人(=弟子)を登録 → セッションで知識を貯めると 師匠化される
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Link href="/deshi" className="text-xs text-stone-500 hover:text-amber-700">/deshi</Link>
          <Link href="/shisho" className="text-xs text-stone-500 hover:text-amber-700">/shisho</Link>
          <button onClick={logout} className="text-xs text-stone-500 hover:text-red-600">
            ログアウト
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-4">
        {/* タブ切替 */}
        <div className="flex gap-1 border-b border-stone-200">
          {([
            ['people', '弟子・師匠'],
            ['prompts', '基礎プロンプト'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm border-b-2 transition ${
                tab === key
                  ? 'border-amber-600 text-amber-700 font-medium'
                  : 'border-transparent text-stone-500 hover:text-stone-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'prompts' ? (
          <PromptsTab pwd={pwd} />
        ) : (
          <>
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-medium text-stone-600">{list.length} 人</h2>
          <button
            onClick={() => setCreating(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-lg"
          >
            + 新規追加
          </button>
        </div>

        {loading ? (
          <p className="text-center text-stone-500 py-12">読み込み中…</p>
        ) : list.length === 0 ? (
          <p className="text-center text-stone-500 py-12">
            まだ誰も登録されていません。「+ 新規追加」から始めましょう。
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((c) => (
              <li
                key={c.id}
                className="bg-white border border-stone-200 rounded-lg p-4 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-stone-800">{c.name}</span>
                      <span className="text-xs text-stone-500">— {c.craft}</span>
                      <StatusBadge knowledgeCount={c.knowledge_count || 0} />
                    </div>
                    {c.profile && (
                      <p className="text-xs text-stone-600 mt-1 line-clamp-2">{c.profile}</p>
                    )}
                    <div className="flex gap-3 text-[10px] text-stone-500 mt-2">
                      <span>セッション {c.session_count || 0} 回</span>
                      <span>ナレッジ {c.knowledge_count || 0} 件</span>
                      <span>追加日 {new Date(c.created_at).toLocaleDateString('ja-JP')}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      onClick={() => setEditing(c)}
                      className="px-3 py-1 text-xs border border-stone-300 hover:border-amber-500 hover:text-amber-700 rounded"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      className="px-3 py-1 text-xs border border-red-300 text-red-600 hover:bg-red-50 rounded"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
          </>
        )}
      </div>

      {/* モーダル */}
      {(creating || editing) && (
        <CraftsmanModal
          initial={editing || undefined}
          onCancel={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSubmit={editing ? handleUpdate : handleCreate}
        />
      )}
    </main>
  )
}

function StatusBadge({ knowledgeCount }: { knowledgeCount: number }) {
  if (knowledgeCount === 0) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
        弟子(ヒアリング前)
      </span>
    )
  }
  if (knowledgeCount < 10) {
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
        修行中
      </span>
    )
  }
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600 text-white">
      師匠化
    </span>
  )
}

function CraftsmanModal({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Craftsman
  onSubmit: (v: Partial<Craftsman>) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || '')
  const [craft, setCraft] = useState(initial?.craft || '')
  const [profile, setProfile] = useState(initial?.profile || '')
  const [apprentice_context, setApprenticeContext] = useState(initial?.apprentice_context || '')
  const [teaching_style, setTeachingStyle] = useState(initial?.teaching_style || '')

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-stone-800">
          {initial ? '編集' : '新規追加'}
        </h2>

        <Field label="名前" required>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: 山田太郎"
            className="g-input"
          />
        </Field>

        <Field label="分野 / 技" required>
          <input
            value={craft}
            onChange={(e) => setCraft(e.target.value)}
            placeholder="例: 寿司職人 / 染物 / 機械整備"
            className="g-input"
          />
        </Field>

        <Field label="プロフィール" help="人物像・経歴・特徴を自由に">
          <textarea
            value={profile}
            onChange={(e) => setProfile(e.target.value)}
            rows={3}
            className="g-input"
            placeholder="例: 京都で40年、寿司一筋。先代から店を継いだ"
          />
        </Field>

        <Field
          label="AI弟子の前提知識"
          help="弟子が事前に知っておくべきこと(初歩質問を避けるため)"
        >
          <textarea
            value={apprentice_context}
            onChange={(e) => setApprenticeContext(e.target.value)}
            rows={3}
            className="g-input"
            placeholder="例: 江戸前寿司の基本工程は理解している"
          />
        </Field>

        <Field
          label="AI師匠の教え方"
          help="師匠化された時の口調・方針"
        >
          <textarea
            value={teaching_style}
            onChange={(e) => setTeachingStyle(e.target.value)}
            rows={3}
            className="g-input"
            placeholder="例: ぶっきらぼうだが、相手のレベルに合わせて噛み砕く"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-stone-300 rounded-lg text-stone-600 hover:bg-stone-50"
          >
            キャンセル
          </button>
          <button
            onClick={() =>
              onSubmit({
                name: name.trim(),
                craft: craft.trim(),
                profile: profile.trim() || undefined,
                apprentice_context: apprentice_context.trim() || undefined,
                teaching_style: teaching_style.trim() || undefined,
              })
            }
            disabled={!name.trim() || !craft.trim()}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:bg-stone-300"
          >
            保存
          </button>
        </div>
      </div>

      <style>{`
        .g-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          border: 1px solid #d4d4d8;
          background: #fafaf9;
          font-size: 14px;
          outline: none;
        }
        .g-input:focus { background: white; border-color: #d97706; }
      `}</style>
    </div>
  )
}

function Field({
  label,
  children,
  required,
  help,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
  help?: string
}) {
  return (
    <div>
      <label className="text-xs font-medium text-stone-700 block mb-1">
        {label} {required && <span className="text-amber-700">*</span>}
      </label>
      {children}
      {help && <p className="text-[10px] text-stone-400 mt-1">{help}</p>}
    </div>
  )
}

// =====================================================
// 基礎プロンプト編集タブ
// =====================================================
type PromptKey = 'deshi_base_prompt' | 'shisho_base_prompt'

function PromptsTab({ pwd }: { pwd: string }) {
  const [values, setValues] = useState<Record<PromptKey, string>>({
    deshi_base_prompt: '',
    shisho_base_prompt: '',
  })
  const [defaults, setDefaults] = useState<Record<PromptKey, string>>({
    deshi_base_prompt: '',
    shisho_base_prompt: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<PromptKey | null>(null)
  const [dirty, setDirty] = useState<Record<PromptKey, boolean>>({
    deshi_base_prompt: false,
    shisho_base_prompt: false,
  })

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-password': pwd },
        body: JSON.stringify({ action: 'get_prompts' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      setValues(data.settings || {})
      setDefaults(data.defaults || {})
      setDirty({ deshi_base_prompt: false, shisho_base_prompt: false })
    } catch (err: any) {
      alert(`取得失敗: ${err?.message || err}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save(key: PromptKey) {
    setSaving(key)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-password': pwd },
        body: JSON.stringify({ action: 'update_prompt', key, value: values[key] }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      setDirty((d) => ({ ...d, [key]: false }))
      alert('保存しました。次の会話から反映されます。')
    } catch (err: any) {
      alert(`保存失敗: ${err?.message || err}`)
    } finally {
      setSaving(null)
    }
  }

  async function resetToDefault(key: PromptKey) {
    if (!confirm('デフォルトに戻します。今の編集内容は破棄されます。よろしいですか?')) return
    setSaving(key)
    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-admin-password': pwd },
        body: JSON.stringify({ action: 'reset_prompt', key }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
      setValues((v) => ({ ...v, [key]: data.value }))
      setDirty((d) => ({ ...d, [key]: false }))
    } catch (err: any) {
      alert(`リセット失敗: ${err?.message || err}`)
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <p className="text-center text-stone-500 py-12">読み込み中…</p>

  return (
    <div className="space-y-8">
      <PromptEditor
        title="AI弟子の基礎プロンプト (聞き方)"
        description="/deshi 画面でユーザーがAI弟子と対話する時に使われる system prompt。プレースホルダ {{craftsmanProfile}} {{previousKnowledge}} {{apprenticeContext}} は実行時に置換されます。"
        value={values.deshi_base_prompt}
        defaultValue={defaults.deshi_base_prompt}
        dirty={dirty.deshi_base_prompt}
        saving={saving === 'deshi_base_prompt'}
        onChange={(v) => {
          setValues((cur) => ({ ...cur, deshi_base_prompt: v }))
          setDirty((d) => ({ ...d, deshi_base_prompt: true }))
        }}
        onSave={() => save('deshi_base_prompt')}
        onReset={() => resetToDefault('deshi_base_prompt')}
      />
      <PromptEditor
        title="AI師匠の基礎プロンプト (教え方)"
        description="/shisho 画面でユーザーがAI師匠に質問する時に使われる system prompt。プレースホルダ {{craftsmanName}} {{craft}} {{knowledgeMd}} {{learnerContext}} {{teachingStyle}} は実行時に置換されます。"
        value={values.shisho_base_prompt}
        defaultValue={defaults.shisho_base_prompt}
        dirty={dirty.shisho_base_prompt}
        saving={saving === 'shisho_base_prompt'}
        onChange={(v) => {
          setValues((cur) => ({ ...cur, shisho_base_prompt: v }))
          setDirty((d) => ({ ...d, shisho_base_prompt: true }))
        }}
        onSave={() => save('shisho_base_prompt')}
        onReset={() => resetToDefault('shisho_base_prompt')}
      />
    </div>
  )
}

function PromptEditor({
  title,
  description,
  value,
  defaultValue,
  dirty,
  saving,
  onChange,
  onSave,
  onReset,
}: {
  title: string
  description: string
  value: string
  defaultValue: string
  dirty: boolean
  saving: boolean
  onChange: (v: string) => void
  onSave: () => void
  onReset: () => void
}) {
  const isDefault = value === defaultValue
  return (
    <section className="bg-white border border-stone-200 rounded-lg p-4 space-y-3">
      <div>
        <h3 className="font-bold text-stone-800">{title}</h3>
        <p className="text-xs text-stone-500 mt-1">{description}</p>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={18}
        className="w-full p-3 text-xs font-mono leading-relaxed border border-stone-300 rounded-lg bg-stone-50 focus:bg-white focus:border-amber-500 outline-none"
        spellCheck={false}
      />
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-stone-500">
          {value.length} 文字
          {isDefault && <span className="ml-2 text-stone-400">(デフォルト状態)</span>}
          {dirty && <span className="ml-2 text-amber-600">未保存の変更あり</span>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onReset}
            disabled={saving}
            className="px-3 py-1.5 text-xs border border-stone-300 rounded text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            デフォルトに戻す
          </button>
          <button
            onClick={onSave}
            disabled={saving || !dirty}
            className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white rounded disabled:bg-stone-300"
          >
            {saving ? '保存中…' : '保存'}
          </button>
        </div>
      </div>
    </section>
  )
}
