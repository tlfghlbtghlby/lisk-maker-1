-- المزامنة بالتغييرات فقط (Delta sync): كل فاتورة/مادة/زبون... صف مستقل في documents بمجموعة تبدأ بـ r_
-- إضافي فقط: وثيقة المحل القديمة (collection='stores') لا تتغير إطلاقاً، ولا يعمل النظام الجديد إلا إذا فعّله التطبيق.

create sequence if not exists public.documents_seq;
alter table public.documents add column if not exists seq bigint;
create index if not exists documents_seq_idx on public.documents (seq) where seq is not null;

-- السماح بمجموعات السجلات (r_invoices, r_products, ...) إضافة إلى stores
drop policy if exists "shop_documents_all" on public.documents;
create policy "shop_documents_all" on public.documents
  for all to anon, authenticated
  using (collection = 'stores' or collection like 'r\_%')
  with check (collection = 'stores' or collection like 'r\_%');

-- قراءة آمنة لوقت التعديل داخل السجل (ISO في الحقل updatedAt)؛ null إذا غير موجود أو غير صالح
create or replace function public.rec_ts(d jsonb) returns timestamptz
language plpgsql immutable as $$
begin
  return nullif(d->>'updatedAt','')::timestamptz;
exception when others then
  return null;
end $$;

-- قاعدة «الأحدث يفوز» + ترقيم التغييرات
create or replace function public.documents_delta_guard() returns trigger
language plpgsql as $$
begin
  if new.collection not like 'r\_%' then
    return new; -- وثيقة المحل القديمة: بلا أي تدخل
  end if;
  -- تسلسل الكتابات حتى يكون ترتيب seq هو ترتيب الإتمام (لا يفوت أي جهاز تغييراً)
  perform pg_advisory_xact_lock(7770001);
  if tg_op = 'UPDATE' then
    if new.data = old.data then
      return null; -- تكرار مطابق: لا شيء يتغير ولا يُرقَّم
    end if;
    if public.rec_ts(new.data) is not null and public.rec_ts(old.data) is not null
       and public.rec_ts(new.data) < public.rec_ts(old.data) then
      return null; -- نسخة أقدم من الموجودة: تُتجاهل (يحتفظ بها الجهاز في سلة المحذوفات عند الدمج)
    end if;
  end if;
  new.seq := nextval('public.documents_seq');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists documents_delta_guard on public.documents;
create trigger documents_delta_guard before insert or update on public.documents
  for each row execute function public.documents_delta_guard();

-- صلاحية استعمال عدّاد الترقيم لأدوار واجهة البيانات (التطبيق يكتب بدور anon)
grant usage, select on sequence public.documents_seq to anon, authenticated, service_role;
