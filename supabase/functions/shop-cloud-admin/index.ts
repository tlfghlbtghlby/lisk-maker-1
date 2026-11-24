// دالة Supabase Edge: إدارة سحابات المحلات المستقلة (للمدير فقط).
// - save_token : يحفظ رمز وصول (Access Token) لمشروع Supabase الخاص بمحل (بعد التحقق منه).
// - status     : يعرض إصدار هيكل قاعدة كل محل مقابل آخر إصدار.
// - apply      : يرفع التعديلات المعلّقة (shop_schema_migrations) على كل المحلات (أو محل واحد). إن لم يوجد شيء يقول ذلك.
// - delete_token: يحذف الرمز المحفوظ.
// الحماية: كل طلب يلزمه المفتاح السري SHOP_ADMIN_KEY (سرّ في Supabase، ليس في الكود).
// الرموز تُخزَّن في جدول shop_cloud_secrets المقفل (RLS بلا سياسات: لا يصله إلا هذه الدالة).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

function safeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return d === 0;
}

const refOf = (url: string): string | null => {
  const m = /^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i.exec(String(url || '').trim());
  return m ? m[1].toLowerCase() : null;
};

async function mgmt(ref: string, token: string, query: string): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(50000),
  });
  const text = await res.text();
  let data: any = text;
  try { data = JSON.parse(text); } catch { /* نص */ }
  return { ok: res.ok, status: res.status, data };
}

const errText = (r: { status: number; data: any }) => {
  const m = typeof r.data === 'string' ? r.data : r.data?.message || JSON.stringify(r.data);
  return `(${r.status}) ${String(m).slice(0, 300)}`;
};

async function currentVersion(ref: string, token: string): Promise<{ version: number; error?: string }> {
  const r = await mgmt(ref, token, 'select version from public.schema_info where id = 1');
  if (r.ok && Array.isArray(r.data) && r.data[0]) return { version: Number(r.data[0].version) || 0 };
  if (r.ok) return { version: 0 };                      // الجدول فارغ
  const msg = errText(r);
  if (/does not exist|schema_info/i.test(msg)) return { version: 0 }; // المشروع لم يُجهَّز بعد
  return { version: -1, error: msg };
}

async function loadMigrations(): Promise<{ version: number; name: string | null; sql: string }[]> {
  const { data } = await sb.from('shop_schema_migrations').select('version,name,sql').order('version', { ascending: true });
  return (data as any[]) || [];
}

async function shopInfo(uid: string) {
  const { data } = await sb.from('documents').select('data').eq('collection', 'users').eq('id', uid).maybeSingle();
  const d: any = data?.data;
  return { name: d?.storeName || d?.displayName || uid, cloud: d?.cloud || null };
}

