// تخصيص ألوان الثيم (الفاتح والداكن) — يُطبَّق عبر عنصر <style> يعدّل ألوان الأصناف المستعملة في كل الشاشات.
// لا يُصدر أي قاعدة إلا لما غيّره المستخدم، فالافتراضي يبقى كما هو تماماً.
// القواعد داخل @media screen فلا تتأثر الطباعة (القوائم والفواتير تبقى كما هي).

export interface ThemeModeColors {
  page?: string;      // خلفية الصفحة
  surface?: string;   // خلفية البطاقات والنوافذ
  surface2?: string;  // خلفية الحقول والصفوف الثانوية
  text?: string;      // لون الكتابة الأساسي
  muted?: string;     // لون الكتابة الثانوي
  border?: string;    // لون الحدود
  accent?: string;    // اللون المميز (الأزرار الذهبية)
  soft?: number;      // تخفيف الأبيض الصافي 0..100
}

export interface ThemeCustom {
  light?: ThemeModeColors;
  dark?: ThemeModeColors;
}

export const THEME_LS_KEY = 'mufakir_theme_custom';
const STYLE_ID = 'mufakir-theme-custom';

export const MODE_DEFAULTS: Record<'light' | 'dark', Required<Omit<ThemeModeColors, 'soft'>>> = {
  light: { page: '#f1f5f9', surface: '#ffffff', surface2: '#f8fafc', text: '#0f172a', muted: '#64748b', border: '#e2e8f0', accent: '#f59e0b' },
  dark: { page: '#070d18', surface: '#0b1728', surface2: '#070e1b', text: '#ffffff', muted: '#94a3b8', border: '#334155', accent: '#f59e0b' },
};

