// «الوضع العصري»: طبقة تنسيق شاملة تُفعَّل بإضافة الصنف modern على <html> (تنسيق فقط، لا تغيّر البيانات ولا المزامنة).
export const MODERN_LS_KEY = 'mufakir_modern';

export function isModernMode(): boolean {
  try { return localStorage.getItem(MODERN_LS_KEY) === '1'; } catch { return false; }
}

export function setModernMode(on: boolean): void {
  try { localStorage.setItem(MODERN_LS_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('modern', on);
}

export function installModernMode(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('modern', isModernMode());
}
