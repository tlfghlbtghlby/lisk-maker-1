-- سكربت إعداد مشروع Supabase الخاص بمحل واحد (سحابة مستقلة).
-- نفّذه مرة واحدة في SQL Editor للمشروع الجديد. آمن للتكرار (idempotent).
create table if not exists public.documents (
  collection text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (collection, id)
);

alter table public.documents enable row level security;

-- مشروع المحل يحمل وثيقة محله فقط (stores). نمنع أي مجموعة أخرى.
drop policy if exists "shop_documents_all" on public.documents;
create policy "shop_documents_all" on public.documents
  for all to anon, authenticated
  using (collection = 'stores')
  with check (collection = 'stores');

-- المزامنة اللحظية بين أجهزة المحل
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='documents') then
    alter publication supabase_realtime add table public.documents;
  end if;
end $$;

-- رقم إصدار هيكل قاعدة المحل (لترقيات لاحقة)
create table if not exists public.schema_info (id int primary key default 1, version int not null);
insert into public.schema_info (id, version) values (1, 1) on conflict (id) do nothing;
alter table public.schema_info enable row level security;
drop policy if exists "schema_info_read" on public.schema_info;
create policy "schema_info_read" on public.schema_info for select to anon, authenticated using (true);
