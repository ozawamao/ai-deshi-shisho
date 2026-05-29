import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../lib/supabase'
import { loadKnowledgeMd } from '../../lib/knowledge'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('craftsmanId')
  if (!id) return NextResponse.json({ error: 'craftsmanId required' }, { status: 400 })
  const admin = supabaseAdmin()
  const { data: craftsman } = await admin.from('craftsmen').select('*').eq('id', id).single()
  const { data: nodes } = await admin
    .from('knowledge_nodes')
    .select('*')
    .eq('craftsman_id', id)
    .order('created_at', { ascending: false })
  const md = await loadKnowledgeMd(id)
  return NextResponse.json({ craftsman, nodes: nodes || [], md })
}
