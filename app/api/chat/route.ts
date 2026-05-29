import { NextRequest, NextResponse } from 'next/server'
import { anthropic, MODEL, DESHI_SYSTEM, SHISHO_SYSTEM } from '../../lib/claude'
import { supabaseAdmin } from '../../lib/supabase'
import { loadKnowledgeMd } from '../../lib/knowledge'

export const runtime = 'nodejs'

// POST /api/chat
// body: {
//   mode: 'deshi' | 'shisho',
//   sessionId?: string,        // deshi: utterances are persisted
//   craftsmanId: string,
//   userText: string,
//   history: Array<{role:'user'|'assistant', content:string}>,
//   learnerContext?: string,
// }
export async function POST(req: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY が未設定です (Vercel の Environment Variables を確認)' },
        { status: 500 }
      )
    }
    const body = await req.json()
    const { mode, sessionId, craftsmanId, userText, history = [], learnerContext } = body

    if (!craftsmanId) {
      return NextResponse.json({ error: 'craftsmanId が無い (セッション作成に失敗している可能性)' }, { status: 400 })
    }
    if (!userText || typeof userText !== 'string') {
      return NextResponse.json({ error: 'userText 必須' }, { status: 400 })
    }

    const admin = supabaseAdmin()
    const { data: craftsman, error: cErr } = await admin
      .from('craftsmen')
      .select('*')
      .eq('id', craftsmanId)
      .single()
    if (cErr || !craftsman) {
      return NextResponse.json(
        { error: `craftsman not found (${craftsmanId}): ${cErr?.message || 'no row'}` },
        { status: 404 }
      )
    }

  let system: string
  if (mode === 'deshi') {
    // 前回までのナレッジサマリー
    const { data: nodes } = await admin
      .from('knowledge_nodes')
      .select('category, content')
      .eq('craftsman_id', craftsmanId)
      .order('created_at', { ascending: false })
      .limit(50)
    const summary = (nodes || [])
      .map(n => `- [${n.category}] ${n.content}`)
      .join('\n')
    system = DESHI_SYSTEM(
      craftsman.profile || '',
      summary,
      craftsman.apprentice_context || '',
    )
  } else {
    const md = await loadKnowledgeMd(craftsmanId)
    system = SHISHO_SYSTEM(
      craftsman.name,
      craftsman.craft,
      md || '（まだ知識が記録されていません）',
      learnerContext || '',
      craftsman.teaching_style || '',
    )
  }

  const messages = [
    ...history.map((h: any) => ({ role: h.role, content: h.content })),
    { role: 'user' as const, content: userText },
  ]

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system,
    messages,
  })
  const text = res.content.map(c => (c.type === 'text' ? c.text : '')).join('')

    if (mode === 'deshi' && sessionId) {
      await admin.from('utterances').insert([
        { session_id: sessionId, role: 'user', content: userText },
        { session_id: sessionId, role: 'assistant', content: text },
      ])
    }

    return NextResponse.json({ text })
  } catch (err: any) {
    console.error('[chat] error', err)
    return NextResponse.json(
      { error: err?.message || 'internal error', model: process.env.ANTHROPIC_MODEL || 'default' },
      { status: 500 }
    )
  }
}
