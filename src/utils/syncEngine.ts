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

export function mergeInvoices(localInvoices: any[] = [], serverInvoices: any[] = []): any[] {
  const map = new Map<string, any>();

  for (const inv of serverInvoices) {
    if (inv && inv.id !== undefined && inv.id !== null) {
      map.set(String(inv.id), inv);
    }
  }

  for (const inv of localInvoices) {
    if (inv && inv.id !== undefined && inv.id !== null) {
      map.set(String(inv.id), inv);
    }
  }

  const mergedList = Array.from(map.values());
  mergedList.sort((a, b) => {
    const timeA = getEntityTimestamp(a);
    const timeB = getEntityTimestamp(b);
    return timeB - timeA;
  });

  return mergedList;
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
