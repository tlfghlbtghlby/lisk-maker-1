import React, { useEffect, useState } from 'react';
import { Sparkles, Save, RefreshCw } from 'lucide-react';
import { supabase, getDocument, setDocument } from '../supabase';

interface Limits { enabled: boolean; perStoreDaily: number; globalLimit: number; globalWindow: 'day' | '5h'; }
const DEFAULTS: Limits = { enabled: true, perStoreDaily: 40, globalLimit: 400, globalWindow: 'day' };

/** تحكم الإدارة بحدود قراءة الصور بالذكاء الاصطناعي */
export const AiScanLimitsCard: React.FC<{ clients: { uid: string; storeName?: string; displayName?: string }[] }> = ({ clients }) => {
  const [lim, setLim] = useState<Limits>(DEFAULTS);
  const [stats, setStats] = useState<{ today: number; window: number; perStore: Record<string, number> } | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStats = async (w: 'day' | '5h') => {
    try {
      const { data } = await supabase.rpc('ai_scan_stats', { p_global_hours: w === '5h' ? 5 : 24 });
      if (data) setStats(data as any);
    } catch { /* ignore */ }
  };

  useEffect(() => {
    (async () => {
      const d: any = await getDocument('config', 'ai_scan_limits');
      const next = d ? { ...DEFAULTS, ...d } : DEFAULTS;
      setLim(next);
      loadStats(next.globalWindow);
    })();
  }, []);

  const save = async () => {
    setBusy(true); setMsg('');
    try {
      const v: Limits = {
        enabled: lim.enabled,
        perStoreDaily: Math.max(0, Math.min(1000, Math.floor(Number(lim.perStoreDaily) || 0))),
        globalLimit: Math.max(0, Math.min(20000, Math.floor(Number(lim.globalLimit) || 0))),
        globalWindow: lim.globalWindow,
      };
      const cur: any = (await getDocument('config', 'ai_scan_limits')) || {};
      await setDocument('config', 'ai_scan_limits', { ...cur, ...v });
      setLim(v);
      setMsg('تم الحفظ. يسري فوراً على كل المتاجر.');
      loadStats(v.globalWindow);
    } catch { setMsg('تعذر الحفظ. تحقق من الاتصال.'); }
    setBusy(false);
  };

  const nameOf = (uid: string) => { const c = clients.find((x) => x.uid === uid); return c?.storeName || c?.displayName || uid; };
  const rows = stats ? Object.entries(stats.perStore).sort((a, b) => b[1] - a[1]).slice(0, 10) : [];
  const inp = 'w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white text-center font-mono focus:outline-none focus:border-violet-500';

  return (
    <div className="rounded-xl border border-violet-500/40 bg-slate-800/50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-extrabold text-sm"><Sparkles className="w-4 h-4 text-violet-400" />حدود قراءة الصور بالذكاء الاصطناعي</div>
        <button onClick={() => loadStats(lim.globalWindow)} className="p-1.5 rounded-lg hover:bg-slate-700" title="تحديث الأرقام"><RefreshCw className="w-4 h-4" /></button>
      </div>

      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
        <input type="checkbox" checked={lim.enabled} onChange={(e) => setLim({ ...lim, enabled: e.target.checked })} className="w-4 h-4 accent-violet-500" />
        الميزة مفعّلة لكل المتاجر (أوقفها لإيقاف الاستخدام فوراً)
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-bold text-slate-300 mb-1">المسموح لكل صاحب متجر باليوم</label>
          <input type="number" min="0" value={lim.perStoreDaily} onChange={(e) => setLim({ ...lim, perStoreDaily: e.target.value as any })} className={inp} />
          <p className="text-[10px] text-slate-400 mt-1">عدد الصور يومياً (يبدأ اليوم 12 منتصف الليل بتوقيت بغداد)</p>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-300 mb-1">الحد الكلي لكل المتاجر</label>
          <input type="number" min="0" value={lim.globalLimit} onChange={(e) => setLim({ ...lim, globalLimit: e.target.value as any })} className={inp} />
        </div>
        <div>
          <label className="block text-[11px] font-bold text-slate-300 mb-1">الحد الكلي يُحسب</label>
          <select value={lim.globalWindow} onChange={(e) => { const w = e.target.value as 'day' | '5h'; setLim({ ...lim, globalWindow: w }); loadStats(w); }} className={inp}>
            <option value="day">في اليوم الواحد</option>
            <option value="5h">كل 5 ساعات (متحرك)</option>
          </select>
        </div>
      </div>

      {stats && (
        <div className="text-[11px] text-slate-300 space-y-1">
          <p>استُخدم اليوم: <b className="text-white">{stats.today}</b> صورة · ضمن فترة الحد الكلي الحالية: <b className="text-white">{stats.window}</b> من {lim.globalLimit}</p>
          {rows.length > 0 && <p>الأكثر استخداماً اليوم: {rows.map(([u, c]) => `${nameOf(u)} (${c})`).join(' · ')}</p>}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-xs font-extrabold disabled:opacity-50"><Save className="w-4 h-4" />حفظ الحدود</button>
        {msg && <span className="text-xs font-bold text-emerald-400">{msg}</span>}
      </div>
    </div>
  );
};
