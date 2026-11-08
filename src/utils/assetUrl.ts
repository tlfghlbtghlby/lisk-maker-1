// مسارات الملفات العامة (public) تعمل في: Electron (file://) وGitHub Pages (مسار فرعي) وأندرويد.
// لا تستخدم "/assets/..." المطلقة في الكود لأنها تنكسر خارج جذر الدومين.
const BASE = (import.meta as any).env?.BASE_URL ?? './';
export const publicUrl = (file: string) => `${BASE}${file.replace(/^\/+/, '')}`;
export const APP_ICON_URL = publicUrl('icon.png');
