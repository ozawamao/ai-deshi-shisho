import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function url() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || ''
}

let _client: SupabaseClient | null = null
export function getSupabase() {
  if (_client) return _client
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url() || !anon) throw new Error('Supabase env vars missing')
  _client = createClient(url(), anon)
  return _client
}

let _admin: SupabaseClient | null = null
export function supabaseAdmin() {
  if (_admin) return _admin
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url() || !serviceKey) throw new Error('Supabase server env vars missing')
  _admin = createClient(url(), serviceKey, { auth: { persistSession: false } })
  return _admin
}

export type Craftsman = {
  id: string
  name: string
  craft: string
  profile: string | null
  created_at: string
}

export type Session = {
  id: string
  craftsman_id: string
  title: string | null
  summary: string | null
  created_at: string
}

export type Utterance = {
  id: string
  session_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export type KnowledgeNode = {
  id: string
  craftsman_id: string
  session_id: string | null
  category: string | null
  content: string
  confidence: number
  source_quote: string | null
  created_at: string
}
