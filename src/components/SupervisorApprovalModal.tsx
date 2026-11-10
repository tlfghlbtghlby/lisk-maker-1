import React, { useEffect, useState } from 'react';
import { ShieldAlert, Fingerprint, X, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useSupervisorBiometric } from './useSupervisorBiometric';

/** نافذة إذن المشرف: رمز أو بصمة، لمرة واحدة ولهذه القائمة فقط */
export const SupervisorApprovalModal: React.FC = () => {
  const { approvalRequest, grantApproval, cancelApproval, checkSupervisorCode, invoices } = useApp();
  const [code, setCode] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const open = !!approvalRequest;

  const bio = useSupervisorBiometric(open, () => grantApproval());

  useEffect(() => {
    if (open) { setCode(''); setErr(null); }
  }, [open]);

  if (!approvalRequest) return null;
  const inv = invoices.find(i => i.id === approvalRequest.invoiceId);
  const actionLabel = approvalRequest.action === 'edit' ? 'تعديل القائمة' : 'إرجاع القائمة أو موادها';

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const ok = await checkSupervisorCode(code);
    setBusy(false);
    if (ok) { bio.stop(); grantApproval(); }
    else setErr('الرمز غير صحيح.');
  };

  return (
    <div className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-md flex items-center justify-center p-3" dir="rtl" onClick={cancelApproval}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-5 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center"><ShieldAlert className="w-5 h-5" /></div>
            <div>
              <h3 className="text-sm font-black text-slate-900">يتطلب إذن المشرف</h3>
              <p className="text-[11px] text-slate-500">{actionLabel}{inv ? ` — القائمة ${inv.invoiceNumber}` : ''}</p>
            </div>
          </div>
          <button type="button" onClick={cancelApproval} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <p className="text-xs text-slate-600 leading-6">
          اطلب من المشرف أن يضع إصبعه على البصمة أو يُدخل رمزه. يسمح الإذن <b>بهذه المرة وهذه القائمة فقط</b>.
        </p>

        {bio.hasCreds && bio.status !== 'unsupported' && (
          <button type="button" onClick={bio.start} className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold cursor-pointer ${bio.status === 'waiting' ? 'bg-sky-50 border-sky-300 text-sky-800' : 'bg-slate-50 border-slate-300 text-slate-700'}`}>
            <Fingerprint className={`w-5 h-5 ${bio.status === 'waiting' ? 'animate-pulse' : ''}`} />
            {bio.status === 'waiting' ? 'بانتظار البصمة... ضع الإصبع الآن' : 'إعادة محاولة البصمة'}
          </button>
        )}

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">أو أدخل رمز المشرف:</label>
          <input
            type="password"
            value={code}
            onChange={e => { setCode(e.target.value); setErr(null); }}
            autoFocus
            autoComplete="off"
            className="w-full px-3 py-2.5 text-sm font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-900 bg-white"
            placeholder="الرمز..."
          />
        </div>

        {err && <div className="text-xs font-bold rounded-lg px-3 py-2 border text-rose-800 bg-rose-50 border-rose-300">{err}</div>}

        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={cancelApproval} className="px-4 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-700 cursor-pointer">إلغاء</button>
          <button type="submit" disabled={busy || !code.trim()} className="px-5 py-2 text-xs font-black rounded-xl bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
            <Check className="w-4 h-4" /> تأكيد الإذن
          </button>
        </div>
      </form>
    </div>
  );
};
