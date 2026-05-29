import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../lib/supabase'
import { extractKnowledge, buildKnowledgeMd, saveKnowledgeFile } from '../../lib/knowledge'

export const runtime = 'nodejs'

// POST /api/session
// body: { action: 'create', craftsmanName, craft, profile? }
//     | { action: 'end', sessionId, craftsmanId }
//     | { action: 'list_craftsmen' }
//     | { action: 'get_craftsman', craftsmanId }
export async function POST(req: NextRequest) {
  const body = await req.json()
  const admin = supabaseAdmin()

  if (body.action === 'create') {
    let craftsmanId = body.craftsmanId as string | undefined
    if (!craftsmanId) {
      const { data: c, error: ce } = await admin
        .from('craftsmen')
        .insert({ name: body.craftsmanName, craft: body.craft, profile: body.profile ?? null })
        .select()
        .single()
      if (ce) return NextResponse.json({ error: ce.message }, { status: 500 })
      craftsmanId = c.id
    }
    const { data: s, error: se } = await admin
      .from('sessions')
      .insert({ craftsman_id: craftsmanId, title: body.title ?? null })
      .select()
      .single()
    if (se) return NextResponse.json({ error: se.message }, { status: 500 })
    return NextResponse.json({ sessionId: s.id, craftsmanId })
  }

  if (body.action === 'end') {
    const { sessionId, craftsmanId } = body
    const { data: utts } = await admin
      .from('utterances')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })

    const nodes = await extractKnowledge(utts || [])
    if (nodes.length) {
      await admin.from('knowledge_nodes').insert(
        nodes.map(n => ({ ...n, craftsman_id: craftsmanId, session_id: sessionId })),
      )
    }

    const { data: craftsman } = await admin
      .from('craftsmen')
      .select('*')
      .eq('id', craftsmanId)
      .single()
    const { data: allNodes } = await admin
      .from('knowledge_nodes')
      .select('*')
      .eq('craftsman_id', craftsmanId)
      .order('created_at', { ascending: false })

    const md = buildKnowledgeMd(craftsman!.name, craftsman!.craft, allNodes || [])
    const path = await saveKnowledgeFile(craftsmanId, craftsman!.name, craftsman!.craft, md)

    return NextResponse.json({ ok: true, nodesAdded: nodes.length, filePath: path })
  }

  if (body.action === 'list_craftsmen') {
    const { data } = await admin
      .from('craftsmen')
      .select('*')
      .order('created_at', { ascending: false })
    return NextResponse.json({ craftsmen: data || [] })
  }

  if (body.action === 'get_craftsman') {
    const { data } = await admin.from('craftsmen').select('*').eq('id', body.craftsmanId).single()
    return NextResponse.json({ craftsman: data })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
