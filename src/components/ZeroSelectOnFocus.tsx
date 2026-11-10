import { useEffect } from 'react';

/**
 * عند الدخول إلى أي حقل رقمي قيمته 0 يُحدَّد المحتوى كاملًا،
 * فيستبدل الرقم المكتوب الصفر مباشرةً دون الحاجة لحذفه.
 */
export const ZeroSelectOnFocus = () => {
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      const el = e.target as HTMLInputElement | null;
      if (!el || el.tagName !== 'INPUT') return;
      const mode = el.getAttribute('inputmode');
      const isNumeric = el.type === 'number' || mode === 'numeric' || mode === 'decimal';
      if (!isNumeric) return;
      const v = (el.value || '').trim();
      if (v === '0' || v === '0.0' || v === '0.00') {
        setTimeout(() => { try { el.select(); } catch {} }, 0);
      }
    };
    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
  }, []);
  return null;
};
