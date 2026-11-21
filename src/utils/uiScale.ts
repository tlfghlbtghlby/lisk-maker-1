import { useSyncExternalStore } from 'react';

/** حجم النص داخل البرنامج: مستقل عن إعدادات النظام، محفوظ على هذا الجهاز فقط */
export interface UiScale { pct: number; font: 'default' | 'tajawal' | 'cairo' | 'system'; bold: boolean; }
const KEY = 'mufakir_ui_scale_v1';
export const DEFAULT_SCALE: UiScale = { pct: 100, font: 'default', bold: false };
export const MIN_PCT = 75, MAX_PCT = 150;

function load(): UiScale {
  try {
    const r = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (r) {
      const pct = Math.max(MIN_PCT, Math.min(MAX_PCT, Number(r.pct) || 100));
      return { pct, font: ['tajawal', 'cairo', 'system'].includes(r.font) ? r.font : 'default', bold: r.bold === true };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_SCALE };
}

let state = load();
const ls = new Set<() => void>();
const FONTS: Record<string, string> = {
  tajawal: "'Tajawal','Almarai',Tahoma,sans-serif",
  cairo: "'Cairo','Tajawal',Tahoma,sans-serif",
  system: "system-ui,-apple-system,'Segoe UI',Tahoma,Arial,sans-serif",
};

export function applyUiScale(s: UiScale = state) {
  const el = document.documentElement;
  // كل أحجام Tailwind بوحدة rem فتتكبّر/تتصغّر معاً
  if (s.pct === 100) el.style.removeProperty('font-size'); else el.style.fontSize = `${s.pct}%`;
  let st = document.getElementById('ui-scale-style') as HTMLStyleElement | null;
  const css = (s.font !== 'default' ? `html body,html body *:not(svg):not(svg *){font-family:${FONTS[s.font]} !important}` : '') + (s.bold ? `html body{font-weight:600}` : '');
  if (!css) { st?.remove(); return; }
  if (!st) { st = document.createElement('style'); st.id = 'ui-scale-style'; document.head.appendChild(st); }
  st.textContent = css;
}

export const uiScale = {
  get: () => state,
  set(p: Partial<UiScale>) {
    state = { ...state, ...p };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
    applyUiScale(state);
    ls.forEach((l) => l());
  },
  reset() { this.set({ ...DEFAULT_SCALE }); },
};
export const useUiScale = () => useSyncExternalStore((l) => { ls.add(l); return () => { ls.delete(l); }; }, () => state, () => state);
export function installUiScale() { applyUiScale(state); }
