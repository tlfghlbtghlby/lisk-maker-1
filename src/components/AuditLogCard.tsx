import React, { useEffect, useMemo, useState } from 'react';
import { clearAudit, readAudit, type AuditEntry } from '../utils/auditLog';

/** سجل التدقيق: من فعل ماذا ومتى (على هذا الجهاز). */
export const AuditLogCard: React.FC = () => {
  const [list, setList] = useState<AuditEntry[]>(() => readAudit());
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = () => setList(readAudit());
    window.addEventListener('mufakir-audit-change', h);
    return () => window.removeEventListener('mufakir-audit-change', h);
  }, []);
  const shown = useMemo(() => {
    const t = q.trim();
    return list.filter((e) => !t || e.action.includes(t) || e.detail.includes(t) || e.who.includes(t)).slice(0, 200);
  }, [list, q]);
  return (
    <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2" data-testid="audit-log">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between text-right cursor-pointer">
        <div>
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">🛡️ سجل التدقيق ({list.length})</div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">يسجّل: حذف وإرجاع وتعديل الفواتير، حذف المواد والزبائن، تغيير الأسعار، إغلاق الشفت، الأرشفة والاستعادة. محفوظ على هذا الجهاز.</p>
        </div>
        <span className="text-slate-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <>
          <div className="flex items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في السجل" className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#060b13] text-slate-900 dark:text-white" />
            <button type="button" onClick={() => { if (window.confirm('مسح كل سجل التدقيق من هذا الجهاز؟')) clearAudit(); }} className="px-3 py-1.5 text-[11px] font-bold rounded-lg text-rose-700 border border-rose-300 cursor-pointer">مسح</button>
          </div>
          <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#060b13]">
            {shown.length === 0 && <div className="text-center text-xs text-slate-500 py-6">لا توجد عمليات مسجّلة.</div>}
            {shown.map((e, i) => (
              <div key={i} className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black text-slate-900 dark:text-white">{e.action}</span>
                  <span className="text-[10px] font-mono text-slate-500">{new Date(e.t).toLocaleString('ar-IQ')}</span>
                </div>
                <div className="text-slate-600 dark:text-slate-300">{e.detail}</div>
                <div className="text-[10px] text-slate-400">بواسطة: {e.who}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogCard;
