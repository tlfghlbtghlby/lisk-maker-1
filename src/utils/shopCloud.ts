import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * سحابة مستقلة لكل محل (اختيارية ومغلقة افتراضياً).
 * إذا فُعّلت لمحل، تُقرأ وتُكتب وثيقة المحل (stores/store_<uid>) في مشروع Supabase الخاص به،
 * أما الحسابات وكلمات المرور والكتالوج فتبقى في السحابة الرئيسية. منطق المزامنة والدمج لا يتغير إطلاقاً:
 * فقط وجهة القراءة/الكتابة تتغير.
 */
export interface ShopCloudCfg { url: string; anonKey: string; enabled: boolean; }

const KEY = 'mufakir_shop_cloud_v1';
type CfgMap = Record<string, ShopCloudCfg>;

function load(): CfgMap { try { const r = JSON.parse(localStorage.getItem(KEY) || '{}'); return r && typeof r === 'object' ? r : {}; } catch { return {}; } }
let cfgs: CfgMap = load();
const clients = new globalThis.Map<string, SupabaseClient>();
const listeners = new Set<() => void>();

const clean = (c: any): ShopCloudCfg | null => {
  if (!c || typeof c !== 'object') return null;
  const url = String(c.url || '').trim().replace(/\/+$/, '');
  const anonKey = String(c.anonKey || '').trim();
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) || anonKey.length < 20) return null;
  return { url, anonKey, enabled: c.enabled === true };
};

export function getShopCloudCfg(uid: string): ShopCloudCfg | null { return cfgs[uid] || null; }

/** يحفظ إعداد محل في الذاكرة المحلية. يرجع true إذا تغيّر شيء فعلاً */
export function setShopCloudCfg(uid: string, raw: any): boolean {
  const next = clean(raw);
  const prev = cfgs[uid] || null;
  const same = JSON.stringify(prev) === JSON.stringify(next);
  if (same) return false;
  const copy = { ...cfgs };
  if (next) copy[uid] = next; else delete copy[uid];
  cfgs = copy;
  clients.delete(uid);
  try { localStorage.setItem(KEY, JSON.stringify(cfgs)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
  return true;
}

export function shopClientFor(collection: string, docId: string): SupabaseClient | null {
  if (collection !== 'stores' || !docId.startsWith('store_')) return null;
  const uid = docId.slice(6);
  const c = cfgs[uid];
  if (!c || !c.enabled) return null;
  let cl = clients.get(uid);
  if (!cl) {
    cl = createClient(c.url, c.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    clients.set(uid, cl);
  }
  return cl;
}

/** عميل مؤقت لاختبار إعداد قبل حفظه (لوحة الإدارة) */
export function makeShopClient(url: string, anonKey: string): SupabaseClient | null {
  const c = clean({ url, anonKey, enabled: true });
  return c ? createClient(c.url, c.anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }) : null;
}

/** يجلب إعداد المحل من وثيقة حسابه في السحابة الرئيسية (الحقل cloud). يرجع true إذا تغيّر الوضع */
export async function refreshShopCloudCfg(uid: string, fetchUserDoc: () => Promise<any>, timeoutMs = 4000): Promise<boolean> {
  try {
    const doc: any = await Promise.race([fetchUserDoc(), new Promise((r) => setTimeout(() => r(undefined), timeoutMs))]);
    // مهلة أو خطأ شبكة أو حساب غير موجود: نبقى على آخر إعداد معروف ولا نغيّر الوجهة أبداً بالخطأ
    if (!doc || typeof doc !== 'object') return false;
    return setShopCloudCfg(uid, doc.cloud);
  } catch { return false; }
}

/** هل مشروع المحل جاهز فعلاً (جدول documents موجود وقابل للقراءة بالمفتاح العام)؟ يُستعمل قبل التفعيل. */
export async function probeShopCloud(url: string, key: string): Promise<{ ok: boolean; reason?: string }> {
  const cl = makeShopClient(url, key);
  if (!cl) return { ok: false, reason: 'الرابط أو المفتاح غير صحيح' };
  try {
    const r = await cl.from('documents').select('id').limit(1);
    if (r.error) return { ok: false, reason: r.error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'تعذر الاتصال' };
  }
}
