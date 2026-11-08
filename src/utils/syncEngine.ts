export interface SyncableEntity {
  id: string | number;
  updatedAt?: string;
  createdAt?: string;
  date?: string;
  [key: string]: any;
}

export function getEntityTimestamp(entity: any): number {
  const ts = entity?.updatedAt || entity?.createdAt || entity?.date;
  if (!ts) return 0;
  const time = new Date(ts).getTime();
  return isNaN(time) ? 0 : time;
}

export function isItemDeleted(
  id: string,
  item: any,
  deletedMap: Record<string, string> | Set<string> | string[] = {}
): boolean {
  if (!deletedMap) return false;

  if (deletedMap instanceof Set) {
    return deletedMap.has(id);
  }

  if (Array.isArray(deletedMap)) {
    return deletedMap.includes(id);
  }

  const deletedAtStr = deletedMap[id];
  if (!deletedAtStr) return false;

  const delTime = new Date(deletedAtStr).getTime();
  if (isNaN(delTime) || delTime <= 0) return true;

  const itemTime = getEntityTimestamp(item);
  // If the deletion happened at or after the item's last modification, it is deleted
  return itemTime <= delTime;
}

export function mergeProducts(
  localProducts: any[] = [], 
  serverProducts: any[] = [],
  deletedProductsMap: Record<string, string> | Set<string> | string[] = {}
): any[] {
  const map = new Map<string, any>();

  // 1. Process server products, checking against cloud tombstones
  for (const item of serverProducts) {
    if (item && item.id !== undefined && item.id !== null) {
      const idStr = String(item.id);
      if (isItemDeleted(idStr, item, deletedProductsMap)) {
        continue;
      }
      map.set(idStr, item);
    }
  }

  // 2. Process local products
  for (const localItem of localProducts) {
    if (!localItem || localItem.id === undefined || localItem.id === null) continue;

    const idStr = String(localItem.id);
    if (isItemDeleted(idStr, localItem, deletedProductsMap)) {
      continue;
    }

    const serverItem = map.get(idStr);

    if (!serverItem) {
      // Local product that doesn't exist on server yet (and not in deleted tombstones)
      map.set(idStr, localItem);
    } else {
      // Both exist: pick the one with the latest timestamp
      const localTime = getEntityTimestamp(localItem);
      const serverTime = getEntityTimestamp(serverItem);

      if (localTime > serverTime) {
        map.set(idStr, localItem);
      } else {
        map.set(idStr, serverItem);
      }
    }
  }

  return Array.from(map.values());
}

export function mergeInvoices(
  localInvoices: any[] = [],
  serverInvoices: any[] = [],
  tombstones: Record<string, string> = {}
): any[] {
  const { merged } = mergeCollection(localInvoices, serverInvoices, tombstones);
  return merged.sort((x, y) => getEntityTimestamp(y) - getEntityTimestamp(x));
}

export function mergeShifts(localShifts: any[] = [], serverShifts: any[] = []): any[] {
  const map = new Map<string, any>();

  for (const shift of serverShifts) {
    if (shift && shift.id) {
      map.set(String(shift.id), shift);
    }
  }

  for (const shift of localShifts) {
    if (shift && shift.id) {
      const existing = map.get(String(shift.id));
      if (!existing) {
        map.set(String(shift.id), shift);
      } else {
        if (shift.status === 'closed' && existing.status === 'active') {
          map.set(String(shift.id), shift);
        }
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const timeA = new Date(a.startTime || 0).getTime();
    const timeB = new Date(b.startTime || 0).getTime();
    return timeB - timeA;
  });
}


// ================= المزامنة العامة وسلة المحذوفات =================

export type SyncSection = 'products' | 'customers' | 'invoices' | 'reps' | 'shifts' | 'payments';

export const TRASH_RETENTION_MS = 3 * 24 * 60 * 60 * 1000; // 3 أيام
export const TOMBSTONE_RETENTION_MS = 45 * 24 * 60 * 60 * 1000;

export interface TrashEntry {
  id: string;
  section: SyncSection;
  entityId: string;
  label: string;
  data: any;
  deletedAt: string;
  reason: 'deleted' | 'conflict';
  deletedBy?: string;
  details?: string;
}

export type Tombstones = Partial<Record<SyncSection, Record<string, string>>>;

const VOLATILE_KEYS = new Set(['updatedAt', 'lastSavedByClient']);

const stableStringify = (v: any): string => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  return (
    '{' +
    Object.keys(v)
      .filter(k => !VOLATILE_KEYS.has(k) && v[k] !== undefined)
      .sort()
      .map(k => JSON.stringify(k) + ':' + stableStringify(v[k]))
      .join(',') +
    '}'
  );
};

