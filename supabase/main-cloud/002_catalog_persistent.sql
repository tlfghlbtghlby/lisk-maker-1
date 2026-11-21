-- كتالوج دائم: لا يعتمد على وجود وثائق المحلات في السحابة الرئيسية.
-- كل اسم لكل باركود صف مستقل (يظهر للمحل عند الكتابة)، وعند مسح الباركود يُرجع الاسم الأطول (product_catalog).
create table if not exists public.catalog_names (
  barcode text not null,
  name text not null,
  search_name text not null,
  category text, unit text, pieces_per_carton int,
  cost_price numeric, retail_price numeric,
  offers jsonb not null default '[]'::jsonb,
  stores_count int not null default 1,
  updated_at timestamptz not null default now(),
  primary key (barcode, name)
);
create table if not exists public.catalog_seen (
  barcode text not null, name text not null, store_hash text not null,
  primary key (barcode, name, store_hash)
);
alter table public.catalog_names enable row level security;
alter table public.catalog_seen enable row level security;   -- بلا سياسات: الوصول عبر الدوال فقط

-- رفع مواد محل إلى الكتالوج (باركود + اسم + تصنيف + وحدة + أسعار). لا تُخزَّن هوية المحل إلا كبصمة md5.
create or replace function public.catalog_contribute(p_store text, p_items jsonb)
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; r jsonb; v_bar text; v_name text; v_cost numeric; v_ret numeric; v_ppc int;
        v_h text := md5(replace(coalesce(p_store,''), 'store_', ''));
begin
  if coalesce(length(p_store),0) < 3 or jsonb_typeof(p_items) <> 'array' then return 0; end if;
  for r in select * from jsonb_array_elements(p_items) limit 1000 loop
    v_bar := trim(r->>'code'); v_name := trim(r->>'name');
    continue when v_bar is null or v_bar !~ '^[0-9]{6,15}$' or coalesce(length(v_name),0) not between 2 and 120;
    v_cost := case when (r->>'costPrice') ~ '^[0-9]+(\.[0-9]+)?$' and (r->>'costPrice')::numeric > 0 then (r->>'costPrice')::numeric end;
    v_ret  := case when (r->>'retailPrice') ~ '^[0-9]+(\.[0-9]+)?$' and (r->>'retailPrice')::numeric > 0 then (r->>'retailPrice')::numeric end;
    v_ppc  := case when (r->>'piecesPerCarton') ~ '^[0-9]+$' and (r->>'piecesPerCarton')::numeric > 1 and (r->>'piecesPerCarton')::numeric < 100000 then (r->>'piecesPerCarton')::int end;
    insert into catalog_seen(barcode, name, store_hash) values (v_bar, v_name, v_h) on conflict do nothing;
    insert into catalog_names(barcode, name, search_name, category, unit, pieces_per_carton, cost_price, retail_price, stores_count)
    values (v_bar, v_name, norm_ar(v_name), nullif(trim(r->>'category'),''), nullif(trim(r->>'unit'),''), v_ppc, v_cost, v_ret, 1)
    on conflict (barcode, name) do update set
      category = coalesce(catalog_names.category, excluded.category),
      unit = coalesce(catalog_names.unit, excluded.unit),
      pieces_per_carton = greatest(catalog_names.pieces_per_carton, excluded.pieces_per_carton),
      cost_price = greatest(catalog_names.cost_price, excluded.cost_price),
      retail_price = greatest(catalog_names.retail_price, excluded.retail_price),
      stores_count = (select count(*) from catalog_seen s where s.barcode = excluded.barcode and s.name = excluded.name),
      updated_at = now();
    n := n + 1;
  end loop;
  return n;
end $$;
grant execute on function public.catalog_contribute(text, jsonb) to anon, authenticated;

-- البحث بالاسم: كل اسم صف مستقل (بيبسي قوطية / بيبسي 185 مل بنفس الباركود يظهران معاً)
create or replace function public.catalog_search(p_q text, p_limit integer default 10)
returns table(barcode text, name text, category text, unit text, pieces_per_carton integer, cost_price numeric, retail_price numeric, offers jsonb, stores_count integer)
language sql stable security definer set search_path to 'public' as $$
  with q as (select public.norm_ar(trim(p_q)) as n, replace(public.norm_ar(trim(p_q)), 'ي', '') as k)
  select c.barcode, c.name, c.category, c.unit, c.pieces_per_carton, c.cost_price, c.retail_price, c.offers, c.stores_count
  from public.catalog_names c, q
  where length(trim(p_q)) >= 2
    and (c.search_name like '%' || q.n || '%'
         or (length(q.k) >= 3 and replace(c.search_name, 'ي', '') like '%' || q.k || '%'))
  order by (c.search_name like q.n || '%') desc, (c.search_name like '%' || q.n || '%') desc, c.stores_count desc, length(c.name)
  limit least(greatest(p_limit,1), 20);
$$;

