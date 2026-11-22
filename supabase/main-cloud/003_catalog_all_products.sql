-- 003: رفع كل مواد المحلات إلى الكتالوج (بما فيها بلا باركود أو بباركود داخلي/نصي) لتظهر في اقتراحات الأسماء.
-- الحماية: بحث الباركود (catalog_lookup) يبقى للباركودات التجارية الصحيحة فقط (6–15 رقماً) حتى لا يُملأ اسم خاطئ من رمز داخلي لمحل آخر.
create or replace function public.catalog_contribute(p_store text, p_items jsonb)
returns int language plpgsql security definer set search_path to 'public' as $$
declare n int := 0; r jsonb; v_bar text; v_name text; v_cost numeric; v_ret numeric; v_ppc int;
        v_h text := md5(replace(coalesce(p_store,''), 'store_', ''));
begin
  if coalesce(length(p_store),0) < 3 or jsonb_typeof(p_items) <> 'array' then return 0; end if;
  for r in select * from jsonb_array_elements(p_items) limit 1000 loop
    v_bar := coalesce(trim(r->>'code'), ''); v_name := trim(r->>'name');
    -- كل المواد تُرفع: أي باركود (حتى نصي/قصير) أو بلا باركود (''). الحد: 64 حرفاً للباركود و2–120 للاسم.
    continue when length(v_bar) > 64 or coalesce(length(v_name),0) not between 2 and 120;
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

create or replace function public.catalog_lookup(p_barcode text)
returns table(barcode text, name text, category text, unit text, pieces_per_carton integer, cost_price numeric, retail_price numeric, offers jsonb, stores_count integer)
language sql stable security definer set search_path to 'public' as $$
  select c.barcode, c.name, c.category, c.unit, c.pieces_per_carton, c.cost_price, c.retail_price, c.offers, c.stores_count
  from public.product_catalog c
  where c.barcode = trim(p_barcode) and c.barcode ~ '^[0-9]{6,15}$' limit 1;
$$;
