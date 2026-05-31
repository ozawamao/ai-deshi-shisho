import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../lib/supabase'
import { getAllSettings, saveSetting, DEFAULTS, SettingKey } from '../../lib/settings'
import { compactKnowledgeMd, saveKnowledgeFile } from '../../lib/knowledge'

export const runtime = 'nodejs'

/**
 * /api/admin
 * 管理画面用のCRUD。共通でパスワード認証。
 *
 * 認証: header 'x-admin-password' に正しいパスワードを乗せる
 * 環境変数 ADMIN_PASSWORD で照合
 *
 * action:
 *  - 'auth'           : パスワードだけ検証 (login用)
 *  - 'list'           : craftsmen 一覧 (各行に session数/knowledge数 を集計)
 *  - 'create'         : { name, craft, profile?, apprentice_context?, teaching_style? }
 *  - 'update'         : { id, ...patch }
 *  - 'delete'         : { id } (関連 sessions/utterances/knowledge_nodes も cascade で消える)
 *  - 'rebuild_md'     : { id } 全 knowledge_nodes から knowledge.md を再生成
 *  - 'list_knowledge' : { id } 該当craftsmanの knowledge_nodes 一覧
 *  - 'delete_knowledge': { knowledgeId } 個別ノード削除
 */
export async function POST(req: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    return NextResponse.json(
      { error: 'ADMIN_PASSWORD が Vercel env に未設定です。' },
      { status: 500 }
    )
  }
  const provided = req.headers.get('x-admin-password') || ''
  if (provided !== expected) {
    return NextResponse.json({ error: 'パスワードが違います' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { action } = body
  const admin = supabaseAdmin()

  try {
    if (action === 'auth') {
      return NextResponse.json({ ok: true })
    }

    if (action === 'list') {
      const { data: craftsmen, error } = await admin
        .from('craftsmen')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error

      // 各 craftsman の session 数 / knowledge 数を集計
      const ids = (craftsmen || []).map((c: any) => c.id)
      let sessCounts = new Map<string, number>()
      let knowCounts = new Map<string, number>()
      if (ids.length > 0) {
        const { data: ss } = await admin
          .from('sessions')
          .select('craftsman_id')
          .in('craftsman_id', ids)
        for (const r of ss || []) {
          sessCounts.set(r.craftsman_id, (sessCounts.get(r.craftsman_id) || 0) + 1)
        }
        const { data: ns } = await admin
          .from('knowledge_nodes')
          .select('craftsman_id')
          .in('craftsman_id', ids)
        for (const r of ns || []) {
          knowCounts.set(r.craftsman_id, (knowCounts.get(r.craftsman_id) || 0) + 1)
        }
      }
      const enriched = (craftsmen || []).map((c: any) => ({
        ...c,
        session_count: sessCounts.get(c.id) || 0,
        knowledge_count: knowCounts.get(c.id) || 0,
      }))
      return NextResponse.json({ craftsmen: enriched })
    }

    if (action === 'create') {
      const { name, craft, profile, apprentice_context, teaching_style } = body
      if (!name || !craft) {
        return NextResponse.json({ error: 'name と craft は必須' }, { status: 400 })
      }
      const { data, error } = await admin
        .from('craftsmen')
        .insert({ name, craft, profile, apprentice_context, teaching_style })
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ craftsman: data })
    }

    if (action === 'update') {
      const { id, ...patch } = body
      if (!id) return NextResponse.json({ error: 'id 必須' }, { status: 400 })
      delete (patch as any).action
      const { data, error } = await admin
        .from('craftsmen')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return NextResponse.json({ craftsman: data })
    }

    if (action === 'delete') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'id 必須' }, { status: 400 })
      const { error } = await admin.from('craftsmen').delete().eq('id', id)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'list_knowledge') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'id 必須' }, { status: 400 })
      const { data, error } = await admin
        .from('knowledge_nodes')
        .select('*')
        .eq('craftsman_id', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return NextResponse.json({ nodes: data || [] })
    }

    if (action === 'delete_knowledge') {
      const { knowledgeId } = body
      if (!knowledgeId) return NextResponse.json({ error: 'knowledgeId 必須' }, { status: 400 })
      const { error } = await admin.from('knowledge_nodes').delete().eq('id', knowledgeId)
      if (error) throw error
      return NextResponse.json({ ok: true })
    }

    if (action === 'get_prompts') {
      const settings = await getAllSettings()
      return NextResponse.json({ settings, defaults: DEFAULTS })
    }

    if (action === 'update_prompt') {
      const { key, value } = body as { key: SettingKey; value: string }
      if (!key || !['deshi_base_prompt', 'shisho_base_prompt'].includes(key)) {
        return NextResponse.json({ error: 'key不正' }, { status: 400 })
      }
      if (typeof value !== 'string' || !value.trim()) {
        return NextResponse.json({ error: 'value必須' }, { status: 400 })
      }
      await saveSetting(key, value)
      return NextResponse.json({ ok: true })
    }

    if (action === 'rebuild_md') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'id 必須' }, { status: 400 })
      const { data: craftsman } = await admin.from('craftsmen').select('*').eq('id', id).single()
      if (!craftsman) return NextResponse.json({ error: 'craftsman not found' }, { status: 404 })
      const { data: nodes } = await admin
        .from('knowledge_nodes')
        .select('*')
        .eq('craftsman_id', id)
        .order('created_at', { ascending: true })
      const md = await compactKnowledgeMd(craftsman.name, craftsman.craft, nodes || [])
      const path = await saveKnowledgeFile(id, craftsman.name, craftsman.craft, md)
      return NextResponse.json({ ok: true, filePath: path, nodes: (nodes || []).length, chars: md.length })
    }

    if (action === 'reset_prompt') {
      const { key } = body as { key: SettingKey }
      if (!key || !['deshi_base_prompt', 'shisho_base_prompt'].includes(key)) {
        return NextResponse.json({ error: 'key不正' }, { status: 400 })
      }
      await saveSetting(key, DEFAULTS[key])
      return NextResponse.json({ ok: true, value: DEFAULTS[key] })
    }

    return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  } catch (err: any) {
    console.error('[admin]', err)
    return NextResponse.json({ error: err?.message || 'internal error' }, { status: 500 })
  }
}