-- التحديث الليلي: يُدخل ما في وثائق المحلات المتبقية في السحابة الرئيسية إلى catalog_names (إضافة فقط، بلا حذف)،
-- ثم يعيد بناء product_catalog (الاسم الأطول لكل باركود) من catalog_names الدائم.
create or replace function public.refresh_product_catalog(min_stores_for_prices integer DEFAULT 1)
returns integer language plpgsql security definer set search_path to 'public' as $$
declare n int;
begin
  create temp table _p on commit drop as
  select d.id as store_id, p.e->>'id' as pid, p.e->>'code' as code, trim(p.e->>'name') as name,
         nullif(trim(p.e->>'category'),'') as category, nullif(trim(p.e->>'unit'),'') as unit,
         case when (p.e->>'piecesPerCarton') ~ '^[0-9]+(\.[0-9]+)?$' then (p.e->>'piecesPerCarton')::numeric end as ppc,
         case when (p.e->>'costPrice') ~ '^[0-9]+(\.[0-9]+)?$' then (p.e->>'costPrice')::numeric end as cost,
         case when (p.e->>'retailPrice') ~ '^[0-9]+(\.[0-9]+)?$' then (p.e->>'retailPrice')::numeric end as retail,
         d.data#>'{settings,promotions}' as promos
  from documents d
  cross join lateral jsonb_array_elements(case when jsonb_typeof(d.data->'products')='array' then d.data->'products' else '[]'::jsonb end) as p(e)
  where d.collection='stores' and (p.e->>'code') ~ '^[0-9]{6,15}$' and coalesce(trim(p.e->>'name'),'') <> '';

  create temp table _o on commit drop as
  select p.code, o.e->>'buyQty' as buy_qty, o.e->>'discountType' as dtype, o.e->>'discountValue' as dval,
         coalesce(o.e->>'discountScope','per_piece') as dscope, coalesce(o.e->>'discountRepeat','true') as drepeat,
         count(distinct p.store_id) as c
  from _p p
  cross join lateral jsonb_array_elements(case when jsonb_typeof(p.promos)='array' then p.promos else '[]'::jsonb end) as o(e)
  where o.e->>'kind' = 'qty_discount' and coalesce(o.e->>'active','true') <> 'false'
    and (o.e->>'productId') = p.pid
    and coalesce(jsonb_array_length(case when jsonb_typeof(o.e->'productIds')='array' then o.e->'productIds' else '[]'::jsonb end),0) <= 1
    and (o.e->>'buyQty') ~ '^[0-9]+$' and (o.e->>'discountValue') ~ '^[0-9]+(\.[0-9]+)?$'
  group by 1,2,3,4,5,6;

  -- 1) إدخال بصمات المحلات والأسماء (إضافة فقط)
  insert into catalog_seen(barcode, name, store_hash)
  select distinct code, name, md5(replace(store_id,'store_','')) from _p on conflict do nothing;

  insert into catalog_names(barcode, name, search_name, category, unit, pieces_per_carton, cost_price, retail_price, stores_count)
  select g.code, g.name, norm_ar(g.name), (mode() within group (order by g.category)), (mode() within group (order by g.unit)),
         (max(g.ppc) filter (where g.ppc > 1))::int, max(g.cost) filter (where g.cost > 0), max(g.retail) filter (where g.retail > 0), 1
  from _p g group by g.code, g.name
  on conflict (barcode, name) do update set
    category = coalesce(excluded.category, catalog_names.category),
    unit = coalesce(excluded.unit, catalog_names.unit),
    pieces_per_carton = coalesce(excluded.pieces_per_carton, catalog_names.pieces_per_carton),
    cost_price = coalesce(excluded.cost_price, catalog_names.cost_price),
    retail_price = coalesce(excluded.retail_price, catalog_names.retail_price),
    updated_at = now();

  update catalog_names c set stores_count = s.k
  from (select barcode, name, count(*)::int k from catalog_seen group by 1,2) s
  where s.barcode = c.barcode and s.name = c.name and c.stores_count is distinct from s.k;

  -- العروض: تُحدَّث فقط إذا وُجد عرض حالي (حتى لا تضيع عروض المحلات المنقولة)
  update catalog_names c set offers = x.offers
  from (select o2.code, coalesce(jsonb_agg(jsonb_build_object('buyQty', o2.buy_qty::int, 'discountType', coalesce(o2.dtype,'amount'), 'discountValue', o2.dval::numeric, 'discountScope', o2.dscope, 'discountRepeat', o2.drepeat <> 'false', 'stores', o2.c) order by o2.c desc), '[]'::jsonb) offers
        from (select * from _o order by c desc) o2 group by o2.code) x
  where x.code = c.barcode and jsonb_array_length(x.offers) > 0;

  -- 2) إعادة بناء الكتالوج الرئيسي (الاسم الأطول لكل باركود) من الأسماء الدائمة
  delete from public.product_catalog;
  insert into public.product_catalog (barcode, name, search_name, category, unit, pieces_per_carton, cost_price, retail_price, offers, stores_count, updated_at)
  select n.barcode,
         (array_agg(n.name order by length(n.name) desc, n.stores_count desc, n.name))[1],
         norm_ar((array_agg(n.name order by length(n.name) desc, n.stores_count desc, n.name))[1]),
         (mode() within group (order by n.category)),
         (mode() within group (order by n.unit)),
         (max(n.pieces_per_carton) filter (where n.pieces_per_carton > 1))::int,
         case when t.k >= min_stores_for_prices then max(n.cost_price) filter (where n.cost_price > 0) end,
         case when t.k >= min_stores_for_prices then max(n.retail_price) filter (where n.retail_price > 0) end,
         coalesce((array_agg(n.offers order by jsonb_array_length(n.offers) desc))[1], '[]'::jsonb),
         t.k, now()
  from catalog_names n
  join (select barcode, count(distinct store_hash)::int k from catalog_seen group by 1) t on t.barcode = n.barcode
  group by n.barcode, t.k;
  get diagnostics n = row_count;
  return n;
end $$;
