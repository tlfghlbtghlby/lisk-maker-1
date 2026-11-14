-- سجل استخدام قراءة الصور بالذكاء الاصطناعي + دوال الحد (مطبّقة على Supabase)
create table if not exists public.ai_scan_log (id bigserial primary key, store_id text not null, at timestamptz not null default now());
create index if not exists ai_scan_log_at_idx on public.ai_scan_log(at);
create index if not exists ai_scan_log_store_at_idx on public.ai_scan_log(store_id, at);
alter table public.ai_scan_log enable row level security;
-- الدوال: ai_scan_day_start (بداية اليوم بتوقيت بغداد)، ai_scan_hit2(store, store_limit, global_limit, global_hours)
-- ai_scan_refund2(store)، ai_scan_stats(global_hours). الحدود نفسها في documents: config/ai_scan_limits
