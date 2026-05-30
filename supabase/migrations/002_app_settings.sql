-- app_settings: 管理画面から編集する設定 (key-value)
-- 当面のキー:
--   'deshi_base_prompt'  : AI弟子の基礎プロンプト (テンプレ文字列)
--   'shisho_base_prompt' : AI師匠の基礎プロンプト (テンプレ文字列)

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

alter table app_settings disable row level security;
