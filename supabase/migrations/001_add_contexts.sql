-- 弟子AIが事前に持っておく専門知識 (用語・基礎・関連分野など)
alter table craftsmen add column if not exists apprentice_context text;

-- 師匠AIの教え方の指示 (口調・対象レベル・教育方針など)
alter table craftsmen add column if not exists teaching_style text;
