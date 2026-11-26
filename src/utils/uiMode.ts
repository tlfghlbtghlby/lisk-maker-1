// «وضع سطح المكتب»: الوضع الثالث بجانب الاعتيادي والعصري. يغيّر الواجهات جذرياً (قائمة جانبية، شاشة رئيسية بمربعات داكنة،
// جداول بترويسة صفراء، أزرار سفلية...) بطبقة تنسيق desk.css وصنف desk على <html>. لا يمس البيانات ولا المنطق.
// الأوضاع الثلاثة متنافية: تفعيل أحدها يُطفئ الآخرين، والاعتيادي هو الافتراضي.
import { useEffect, useState } from 'react';
import { isModernMode, setModernMode } from './modernMode';

export const DESK_LS_KEY = 'mufakir_desk';
export type UiMode = 'classic' | 'modern' | 'desk';
const EVT = 'mufakir-desk-change';

/** وضع سطح المكتب للويندوز/الويب فقط؛ تطبيق الأندرويد له واجهته ولا يتأثر به إطلاقاً. */
export const deskModeSupported: boolean = (() => {
  try {
    const c = (window as any).Capacitor; // يُحقن في تطبيق الأندرويد فقط
    return !(c?.isNativePlatform?.() && c.getPlatform?.() === 'android');
  } catch {
    return true;
  }
})();

export function isDeskMode(): boolean {
  if (!deskModeSupported) return false;
  try { return localStorage.getItem(DESK_LS_KEY) === '1'; } catch { return false; }
}

export function getUiMode(): UiMode {
  if (isDeskMode()) return 'desk';
  return isModernMode() ? 'modern' : 'classic';
}

/** يضبط الوضع ويطفئ غيره. الوضع العصري يبقى بمفتاحه القديم كي لا يتأثر أي جهاز محدَّث لاحقاً. */
export function setUiMode(mode: UiMode): void {
  if (mode === 'desk' && !deskModeSupported) return;
  try { localStorage.setItem(DESK_LS_KEY, mode === 'desk' ? '1' : '0'); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('desk', mode === 'desk');
  setModernMode(mode === 'modern');
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVT));
}

export function installDeskMode(): void {
  if (typeof document === 'undefined') return;
  const on = isDeskMode();
  document.documentElement.classList.toggle('desk', on);
  if (on && isModernMode()) setModernMode(false); // التنافي
}

export function useDeskMode(): boolean {
  const [on, setOn] = useState<boolean>(() => isDeskMode());
  useEffect(() => {
    const h = () => setOn(isDeskMode());
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  return on;
}
