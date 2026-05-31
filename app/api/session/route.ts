import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../lib/supabase'
import { extractKnowledge, compactKnowledgeMd, saveKnowledgeFile } from '../../lib/knowledge'

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

    // Claude で要約してコンパクト化。失敗時は内部で buildKnowledgeMd フォールバック
    const md = await compactKnowledgeMd(craftsman!.name, craftsman!.craft, allNodes || [])
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

  if (body.action === 'update_craftsman') {
    const { craftsmanId, name, craft, profile, apprentice_context, teaching_style } = body
    const patch: any = {}
    if (name !== undefined) patch.name = name
    if (craft !== undefined) patch.craft = craft
    if (profile !== undefined) patch.profile = profile
    if (apprentice_context !== undefined) patch.apprentice_context = apprentice_context
    if (teaching_style !== undefined) patch.teaching_style = teaching_style
    const { data, error } = await admin
      .from('craftsmen')
      .update(patch)
      .eq('id', craftsmanId)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ craftsman: data })
  }

  if (body.action === 'create_craftsman') {
    const { name, craft, profile, apprentice_context, teaching_style } = body
    const { data, error } = await admin
      .from('craftsmen')
      .insert({ name, craft, profile, apprentice_context, teaching_style })
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ craftsman: data })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