export const sameContent = (a: any, b: any): boolean => stableStringify(a) === stableStringify(b);

/**
 * دمج مجموعة سجلات بين النسخة المحلية والسحابية:
 *  - سجل موجود في طرف واحد فقط: يُضاف (دمج دون تعارض).
 *  - سجل موجود في الطرفين ومتطابق: يبقى كما هو.
 *  - سجل موجود في الطرفين ومختلف (تعارض): الأحدث يفوز، والأقدم يُرجَع ضمن losers ليُحفظ في سلة المحذوفات.
 *  - سجل محذوف (له شاهد حذف أحدث من آخر تعديل عليه): يُستبعد.
 */
export function mergeCollection<T extends { id: any }>(
  local: T[] = [],
  cloud: T[] = [],
  tombstones: Record<string, string> = {},
  conflictSince = 0
): { merged: T[]; losers: T[] } {
  const map = new Map<string, T>();
  const losers: T[] = [];

  for (const item of cloud || []) {
    if (!item || item.id === undefined || item.id === null) continue;
    const id = String(item.id);
    if (isItemDeleted(id, item, tombstones)) continue;
    map.set(id, item);
  }

  for (const item of local || []) {
    if (!item || item.id === undefined || item.id === null) continue;
    const id = String(item.id);
    if (isItemDeleted(id, item, tombstones)) continue;
    const other = map.get(id);
    if (!other) {
      map.set(id, item);
      continue;
    }
    if (sameContent(item, other)) {
      // لا تعارض: نُبقي الأحدث زمنياً فقط
      if (getEntityTimestamp(item) > getEntityTimestamp(other)) map.set(id, item);
      continue;
    }
    const lt = getEntityTimestamp(item);
    const ct = getEntityTimestamp(other);
    // تعارض حقيقي فقط إذا كانت النسخة الخاسرة قد عُدّلت بعد آخر مزامنة ناجحة
    // (أي أن الطرف الآخر لم يرها)، وإلا فهي نسخة قديمة عادية لا تحتاج حفظاً.
    if (lt > ct) {
      map.set(id, item);
      if (ct > conflictSince) losers.push(other);
    } else {
      if (lt > conflictSince) losers.push(item);
    }
  }

  return { merged: Array.from(map.values()), losers };
}

export function mergeTombstones(a: Tombstones = {}, b: Tombstones = {}): Tombstones {
  const out: Tombstones = {};
  const now = Date.now();
  const sections = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]) as Set<SyncSection>;
  sections.forEach(sec => {
    const merged: Record<string, string> = { ...(b?.[sec] || {}) };
    Object.entries(a?.[sec] || {}).forEach(([id, t]) => {
      if (!merged[id] || new Date(t).getTime() > new Date(merged[id]).getTime()) merged[id] = t;
    });
    Object.keys(merged).forEach(id => {
      const ts = new Date(merged[id]).getTime();
      if (!isNaN(ts) && now - ts > TOMBSTONE_RETENTION_MS) delete merged[id];
    });
    out[sec] = merged;
  });
  return out;
}

export function purgeTrash(entries: TrashEntry[] = []): TrashEntry[] {
  const now = Date.now();
  return entries.filter(e => {
    const t = new Date(e.deletedAt).getTime();
    return !isNaN(t) && now - t < TRASH_RETENTION_MS;
  });
}

export function mergeTrash(...lists: (TrashEntry[] | undefined)[]): TrashEntry[] {
  const map = new Map<string, TrashEntry>();
  lists.forEach(l => (l || []).forEach(e => e && e.id && map.set(e.id, e)));
  return purgeTrash(Array.from(map.values())).sort(
    (a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime()
  );
}

export function makeTrashEntry(
  section: SyncSection,
  data: any,
  label: string,
  reason: 'deleted' | 'conflict',
  deletedBy?: string,
  details?: string
): TrashEntry {
  const entityId = String(data?.id ?? '');
  const stamp = reason === 'conflict' ? String(data?.updatedAt || data?.createdAt || '') : String(Date.now());
  return {
    id: `${reason === 'conflict' ? 'c' : 'd'}_${section}_${entityId}_${stamp}_${Math.random().toString(36).slice(2, 6)}`.replace(
      reason === 'conflict' ? /_[a-z0-9]{4}$/ : /$^/,
      ''
    ),
    section,
    entityId,
    label,
    data,
    deletedAt: new Date().toISOString(),
    reason,
    deletedBy,
    details,
  };
}
