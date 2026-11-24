import React, { useEffect, useState } from 'react';
import { shopAdminCall, getAdminKey } from '../utils/shopCloudPush';
import { CURRENT_APP_VERSION } from '../context/AppContext';

/** إصدارات التطبيق (للمدير): الإصدار الأحدث وروابط التحميل؛ البرنامج عند الزبائن يقارن إصداره بهذا الرقم ويُظهر زر التحديث */
export default function AppReleaseBox() {
  const [ver, setVer] = useState('');
  const [ua, setUa] = useState('');
  const [uw, setUw] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const keyOk = () => getAdminKey().length >= 16;

  const load = async () => {
    if (!keyOk()) { setMsg({ ok: false, text: 'أدخل مفتاح الإدارة في صندوق «تعديلات سحابات المحلات» أعلاه أولاً.' }); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await shopAdminCall({ action: 'get_release' });
      const d = r.release || {};
      setVer(d.latest_version || ''); setUa(d.update_url_android || ''); setUw(d.update_url_windows || '');
      const top = Array.isArray(d.changelog) ? d.changelog.find((e: any) => e.version === d.latest_version) : null;
      setNotes((top?.notes || []).join('\n')); setLoaded(true);
    } catch (e: any) { setMsg({ ok: false, text: e?.message || 'تعذر الاتصال' }); }
    setBusy(false);
  };
  useEffect(() => { if (keyOk()) load(); /* eslint-disable-next-line */ }, []);

  const save = async () => {
    if (!keyOk()) { setMsg({ ok: false, text: 'أدخل مفتاح الإدارة أولاً.' }); return; }
    setBusy(true); setMsg(null);
    try {
      await shopAdminCall({ action: 'set_release', version: ver.trim(), urlAndroid: ua.trim(), urlWindows: uw.trim(), notes: notes.split('\n') });
      setMsg({ ok: true, text: `تم: الإصدار الأحدث ${ver.trim()}. سيظهر زر التحديث للزبائن الأقل إصداراً (ولا يُجبَر أحد على التحديث).` });
    } catch (e: any) { setMsg({ ok: false, text: e?.message || 'تعذر الحفظ' }); }
    setBusy(false);
  };

  const inp = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white';
  return (
    <div data-testid="app-release-box" className="mb-3 p-3 rounded-xl border border-emerald-700 bg-emerald-950/30 space-y-2">
      <div className="text-xs font-black text-emerald-300">🚀 إصدارات التطبيق <span className="font-normal text-slate-400">(هذه النسخة: {CURRENT_APP_VERSION})</span></div>
      <div className="grid sm:grid-cols-2 gap-2">
        <label className="text-[11px] text-slate-300">الإصدار الأحدث
          <input dir="ltr" className={inp} value={ver} onChange={(e) => setVer(e.target.value)} placeholder="2.3.0" data-testid="release-version" />
        </label>
        <span />
        <label className="text-[11px] text-slate-300">رابط أندرويد (APK)
          <input dir="ltr" className={inp} value={ua} onChange={(e) => setUa(e.target.value)} placeholder="https://github.com/.../AlMufakir.apk" />
        </label>
        <label className="text-[11px] text-slate-300">رابط ويندوز (Setup)
          <input dir="ltr" className={inp} value={uw} onChange={(e) => setUw(e.target.value)} placeholder="https://github.com/.../AlMufakir-Setup.exe" />
        </label>
      </div>
      <label className="block text-[11px] text-slate-300">ما الجديد (سطر لكل نقطة، يظهر في سجل التحديثات)
        <textarea className={inp + ' h-20'} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="flex gap-2 items-center">
        <button type="button" disabled={busy || !/^\d+\.\d+\.\d+$/.test(ver.trim())} onClick={save} data-testid="release-save" className="px-3 py-1.5 rounded-lg text-xs font-black bg-emerald-600 text-white disabled:opacity-40">نشر الإصدار للزبائن</button>
        <button type="button" disabled={busy} onClick={load} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-700 text-white">{loaded ? 'تحديث' : 'جلب الحالي'}</button>
      </div>
      {msg && <div className={`text-[11px] font-bold rounded-lg px-3 py-2 border break-words ${msg.ok ? 'text-emerald-300 bg-emerald-950/40 border-emerald-700' : 'text-rose-300 bg-rose-950/40 border-rose-700'}`}>{msg.text}</div>}
    </div>
  );
}
