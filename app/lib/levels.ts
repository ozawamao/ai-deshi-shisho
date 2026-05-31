/**
 * 師匠レベル (1〜5段階)
 * 見習い → 弟子 → 一人前 → 師範 → 師匠
 *
 * 昇格条件: ナレッジノード数 + カテゴリ網羅
 */

export type LevelKey = 'minarai' | 'deshi' | 'ichininmae' | 'shihan' | 'shishou'

export interface LevelDef {
  key: LevelKey
  rank: number // 1〜5
  name: string
  emoji: string
  /** Tailwind バッジ用クラス */
  badge: string
  /** 上位への昇格に必要な (count, cats) */
  next?: { count: number; cats: number; toName: string }
}

const SHISHOU: LevelDef = {
  key: 'shishou',
  rank: 5,
  name: '師匠',
  emoji: '👴',
  badge: 'bg-amber-600 text-white',
}
const SHIHAN: LevelDef = {
  key: 'shihan',
  rank: 4,
  name: '師範',
  emoji: '⛩',
  badge: 'bg-amber-500/40 text-amber-900 border border-amber-600/40',
  next: { count: 80, cats: 5, toName: '師匠' },
}
const ICHININMAE: LevelDef = {
  key: 'ichininmae',
  rank: 3,
  name: '一人前',
  emoji: '⚒',
  badge: 'bg-amber-200 text-amber-900',
  next: { count: 40, cats: 4, toName: '師範' },
}
const DESHI: LevelDef = {
  key: 'deshi',
  rank: 2,
  name: '弟子',
  emoji: '🌱',
  badge: 'bg-amber-100 text-amber-800',
  next: { count: 15, cats: 3, toName: '一人前' },
}
const MINARAI: LevelDef = {
  key: 'minarai',
  rank: 1,
  name: '見習い',
  emoji: '🐣',
  badge: 'bg-stone-100 text-stone-600',
  next: { count: 3, cats: 0, toName: '弟子' },
}

export const LEVELS: LevelDef[] = [MINARAI, DESHI, ICHININMAE, SHIHAN, SHISHOU]

/** 既知カテゴリ (extractKnowledge と揃える) */
export const ALL_CATEGORIES = [
  '判断基準',
  '感覚的指標',
  '経験則',
  '失敗のパターンと対処',
  '言語化が難しい領域',
]

export interface ComputedLevel extends LevelDef {
  /** ノード数 */
  count: number
  /** 網羅カテゴリ数 */
  cats: number
  /** 次レベルまで何が足りないか (text) */
  progressNote: string
}

/**
 * ノード一覧からレベルを判定。
 * 上位から順に「両方の条件を満たしたか」を見る。
 */
export function computeLevel(
  nodes: Array<{ category?: string | null }>,
): ComputedLevel {
  const count = nodes.length
  const catSet = new Set<string>()
  for (const n of nodes) {
    if (n.category) catSet.add(n.category)
  }
  const cats = catSet.size

  const matched: LevelDef = (() => {
    if (count >= 80 && cats >= 5) return SHISHOU
    if (count >= 40 && cats >= 4) return SHIHAN
    if (count >= 15 && cats >= 3) return ICHININMAE
    if (count >= 3) return DESHI
    return MINARAI
  })()

  let progressNote = ''
  if (matched.next) {
    const dCount = Math.max(0, matched.next.count - count)
    const dCats = Math.max(0, matched.next.cats - cats)
    const parts: string[] = []
    if (dCount > 0) parts.push(`+${dCount}件`)
    if (dCats > 0) parts.push(`+${dCats}分野`)
    progressNote = parts.length
      ? `${matched.next.toName}まで ${parts.join(' / ')}`
      : `${matched.next.toName} 昇格条件を満たしています`
  } else {
    progressNote = '最上位'
  }

  return { ...matched, count, cats, progressNote }
}
