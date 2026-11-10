-- جداول ربط التليجرام. شغّل هذا الملف مرة واحدة من Supabase → SQL Editor.
-- RLS مفعّل بدون أي سياسة: لا يمكن قراءة هذه الجداول أو الكتابة فيها إلا عبر الدالة (service role).

create table if not exists public.tg_stores (
  store_uid   text primary key,
  secret_hash text not null,
  store_name  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.tg_codes (
  code          text primary key,
  kind          text not null check (kind in ('store', 'customer', 'rep')),
  store_uid     text not null references public.tg_stores(store_uid) on delete cascade,
  customer_id   text,
  customer_name text,
  created_at    timestamptz not null default now()
);

create table if not exists public.tg_chats (
  id          bigserial primary key,
  kind        text not null check (kind in ('store', 'customer', 'rep')),
  store_uid   text not null references public.tg_stores(store_uid) on delete cascade,
  customer_id text not null default '',
  chat_id     bigint not null,
  chat_name   text,
  linked_at   timestamptz not null default now(),
  unique (kind, store_uid, customer_id, chat_id)
);

create index if not exists tg_chats_lookup on public.tg_chats (store_uid, kind, customer_id);

-- إعدادات البوت (التوكن وسرّ الـ webhook). مقفلة بـ RLS بلا سياسات: لا يقرؤها إلا الدالة.
create table if not exists public.tg_config (
  key   text primary key,
  value text not null
);

alter table public.tg_config enable row level security;
alter table public.tg_stores enable row level security;
alter table public.tg_codes  enable row level security;
alter table public.tg_chats  enable row level security;


-- ترقية (لمن أنشأ الجداول سابقاً): السماح بنوع المندوب. شغّل هذا الجزء مرة واحدة.
alter table public.tg_codes drop constraint if exists tg_codes_kind_check;
alter table public.tg_codes add constraint tg_codes_kind_check check (kind in ('store', 'customer', 'rep'));
alter table public.tg_chats drop constraint if exists tg_chats_kind_check;
alter table public.tg_chats add constraint tg_chats_kind_check check (kind in ('store', 'customer', 'rep'));
