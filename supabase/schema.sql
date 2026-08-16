-- AI弟子 & AI師匠 schema
--
-- 【2026-08-16】Supabase プロジェクトを tabinosihiori-ai-facilitator
-- (eufuqrrwyqosugdgmtla) へ統合した。本番スキーマの正は
--   ~/projects/tabinosihiori-ai-facilitator/supabase/migrations/
--     20260816140000_ai_deshi_shisho_tables.sql
--     20260816141000_craftsmen_drifted_columns.sql
-- であり、このファイルは新規構築時の参考用。変更時は両方を更新すること。
--
-- 新規に立て直す場合: Supabase SQL editor で全文実行
--   https://supabase.com/dashboard/project/<PROJECT_REF>/sql/new

create extension if not exists "pgcrypto";

-- 注: apprentice_context / teaching_style は本ファイルに無いまま本番へ
-- 直接追加されており、統合時にデータ投入が失敗する原因になった。追記済み。
create table if not exists craftsmen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  craft text not null,
  profile text,
  apprentice_context text,
  teaching_style text,
  created_at timestamptz default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  craftsman_id uuid references craftsmen(id) on delete cascade,
  title text,
  summary text,
  created_at timestamptz default now()
);

create table if not exists utterances (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz default now()
);

create table if not exists knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  craftsman_id uuid references craftsmen(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  category text,
  content text not null,
  confidence float default 0.5,
  source_quote text,
  created_at timestamptz default now()
);

create table if not exists knowledge_files (
  id uuid primary key default gen_random_uuid(),
  craftsman_id uuid references craftsmen(id) on delete cascade,
  file_path text not null,
  version int default 1,
  updated_at timestamptz default now()
);

create index if not exists idx_utterances_session on utterances(session_id, created_at);
create index if not exists idx_knowledge_craftsman on knowledge_nodes(craftsman_id, created_at desc);
create index if not exists idx_sessions_craftsman on sessions(craftsman_id, created_at desc);

-- Storage bucket for knowledge md files (非公開)
-- アプリは admin.storage.download() のみ使用し公開URLを使わないため public 不要。
insert into storage.buckets (id, name, public)
values ('knowledge', 'knowledge', false)
on conflict (id) do update set public = false;

-- RLS: 有効化してポリシーは作らない = service_role のみアクセス可。
--
-- 元は「Phase 1 では disable のまま anon key 経由でアクセス」としていたが、
-- 実装を確認したところ anon クライアント getSupabase() はどこからも使われておらず、
-- DB アクセスは全て supabaseAdmin() (service_role) 経由のサーバーサイド API ルートだった。
-- 統合先プロジェクトの anon キーは他アプリのバンドルに埋め込まれ公開範囲が広いため、
-- RLS 無効のままだと職人の暗黙知データが広く露出する。2026-08-16 に有効化した。
alter table craftsmen enable row level security;
alter table sessions enable row level security;
alter table utterances enable row level security;
alter table knowledge_nodes enable row level security;
alter table knowledge_files enable row level security;
