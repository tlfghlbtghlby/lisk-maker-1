import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * مزامنة بالتغييرات فقط (Delta) لسحابة المحل المستقلة — مغلقة افتراضياً (cfg.delta).
 * بدل وثيقة واحدة كبيرة: كل فاتورة/مادة/زبون/وردية/دفعة صف مستقل في documents (المجموعات r_*),
 * والإعدادات والشواهد والسلة في صفوف r_meta الصغيرة. منطق الدمج في AppContext (computeMerge) لا يتغير:
 *  - القراءة تُرجع «وثيقة جزئية» تحوي فقط ما تغيّر منذ آخر مؤشر seq (والدمج يتعامل معها كأي وثيقة سحابية).
 *  - الكتابة تدفع الصفوف التي تغيّرت فقط.
 * يحتاج تعديل قاعدة المحل رقم 5 (supabase/shop-cloud/005_delta_records.sql).
 */

export const ITEM_COLS = ['products', 'customers', 'invoices', 'shifts', 'payments'] as const;
type ItemCol = typeof ITEM_COLS[number];
const META_KEYS = ['settings', 'trash', 'tombstones', 'features', 'offers'] as const;
const tbl = (c: string) => `r_${c}`;
const TBL_ITEMS = ITEM_COLS.map(tbl);
const TBL_META = 'r_meta';
const PAGE = 500;
const CHUNK = 100;
const OVERLAP = 50; // إعادة قراءة آخر عدد من التغييرات احتياطاً (آمن لأن الدمج متكرر الأثر)
const TOMB_SECTION: Partial<Record<ItemCol, string>> = { products: 'products', customers: 'customers', invoices: 'invoices', shifts: 'shifts' };

type Known = { items: Record<string, Record<string, string>>; meta: Record<string, string>; deleted: Record<string, true> };

const kKnown = (docId: string) => `delta_known_${docId}`;
const kCursor = (docId: string) => `delta_cursor_${docId}`;

function hash(s: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36) + ':' + s.length;
}

const memKnown = new Map<string, Known>();
const pendingCursor = new Map<string, number>();

function loadKnown(docId: string): Known {
  let k = memKnown.get(docId);
  if (k) return k;
  try { k = JSON.parse(localStorage.getItem(kKnown(docId)) || 'null'); } catch { k = undefined; }
  if (!k || typeof k !== 'object' || !k.items) k = { items: {}, meta: {}, deleted: {} };
  k.deleted = k.deleted || {};
  memKnown.set(docId, k);
  return k;
}
function saveKnown(docId: string) {
  const k = memKnown.get(docId);
  if (!k) return;
  try { localStorage.setItem(kKnown(docId), JSON.stringify(k)); } catch { /* ignore */ }
}
function getCursor(docId: string): number {
  try { const v = Number(localStorage.getItem(kCursor(docId))); return Number.isFinite(v) && v > 0 ? v : 0; } catch { return 0; }
}
function setCursor(docId: string, v: number) { try { localStorage.setItem(kCursor(docId), String(v)); } catch { /* ignore */ } }

/** يثبّت المؤشر المؤجَّل من القراءة السابقة (بعد أن طُبّقت نتيجتها محلياً) */
function commitCursor(docId: string) {
  const p = pendingCursor.get(docId);
  if (p !== undefined) { setCursor(docId, Math.max(0, p - OVERLAP)); pendingCursor.delete(docId); }
}

