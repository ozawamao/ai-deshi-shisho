import { supabaseAdmin } from './supabase'
import { DESHI_DEFAULT_TEMPLATE, SHISHO_DEFAULT_TEMPLATE } from './claude'

export type SettingKey = 'deshi_base_prompt' | 'shisho_base_prompt'

export const DEFAULTS: Record<SettingKey, string> = {
  deshi_base_prompt: DESHI_DEFAULT_TEMPLATE,
  shisho_base_prompt: SHISHO_DEFAULT_TEMPLATE,
}

/** DB から1件取得。無ければデフォルトを返す。 */
export async function getSetting(key: SettingKey): Promise<string> {
  try {
    const admin = supabaseAdmin()
    const { data } = await admin
      .from('app_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (data?.value && typeof data.value === 'string') return data.value
  } catch {
    // テーブル未作成等はデフォにフォールバック
  }
  return DEFAULTS[key]
}

/** 全部取ってオブジェクトで返す (admin 画面用) */
export async function getAllSettings(): Promise<Record<SettingKey, string>> {
  const admin = supabaseAdmin()
  const result = { ...DEFAULTS }
  try {
    const { data } = await admin.from('app_settings').select('key,value')
    for (const row of data || []) {
      if (row.key in result && typeof row.value === 'string') {
        ;(result as any)[row.key] = row.value
      }
    }
  } catch {}
  return result
}

/** 上書き保存 (upsert) */
export async function saveSetting(key: SettingKey, value: string): Promise<void> {
  const admin = supabaseAdmin()
  await admin
    .from('app_settings')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
}
