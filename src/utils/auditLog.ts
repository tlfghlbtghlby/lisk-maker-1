// سجل تدقيق محلي للعمليات الحساسة (حذف/إرجاع/تعديل أسعار/إغلاق شفت/استعادة…).
// يُحفظ على هذا الجهاز فقط (لا يُزامَن حتى لا يزيد حجم السحابة) ويُضمَّن في النسخة الاحتياطية.
const KEY = 'mufakir_audit_log';
const MAX = 600;

export interface AuditEntry {
  t: string; // ISO
  who: string;
  action: string;
  detail: string;
}

export function readAudit(): AuditEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export function logAudit(action: string, detail: string, who: string): void {
  try {
    const list = readAudit();
    list.unshift({ t: new Date().toISOString(), who: who || '—', action, detail: String(detail || '').slice(0, 300) });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event('mufakir-audit-change'));
  } catch {}
}

export function clearAudit(): void {
  try { localStorage.removeItem(KEY); window.dispatchEvent(new Event('mufakir-audit-change')); } catch {}
}
