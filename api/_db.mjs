import { neon } from "@neondatabase/serverless";

let initialized = false;

export function client() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  return neon(url);
}

export async function ensureSchema() {
  if (initialized) return;
  const sql = client();

  const statements = [
    `create table if not exists roader_accounts (
      id bigserial primary key,
      name text not null,
      handle text not null unique,
      sector text not null default '',
      target_audience text not null default '',
      tone text not null default '',
      persona text not null default '',
      daily_post_goal integer not null default 0,
      cta_ratio integer not null default 0,
      telegram_source_code text,
      is_active boolean not null default true,
      threads_user_id text,
      threads_access_token_encrypted text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`,
    `create table if not exists roader_content_profiles (
      id bigserial primary key,
      account_id bigint not null references roader_accounts(id) on delete cascade,
      min_chars integer not null default 180,
      max_chars integer not null default 420,
      quality_threshold integer not null default 80,
      auto_publish_threshold integer not null default 90,
      banned_phrases jsonb not null default '[]'::jsonb,
      type_mix jsonb not null default '{"정보형":35,"후킹형":25,"댓글유도형":20,"뉴스해설형":15,"CTA":5}'::jsonb,
      style_rules jsonb not null default '{"mobile_format":{"priority":"required","paragraph_max_sentences":2,"blank_line_between_paragraphs":true,"target_paragraphs":"5~7","max_line_chars":58,"split_long_sentences":true,"separate_question_or_cta":true,"instruction":"모바일에서 한눈에 읽히도록 한 문단 1~2문장, 문단 사이 빈 줄 1개, 긴 문장은 의미 단위로 줄바꿈하고 질문/CTA는 별도 문단으로 분리"}}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(account_id)
    )`,
    `create table if not exists roader_topics (
      id bigserial primary key,
      account_id bigint not null references roader_accounts(id) on delete cascade,
      name text not null,
      category text not null default '',
      priority integer not null default 50,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    )`,
    `create table if not exists roader_posts (
      id bigserial primary key,
      account_id bigint not null references roader_accounts(id) on delete cascade,
      topic_id bigint references roader_topics(id) on delete set null,
      post_type text not null default '정보형',
      media_mode text not null default 'text',
      body text not null,
      quality_score integer,
      quality_status text,
      quality_details jsonb not null default '{}'::jsonb,
      status text not null default 'draft',
      source_code text,
      threads_post_id text,
      published_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`,
    `create table if not exists roader_post_media (
      id bigserial primary key,
      post_id bigint not null references roader_posts(id) on delete cascade,
      kind text not null default 'image',
      url text not null,
      alt_text text,
      sort_order integer not null default 0,
      created_at timestamptz not null default now()
    )`,
    `create table if not exists roader_schedules (
      id bigserial primary key,
      post_id bigint not null references roader_posts(id) on delete cascade,
      scheduled_at timestamptz not null,
      timezone text not null default 'Asia/Seoul',
      status text not null default 'scheduled',
      last_error text,
      attempt_count integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`,
    `create table if not exists roader_metrics (
      id bigserial primary key,
      post_id bigint not null references roader_posts(id) on delete cascade,
      captured_at timestamptz not null default now(),
      views integer not null default 0,
      likes integer not null default 0,
      replies integer not null default 0,
      reposts integer not null default 0,
      quotes integer not null default 0,
      shares integer not null default 0,
      profile_visits integer not null default 0,
      bot_entries integer not null default 0,
      applications integer not null default 0
    )`,
    `create table if not exists roader_leads (
      id bigserial primary key,
      telegram_user_id text not null,
      receipt_number text,
      telegram_username text,
      display_name text,
      age_group text,
      interest text,
      experience text,
      source_code text,
      source_post_id bigint references roader_posts(id) on delete set null,
      status text not null default 'pending',
      processed_by text,
      processed_at timestamptz,
      created_at timestamptz not null default now()
    )`,
    `create table if not exists roader_style_sources (
      id bigserial primary key,
      account_id bigint not null references roader_accounts(id) on delete cascade,
      source_handle text not null,
      label text not null default '',
      is_active boolean not null default true,
      last_synced_at timestamptz,
      last_sync_count integer not null default 0,
      last_error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique(account_id, source_handle)
    )`,
    `create table if not exists roader_style_samples (
      id bigserial primary key,
      account_id bigint not null references roader_accounts(id) on delete cascade,
      source_id bigint not null references roader_style_sources(id) on delete cascade,
      body text not null,
      sample_hash text not null,
      created_at timestamptz not null default now(),
      unique(source_id, sample_hash)
    )`,
    `create table if not exists roader_style_profiles (
      id bigserial primary key,
      account_id bigint not null references roader_accounts(id) on delete cascade,
      profile jsonb not null default '{}'::jsonb,
      sample_count integer not null default 0,
      confidence integer not null default 0,
      updated_at timestamptz not null default now(),
      unique(account_id)
    )`,
    `alter table roader_content_profiles alter column style_rules set default '{"mobile_format":{"priority":"required","paragraph_max_sentences":2,"blank_line_between_paragraphs":true,"target_paragraphs":"5~7","max_line_chars":58,"split_long_sentences":true,"separate_question_or_cta":true,"instruction":"모바일에서 한눈에 읽히도록 한 문단 1~2문장, 문단 사이 빈 줄 1개, 긴 문장은 의미 단위로 줄바꿈하고 질문/CTA는 별도 문단으로 분리"}}'::jsonb`,
    `update roader_content_profiles set style_rules = coalesce(style_rules,'{}'::jsonb) || '{"mobile_format":{"priority":"required","paragraph_max_sentences":2,"blank_line_between_paragraphs":true,"target_paragraphs":"5~7","max_line_chars":58,"split_long_sentences":true,"separate_question_or_cta":true,"instruction":"모바일에서 한눈에 읽히도록 한 문단 1~2문장, 문단 사이 빈 줄 1개, 긴 문장은 의미 단위로 줄바꿈하고 질문/CTA는 별도 문단으로 분리"}}'::jsonb where not (coalesce(style_rules,'{}'::jsonb) ? 'mobile_format')`,
    `create index if not exists idx_roader_style_samples_account on roader_style_samples(account_id, created_at desc)`,
    `create index if not exists idx_roader_style_sources_account on roader_style_sources(account_id, is_active)`,
    `alter table roader_accounts alter column daily_post_goal set default 0`,
    `alter table roader_accounts alter column cta_ratio set default 0`,
    `create index if not exists idx_roader_posts_account_status on roader_posts(account_id, status)`,
    `create index if not exists idx_roader_schedules_time_status on roader_schedules(scheduled_at, status)`,
    `alter table roader_metrics add column if not exists quotes integer not null default 0`,
    `alter table roader_metrics add column if not exists shares integer not null default 0`,
    `create index if not exists idx_roader_metrics_post_time on roader_metrics(post_id, captured_at desc)`,
    `create index if not exists idx_roader_leads_source on roader_leads(source_code, created_at desc)`
  ];

  for (const statement of statements) {
    await sql(statement);
  }

  initialized = true;
}

export async function dbHealth() {
  await ensureSchema();
  const rows = await client()("select now() as now, current_database() as database");
  return rows[0];
}
