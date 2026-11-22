import { supabase } from '../supabase';

/** رفع مواد المحل إلى الكتالوج المشترك فور إضافتها/تعديلها (كل المواد: باركود إن وُجد + اسم + تصنيف + وحدة + أسعار). لا فواتير ولا بيانات زبائن. */
const SENT_KEY = 'mufakir_catalog_sent_v1';

function loadSent(uid: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(`${SENT_KEY}_${uid}`) || '[]')); } catch { return new Set(); }
}
function saveSent(uid: string, s: Set<string>) {
  try { localStorage.setItem(`${SENT_KEY}_${uid}`, JSON.stringify(Array.from(s).slice(-60000))); } catch { /* ignore */ }
}
const keyOf = (p: any) => `${String(p.code ?? '').trim()}|${String(p.name).trim()}`;

export interface ContributeResult { sent: number; pending: number; failed: boolean; }

/** يرسل المواد الجديدة فقط (التي لم تُرسل بهذا الاسم والباركود من قبل). يُعاد المحاولة لاحقاً عند الفشل. */
export async function contributeProducts(uid: string, products: any[], maxBatches = 20): Promise<ContributeResult> {
  const sent = loadSent(uid);
  const todo = (products || []).filter((p) => p && String(p.code ?? '').trim().length <= 64 && String(p.name || '').trim().length >= 2 && !sent.has(keyOf(p)));
  let ok = 0;
  for (let i = 0, b = 0; i < todo.length && b < maxBatches; i += 300, b++) {
    const chunk = todo.slice(i, i + 300);
    const items = chunk.map((p) => ({ code: String(p.code ?? '').trim(), name: String(p.name).trim(), category: p.category || null, unit: p.unit || null, piecesPerCarton: p.piecesPerCarton ?? null, costPrice: p.costPrice ?? null, retailPrice: p.retailPrice ?? null }));
    try {
      const { error } = await (supabase as any).rpc('catalog_contribute', { p_store: uid, p_items: items });
      if (error) { saveSent(uid, sent); return { sent: ok, pending: todo.length - ok, failed: true }; }
      chunk.forEach((p) => sent.add(keyOf(p)));
      ok += chunk.length;
    } catch { saveSent(uid, sent); return { sent: ok, pending: todo.length - ok, failed: true }; }
  }
  saveSent(uid, sent);
  return { sent: ok, pending: Math.max(0, todo.length - ok), failed: false };
}
