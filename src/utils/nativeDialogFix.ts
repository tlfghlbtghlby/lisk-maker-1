/**
 * إصلاح "لا يقبل الكتابة إلا بعد إعادة التشغيل":
 * نوافذ alert/confirm/prompt الأصلية في Electron على ويندوز تُفقد النافذة تركيز لوحة المفاتيح،
 * فتبدو الحقول سليمة لكنها لا تستقبل الكتابة. نغلّف الدوال الثلاث لاستعادة التركيز فور إغلاق النافذة.
 * (prompt غير مدعومة في Electron أصلاً فنُرجع null بدل أن تتجمد الواجهة.)
 */
let installed = false;

function refocus() {
  try {
    const api = (window as any).electronAPI;
    if (api?.refocusWindow) api.refocusWindow();
  } catch { /* ignore */ }
  // احتياط للمتصفح/الأندرويد: أعد التركيز على العنصر الفعّال بعد دورة حدث
  setTimeout(() => {
    try {
      const el = document.activeElement as HTMLElement | null;
      window.focus();
      if (el && typeof el.blur === 'function' && typeof el.focus === 'function' && el !== document.body) {
        el.blur();
        el.focus();
      }
    } catch { /* ignore */ }
  }, 30);
}

export function installNativeDialogFix() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const w = window as any;
  const origAlert = w.alert?.bind(window);
  const origConfirm = w.confirm?.bind(window);
  const origPrompt = w.prompt?.bind(window);
  if (origAlert) w.alert = (msg?: any) => { try { origAlert(msg); } finally { refocus(); } };
  if (origConfirm) w.confirm = (msg?: any) => { let r = false; try { r = origConfirm(msg); } finally { refocus(); } return r; };
  if (origPrompt) w.prompt = (msg?: any, def?: any) => {
    let r: string | null = null;
    try { r = origPrompt(msg, def); } catch { r = null; } finally { refocus(); }
    return r;
  };
}