async function applyOne(row: { uid: string; project_ref: string; access_token: string }, migs: { version: number; name: string | null; sql: string }[]) {
  const info = await shopInfo(row.uid);
  const cur = await currentVersion(row.project_ref, row.access_token);
  if (cur.version < 0) return { uid: row.uid, store: info.name, ok: false, error: cur.error, from: null, to: null, applied: [] as number[] };
  const pending = migrations_after(migs, cur.version);
  const applied: number[] = [];
  for (const m of pending) {
    const sql = `${m.sql}\n;\ninsert into public.schema_info (id, version) values (1, ${Number(m.version)}) on conflict (id) do update set version = excluded.version;`;
    const r = await mgmt(row.project_ref, row.access_token, sql);
    if (!r.ok) return { uid: row.uid, store: info.name, ok: false, error: `فشل التعديل رقم ${m.version}: ${errText(r)}`, from: cur.version, to: applied.length ? applied[applied.length - 1] : cur.version, applied };
    applied.push(m.version);
  }
  return { uid: row.uid, store: info.name, ok: true, from: cur.version, to: applied.length ? applied[applied.length - 1] : cur.version, applied };
}
const migrations_after = (migs: { version: number; name: string | null; sql: string }[], v: number) => migs.filter((m) => m.version > v);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad_json' }, 400); }

  const adminKey = Deno.env.get('SHOP_ADMIN_KEY') || '';
  if (!adminKey || adminKey.length < 16) return json({ error: 'not_configured' }, 503);
  if (typeof body?.key !== 'string' || !safeEqual(body.key, adminKey)) {
    await new Promise((r) => setTimeout(r, 800)); // إبطاء التخمين
    return json({ error: 'unauthorized' }, 401);
  }

  const action = String(body?.action || '');
  try {
    if (action === 'save_token') {
      const uid = String(body?.uid || '').slice(0, 120);
      const token = String(body?.accessToken || '').trim();
      if (!uid || token.length < 20) return json({ error: 'bad_input' }, 400);
      const info = await shopInfo(uid);
      const ref = refOf(info.cloud?.url);
      if (!ref) return json({ error: 'no_cloud_url', message: 'احفظ رابط سحابة المحل أولاً ثم أعد المحاولة.' }, 400);
      const t = await mgmt(ref, token, 'select 1 as ok');
      if (!t.ok) return json({ error: 'token_rejected', message: `الرمز لا يعمل على هذا المشروع. ${errText(t)}` }, 400);
      const { error } = await sb.from('shop_cloud_secrets').upsert({ uid, project_ref: ref, access_token: token, updated_at: new Date().toISOString() });
      if (error) return json({ error: 'store_failed' }, 500);
      return json({ ok: true, ref });
    }

    if (action === 'delete_token') {
      const uid = String(body?.uid || '').slice(0, 120);
      await sb.from('shop_cloud_secrets').delete().eq('uid', uid);
      return json({ ok: true });
    }

    if (action === 'status' || action === 'apply') {
      const only = body?.uid ? String(body.uid).slice(0, 120) : null;
      let q = sb.from('shop_cloud_secrets').select('uid,project_ref,access_token');
      if (only) q = q.eq('uid', only);
      const { data: rows } = await q;
      const migs = await loadMigrations();
      const latest = migs.length ? migs[migs.length - 1].version : 0;
      const list = (rows as any[]) || [];
      if (!list.length) return json({ ok: true, latest, shops: [], results: [], changed: 0, failed: 0, message: 'لا يوجد محل له رمز وصول محفوظ.' });

      if (action === 'status') {
        const shops = [];
        for (const row of list) {
          const info = await shopInfo(row.uid);
          const cur = await currentVersion(row.project_ref, row.access_token);
          shops.push({ uid: row.uid, store: info.name, version: cur.version < 0 ? null : cur.version, pending: cur.version < 0 ? null : migrations_after(migs, cur.version).length, error: cur.error });
        }
        return json({ ok: true, latest, shops });
      }

      const results = [];
      for (const row of list) results.push(await applyOne(row, migs));
      const changed = results.filter((r) => r.applied.length > 0).length;
      const failed = results.filter((r) => !r.ok).length;
      return json({
        ok: true, latest, results, changed, failed,
        message: failed ? `فشل ${failed} محل، راجع التفاصيل.` : changed ? `رُفعت التعديلات على ${changed} محل.` : 'ليس هناك تعديلات نحتاج إلى رفعها.',
      });
    }
    // ---- إصدارات التطبيق (يظهر للزبائن زر التحديث إذا كان إصدارهم أقل) ----
    if (action === 'get_release') {
      const { data } = await sb.from('system_settings').select('latest_version,update_url_android,update_url_windows,update_message,min_required_version,changelog').eq('id', 'global_config').maybeSingle();
      return json({ ok: true, release: data || null });
    }
    if (action === 'set_release') {
      const ver = String(body?.version || '').trim();
      if (!/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ver)) return json({ error: 'bad_version', message: 'الإصدار بصيغة 2.3.0' }, 400);
      const okUrl = (u: unknown) => { const t = String(u || '').trim(); return !t ? null : /^https:\/\/[^\s]{4,500}$/i.test(t) ? t : undefined; };
      const ua = okUrl(body?.urlAndroid), uw = okUrl(body?.urlWindows);
      if (ua === undefined || uw === undefined) return json({ error: 'bad_url', message: 'الرابط يجب أن يبدأ بـ https://' }, 400);
      const notes: string[] = Array.isArray(body?.notes) ? body.notes.map((x: unknown) => String(x).trim().slice(0, 200)).filter(Boolean).slice(0, 12) : [];
      const { data: cur } = await sb.from('system_settings').select('changelog').eq('id', 'global_config').maybeSingle();
      let cl: any[] = Array.isArray((cur as any)?.changelog) ? (cur as any).changelog.filter((e: any) => e && e.version) : [];
      const today = new Date().toISOString().slice(0, 10);
      cl = cl.filter((e) => e.version !== ver).map((e) => (e.title === 'الإصدار الحالي' ? { ...e, title: 'الإصدار السابق' } : e));
      cl.unshift({ date: today, version: ver, title: 'الإصدار الحالي', notes });
      const patch: Record<string, unknown> = { latest_version: ver, update_url_android: ua, update_url_windows: uw, changelog: cl.slice(0, 30), latest_released_at: new Date().toISOString() };
      const { error } = await sb.from('system_settings').update(patch).eq('id', 'global_config');
      if (error) return json({ error: 'save_failed', message: String(error.message).slice(0, 200) }, 500);
      return json({ ok: true, version: ver });
    }
    return json({ error: 'unknown_action' }, 400);
  } catch (e) {
    console.error('shop_cloud_admin_failed', String(e).slice(0, 300));
    return json({ error: 'server_error' }, 500);
  }
});
