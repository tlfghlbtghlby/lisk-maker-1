import React, { useMemo } from 'react';
import { barcodeSvg } from '../utils/barcodeSvg';

interface Props {
  storeName: string;
  subtitle?: string;
  phone?: string;
  date: string;      // 2026/11/26
  time: string;      // 13:51
  invoiceNumber: string;
  accountant?: string;
  customerName?: string;
  repName?: string;
  seal?: string;
  pageLabel?: string;
  compact?: boolean; // ورق حراري 58mm
}

/**
 * ترويسة «ورقة الكاشير»: شريط أسود باسم المحل والهاتف، صفوف معلومات بإطار، ثم باركود رقم القائمة.
 * تُستعمل فقط عند اختيار قالب «ورقة الكاشير» ولا تمس القوالب الأخرى.
 */
export const CashierInvoiceHeader: React.FC<Props> = ({
  storeName, subtitle, phone, date, time, invoiceNumber, accountant, customerName, repName, seal, pageLabel, compact,
}) => {
  const bar = useMemo(() => {
    try {
      const code = String(invoiceNumber || '').replace(/[^\x20-\x7e]/g, '');
      if (!code) return null;
      return barcodeSvg(code, { moduleMm: compact ? 0.27 : 0.33, heightMm: compact ? 9 : 11 }).svg;
    } catch {
      return null;
    }
  }, [invoiceNumber, compact]);

  const rows: [string, React.ReactNode, boolean?][] = [
    ['تاريخ الفاتورة', <span dir="ltr" className="font-mono">{date}</span>],
    ['وقت الفاتورة', <span dir="ltr" className="font-mono">{time}</span>],
    ['رقم الفاتورة', <span className="font-mono font-black">{invoiceNumber}</span>],
  ];
  if (customerName && customerName.trim()) rows.push(['السيد', customerName]);
  if (repName) rows.push(['المندوب', repName]);
  if (accountant) rows.push(['المحاسب', accountant]);

  return (
    <div className="cashier-head" data-testid="cashier-head">
      <div className="cashier-band">
        <div className={compact ? 'text-[13px] leading-tight' : 'text-[17px] leading-tight'}>{storeName || 'المحل'}</div>
        {subtitle ? <div className="cashier-sub">{subtitle}</div> : null}
        {phone ? <div dir="ltr" className={`font-mono ${compact ? 'text-[13px]' : 'text-[18px]'} tracking-wide`}>{phone}</div> : null}
      </div>
      <div className="cashier-rows">
        {rows.map(([k, v], i) => (
          <div key={i} className="cashier-row">
            <span className="cashier-k">{k}</span>
            <span className="cashier-v">{v}</span>
          </div>
        ))}
        {seal ? (
          <div className="cashier-row">
            <span className="cashier-k">بصمة التحقق</span>
            <span className="cashier-v font-mono">{seal.replace(/-/g, '').slice(0, 6)}</span>
          </div>
        ) : null}
        {pageLabel ? (
          <div className="cashier-row">
            <span className="cashier-k">الصفحة</span>
            <span className="cashier-v font-mono">{pageLabel}</span>
          </div>
        ) : null}
      </div>
      {bar ? (
        <div className="cashier-bar" dangerouslySetInnerHTML={{ __html: bar }} />
      ) : null}
    </div>
  );
};

export default CashierInvoiceHeader;
