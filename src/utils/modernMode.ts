// «الوضع العصري»: طبقة تنسيق شاملة + شاشة رئيسية وشريط تحكم، تُفعَّل بالصنف modern على <html>.
// كل الأيقونات والواجهات مضمَّنة في البرنامج نفسه (لا تُحمَّل من السحابة ولا تُخزَّن فيها).
import { useEffect, useState } from 'react';

export const MODERN_LS_KEY = 'mufakir_modern';
const EVT = 'mufakir-modern-change';

export function isModernMode(): boolean {
  try { return localStorage.getItem(MODERN_LS_KEY) === '1'; } catch { return false; }
}

export function setModernMode(on: boolean): void {
  try { localStorage.setItem(MODERN_LS_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('modern', on);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVT));
}

export function installModernMode(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('modern', isModernMode());
}

export function useModernMode(): boolean {
  const [on, setOn] = useState<boolean>(() => isModernMode());
  useEffect(() => {
    const h = () => setOn(isModernMode());
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  return on;
}
