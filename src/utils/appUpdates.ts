import { useEffect, useState, useSyncExternalStore } from 'react';
import { supabase } from '../supabase';
import { CURRENT_APP_VERSION, isVersionOutdated } from '../context/AppContext';
import { isAndroidApp } from './androidOnly';

export interface UpdateEntry { version: string; date?: string; title?: string; notes?: string[]; }
export interface UpdateInfo { latestVersion: string; releasedAt?: string; url?: string; message?: string; changelog: UpdateEntry[]; }

const SEEN = 'mufakir_seen_update_v1';
let info: UpdateInfo | null = null;
let seen = (() => { try { return localStorage.getItem(SEEN) || ''; } catch { return ''; } })();
const ls = new Set<() => void>();
const emit = () => ls.forEach((l) => l());

const okUrl = (u: any): string | undefined => (typeof u === 'string' && /^https?:\/\//i.test(u.trim()) ? u.trim() : undefined);
/** رابط التحديث حسب المنصة: أندرويد / ويندوز (Electron)، وإلا الرابط العام (update_url) */
function pickUpdateUrl(d: any): string | undefined {
  let platformUrl: string | undefined;
  try {
    if (isAndroidApp()) platformUrl = okUrl(d.update_url_android);
    else if ((window as any).electronAPI || (window as any).electron) platformUrl = okUrl(d.update_url_windows);
  } catch { /* */ }
  return platformUrl || okUrl(d.update_url);
}

/** يجلب معلومات التحديث من السحابة (قراءة فقط). أي فشل = صمت، والبرنامج يعمل كالمعتاد */
export async function fetchUpdateInfo(): Promise<UpdateInfo | null> {
  try {
    const { data, error } = await supabase.from('system_settings').select('*').eq('id', 'global_config').maybeSingle();
    if (error || !data) return info;
    const d: any = data;
    const cl: UpdateEntry[] = Array.isArray(d.changelog) ? d.changelog.filter((e: any) => e && e.version) : [];
    cl.sort((a, b) => (b.date || '').localeCompare(a.date || '') || (isVersionOutdated(a.version, b.version) ? 1 : -1));
    info = {
      latestVersion: String(d.latest_version || cl[0]?.version || CURRENT_APP_VERSION),
      releasedAt: d.latest_released_at || cl[0]?.date || undefined,
      url: pickUpdateUrl(d),
      message: d.update_message || undefined,
      changelog: cl,
    };
    emit();
  } catch { /* offline */ }
  return info;
}

export const hasNewUpdate = (i: UpdateInfo | null) => !!i && isVersionOutdated(CURRENT_APP_VERSION, i.latestVersion);
export const markUpdateSeen = () => { if (!info) return; seen = info.latestVersion; try { localStorage.setItem(SEEN, seen); } catch { /* */ } emit(); };

export function useUpdateInfo() {
  const cur = useSyncExternalStore((l) => { ls.add(l); return () => { ls.delete(l); }; }, () => info, () => info);
  useSyncExternalStore((l) => { ls.add(l); return () => { ls.delete(l); }; }, () => seen, () => seen);
  const [loading, setLoading] = useState(!info);
  useEffect(() => { let on = true; fetchUpdateInfo().finally(() => on && setLoading(false)); return () => { on = false; }; }, []);
  const isNew = hasNewUpdate(cur);
  return { info: cur, loading, isNew, unseen: isNew && !!cur && cur.latestVersion !== seen, refresh: fetchUpdateInfo };
}