/** يقرأ ما تغيّر منذ آخر مؤشر. يرجع وثيقة جزئية بشكل وثيقة المحل، أو null إن لم يوجد شيء/تعذّر. */
export async function deltaPull(cl: SupabaseClient, docId: string): Promise<{ doc: any | null; changed: boolean; empty: boolean }> {
  commitCursor(docId);
  const known = loadKnown(docId);
  let cursor = getCursor(docId);
  const out: Record<string, any[]> = {};
  let maxSeq = cursor;
  let changed = false;
  for (;;) {
    const { data, error } = await cl.from('documents').select('collection,id,data,seq')
      .in('collection', TBL_ITEMS).gt('seq', cursor).order('seq', { ascending: true }).limit(PAGE);
    if (error) throw error;
    const rows: any[] = data || [];
    for (const r of rows) {
      const col = String(r.collection).slice(2) as ItemCol;
      maxSeq = Math.max(maxSeq, Number(r.seq) || 0);
      const d = r.data;
      if (!d || typeof d !== 'object') continue;
      if (d._deleted) { known.deleted[`${col}:${r.id}`] = true; if (known.items[col]) delete known.items[col][String(r.id)]; continue; }
      const h = hash(JSON.stringify(d));
      const kc = (known.items[col] = known.items[col] || {});
      if (kc[String(r.id)] === h) continue; // نفس ما نعرفه (غالباً صدى لرفعنا نحن)
      kc[String(r.id)] = h;
      (out[col] = out[col] || []).push(d);
      changed = true;
    }
    if (rows.length < PAGE) break;
    cursor = Number(rows[rows.length - 1].seq);
  }
  // صفوف r_meta تُقرأ كاملة دائماً (صغيرة) حتى لا تُكتب فوقها قيم أقدم
  const mres = await cl.from('documents').select('id,data').eq('collection', TBL_META);
  if (mres.error) throw mres.error;
  const doc: any = { ...out, __delta: true };
  let hasMeta = false;
  for (const r of (mres.data as any[]) || []) {
    if (!(META_KEYS as readonly string[]).includes(r.id)) continue;
    hasMeta = true;
    doc[r.id] = r.data?.v ?? r.data;
    const h = hash(JSON.stringify(doc[r.id]));
    if (known.meta[r.id] !== h) { known.meta[r.id] = h; changed = true; }
  }
  pendingCursor.set(docId, maxSeq);
  saveKnown(docId);
  const empty = !hasMeta && maxSeq === 0 && !changed;
  return { doc: empty ? null : doc, changed, empty };
}

/** يدفع الصفوف التي تغيّرت فقط من وثيقة المحل الكاملة (payload). يرمي عند الفشل. */
export async function deltaPush(cl: SupabaseClient, docId: string, payload: any): Promise<number> {
  const known = loadKnown(docId);
  const rows: { collection: string; id: string; data: any; col: string; h: string; kind: 'item' | 'meta' | 'del' }[] = [];
  const tombs: Record<string, Record<string, string>> = payload?.tombstones || {};

  for (const col of ITEM_COLS) {
    const arr: any[] = Array.isArray(payload?.[col]) ? payload[col] : [];
    const kc = (known.items[col] = known.items[col] || {});
    for (const it of arr) {
      if (!it || it.id === undefined || it.id === null) continue;
      const id = String(it.id);
      const h = hash(JSON.stringify(it));
      if (kc[id] === h) continue;
      rows.push({ collection: tbl(col), id, data: it, col, h, kind: 'item' });
    }
    // حذف صريح فقط (له شاهد حذف): يُكتب كعلامة «محذوف» حتى لا تنزّله الأجهزة الجديدة
    const sec = TOMB_SECTION[col];
    const tm = sec ? tombs[sec] : null;
    if (tm) {
      const present = new Set(arr.map((x) => String(x?.id)));
      for (const [id, at] of Object.entries(tm)) {
        if (present.has(id) || known.deleted[`${col}:${id}`]) continue;
        if (!kc[id]) continue; // لا نعرفه في السحابة أصلاً
        rows.push({ collection: tbl(col), id, data: { id, _deleted: true, updatedAt: at || new Date().toISOString() }, col, h: '', kind: 'del' });
      }
    }
  }
  for (const k of META_KEYS) {
    if (payload?.[k] === undefined) continue;
    const h = hash(JSON.stringify(payload[k]));
    if (known.meta[k] === h) continue;
    rows.push({ collection: TBL_META, id: k, data: { v: payload[k] }, col: k, h, kind: 'meta' });
  }

  let pushed = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await cl.from('documents').upsert(
      chunk.map((r) => ({ collection: r.collection, id: r.id, data: r.data })),
      { onConflict: 'collection,id' }
    );
    if (error) { saveKnown(docId); throw error; }
    for (const r of chunk) {
      if (r.kind === 'item') known.items[r.col][r.id] = r.h;
      else if (r.kind === 'meta') known.meta[r.col] = r.h;
      else { known.deleted[`${r.col}:${r.id}`] = true; delete known.items[r.col][r.id]; }
    }
    pushed += chunk.length;
  }
  saveKnown(docId);
  return pushed;
}

export function deltaReset(docId: string) {
  memKnown.delete(docId); pendingCursor.delete(docId);
  try { localStorage.removeItem(kKnown(docId)); localStorage.removeItem(kCursor(docId)); } catch { /* ignore */ }
}
