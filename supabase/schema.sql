-- AI弟子 & AI師匠 schema
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/<PROJECT_REF>/sql/new

create extension if not exists "pgcrypto";

create table if not exists craftsmen (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  craft text not null,
  profile text,
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

-- Storage bucket for knowledge md files
-- Run separately if not exists:
-- insert into storage.buckets (id, name, public) values ('knowledge', 'knowledge', true) on conflict do nothing;

-- RLS: 開発中はオフ、本番では適切に。Phase 1 では disable のままで anon key 経由でアクセス。
alter table craftsmen disable row level security;
alter table sessions disable row level security;
alter table utterances disable row level security;
alter table knowledge_nodes disable row level security;
alter table knowledge_files disable row level security;
