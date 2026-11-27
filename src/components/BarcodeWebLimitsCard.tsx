import React, { useEffect, useState } from 'react';
import { Search, Save } from 'lucide-react';
import { getDocument, setDocument } from '../supabase';

interface Limits { enabled: boolean; perStoreDaily: number; globalLimit: number; }
const DEFAULTS: Limits = { enabled: true, perStoreDaily: 150, globalLimit: 1500 };

/** تحكم الإدارة بحدود بحث جوجل عن الباركود (الطريقة الثالثة للتعرف على المواد) */
export const BarcodeWebLimitsCard: React.FC = () => {
  const [lim, setLim] = useState<Limits>(DEFAULTS);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const d: any = await getDocument('config', 'barcode_web_limits');
      if (d) setLim({ ...DEFAULTS, ...d });
    })();
  }, []);

  const save = async () => {
    setBusy(true); setMsg('');
    try {
      const v: Limits = {
        enabled: lim.enabled,
        perStoreDaily: Math.max(0, Math.min(2000, Math.floor(Number(lim.perStoreDaily) || 0))),
        globalLimit: Math.max(0, Math.min(50000, Math.floor(Number(lim.globalLimit) || 0))),
      };
      const cur: any = (await getDocument('config', 'barcode_web_limits')) || {};
      await setDocument('config', 'barcode_web_limits', { ...cur, ...v });
      setLim(v);
      setMsg('تم الحفظ. يسري فوراً على كل المتاجر.');
    } catch { setMsg('تعذر الحفظ. تحقق من الاتصال.'); }
    setBusy(false);
  };

  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white text-center font-mono focus:outline-none focus:border-sky-500';
  return (
    <div className="rounded-xl border border-sky-500/40 bg-slate-800/50 p-4 space-y-3" data-testid="barcode-web-limits">
      <div className="flex items-center gap-2 font-extrabold text-sm"><Search className="w-4 h-4 text-sky-400" />حدود بحث جوجل عن الباركود</div>
      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
        <input type="checkbox" checked={lim.enabled} onChange={(e) => setLim({ ...lim, enabled: e.target.checked })} className="w-4 h-4 accent-sky-500" />
        الميزة مفعّلة لكل المتاجر (أوقفها لإيقاف الاستهلاك فوراً)
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-300 mb-1">المسموح لكل صاحب متجر باليوم</label>
          <input type="number" min="0" value={lim.perStoreDaily} onChange={(e) => setLim({ ...lim, perStoreDaily: e.target.value as any })} className={inp} />
          <p className="text-[10px] text-slate-400 mt-1">عدد الباركودات التي تُبحث في جوجل (لا يُحسب ما وُجد في الكتالوج أو القواعد العالمية)</p>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-300 mb-1">الحد الكلي لكل المتاجر باليوم</label>
          <input type="number" min="0" value={lim.globalLimit} onChange={(e) => setLim({ ...lim, globalLimit: e.target.value as any })} className={inp} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-extrabold disabled:opacity-50"><Save className="w-4 h-4" />حفظ الحدود</button>
        {msg && <span className="text-xs font-bold text-emerald-400">{msg}</span>}
      </div>
    </div>
  );
};
