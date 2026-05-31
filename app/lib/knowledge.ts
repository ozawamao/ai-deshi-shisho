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

/**
 * 全 knowledge_nodes を Claude に渡してコンパクトな知識ベースMD を生成する。
 * 重複統合・優先順位付け・冗長削除を AI に任せ、実用本位の MD に整える。
 * 失敗時は buildKnowledgeMd() のフォールバックを使う。
 */
const COMPACT_PROMPT = `以下は職人「{name}」(分野: {craft})の暗黙知ノード一覧です。
これを師匠AIが弟子に教える時の「コンパクトな知識ベース」として整理してください。

【整理の方針】
- 同じ趣旨のものは統合する。重複は1行にまとめる
- 似たグループはセクションを揃える
- 抽象化しすぎず、相手に伝わる具体例(数字・色・音・手応えなど)は残す
- 冗長な前置きや言い換えは削る
- 全体で {max_chars} 文字以内に収める
- 元のニュアンスは曲げない

【出力フォーマット】Markdown
# {name}の技（{craft}）

## いつ何を見るか (判断基準・感覚的指標)
- ...

## 経験から学んだ原則
- ...

## よくある失敗と対処
- ...

## 言語化しきれていない領域（未完）
- ...

【入力ノード (JSON)】
{nodes_json}

【追加コンテキスト: 直近の発言から拾った印象的な引用】
{quotes}
`

export async function compactKnowledgeMd(
  craftsmanName: string,
  craft: string,
  nodes: KnowledgeNode[],
  opts: { maxChars?: number } = {},
): Promise<string> {
  // 入力が極端に少ない場合は AI を呼ばず素直に格納
  if (nodes.length < 3) return buildKnowledgeMd(craftsmanName, craft, nodes)

  const maxChars = opts.maxChars ?? 2000
  const nodesJson = JSON.stringify(
    nodes.map(n => ({
      category: n.category,
      content: n.content,
      confidence: n.confidence,
    })),
    null,
    1,
  ).slice(0, 12000) // 安全側に切る (Claude の input 軽減)

  const quotes = nodes
    .filter(n => n.source_quote)
    .slice(-15)
    .map(n => `> ${n.source_quote}`)
    .join('\n\n')

  const prompt = COMPACT_PROMPT
    .replaceAll('{name}', craftsmanName)
    .replaceAll('{craft}', craft)
    .replaceAll('{max_chars}', String(maxChars))
    .replace('{nodes_json}', nodesJson)
    .replace('{quotes}', quotes || '(なし)')

  try {
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = res.content
      .map(c => (c.type === 'text' ? c.text : ''))
      .join('')
      .trim()
    if (!text || text.length < 50) {
      // 失敗っぽい応答はフォールバック
      return buildKnowledgeMd(craftsmanName, craft, nodes)
    }
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16)
    // 末尾に「最終更新」「原ノード数」を入れて trace 可能に
    return `${text}\n\n---\n_最終更新: ${now} / 原ノード ${nodes.length} 件をコンパクト化_\n`
  } catch (err) {
    console.warn('[compactKnowledgeMd] fallback:', err)
    return buildKnowledgeMd(craftsmanName, craft, nodes)
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