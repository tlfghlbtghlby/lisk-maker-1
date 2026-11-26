// أزرار «الظل الاحترافي»: مفعّلة افتراضياً، ويمكن إيقافها من الإعدادات (لكل جهاز).
export const PB_LS_KEY = 'mufakir_premium_buttons';

export function isPremiumButtons(): boolean {
  try { return localStorage.getItem(PB_LS_KEY) !== '0'; } catch { return true; }
}
export function setPremiumButtons(on: boolean) {
  try { localStorage.setItem(PB_LS_KEY, on ? '1' : '0'); } catch { /* ignore */ }
  if (typeof document !== 'undefined') document.body.classList.toggle('premium-btn', on);
}
export function installPremiumButtons() {
  if (typeof document === 'undefined') return;
  document.body.classList.toggle('premium-btn', isPremiumButtons());
}
