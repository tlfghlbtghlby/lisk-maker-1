import { supabaseUrl, supabaseAnonKey } from '../supabase';

const KEY_STORE = 'shopAdminKey';
export const getAdminKey = (): string => { try { return sessionStorage.getItem(KEY_STORE) || ''; } catch { return ''; } };
export const setAdminKey = (k: string) => { try { k ? sessionStorage.setItem(KEY_STORE, k) : sessionStorage.removeItem(KEY_STORE); } catch { /* */ } };

/** استدعاء دالة shop-cloud-admin (للمدير فقط، بمفتاح SHOP_ADMIN_KEY السري) */
export async function shopAdminCall(body: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${supabaseUrl}/functions/v1/shop-cloud-admin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: supabaseAnonKey, Authorization: `Bearer ${supabaseAnonKey}` },
    body: JSON.stringify({ ...body, key: getAdminKey() }),
  });
  let j: any = null;
  try { j = await res.json(); } catch { /* */ }
  if (res.status === 401) throw new Error('مفتاح الإدارة غير صحيح.');
  if (res.status === 503) throw new Error('لم يُضبط SHOP_ADMIN_KEY على الخادم بعد.');
  if (!res.ok) throw new Error(j?.message || j?.error || `خطأ ${res.status}`);
  return j;
}
