import React, { useState } from 'react';
import { shopAdminCall, getAdminKey, setAdminKey } from '../utils/shopCloudPush';

/** زر «رفع تعديلات السحابات» (للمدير فقط): يطبّق تعديلات هيكل القاعدة على سحابات كل المحلات التي لها رمز وصول */
export default function ShopCloudPush() {
  const [key, setKey] = useState(getAdminKey());
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState<{ ok: boolean; text: string; lines?: string[] } | null>(null);

  const run = async (action: 'status' | 'apply') => {
    setBusy(true); setOut(null); setAdminKey(key.trim());
    try {
      const r = await shopAdminCall({ action });
      if (action === 'status') {
        const lines = (r.shops || []).map((s: any) => `${s.store}: ${s.error ? 'تعذر الفحص — ' + s.error : s.pending ? `ينقصه ${s.pending} تعديل (إصداره ${s.version})` : 'محدّث'}`);
        setOut({ ok: true, text: r.shops?.length ? `آخر إصدار ${r.latest}` : (r.message || 'لا محلات'), lines });
      } else {
        const lines = (r.results || []).map((s: any) => `${s.store}: ${s.ok ? (s.applied.length ? `رُفع (${s.from} ← ${s.to})` : 'لا جديد') : 'فشل — ' + s.error}`);
        setOut({ ok: !r.failed, text: r.message, lines });
      }
    } catch (e: any) { setOut({ ok: false, text: e?.message || 'تعذر الاتصال' }); }
    setBusy(false);
  };

  return (
    <div data-testid="shop-cloud-push" className="mb-3 p-3 rounded-xl border border-sky-700 bg-sky-950/30 space-y-2">
      <div className="text-xs font-black text-sky-300">☁️ تعديلات سحابات المحلات</div>
      <div className="flex flex-wrap gap-2 items-center">
        <input type="password" dir="ltr" value={key} onChange={(e) => setKey(e.target.value)} placeholder="مفتاح الإدارة (SHOP_ADMIN_KEY)" data-testid="push-key" className="flex-1 min-w-[180px] px-3 py-1.5 text-xs bg-slate-800 border border-slate-700 rounded-lg text-white font-mono" />
        <button type="button" disabled={busy || key.trim().length < 16} onClick={() => run('status')} data-testid="push-status" className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 text-white cursor-pointer disabled:opacity-50">فحص</button>
        <button type="button" disabled={busy || key.trim().length < 16} onClick={() => run('apply')} data-testid="push-apply" className="px-3 py-1.5 rounded-lg text-xs font-black bg-sky-600 text-white cursor-pointer disabled:opacity-50">{busy ? '...' : 'رفع تعديلات السحابات'}</button>
      </div>
      {out && (
        <div data-testid="push-result" className={`text-[11px] font-bold rounded-lg px-3 py-2 border break-words ${out.ok ? 'text-emerald-300 bg-emerald-950/40 border-emerald-800' : 'text-rose-300 bg-rose-950/40 border-rose-800'}`}>
          {out.text}
          {out.lines?.map((l, i) => <div key={i} className="font-normal">• {l}</div>)}
        </div>
      )}
    </div>
  );
}