export const PRESETS: Record<'light' | 'dark', { name: string; colors: ThemeModeColors }[]> = {
  light: [
    { name: 'الافتراضي', colors: {} },
    { name: 'مريح للعين', colors: { page: '#e5e7eb', surface: '#f3f4f6', surface2: '#e9ebee', text: '#1f2937', muted: '#586174', border: '#cfd4dc', soft: 0 } },
    { name: 'ورقي دافئ', colors: { page: '#f3ead7', surface: '#fbf5e8', surface2: '#f5ecd8', text: '#3b2f1d', muted: '#7a6a50', border: '#e0d2b4' } },
    { name: 'أزرق هادئ', colors: { page: '#e3ecf6', surface: '#f2f7fc', surface2: '#e8f0f9', text: '#10243e', muted: '#4f6783', border: '#c5d6e8' } },
  ],
  dark: [
    { name: 'الافتراضي', colors: {} },
    { name: 'أسود عميق', colors: { page: '#000000', surface: '#0a0a0a', surface2: '#050505', text: '#e5e5e5', muted: '#9ca3af', border: '#262626' } },
    { name: 'رمادي فحمي', colors: { page: '#16181d', surface: '#20232a', surface2: '#1a1c22', text: '#e6e8ec', muted: '#9aa1ad', border: '#363a44' } },
    { name: 'أزرق ليلي', colors: { page: '#0b1020', surface: '#121a33', surface2: '#0e1529', text: '#e8edf9', muted: '#93a1c4', border: '#27345c' } },
  ],
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function dim(hex: string, soft: number): string {
  if (!HEX.test(hex) || !soft) return hex;
  const k = 1 - Math.max(0, Math.min(100, soft)) * 0.003; // حتى 30% تقليل
  const c = (i: number) => Math.round(parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0');
  return `#${c(1)}${c(3)}${c(5)}`;
}

function sel(list: string[], prefix: string): string {
  return list.map((s) => `${prefix} ${s}`).join(',\n');
}

function ruleBlock(mode: 'light' | 'dark', c: ThemeModeColors): string {
  const d = MODE_DEFAULTS[mode];
  const soft = Number(c.soft) || 0;
  const pre = mode === 'dark' ? 'html.dark' : 'html:not(.dark)';
  const out: string[] = [];
  const val = (v: string | undefined) => (v && HEX.test(v) ? v : undefined);

  // أبيض صافي: في الفاتح يؤثر على الخلفيات البيضاء، وفي الداكن على الكتابة البيضاء
  const page = val(c.page) ?? (mode === 'light' && soft ? d.page : undefined);
  const surface = val(c.surface) ?? (mode === 'light' && soft ? d.surface : undefined);
  const surface2 = val(c.surface2);
  const text = val(c.text) ?? (mode === 'dark' && soft ? d.text : undefined);
  const muted = val(c.muted);
  const border = val(c.border);
  const accent = val(c.accent);

  if (page) {
    const col = mode === 'light' ? dim(page, soft) : page;
    out.push(`${pre} body, ${pre} .app-root { background-color: ${col} !important; }`);
    out.push(`${pre} { --bg-main: ${col}; }`);
  }
  if (surface) {
    const col = mode === 'light' ? dim(surface, soft) : surface;
    const list = mode === 'light'
      ? ['.bg-white:not(.keep-light)']
      : ['[class*="dark:bg-[#0b1728]"]', '[class*="dark:bg-[#0e1c33]"]'];
    out.push(`${sel(list, pre)} { background-color: ${col} !important; }`);
  }
  if (surface2) {
    const list = mode === 'light'
      ? ['.bg-slate-50:not(.keep-light)']
      : ['[class*="dark:bg-[#070e1b]"]', '[class*="dark:bg-[#060b13]"]', '[class*="dark:bg-[#060e1d]"]'];
    out.push(`${sel(list, pre)} { background-color: ${surface2} !important; }`);
  }
  if (text) {
    const col = mode === 'dark' ? dim(text, soft) : text;
    const list = mode === 'light'
      ? ['.text-slate-900', '.text-slate-800', '.text-gray-900', '.text-gray-800']
      : ['[class*="dark:text-white"]', '[class*="dark:text-slate-100"]', '[class*="dark:text-slate-200"]'];
    out.push(`${sel(list, pre)} { color: ${col} !important; }`);
    out.push(`${pre} { --text-main: ${col}; }`);
    if (mode === 'dark') out.push(`${pre} body, ${pre} .app-root { color: ${col}; }`);
  }
  if (muted) {
    const list = mode === 'light'
      ? ['.text-slate-700', '.text-slate-600', '.text-slate-500', '.text-gray-600', '.text-gray-500']
      : ['[class*="dark:text-slate-300"]', '[class*="dark:text-slate-400"]', '[class*="dark:text-slate-500"]'];
    out.push(`${sel(list, pre)} { color: ${muted} !important; }`);
  }
  if (border) {
    const list = mode === 'light'
      ? ['.border-slate-100', '.border-slate-200', '.border-slate-300', '.divide-slate-100 > :not(:last-child)', '.divide-slate-200 > :not(:last-child)']
      : ['[class*="dark:border-slate-700"]', '[class*="dark:border-slate-800"]', '[class*="dark:border-slate-600"]', '[class*="dark:divide-slate-800"] > :not(:last-child)', '[class*="dark:divide-slate-700"] > :not(:last-child)'];
    out.push(`${sel(list, pre)} { border-color: ${border} !important; }`);
  }
  if (accent) {
    out.push(`${sel(['.bg-amber-500:not(.keep-light)', '.bg-amber-600:not(.keep-light)'], pre)} { background-color: ${accent} !important; }`);
    out.push(`${sel(['.border-amber-500', '.border-amber-400'], pre)} { border-color: ${accent} !important; }`);
    out.push(`${sel([mode === 'dark' ? '.text-amber-400' : '.text-amber-600'], pre)} { color: ${accent} !important; }`);
  }
  return out.join('\n');
}

export function buildThemeCss(custom: ThemeCustom | null | undefined): string {
  if (!custom) return '';
  const parts = [custom.light && ruleBlock('light', custom.light), custom.dark && ruleBlock('dark', custom.dark)].filter(Boolean);
  if (!parts.length) return '';
  return `@media screen {\n${parts.join('\n')}\n}`;
}

export function applyThemeCustom(custom: ThemeCustom | null | undefined): void {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  const css = buildThemeCss(custom);
  if (!css) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('style');
    el.id = STYLE_ID;
    document.head.appendChild(el); // آخر عنصر في <head> ليغلب على الباقي
  }
  el.textContent = css;
}

export function readThemeCustom(): ThemeCustom | null {
  try {
    const raw = localStorage.getItem(THEME_LS_KEY);
    return raw ? (JSON.parse(raw) as ThemeCustom) : null;
  } catch {
    return null;
  }
}

export function saveThemeCustom(custom: ThemeCustom | null): void {
  try {
    if (custom) localStorage.setItem(THEME_LS_KEY, JSON.stringify(custom));
    else localStorage.removeItem(THEME_LS_KEY);
  } catch { /* ignore */ }
}

export function installThemeCustom(): void {
  applyThemeCustom(readThemeCustom());
}
