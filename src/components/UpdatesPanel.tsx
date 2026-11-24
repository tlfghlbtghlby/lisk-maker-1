import React, { useEffect, useState } from 'react';
import { CURRENT_APP_VERSION } from '../context/AppContext';
import { useUpdateInfo, markUpdateSeen, getLastUpdateCheck } from '../utils/appUpdates';

/** قسم «التحديثات» في الإعدادات: التحديث اختياري، والتنزيل عبر رابط مباشر يضعه المطوّر */
export default function UpdatesPanel() {
  const { info, loading, isNew, refresh } = useUpdateInfo();
  useEffect(() => { if (info) markUpdateSeen(); }, [info?.latestVersion]);
  const fmt = (d?: string) => { if (!d) return ''; try { return new Date(d).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { return d; } };
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<{ ok: boolean; at: number } | null>(null);
  const check = async () => {
    setBusy(true);
    const t0 = Date.now();
    try { await refresh(); } finally {
      // إبقاء حالة «جارٍ التحقق» ظاهرة لحظة كافية ليراها المستخدم
      const wait = Math.max(0, 600 - (Date.now() - t0));
      setTimeout(() => { setChecked(getLastUpdateCheck()); setBusy(false); }, wait);
    }
  };
  const open = () => {
    if (!info?.url) return;
    const api: any = (window as any).electronAPI || (window as any).electron;
    if (api?.openExternal) { api.openExternal(info.url).catch(() => window.open(info.url, '_blank', 'noopener')); return; }
    window.open(info.url, '_blank', 'noopener');
  };
  return (
    <div data-testid="updates-panel" className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-black text-slate-900 dark:text-white">🔄 التحديثات</div>
        <button type="button" data-testid="update-check" disabled={busy} onClick={check} className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-100 cursor-pointer disabled:opacity-60">{busy ? 'جارٍ التحقق…' : 'تحقق الآن'}</button>
      </div>
      <div className="text-[11px] text-slate-500 dark:text-slate-400">إصدارك الحالي: <b dir="ltr">{CURRENT_APP_VERSION}</b></div>
      {checked && !busy && (
        <div data-testid="update-check-result" className={`text-[11px] font-bold ${checked.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}`}>
          {checked.ok ? `✓ تم الفحص الساعة ${new Date(checked.at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}` : '⚠️ تعذّر الاتصال بالسحابة، حاول لاحقاً. البرنامج يعمل بشكل طبيعي.'}
        </div>
      )}
      {loading && !info ? (
        <div className="text-xs text-slate-500">جارٍ التحقق…</div>
      ) : !info ? (
        <div className="text-xs text-slate-500">تعذّر التحقق (لا اتصال). يعمل البرنامج بشكل طبيعي.</div>
      ) : isNew ? (
        <div data-testid="update-available" className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 space-y-2">
          <div className="text-sm font-black text-emerald-800 dark:text-emerald-300">🎉 يوجد تحديث جديد: <span dir="ltr">{info.latestVersion}</span>{info.releasedAt && <span className="text-[11px] font-bold mr-2">بتاريخ {fmt(info.releasedAt)}</span>}</div>
          {info.message && <p className="text-xs text-slate-700 dark:text-slate-200">{info.message}</p>}
          <p className="text-[11px] text-slate-500">التحديث اختياري، ويمكنك الاستمرار بالإصدار الحالي.</p>
          {info.url ? <button type="button" data-testid="update-download" onClick={open} className="px-4 py-2 rounded-lg text-xs font-black bg-emerald-600 text-white cursor-pointer">تحميل التحديث</button> : <div className="text-[11px] text-amber-700">رابط التحميل لم يُحدَّد بعد.</div>}
        </div>
      ) : (
        <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">✅ أنت على آخر إصدار.</div>
      )}
      {info && info.changelog.length > 0 && (
        <div className="space-y-2" data-testid="update-log">
          <div className="text-xs font-black text-slate-800 dark:text-slate-200">سجل التحديثات</div>
          {info.changelog.map((e) => (
            <div key={e.version} className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2 text-xs"><b dir="ltr">{e.version}</b>{e.title && <span className="font-bold text-slate-700 dark:text-slate-200">{e.title}</span>}<span className="mr-auto text-[11px] text-slate-400">{fmt(e.date)}</span></div>
              {e.notes && e.notes.length > 0 && <ul className="list-disc pr-5 mt-1 text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">{e.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
