import { anthropic, MODEL } from './claude'
import { supabaseAdmin, type Utterance, type KnowledgeNode } from './supabase'

const EXTRACT_PROMPT = `以下は、AI弟子と職人（師匠）の会話ログです。
ここから職人の「暗黙知」を構造化して抽出してください。

【カテゴリ】
- 判断基準
- 感覚的指標
- 経験則
- 失敗のパターンと対処
- 言語化が難しい領域

各ナレッジについて以下を出力（JSONのみ、説明文なし）:
{
  "nodes": [
    {
      "category": "判断基準" | "感覚的指標" | "経験則" | "失敗のパターンと対処" | "言語化が難しい領域",
      "content": "（簡潔に1〜2文で）",
      "confidence": 0.0〜1.0,
      "source_quote": "職人の発言からの直接引用"
    }
  ]
}

会話ログ:
`

export async function extractKnowledge(
  utterances: Utterance[],
): Promise<Array<Omit<KnowledgeNode, 'id' | 'craftsman_id' | 'session_id' | 'created_at'>>> {
  const transcript = utterances
    .map(u => `${u.role === 'user' ? '師匠' : 'AI弟子'}: ${u.content}`)
    .join('\n')

  const res = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: EXTRACT_PROMPT + '\n' + transcript }],
  })

  const text = res.content
    .map(c => (c.type === 'text' ? c.text : ''))
    .join('')

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return []
  try {
    const parsed = JSON.parse(jsonMatch[0])
    return (parsed.nodes || []).map((n: any) => ({
      category: String(n.category || ''),
      content: String(n.content || ''),
      confidence: Number(n.confidence ?? 0.5),
      source_quote: n.source_quote ? String(n.source_quote) : null,
    }))
  } catch {
    return []
  }
}

export function buildKnowledgeMd(
  craftsmanName: string,
  craft: string,
  nodes: KnowledgeNode[],
): string {
  const by = (cat: string) => nodes.filter(n => n.category === cat)
  const fmt = (ns: KnowledgeNode[]) =>
    ns.length ? ns.map(n => `- ${n.content}`).join('\n') : '- （まだなし）'
  const quotes = nodes
    .filter(n => n.source_quote)
    .slice(0, 20)
    .map(n => `> ${n.source_quote}`)
    .join('\n\n')

  const now = new Date().toISOString().replace('T', ' ').slice(0, 16)
  return `# ${craftsmanName}の技（${craft}）

最終更新：${now}

## 判断基準
${fmt(by('判断基準'))}

## 感覚的指標
${fmt(by('感覚的指標'))}

## 経験則
${fmt(by('経験則'))}

## 失敗のパターンと対処
${fmt(by('失敗のパターンと対処'))}

## 言語化が難しい領域（未完）
${fmt(by('言語化が難しい領域'))}

## 発言の引用
${quotes || '> （まだなし）'}
`
}

export async function saveKnowledgeFile(
  craftsmanId: string,
  craftsmanName: string,
  craft: string,
  md: string,
): Promise<string> {
  const admin = supabaseAdmin()
  const path = `knowledge/${craftsmanId}.md`
  const { error } = await admin.storage
    .from('knowledge')
    .upload(path, new Blob([md], { type: 'text/markdown' }), { upsert: true })
  if (error) throw error

  const { data: existing } = await admin
    .from('knowledge_files')
    .select('id, version')
    .eq('craftsman_id', craftsmanId)
    .maybeSingle()

  if (existing) {
    await admin
      .from('knowledge_files')
      .update({ version: existing.version + 1, updated_at: new Date().toISOString(), file_path: path })
      .eq('id', existing.id)
  } else {
    await admin
      .from('knowledge_files')
      .insert({ craftsman_id: craftsmanId, file_path: path, version: 1 })
  }
  return path
}

export async function loadKnowledgeMd(craftsmanId: string): Promise<string> {
  const admin = supabaseAdmin()
  const { data: row } = await admin
    .from('knowledge_files')
    .select('file_path')
    .eq('craftsman_id', craftsmanId)
    .maybeSingle()
  if (!row) return ''
  const { data, error } = await admin.storage.from('knowledge').download(row.file_path)
  if (error || !data) return ''
  return await data.text()
}