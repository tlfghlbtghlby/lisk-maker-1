import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase, getDocument, setDocument, subscribeToDocument, verifyAccountPassword } from '../supabase';
import { 
  Product, 
  Customer, 
  Invoice, 
  InvoiceItem, 
  InvoiceStatus, 
  PaymentRecord, 
  StoreSettings, 
  CreateInvoiceInput, 
  SessionRole, 
  RolePermissions, 
  DEFAULT_EMPLOYEE_PERMISSIONS, 
  DEFAULT_SUPERVISOR_PERMISSIONS, 
  DEFAULT_ADMIN_PERMISSIONS, 
  ADMIN_EMAIL, 
  Shift, 
  ShiftItemSold, 
  ReturnedItemRecord, 
  POSDraftOrder, 
  PresetShift, 
  StoreSupervisor, 
  DeviceSession, 
  DuplicateProductGroup, 
  SalesRep, 
  StoreFeatures, 
  DEFAULT_STORE_FEATURES 
} from '../types';
import { getOrCreateDeviceId, getOrCreateSessionId, detectSystemInfo } from '../utils/deviceSession';
import { findDuplicateGroups } from '../utils/duplicateCleaner';
import {
  mergeProducts, mergeInvoices, mergeShifts,
  mergeCollection, mergeTombstones, mergeTrash, makeTrashEntry, purgeTrash,
  TrashEntry, Tombstones, SyncSection,
} from '../utils/syncEngine';
import { broadcastSync, subscribeSync, SyncMessage } from '../utils/syncChannel';
import pkg from '../../package.json';
import type { TelegramEventKey, StockLogEntry } from '../types';
import {
  tgNotify, formatInvoice, formatPayment, formatReturnFull, formatReturnPartial, formatDeletedInvoice,
  formatProductEvent, diffProduct, formatSimple, esc as tgEsc, FmtCtx,
} from '../utils/telegram';
import { generateStoreSecret, getStoreCode, computeInvoiceSeal } from '../utils/invoiceSeal';
import { netUnitPrice } from '../utils/promotions';

export const CURRENT_APP_VERSION = (pkg as any)?.version || '2.0.0';

export const isVersionOutdated = (current: string, minRequired: string): boolean => {
  try {
    const curParts = current.split('.').map(p => parseInt(p, 10) || 0);
    const minParts = minRequired.split('.').map(p => parseInt(p, 10) || 0);
    const maxLen = Math.max(curParts.length, minParts.length);
    for (let i = 0; i < maxLen; i++) {
      const c = curParts[i] || 0;
      const m = minParts[i] || 0;
      if (c < m) return true;
      if (c > m) return false;
    }
    return false;
  } catch {
    return false;
  }
};

export const sanitizeForFirestore = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForFirestore);
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = sanitizeForFirestore(val);
    }
  }
  return clean;
};

export interface CustomBackupOptions {
  scope: 'all' | 'products_only' | 'settings_only' | 'custom';
  includeProducts?: boolean;
  includeCustomers?: boolean;
  includeInvoices?: boolean;
  includePayments?: boolean;
  includeShifts?: boolean;
  includeSettings?: boolean;
  anonymizeProducts?: boolean;
}

interface AppContextType {
  products: Product[];
  customers: Customer[];
  invoices: Invoice[];
  payments: PaymentRecord[];
  settings: StoreSettings;
  storeFeatures: StoreFeatures;
  draftOrders: POSDraftOrder[];
  activeDraftId: string;
  activeDraft: POSDraftOrder;
  updateActiveDraft: (updates: Partial<POSDraftOrder>) => void;
  addNewDraft: () => string;
  switchToDraft: (id: string) => void;
  clearCurrentDraft: () => void;
  deleteCurrentDraft: () => void;
  completeActiveDraft: () => void;
  shifts: Shift[];
  activeShift: Shift | null;
  startShift: (startingCash?: number, notes?: string, presetShiftId?: string, shiftCode?: string) => Promise<{ success: boolean; error?: string; shift?: Shift }>;
  endShift: (notes?: string) => Promise<Shift | null>;
  getShiftStats: (shift: Shift) => {
    invoicesCount: number;
    totalSales: number;
    totalPaid: number;
    totalRemaining: number;
    totalCost: number;
    totalProfit: number;
    itemsSold: ShiftItemSold[];
    invoices: Invoice[];
  };
  deleteShift: (shiftId: string) => Promise<void>;
  isStartShiftModalOpen: boolean;
  setIsStartShiftModalOpen: (open: boolean) => void;
  isEndShiftModalOpen: boolean;
  setIsEndShiftModalOpen: (open: boolean) => void;
  selectedShiftForDetails: Shift | null;
  setSelectedShiftForDetails: (shift: Shift | null) => void;
  addPresetShift: (preset: Omit<PresetShift, 'id' | 'createdAt'>) => Promise<PresetShift>;
  updatePresetShift: (id: string, updates: Partial<PresetShift>) => Promise<void>;
  deletePresetShift: (id: string) => Promise<void>;
  addSupervisor: (sup: Omit<StoreSupervisor, 'id' | 'createdAt'>) => Promise<StoreSupervisor>;
  updateSupervisor: (id: string, updates: Partial<StoreSupervisor>) => Promise<void>;
  deleteSupervisor: (id: string) => Promise<void>;
  activeSupervisorId: string | null;
  activeSupervisorName: string | null;
  addProduct: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Product;
  addBulkProducts: (items: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[], onProgress?: (curr: number, total: number) => void) => Promise<{ success: boolean; count: number; products: Product[] }>;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  batchDeleteProducts: (productIdsToDelete: string[], stockIncrements?: Record<string, number>) => Promise<{ success: boolean; deletedCount: number; error?: string }>;
  adjustStock: (id: string, delta: number, opts?: { log?: boolean }) => void;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'totalDebt'> & { initialDebt?: number }) => Customer;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  createInvoice: (data: CreateInvoiceInput) => Invoice;
  deleteInvoice: (id: string) => void;
  returnInvoice: (id: string, reason?: string) => Promise<boolean>;
  returnPartialInvoice: (
    invoiceId: string,
    itemsToReturn: { productId: string; quantity: number }[],
    reason: string,
    notes?: string
  ) => Promise<{ success: boolean; error?: string }>;
  applyBulkPriceAdjustment: (percentage: number, priceTargets: { retail: boolean; wholesale: boolean; cost: boolean }, roundToHundreds?: boolean) => Promise<{ updatedCount: number }>;
  recordPayment: (customerId: string, amount: number, notes?: string) => PaymentRecord;
  trash: TrashEntry[];
  restoreTrashEntry: (id: string) => boolean;
  purgeTrashEntry: (id: string) => void;
  emptyTrash: (sections?: SyncSection[]) => void;
  getUnappliedDebts: () => { customerId: string; customerName: string; amount: number; invoices: number }[];
  reconcileCustomerDebts: () => number;
  updateSettings: (newSettings: Partial<StoreSettings>) => void;
  resetToDemo: () => void;
  resetToZero: () => void;
  exportDataJSON: () => string;
  exportCustomBackup: (options: CustomBackupOptions) => string;
  importDataJSON: (jsonStr: string) => { success: boolean; error?: string };
  importProductsOnly: (
    jsonStr: string,
    mode?: 'merge' | 'replace',
    onProgress?: (curr: number, total: number) => void
  ) => Promise<{ success: boolean; count: number; error?: string }>;
  addProductsBulk: (newProducts: Product[]) => Promise<{ success: boolean; count: number; error?: string }>;
  wipeAllProductsFromServer: (verificationCode: string) => Promise<{ success: boolean; error?: string }>;
  formatMoney: (amount: number) => string;
  currentUser: any;
  authLoading: boolean;
  isCloudConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: string | null;
  syncNotice: string | null;
  setSyncNotice: (msg: string | null) => void;
  syncNow: () => Promise<void>;
  loginUser: (user: any) => Promise<{ success: boolean; error?: string } | void>;
  logout: () => Promise<void>;
  sessionRole: SessionRole;
  permissions: RolePermissions;
  switchSession: (targetRole: SessionRole, passwordOrPin?: string, targetSupervisorId?: string) => Promise<{ success: boolean; error?: string }>;
  hasPermission: (action: keyof RolePermissions) => boolean;
  isSessionModalOpen: boolean;
  setIsSessionModalOpen: (open: boolean) => void;
  targetSessionForModal: SessionRole | null;
  setTargetSessionForModal: (role: SessionRole | null) => void;
  targetSupervisorIdForModal: string | null;
  setTargetSupervisorIdForModal: (id: string | null) => void;
  openSessionModal: (targetRole?: SessionRole, targetSupervisorId?: string) => void;
  currentDeviceId: string;
  currentSessionId: string;
  deviceSessions: DeviceSession[];
  refreshSessions: () => Promise<void>;
  terminateSession: (sessionId: string) => Promise<{ success: boolean }>;
  isDuplicatesModalOpen: boolean;
  setIsDuplicatesModalOpen: (open: boolean) => void;
  isActiveSessionsModalOpen: boolean;
  setIsActiveSessionsModalOpen: (open: boolean) => void;
  duplicateGroups: DuplicateProductGroup[];
  refreshDuplicates: () => DuplicateProductGroup[];
  addSalesRep: (rep: Omit<SalesRep, 'id' | 'createdAt'>) => Promise<SalesRep>;
  updateSalesRep: (id: string, updates: Partial<SalesRep>) => Promise<void>;
  deleteSalesRep: (id: string) => Promise<void>;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const defaultEmptySettings: StoreSettings = {
  storeName: 'برنامج المفكر المحاسبي',
  ownerName: '',
  phone: '',
  address: '',
  currency: 'دينار',
  invoiceFooterNote: 'شكراً لتعاملكم معنا',
  printFormat: 'a4',
  invoiceTemplate: 'classic',
  modernHeader: {
    badgeText: 'قرطاسية',
    fontFamily: 'Amiri',
    rightBannerColor: '#1e40af',
    leftBannerColor: '#ea580c',
    activitiesText: 'لوازم مدرسية - لوازم مكتبية - هدايا - لعب أطفال - دراجات هوائية',
    badgeLeftText: 'جملة',
    badgeRightText: 'مفرد',
    centerIconType: 'preset',
    centerIconPreset: 'stationery',
    showBarcode: true,
    showTelegram: true,
    telegramHandle: '@AAABBB19901192',
    showFacebook: true,
    facebookName: 'قرطاسية عبد الله الاعرجي',
    showWhatsapp: true,
    whatsappNumber: '07756122078 / 07809595747',
    showInstagram: false,
    instagramHandle: '',
    deliveryNote: 'توصيل جميع المحافظات',
  },
  enableWholesale: true,
  showSuperWholesale: true,
  showSpecialPrice: true,
  invoiceShowCartonColumns: true,
  invoiceShowPiecePrice: false,
  quickQuantityEntry: false,
  allowMultiDeviceShifts: true,
  giftCostCounted: true,
  deviceMode: typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop',
  desktopLayout: 'full',
  supervisorPin: '1122',
  defaultSessionOnLaunch: 'employee',
  supervisors: [
    {
      id: 'sup_default_1',
      name: 'المشرف العام',
      pin: '1122',
      canConfigureShifts: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    }
  ],
  presetShifts: [
    {
      id: 'preset_morning',
      name: 'شفت الصباح',
      code: '1111',
      notes: 'شفت العمل الصباحي',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'preset_evening',
      name: 'شفت المساء',
      code: '2222',
      notes: 'شفت العمل المسائي',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
  ],
  enableSalesReps: false,
  salesReps: [],
  defaultShowRepOnInvoice: true,
  repCommissionDefaultType: 'percentage_profit',
  theme: 'dark',
};

const readLastSyncMs = (): number => {
  try {
    const v = parseInt(localStorage.getItem('last_sync_ms') || '', 10);
    return isNaN(v) ? Date.now() : v;
  } catch {
    return Date.now();
  }
};

export const sanitizePayload = <T = any>(obj: T): T => {
  if (obj === null || obj === undefined) return null as any;
  if (obj instanceof Date) return obj.toISOString() as any;
  if (Array.isArray(obj)) return obj.filter(i => i !== undefined).map(i => sanitizePayload(i)) as any;
  if (typeof obj === 'object') {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) clean[k] = sanitizePayload(v);
    }
    return clean as any;
  }
  return obj;
};

export const createDefaultDraftOrder = (orderNumber: number = 1): POSDraftOrder => {
  const d = new Date();
  d.setDate(d.getDate() + 15);
  return {
    id: 'draft_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    orderNumber,
    cartItems: [],
    saleType: 'direct',
    globalPriceType: 'retail',
    selectedCustomerId: '',
    customCustomerName: '',
    customerPhone: '',
    discount: 0,
    paidAmount: 0,
    dueDate: d.toISOString().split('T')[0],
    notes: '',
    updatedAt: new Date().toISOString(),
  };
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const active = localStorage.getItem('active_client_session');
      return active ? JSON.parse(active) : null;
    } catch {
      return null;
    }
  });

  const [authLoading, setAuthLoading] = useState<boolean>(() => {
    try {
      const active = localStorage.getItem('active_client_session');
      return !active;
    } catch {
      return true;
    }
  });

  const deduplicateProducts = (prods: Product[]): Product[] => {
    if (!Array.isArray(prods)) return [];
    const map = new Map<string, Product>();
    for (const p of prods) {
      if (p && p.id) {
        map.set(String(p.id), p);
      }
    }
    return Array.from(map.values());
  };

  const [products, setProductsState] = useState<Product[]>(() => {
    try {
      const cached = localStorage.getItem('cached_pos_products');
      if (cached) {
        const parsed = JSON.parse(cached);
        const clean = deduplicateProducts(parsed);
        if (Array.isArray(parsed) && clean.length !== parsed.length) {
          try {
            localStorage.setItem('cached_pos_products', JSON.stringify(clean));
          } catch {}
        }
        return clean;
      }
      return [];
    } catch {
      return [];
    }
  });

  const setProducts = (action: Product[] | ((prev: Product[]) => Product[])) => {
    setProductsState(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      return deduplicateProducts(next);
    });
  };

  const [customers, setCustomers] = useState<Customer[]>(() => {
    try {
      const cached = localStorage.getItem('cached_pos_customers');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    try {
      const cached = localStorage.getItem('cached_pos_invoices');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [payments, setPayments] = useState<PaymentRecord[]>(() => {
    try {
      const raw = localStorage.getItem('cached_pos_payments');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // سلة المحذوفات وشواهد الحذف (لمنع عودة المحذوف عند المزامنة)
  const [trash, setTrash] = useState<TrashEntry[]>(() => {
    try {
      const raw = localStorage.getItem('cached_pos_trash');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? purgeTrash(parsed) : [];
    } catch {
      return [];
    }
  });
  const [tombstones, setTombstones] = useState<Tombstones>(() => {
    try {
      const raw = localStorage.getItem('cached_pos_tombstones');
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });

  const [shifts, setShifts] = useState<Shift[]>(() => {
    try {
      const activeUser = localStorage.getItem('active_client_session');
      const uid = activeUser ? JSON.parse(activeUser)?.uid : null;
      if (uid) {
        const scopedCached = localStorage.getItem(`cached_pos_shifts_${uid}`);
        if (scopedCached) {
          const parsed = JSON.parse(scopedCached);
          if (Array.isArray(parsed)) {
            return parsed.filter(s => !s.storeUid || s.storeUid === uid);
          }
        }
      }
      const genericCached = localStorage.getItem('cached_pos_shifts');
      if (genericCached) {
        const parsed = JSON.parse(genericCached);
        if (Array.isArray(parsed)) {
          return uid ? parsed.filter(s => !s.storeUid || s.storeUid === uid) : parsed;
        }
      }
      return [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.removeItem('cached_pos_offers');
    } catch {}
  }, []);

  const [currentDeviceId] = useState<string>(() => getOrCreateDeviceId());
  const currentSessionId = useMemo(() => {
    return getOrCreateSessionId(currentUser?.uid || 'local');
  }, [currentUser]);

  const [deviceSessions, setDeviceSessions] = useState<DeviceSession[]>([]);
  const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false);
  const [isActiveSessionsModalOpen, setIsActiveSessionsModalOpen] = useState(false);

  const [sessionRole, setSessionRole] = useState<SessionRole>(() => {
    try {
      const saved = localStorage.getItem('active_session_role') as SessionRole;
      if (saved === 'admin' || saved === 'supervisor' || saved === 'employee') return saved;
    } catch {}
    return 'employee';
  });

  const [activeSupervisorId, setActiveSupervisorId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('active_supervisor_id') || null;
    } catch {
      return null;
    }
  });

  // معرف فريد ومستقل لكل مستخدم لعزل شفته النشطة
  const currentAccountIdentifier = useMemo(() => {
    if (!currentUser) return 'guest';
    if (sessionRole === 'supervisor' && activeSupervisorId) {
      return `${currentUser.uid}_sup_${activeSupervisorId}`;
    }
    return `${currentUser.uid}_${sessionRole}`;
  }, [currentUser, sessionRole, activeSupervisorId]);

  // استخراج الشفت النشط الحالي الخاص بهذا الحساب والمتجر فقط دون التداخل مع غيره
  const [activeShift, setActiveShift] = useState<Shift | null>(() => {
    try {
      const activeUser = localStorage.getItem('active_client_session');
      const uid = activeUser ? JSON.parse(activeUser)?.uid : null;
      const devId = getOrCreateDeviceId();
      const scopedCached = uid ? localStorage.getItem(`cached_pos_active_shift_${uid}_${devId}`) : null;
      const cachedDev = scopedCached || localStorage.getItem(`cached_pos_active_shift_${devId}`);
      if (cachedDev) {
        const parsed = JSON.parse(cachedDev);
        if (parsed?.status === 'active') {
          if (!uid || !parsed.storeUid || parsed.storeUid === uid) {
            return parsed;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  // دالة بث موحدة تستخدم قناة الذاكرة syncChannel
  const broadcastSyncEvent = (type: any, data: any, _sessionId?: string, storeUid?: string) => {
    broadcastSync(type, data, storeUid || currentUser?.uid);
  };

  // المزامنة اللحظية في أقل من ملي ثانية عبر الرام (BroadcastChannel / IPC Relay) بين النوافذ المنفصلة
  useEffect(() => {
    const unsubscribe = subscribeSync((payload: SyncMessage) => {
      // التحقق من المتجر المشغل لضمان عدم التداخل
      if (currentUser?.uid && payload.storeUid && payload.storeUid !== currentUser.uid) {
        return;
      }

      switch (payload.type) {
        case 'INVOICE_CREATED': {
          const { invoice, updatedProducts, updatedShift } = payload.data || {};
          if (invoice) {
            setInvoices(prev => {
              if (prev.some(i => i.id === invoice.id)) return prev;
              const next = [invoice, ...prev];
              try {
                localStorage.setItem('cached_pos_invoices', JSON.stringify(next));
              } catch {}
              return next;
            });
          }

          // خصم كميات المخزن فورياً في النافذة الرئيسية وباقي النوافذ
          if (Array.isArray(updatedProducts)) {
            setProducts(updatedProducts);
            try {
              localStorage.setItem('cached_pos_products', JSON.stringify(updatedProducts));
            } catch {}
          } else if (invoice?.items && Array.isArray(invoice.items)) {
            setProducts(prev => {
              const deductions = new Map<string, number>();
              invoice.items.forEach((it: any) => {
                const qty = Number(it.deductedPieces ?? it.quantity) || 0;
                deductions.set(it.productId, (deductions.get(it.productId) || 0) + qty);
              });
              const next = prev.map(p => {
                const d = deductions.get(p.id);
                if (d && d > 0) {
                  return {
                    ...p,
                    stock: Math.max(0, Math.round((p.stock - d) * 1000) / 1000),
                    updatedAt: new Date().toISOString()
                  };
                }
                return p;
              });
              try {
                localStorage.setItem('cached_pos_products', JSON.stringify(next));
              } catch {}
              return next;
            });
          }

          if (updatedShift) {
            setShifts(prev => {
              const next = prev.map(s => s.id === updatedShift.id ? updatedShift : s);
              if (!prev.some(s => s.id === updatedShift.id)) next.unshift(updatedShift);
              try {
                localStorage.setItem('cached_pos_shifts', JSON.stringify(next));
              } catch {}
              return next;
            });
            setActiveShift(prev => (prev?.id === updatedShift.id ? updatedShift : prev));
          }
          break;
        }

        case 'PRODUCT_SAVED':
        case 'PRODUCT_DELETED':
        case 'PRODUCTS_BATCH_UPDATED': {
          if (Array.isArray(payload.data.allProducts)) {
            setProducts(payload.data.allProducts);
            try {
              localStorage.setItem('cached_pos_products', JSON.stringify(payload.data.allProducts));
            } catch {}
          }
          break;
        }

        case 'STOCK_ADJUSTED': {
          if (Array.isArray(payload.data.updatedProducts)) {
            setProducts(payload.data.updatedProducts);
            try {
              localStorage.setItem('cached_pos_products', JSON.stringify(payload.data.updatedProducts));
            } catch {}
          }
          break;
        }

        case 'INVOICE_DELETED': {
          const { updatedInvoices, restoredProducts } = payload.data;
          if (Array.isArray(updatedInvoices)) {
            setInvoices(updatedInvoices);
            try {
              localStorage.setItem('cached_pos_invoices', JSON.stringify(updatedInvoices));
            } catch {}
          }
          if (Array.isArray(restoredProducts)) {
            setProducts(restoredProducts);
            try {
              localStorage.setItem('cached_pos_products', JSON.stringify(restoredProducts));
            } catch {}
          }
          break;
        }

        case 'SHIFT_UPDATED': {
          const { shift, allShifts } = payload.data;
          if (Array.isArray(allShifts)) {
            setShifts(allShifts);
            try {
              localStorage.setItem('cached_pos_shifts', JSON.stringify(allShifts));
            } catch {}
          }
          if (shift) {
            if (shift.status === 'closed') {
              setActiveShift(prev => (prev?.id === shift.id ? null : prev));
            } else if (shift.status === 'active') {
              setActiveShift(prev => (prev?.id === shift.id ? shift : prev));
            }
          }
          break;
        }

        case 'CUSTOMERS_UPDATED': {
          const { customers: updatedCusts } = payload.data;
          if (Array.isArray(updatedCusts)) {
            setCustomers(updatedCusts);
            try {
              localStorage.setItem('cached_pos_customers', JSON.stringify(updatedCusts));
            } catch {}
          }
          break;
        }

        case 'SETTINGS_UPDATED': {
          const { settings: newSettings } = payload.data;
          if (newSettings) {
            setSettings(prev => ({ ...prev, ...newSettings }));
            try {
              localStorage.setItem('cached_pos_settings', JSON.stringify(newSettings));
            } catch {}
          }
          break;
        }
      }
    });

    return () => unsubscribe();
  }, [currentSessionId, currentUser?.uid]);

  const [isStartShiftModalOpen, setIsStartShiftModalOpen] = useState(false);
  const [isEndShiftModalOpen, setIsEndShiftModalOpen] = useState(false);
  const [selectedShiftForDetails, setSelectedShiftForDetails] = useState<Shift | null>(null);

  const [settings, setSettings] = useState<StoreSettings>(() => {
    try {
      const cached = localStorage.getItem('cached_pos_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.storeName === 'نظام المبيعات والمخزن' || !parsed.storeName) {
          parsed.storeName = 'برنامج المفكر المحاسبي';
        }
        return parsed;
      }
      return defaultEmptySettings;
    } catch {
      return defaultEmptySettings;
    }
  });

  // مزامنة activeShift عند تبديل المستخدم أو الجلسة لضمان عزله التام لكل متجر ولكل حساب
  useEffect(() => {
    if (!currentUser) {
      setActiveShift(null);
      return;
    }

    const currentUid = currentUser.uid;
    const multiDevice = settings.allowMultiDeviceShifts !== false;
    const candidates = shifts.filter(s => {
      if (s.status !== 'active') return false;
      // عند تفعيل الشفتات المتعددة: لا نتبنّى شفتاً فتحه جهاز آخر، لكل جهاز شفته المستقل
      if (multiDevice && s.deviceId && s.deviceId !== currentDeviceId) return false;
      // لا يُعرض شفت لمتجر آخر إطلاقاً
      if (s.storeUid && s.storeUid !== currentUid) return false;
      if (s.openedBy?.uid && s.openedBy.uid.startsWith('user_') && s.openedBy.uid !== currentUid) return false;

      const shiftOpUid = (s as any).operatorId || s.openedBy?.uid;
      const shiftSupId = (s as any).supervisorId;

      if (sessionRole === 'supervisor' && activeSupervisorId) {
        return shiftSupId === activeSupervisorId || shiftOpUid === currentAccountIdentifier;
      }
      return (
        shiftOpUid === currentAccountIdentifier ||
        shiftOpUid === currentUid ||
        (s.openedBy?.role === sessionRole && s.deviceId === currentDeviceId)
      );
    });

    const myActive = candidates.find(s => s.deviceId === currentDeviceId) || candidates[0];
    setActiveShift(myActive || null);
  }, [shifts, currentUser, sessionRole, activeSupervisorId, currentAccountIdentifier, currentDeviceId, settings.allowMultiDeviceShifts]);


  const [storeFeatures, setStoreFeatures] = useState<StoreFeatures>(() => {
    try {
      const cached = localStorage.getItem('cached_pos_features');
      if (cached) return JSON.parse(cached);
      if (settings?.features) return settings.features;
    } catch {}
    return DEFAULT_STORE_FEATURES;
  });

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('mufakir_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      const cachedSettings = localStorage.getItem('cached_pos_settings');
      if (cachedSettings) {
        const parsed = JSON.parse(cachedSettings);
        if (parsed.theme === 'light' || parsed.theme === 'dark') return parsed.theme;
      }
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
    }
    try {
      localStorage.setItem('mufakir_theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      updateSettings({ theme: next });
      return next;
    });
  };

  const [draftOrders, setDraftOrders] = useState<POSDraftOrder[]>(() => {
    try {
      const cached = localStorage.getItem('cached_pos_draft_orders');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [createDefaultDraftOrder(1)];
  });

  const [activeDraftId, setActiveDraftId] = useState<string>(() => {
    try {
      return localStorage.getItem('cached_pos_active_draft_id') || '';
    } catch {
      return '';
    }
  });

  const activeDraft = useMemo(() => {
    if (activeDraftId) {
      const found = draftOrders.find(d => d.id === activeDraftId);
      if (found) return found;
    }
    return draftOrders[0] || createDefaultDraftOrder(1);
  }, [draftOrders, activeDraftId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem('cached_pos_draft_orders', JSON.stringify(draftOrders));
      } catch (e) {}
    }, 250);
    return () => clearTimeout(timer);
  }, [draftOrders]);

  useEffect(() => {
    try {
      if (activeDraft.id) {
        localStorage.setItem('cached_pos_active_draft_id', activeDraft.id);
      }
    } catch (e) {}
  }, [activeDraft.id]);

  const updateActiveDraft = (updates: Partial<POSDraftOrder>) => {
    setDraftOrders(prev => {
      const targetId = activeDraft.id;
      return prev.map(order => {
        if (order.id === targetId) {
          return { ...order, ...updates, updatedAt: new Date().toISOString() };
        }
        return order;
      });
    });
  };

  const addNewDraft = (): string => {
    const usedNumbers = new Set(draftOrders.map(d => d.orderNumber));
    let nextNum = 1;
    while (usedNumbers.has(nextNum)) nextNum++;
    const newOrder = createDefaultDraftOrder(nextNum);
    setDraftOrders(prev => [...prev, newOrder]);
    setActiveDraftId(newOrder.id);
    return newOrder.id;
  };

  const switchToDraft = (id: string) => setActiveDraftId(id);

  const clearCurrentDraft = () => {
    setDraftOrders(prev => {
      const targetId = activeDraft.id;
      return prev.map(order => {
        if (order.id === targetId) {
          const d = new Date();
          d.setDate(d.getDate() + 15);
          return {
            ...order,
            cartItems: [],
            selectedCustomerId: '',
            customCustomerName: '',
            customerPhone: '',
            discount: 0,
            paidAmount: 0,
            dueDate: d.toISOString().split('T')[0],
            notes: '',
            updatedAt: new Date().toISOString(),
          };
        }
        return order;
      });
    });
  };

  const deleteCurrentDraft = () => {
    setDraftOrders(prev => {
      const targetId = activeDraft.id;
      if (prev.length <= 1) {
        const fresh = createDefaultDraftOrder(1);
        setActiveDraftId(fresh.id);
        return [fresh];
      }
      const remaining = prev.filter(order => order.id !== targetId);
      setActiveDraftId(remaining[0].id);
      return remaining;
    });
  };

  const completeActiveDraft = () => deleteCurrentDraft();

  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [targetSessionForModal, setTargetSessionForModal] = useState<SessionRole | null>(null);
  const [targetSupervisorIdForModal, setTargetSupervisorIdForModal] = useState<string | null>(null);

  const openSessionModal = (targetRole?: SessionRole, targetSupervisorId?: string) => {
    setTargetSessionForModal(targetRole || null);
    setTargetSupervisorIdForModal(targetSupervisorId || null);
    setIsSessionModalOpen(true);
  };

  const activeSupervisorName = useMemo(() => {
    if (sessionRole !== 'supervisor') return null;
    if (activeSupervisorId && settings.supervisors) {
      const found = settings.supervisors.find(s => s.id === activeSupervisorId);
      if (found) return found.name;
    }
    return (settings.supervisors && settings.supervisors.length > 0) ? settings.supervisors[0].name : 'المشرف';
  }, [sessionRole, activeSupervisorId, settings.supervisors]);

  useEffect(() => {
    if (storeFeatures?.allowedRoles) {
      if (storeFeatures.allowedRoles[sessionRole] === false) {
        if (storeFeatures.allowedRoles.employee !== false) {
          setSessionRole('employee');
          setActiveSupervisorId(null);
          try {
            localStorage.setItem('active_session_role', 'employee');
            localStorage.removeItem('active_supervisor_id');
          } catch {}
        } else if (storeFeatures.allowedRoles.admin !== false) {
          setSessionRole('admin');
          try {
            localStorage.setItem('active_session_role', 'admin');
          } catch {}
        }
      }
    }
  }, [storeFeatures, sessionRole]);

  const permissions: RolePermissions = useMemo(() => {
    if (sessionRole === 'admin') return DEFAULT_ADMIN_PERMISSIONS;
    if (sessionRole === 'supervisor') {
      const currentSup = (settings.supervisors || []).find(s => s.id === activeSupervisorId);
      const base: RolePermissions = {
        ...DEFAULT_SUPERVISOR_PERMISSIONS,
        ...(settings.supervisorPermissions || {}),
        ...(currentSup?.permissions || {}),
      };
      if (currentSup && typeof currentSup.canConfigureShifts === 'boolean') {
        base.canConfigureShifts = currentSup.canConfigureShifts;
      }
      return base;
    }
    return {
      ...DEFAULT_EMPLOYEE_PERMISSIONS,
      ...(settings.employeePermissions || {}),
    };
  }, [sessionRole, activeSupervisorId, settings.supervisors, settings.supervisorPermissions, settings.employeePermissions]);

  const hasPermission = (action: keyof RolePermissions): boolean => {
    if (sessionRole === 'admin' || currentUser?.role === 'admin') {
      return true;
    }
    if ((action === 'canAccessShifts' || action === 'canManageShifts' || action === 'canConfigureShifts') && storeFeatures?.enableShifts === false) {
      return false;
    }
    if (action === 'canManageSalesReps' && storeFeatures?.enableSalesReps === false) {
      return false;
    }

    // إذا كانت صلاحية سعر التكلفة غير مفعلة، تحجب الأرباح والتقارير المالية تلقائياً
    const canSeeCost = !!permissions.canViewCostPrice;
    if (!canSeeCost && (action === 'canViewCostPrice' || action === 'canViewReports')) {
      return false;
    }

    return !!permissions[action];
  };

  const switchSession = async (
    targetRole: SessionRole,
    passwordOrPin?: string,
    targetSupervisorId?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const isAllowedByPlan = storeFeatures?.allowedRoles?.[targetRole] !== false;
    if (!isAllowedByPlan) {
      return { success: false, error: `تم إلغاء تفعيل هذه الجلسة (${targetRole}) لهذا المتجر من قبل الإدارة العامة.` };
    }

    if (targetRole === 'employee') {
      setSessionRole('employee');
      setActiveSupervisorId(null);
      try {
        localStorage.setItem('active_session_role', 'employee');
        localStorage.removeItem('active_supervisor_id');
      } catch {}
      return { success: true };
    }

    if (targetRole === 'supervisor') {
      const cleanPin = (passwordOrPin || '').trim();
      const isAccountPass = async () => (cleanPin ? verifyAccountPassword(currentUser, cleanPin) : false);
      const supervisorsList = settings.supervisors || [];

      const targetSupId = targetSupervisorId || targetSupervisorIdForModal;
      if (targetSupId) {
        const sup = supervisorsList.find(s => s.id === targetSupId);
        if (sup) {
          if (cleanPin && (cleanPin === sup.pin.trim() || (await isAccountPass()))) {
            setSessionRole('supervisor');
            setActiveSupervisorId(sup.id);
            try {
              localStorage.setItem('active_session_role', 'supervisor');
              localStorage.setItem('active_supervisor_id', sup.id);
            } catch {}
            return { success: true };
          }
          return { success: false, error: `الرمز السري غير صحيح للمشرف (${sup.name})` };
        }
      }

      const matchedSup = supervisorsList.find(s => s.pin && s.pin.trim() === cleanPin);
      if (matchedSup) {
        setSessionRole('supervisor');
        setActiveSupervisorId(matchedSup.id);
        try {
          localStorage.setItem('active_session_role', 'supervisor');
          localStorage.setItem('active_supervisor_id', matchedSup.id);
        } catch {}
        return { success: true };
      }

      const validPin = (settings.supervisorPin || '1122').trim();
      if (cleanPin && (cleanPin === validPin || (await isAccountPass()))) {
        setSessionRole('supervisor');
        const fallbackId = supervisorsList[0]?.id || null;
        setActiveSupervisorId(fallbackId);
        try {
          localStorage.setItem('active_session_role', 'supervisor');
          if (fallbackId) localStorage.setItem('active_supervisor_id', fallbackId);
        } catch {}
        return { success: true };
      }

      return { success: false, error: 'الرمز السري لجلسة المشرف غير صحيح' };
    }

    if (targetRole === 'admin') {
      const cleanPass = (passwordOrPin || '').trim();
      if (!cleanPass) return { success: false, error: 'يرجى إدخال رمز الحساب (كلمة المرور)' };

      if (await verifyAccountPassword(currentUser, cleanPass)) {
        setSessionRole('admin');
        setActiveSupervisorId(null);
        try {
          localStorage.setItem('active_session_role', 'admin');
          localStorage.removeItem('active_supervisor_id');
        } catch {}
        return { success: true };
      }

      return { success: false, error: 'رمز الحساب غير صحيح.' };
    }

    return { success: false, error: 'نوع جلسة غير صالح' };
  };

  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const logout = async () => {
    const prevUid = currentUser?.uid;
    setCurrentUser(null);
    setProducts([]);
    setCustomers([]);
    setInvoices([]);
    setPayments([]);
    setShifts([]);
    setActiveShift(null);
    try {
      localStorage.removeItem('active_client_session');
      localStorage.removeItem('last_active_user_uid');
      localStorage.removeItem('cached_pos_products');
      localStorage.removeItem('cached_pos_customers');
      localStorage.removeItem('cached_pos_invoices');
      localStorage.removeItem('cached_pos_settings');
      localStorage.removeItem('cached_pos_shifts');
      localStorage.removeItem('cached_pos_features');
      localStorage.removeItem(`cached_pos_active_shift_${currentDeviceId}`);
      localStorage.removeItem('cached_pos_active_shift');
      if (prevUid) {
        localStorage.removeItem(`cached_pos_shifts_${prevUid}`);
        localStorage.removeItem(`cached_pos_active_shift_${prevUid}_${currentDeviceId}`);
      }
    } catch (e) {}
    try {
      await supabase.auth.signOut();
    } catch (e) {}
  };

  useEffect(() => {
    if (!currentUser) {
      setAuthLoading(false);
      setShifts([]);
      setActiveShift(null);
      return;
    }
    setAuthLoading(false);

    const currentUid = currentUser.uid;
    const storeDocId = `store_${currentUid}`;

    // تهيئة شفتات هذا المتجر تحديداً من التخزين المحلي المعزول فور تبديل الحساب
    try {
      const scopedShiftsKey = `cached_pos_shifts_${currentUid}`;
      const localScoped = localStorage.getItem(scopedShiftsKey);
      if (localScoped) {
        const parsed = JSON.parse(localScoped);
        if (Array.isArray(parsed)) {
          const cleanLocal = parsed.filter(s => !s.storeUid || s.storeUid === currentUid);
          setShifts(cleanLocal);
        } else {
          setShifts([]);
        }
      } else {
        setShifts([]);
      }
    } catch {
      setShifts([]);
    }

    const loadInitialData = async () => {
      try {
        const storeData = await getDocument('stores', storeDocId);
        if (storeData) {
          applyCloudData(storeData);
          if (storeData.features || storeData.settings?.features) {
            const rawFeats = storeData.features || storeData.settings?.features;
            const mergedFeats: StoreFeatures = {
              ...DEFAULT_STORE_FEATURES,
              ...rawFeats,
              allowedRoles: { ...DEFAULT_STORE_FEATURES.allowedRoles, ...(rawFeats.allowedRoles || {}) }
            };
            setStoreFeatures(mergedFeats);
            try {
              localStorage.setItem('cached_pos_features', JSON.stringify(mergedFeats));
            } catch {}
          }
        }
        setIsCloudConnected(true);
        setLastSyncTime(new Date().toLocaleTimeString('ar-IQ'));
      } catch (err) {
        console.warn('Initial Supabase fetch error:', err);
      }
    };

    loadInitialData();

    const storeSub = subscribeToDocument('stores', storeDocId, (newData) => {
      if (!newData) return;

      if (newData.lastSavedByClient && newData.lastSavedByClient === currentSessionId) {
        setIsCloudConnected(true);
        setLastSyncTime(new Date().toLocaleTimeString('ar-IQ'));
        return;
      }

      applyCloudData(newData);
      if (newData.features || newData.settings?.features) {
        const rawFeats = newData.features || newData.settings?.features;
        const mergedFeats: StoreFeatures = {
          ...DEFAULT_STORE_FEATURES,
          ...rawFeats,
          allowedRoles: { ...DEFAULT_STORE_FEATURES.allowedRoles, ...(rawFeats.allowedRoles || {}) }
        };
        setStoreFeatures(mergedFeats);
        try {
          localStorage.setItem('cached_pos_features', JSON.stringify(mergedFeats));
        } catch {}
      }

      setIsCloudConnected(true);
      setLastSyncTime(new Date().toLocaleTimeString('ar-IQ'));
    });

    return () => {
      storeSub.unsubscribe();
    };
  }, [currentUser, currentSessionId]);

  // آخر حالة محدّثة (لتجنب القيم القديمة داخل المؤقتات)
  const stateRef = useRef<any>({});
  stateRef.current = { ...stateRef.current, products, customers, invoices, shifts, payments, settings, trash, tombstones };

  const lastSyncMsRef = useRef<number>(readLastSyncMs());
  const markSynced = () => {
    lastSyncMsRef.current = Date.now();
    try { localStorage.setItem('last_sync_ms', String(lastSyncMsRef.current)); } catch {}
  };

  const getActorLabel = (): string => {
    const who = activeShift?.openedBy;
    if (who?.name) return `${who.name}${who.role ? ` (${who.role})` : ''}`;
    return currentUser?.email || 'المستخدم';
  };

  // ============ إشعارات التليجرام (تُرسل عبر دالة Supabase، والتوكن محفوظ هناك) ============
  const emitTelegram = (
    event: TelegramEventKey,
    build: (ctx: FmtCtx) => { store?: string; customerId?: string; customer?: string }
  ) => {
    try {
      const tgs = stateRef.current.settings?.telegram;
      if (!tgs || !tgs.enabled || !tgs.secret || !currentUser?.uid) return;
      const ctx: FmtCtx = {
        currency: stateRef.current.settings?.currency || 'د.ع',
        storeName: currentUser?.storeName || currentUser?.displayName || '',
        actor: getActorLabel(),
        includeItems: tgs.includeItems !== false,
        includeProfit: tgs.includeProfit !== false,
      };
      const m = build(ctx);
      const text = tgs.events?.[event] !== false ? m.store : undefined;
      const customerText = tgs.customerNotifications !== false ? m.customer : undefined;
      if (!text && !customerText) return;
      tgNotify({
        storeUid: currentUser.uid,
        secret: tgs.secret,
        text,
        customerId: m.customerId,
        customerText,
      }).catch(() => {});
    } catch {}
  };

  // دمج النسخة المحلية مع السحابية: الأحدث يفوز عند التعارض، وغير المتعارض يُدمج،
  // والنسخة الخاسرة تُحفظ في سلة المحذوفات للاستعادة.
  const computeMerge = (snap: any, cloud: any) => {
    const since = lastSyncMsRef.current || 0;
    const tombs = mergeTombstones(snap.tombstones, cloud?.tombstones);
    const conflicts: TrashEntry[] = [];
    const track = (section: SyncSection, label: (x: any) => string, losers: any[]) =>
      losers.forEach(l => conflicts.push(makeTrashEntry(section, l, label(l), 'conflict', 'مزامنة', 'نسخة قديمة استُبدلت عند المزامنة')));

    const prod = mergeCollection<any>(snap.products, cloud?.products || [], tombs.products || {}, since);
    track('products', x => x.name || 'مادة', prod.losers);
    const cust = mergeCollection<any>(snap.customers, cloud?.customers || [], tombs.customers || {}, since);
    track('customers', x => x.name || 'زبون', cust.losers);
    const inv = mergeCollection<any>(snap.invoices, cloud?.invoices || [], tombs.invoices || {}, since);
    track('invoices', x => `${x.invoiceNumber || ''} - ${x.customerName || ''}`, inv.losers);
    inv.merged.sort((x: any, y: any) => new Date(y.date || 0).getTime() - new Date(x.date || 0).getTime());
    const reps = mergeCollection<any>(snap.settings?.salesReps || [], cloud?.settings?.salesReps || [], tombs.reps || {}, since);
    track('reps', x => x.name || 'مندوب', reps.losers);

    // الدفعات: إضافة فقط (دمج بالاتحاد)
    const payMap = new Map<string, any>();
    (cloud?.payments || []).forEach((x: any) => x?.id && payMap.set(String(x.id), x));
    (snap.payments || []).forEach((x: any) => x?.id && payMap.set(String(x.id), x));
    const payments = Array.from(payMap.values()).sort(
      (x: any, y: any) => new Date(y.date || 0).getTime() - new Date(x.date || 0).getTime()
    );

    // الشفتات
    const uid = currentUser?.uid;
    const cleanCloudShifts = (cloud?.shifts || [])
      .filter((sh: any) => {
        if (sh.storeUid && sh.storeUid !== uid) return false;
        if (sh.openedBy?.uid && sh.openedBy.uid.startsWith('user_') && sh.openedBy.uid !== uid) return false;
        return true;
      })
      .map((sh: any) => ({ ...sh, storeUid: uid, storeId: uid }));
    const localShifts = (snap.shifts || []).filter((sh: any) => !sh.storeUid || sh.storeUid === uid);
    const shiftTomb = tombs.shifts || {};
    const shifts = mergeShifts(localShifts, cleanCloudShifts).filter((sh: any) => !shiftTomb[String(sh.id)]);

    const trashMerged = mergeTrash(snap.trash, cloud?.trash, conflicts);
    return { products: prod.merged, customers: cust.merged, invoices: inv.merged, reps: reps.merged, payments, shifts, trash: trashMerged, tombstones: tombs };
  };

  // تطبيق نتيجة الدمج على الحالة والتخزين المحلي
  const applyMergeResult = (r: ReturnType<typeof computeMerge>, takeSettings?: any) => {
    setProducts(r.products);
    setCustomers(r.customers);
    setInvoices(r.invoices as any);
    setPayments(r.payments);
    setShifts(r.shifts);
    setTrash(r.trash);
    setTombstones(r.tombstones);
    setSettings(prev => ({
      ...prev,
      ...(takeSettings || {}),
      salesReps: r.reps,
      invoiceSecret: (takeSettings?.invoiceSecret as string) || prev.invoiceSecret,
    }));
    stateRef.current = {
      ...stateRef.current,
      products: r.products, customers: r.customers, invoices: r.invoices, payments: r.payments,
      shifts: r.shifts, trash: r.trash, tombstones: r.tombstones,
      settings: { ...stateRef.current.settings, ...(takeSettings || {}), salesReps: r.reps },
    };
    try {
      localStorage.setItem('cached_pos_products', JSON.stringify(r.products));
      localStorage.setItem('cached_pos_customers', JSON.stringify(r.customers));
      localStorage.setItem('cached_pos_invoices', JSON.stringify(r.invoices));
      localStorage.setItem('cached_pos_payments', JSON.stringify(r.payments));
      localStorage.setItem('cached_pos_trash', JSON.stringify(r.trash));
      localStorage.setItem('cached_pos_tombstones', JSON.stringify(r.tombstones));
      if (currentUser?.uid) localStorage.setItem(`cached_pos_shifts_${currentUser.uid}`, JSON.stringify(r.shifts));
      localStorage.setItem('cached_pos_shifts', JSON.stringify(r.shifts));
    } catch {}
  };

  const applyCloudData = (cloud: any) => {
    if (!cloud) return;
    const r = computeMerge(stateRef.current, cloud);
    applyMergeResult(r, cloud.settings);
    markSynced();
    return r;
  };

  const pendingCloudSyncRef = useRef<{
    timer: any;
    override: Partial<{
      products: Product[];
      customers: Customer[];
      invoices: Invoice[];
      shifts: Shift[];
      settings: StoreSettings;
      payments: PaymentRecord[];
      __replace: boolean;
    }>;
  }>({ timer: null, override: {} });

  const saveStoreToCloud = async (
    overridePartial?: Partial<{
      products: Product[];
      customers: Customer[];
      invoices: Invoice[];
      shifts: Shift[];
      settings: StoreSettings;
      payments: PaymentRecord[];
      __replace?: boolean;
    }>,
    immediate: boolean = false
  ) => {
    if (!currentUser?.uid) return;
    const storeDocId = `store_${currentUser.uid}`;

    if (overridePartial) {
      Object.assign(pendingCloudSyncRef.current.override, overridePartial);
    }

    const executeUpload = async () => {
      if (!currentUser?.uid) return;
      const merged = { ...pendingCloudSyncRef.current.override };
      pendingCloudSyncRef.current.override = {};

      try {
        const forceReplace = Boolean((merged as any).__replace);
        const snap: any = { ...stateRef.current };
        (['products', 'customers', 'invoices', 'shifts', 'payments', 'settings'] as const).forEach(k => {
          if ((merged as any)[k] !== undefined) snap[k] = (merged as any)[k];
        });

        // اقرأ النسخة السحابية الحالية وادمجها قبل الكتابة حتى لا نمحو تعديلات الأجهزة الأخرى
        let result: ReturnType<typeof computeMerge>;
        if (forceReplace) {
          result = {
            products: snap.products, customers: snap.customers, invoices: snap.invoices,
            reps: snap.settings?.salesReps || [], payments: snap.payments, shifts: snap.shifts,
            trash: snap.trash, tombstones: snap.tombstones,
          } as any;
        } else {
          let cloudNow: any = null;
          try {
            cloudNow = await getDocument('stores', storeDocId);
          } catch {}
          result = computeMerge(snap, cloudNow);
          applyMergeResult(result);
        }

        const rawShifts = result.shifts;
        const storeShifts = rawShifts
          .filter((s: any) => !s.storeUid || s.storeUid === currentUser.uid)
          .map((s: any) => ({ ...s, storeUid: currentUser.uid, storeId: currentUser.uid }));

        const payload = sanitizePayload({
          products: result.products,
          customers: result.customers,
          invoices: result.invoices,
          shifts: storeShifts,
          payments: result.payments,
          settings: { ...snap.settings, salesReps: result.reps },
          trash: result.trash,
          tombstones: result.tombstones,
          offers: [],
          features: storeFeatures,
          lastSavedByClient: currentSessionId,
          updatedAt: new Date().toISOString()
        });

        await setDocument('stores', storeDocId, payload);
        markSynced();
        setIsCloudConnected(true);
        setLastSyncTime(new Date().toLocaleTimeString('ar-IQ'));
      } catch (err) {
        console.warn('Background save notice:', err);
      }
    };

    if (immediate) {
      if (pendingCloudSyncRef.current.timer) {
        clearTimeout(pendingCloudSyncRef.current.timer);
        pendingCloudSyncRef.current.timer = null;
      }
      return executeUpload();
    }

    if (pendingCloudSyncRef.current.timer) {
      clearTimeout(pendingCloudSyncRef.current.timer);
    }
    pendingCloudSyncRef.current.timer = setTimeout(() => {
      pendingCloudSyncRef.current.timer = null;
      executeUpload();
    }, 450);
  };

  const syncNow = async () => {
    if (!currentUser?.uid) return;
    setIsSyncing(true);
    setSyncNotice('جاري المزامنة مع السحابة...');
    try {
      const storeDocId = `store_${currentUser.uid}`;
      const cloudData = await getDocument('stores', storeDocId);
      if (cloudData) {
        applyCloudData(cloudData);

        if (cloudData.features || cloudData.settings?.features) {
          const rawFeats = cloudData.features || cloudData.settings?.features;
          const mergedFeats: StoreFeatures = {
            ...DEFAULT_STORE_FEATURES,
            ...rawFeats,
            allowedRoles: { ...DEFAULT_STORE_FEATURES.allowedRoles, ...(rawFeats.allowedRoles || {}) }
          };
          setStoreFeatures(mergedFeats);
          try {
            localStorage.setItem('cached_pos_features', JSON.stringify(mergedFeats));
          } catch {}
        }

        await saveStoreToCloud(undefined, true);
      } else {
        await saveStoreToCloud(undefined, true);
      }
      setIsCloudConnected(true);
      setLastSyncTime(new Date().toLocaleTimeString('ar-IQ'));
      setSyncNotice('✅ اكتملت المزامنة بنجاح.');
      setTimeout(() => setSyncNotice(null), 3500);
    } catch {
      setIsCloudConnected(false);
      setSyncNotice('تعذر الاتصال بالسحابة، يرجى فحص الإنترنت.');
      setTimeout(() => setSyncNotice(null), 3500);
    } finally {
      setIsSyncing(false);
    }
  };

  const makeStockLog = (qty: number, type: 'purchase' | 'adjust', note?: string): StockLogEntry => ({
    id: 'sl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    date: new Date().toISOString(),
    qty,
    type,
    ...(note ? { note } : {}),
  });
  const appendStockLog = (log: StockLogEntry[] | undefined, entry: StockLogEntry): StockLogEntry[] =>
    [...(log || []), entry].slice(-500);

  const addProduct = (prodData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Product => {
    const now = new Date().toISOString();
    const newId = 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const currentUid = currentUser?.uid || 'offline_store';

    const newProduct: Product = {
      ...prodData,
      id: newId,
      ownerUid: currentUid,
      code: prodData.code?.trim() || `${1000 + products.length + 1}`,
      createdAt: (prodData as any).createdAt || now,
      updatedAt: now,
    };
    if ((newProduct.stock || 0) > 0 && !(newProduct.purchaseLog && newProduct.purchaseLog.length)) {
      newProduct.purchaseLog = [makeStockLog(newProduct.stock, 'purchase', 'رصيد أولي')];
    }

    const updated = [newProduct, ...products];
    setProducts(updated);
    try {
      localStorage.setItem('cached_pos_products', JSON.stringify(updated));
    } catch {}
    saveStoreToCloud({ products: updated });
    broadcastSyncEvent('PRODUCT_SAVED', { product: newProduct, allProducts: updated }, currentSessionId, currentUser?.uid);
    emitTelegram('productAdded', ctx => ({ store: formatProductEvent('added', newProduct, ctx) }));
    return newProduct;
  };

  const addBulkProducts = async (itemsData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[], onProgress?: (curr: number, total: number) => void) => {
    const now = new Date().toISOString();
    const created: Product[] = [];
    const currentUid = currentUser?.uid || '';

    for (let i = 0; i < itemsData.length; i++) {
      const item = itemsData[i];
      const newId = 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + '_' + i;
      created.push({
        ...item,
        id: newId,
        ownerUid: (item as any).ownerUid || currentUid,
        createdAt: (item as any).createdAt || now,
        updatedAt: now,
      });
      if (onProgress && i % 100 === 0) onProgress(i, itemsData.length);
    }

    const updated = [...created, ...products];
    setProducts(updated);
    try {
      localStorage.setItem('cached_pos_products', JSON.stringify(updated));
    } catch {}
    await saveStoreToCloud({ products: updated });
    broadcastSyncEvent('PRODUCTS_BATCH_UPDATED', { allProducts: updated }, currentSessionId, currentUser?.uid);
    return { success: true, count: created.length, products: created };
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    const beforeProduct = products.find(p => p.id === id);
    const finalUpdates: Partial<Product> = { ...updates, updatedAt: new Date().toISOString() };
    if (beforeProduct && typeof updates.stock === 'number' && !updates.purchaseLog) {
      const diff = Math.round((updates.stock - (beforeProduct.stock || 0)) * 1000) / 1000;
      if (diff !== 0) {
        finalUpdates.purchaseLog = appendStockLog(
          beforeProduct.purchaseLog,
          makeStockLog(Math.abs(diff), diff > 0 ? 'purchase' : 'adjust', 'تعديل المادة')
        );
      }
    }
    const updated = products.map(p => p.id === id ? { ...p, ...finalUpdates } : p);
    setProducts(updated);
    try {
      localStorage.setItem('cached_pos_products', JSON.stringify(updated));
    } catch {}
    saveStoreToCloud({ products: updated });
    broadcastSyncEvent('PRODUCT_SAVED', { product: finalUpdates, allProducts: updated }, currentSessionId, currentUser?.uid);
    if (beforeProduct) {
      const afterProduct = { ...beforeProduct, ...finalUpdates };
      const includeCost = stateRef.current.settings?.telegram?.includeProfit !== false;
      const changes = diffProduct(beforeProduct, afterProduct, includeCost);
      if (changes.length > 0) {
        emitTelegram('productEdited', ctx => ({ store: formatProductEvent('edited', afterProduct, ctx, changes) }));
      }
    }
  };

  // ============ سلة المحذوفات ============
  const persistTrash = (nextTrash: TrashEntry[], nextTombs: Tombstones) => {
    setTrash(nextTrash);
    setTombstones(nextTombs);
    stateRef.current = { ...stateRef.current, trash: nextTrash, tombstones: nextTombs };
    try {
      localStorage.setItem('cached_pos_trash', JSON.stringify(nextTrash));
      localStorage.setItem('cached_pos_tombstones', JSON.stringify(nextTombs));
    } catch {}
  };

  const moveToTrash = (section: SyncSection, items: any[], labelOf: (x: any) => string, details?: string) => {
    if (!items || items.length === 0) return;
    const nowIso = new Date().toISOString();
    const actor = getActorLabel();
    const entries = items.map(it => makeTrashEntry(section, it, labelOf(it), 'deleted', actor, details));
    const tombs: Tombstones = { ...stateRef.current.tombstones };
    const secMap = { ...(tombs[section] || {}) };
    items.forEach(it => { secMap[String(it.id)] = nowIso; });
    tombs[section] = secMap;
    persistTrash(mergeTrash(entries, stateRef.current.trash), tombs);
  };

  const cleanTombstone = (section: SyncSection, id: string, tombs: Tombstones): Tombstones => {
    const sec = { ...(tombs[section] || {}) };
    delete sec[id];
    return { ...tombs, [section]: sec };
  };

  const restoreTrashEntry = (entryId: string): boolean => {
    const entry: TrashEntry | undefined = stateRef.current.trash.find((e: TrashEntry) => e.id === entryId);
    if (!entry) return false;
    const now = new Date().toISOString();
    const data = { ...entry.data, updatedAt: now };
    let tombs = cleanTombstone(entry.section, entry.entityId, stateRef.current.tombstones);
    let nextTrash = stateRef.current.trash.filter((e: TrashEntry) => e.id !== entryId);
    const swapOut = (existing: any, label: string) => {
      if (existing) {
        nextTrash = mergeTrash(
          [makeTrashEntry(entry.section, existing, label, 'conflict', getActorLabel(), 'نسخة حالية استُبدلت عند الاستعادة')],
          nextTrash
        );
      }
    };

    if (entry.section === 'products') {
      const existing = products.find(p => p.id === entry.entityId);
      swapOut(existing, entry.label);
      const updated = [data as Product, ...products.filter(p => p.id !== entry.entityId)];
      setProducts(updated);
      try { localStorage.setItem('cached_pos_products', JSON.stringify(updated)); } catch {}
      persistTrash(nextTrash, tombs);
      saveStoreToCloud({ products: updated });
    } else if (entry.section === 'customers') {
      const existing = customers.find(c => c.id === entry.entityId);
      swapOut(existing, entry.label);
      const updated = [data as Customer, ...customers.filter(c => c.id !== entry.entityId)];
      setCustomers(updated);
      try { localStorage.setItem('cached_pos_customers', JSON.stringify(updated)); } catch {}
      persistTrash(nextTrash, tombs);
      saveStoreToCloud({ customers: updated });
    } else if (entry.section === 'invoices') {
      const existing = invoices.find(i => i.id === entry.entityId);
      swapOut(existing, entry.label);
      const inv: any = data;
      // استعادة قائمة محذوفة: إعادة خصم المخزون وإعادة الدين الذي أضافته
      if (entry.reason === 'deleted' && !existing) {
        (inv.items || []).forEach((it: any) => {
          if (inv.status !== 'returned') adjustStock(it.productId, -(it.deductedPieces ?? it.quantity));
        });
        if (inv.debtApplied && inv.customerId && inv.status !== 'returned' && inv.remainingAmount > 0) {
          const custs = customers.map(c =>
            c.id === inv.customerId ? { ...c, updatedAt: now, totalDebt: (Number(c.totalDebt) || 0) + inv.remainingAmount } : c
          );
          setCustomers(custs);
          try { localStorage.setItem('cached_pos_customers', JSON.stringify(custs)); } catch {}
          saveStoreToCloud({ customers: custs });
        }
      }
      const updated = [inv as Invoice, ...invoices.filter(i => i.id !== entry.entityId)];
      setInvoices(updated);
      try { localStorage.setItem('cached_pos_invoices', JSON.stringify(updated)); } catch {}
      persistTrash(nextTrash, tombs);
      saveStoreToCloud({ invoices: updated });
    } else if (entry.section === 'shifts') {
      const updated = [data as any as Shift, ...shifts.filter(sh => sh.id !== entry.entityId)];
      setShifts(updated);
      try {
        if (currentUser?.uid) localStorage.setItem(`cached_pos_shifts_${currentUser.uid}`, JSON.stringify(updated));
        localStorage.setItem('cached_pos_shifts', JSON.stringify(updated));
      } catch {}
      persistTrash(nextTrash, tombs);
      saveStoreToCloud({ shifts: updated });
    } else if (entry.section === 'reps') {
      const reps = settings.salesReps || [];
      swapOut(reps.find(r => r.id === entry.entityId), entry.label);
      persistTrash(nextTrash, tombs);
      updateSettings({ salesReps: [data as any, ...reps.filter(r => r.id !== entry.entityId)] });
    } else {
      persistTrash(nextTrash, tombs);
    }
    saveStoreToCloud(undefined);
    emitTelegram('trashRestored', ctx => ({
      store: formatSimple('♻️ <b>استعادة من سلة المحذوفات</b>', [
        `العنصر: ${tgEsc(entry.label)}`,
        `القسم: ${tgEsc(entry.section)}`,
        `🧑‍💼 المنفذ: ${tgEsc(ctx.actor || '')}`,
      ], ctx),
    }));
    return true;
  };

  const purgeTrashEntry = (entryId: string) => {
    persistTrash(stateRef.current.trash.filter((e: TrashEntry) => e.id !== entryId), stateRef.current.tombstones);
    saveStoreToCloud(undefined);
  };

  const emptyTrash = (sections?: SyncSection[]) => {
    const keep = stateRef.current.trash.filter((e: TrashEntry) => sections && !sections.includes(e.section));
    persistTrash(keep, stateRef.current.tombstones);
    saveStoreToCloud(undefined);
  };

  // تنظيف تلقائي: حذف ما مضى عليه أكثر من 3 أيام
  useEffect(() => {
    const run = () => {
      const cur: TrashEntry[] = stateRef.current.trash || [];
      const cleaned = purgeTrash(cur);
      if (cleaned.length !== cur.length) {
        persistTrash(cleaned, stateRef.current.tombstones);
        saveStoreToCloud(undefined);
      }
    };
    run();
    const t = setInterval(run, 60 * 60 * 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.uid]);

  const deleteProduct = (id: string) => {
    moveToTrash('products', products.filter(p => p.id === id), x => x.name || 'مادة');
    products.filter(p => p.id === id).forEach(dp => emitTelegram('productDeleted', ctx => ({ store: formatProductEvent('deleted', dp, ctx) })));
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    try {
      localStorage.setItem('cached_pos_products', JSON.stringify(updated));
    } catch {}
    saveStoreToCloud({ products: updated });
    broadcastSyncEvent('PRODUCT_DELETED', { productId: id, allProducts: updated }, currentSessionId, currentUser?.uid);
  };

  const batchDeleteProducts = async (
    productIdsToDelete: string[],
    stockIncrements?: Record<string, number>
  ): Promise<{ success: boolean; deletedCount: number; error?: string }> => {
    if (!productIdsToDelete || productIdsToDelete.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    try {
      const deleteSet = new Set(productIdsToDelete);
      const increments = stockIncrements || {};
      moveToTrash('products', products.filter(p => deleteSet.has(p.id)), x => x.name || 'مادة');
      const deletedList = products.filter(p => deleteSet.has(p.id));
      if (deletedList.length === 1) {
        emitTelegram('productDeleted', ctx => ({ store: formatProductEvent('deleted', deletedList[0], ctx) }));
      } else if (deletedList.length > 1) {
        emitTelegram('productDeleted', ctx => ({
          store: formatSimple('🗑️ <b>حذف مواد</b>', [
            `🧑‍💼 المنفذ: ${tgEsc(ctx.actor || '')}`,
            `العدد: ${deletedList.length}`,
            ...deletedList.slice(0, 40).map(d => `• ${tgEsc(d.name)} (${tgEsc(d.code)})`),
            deletedList.length > 40 ? `… و${deletedList.length - 40} أخرى` : '',
            'ℹ️ نُقلت إلى سلة المحذوفات (3 أيام).',
          ], ctx),
        }));
      }

      const updatedProducts = products
        .filter(p => !deleteSet.has(p.id))
        .map(p => {
          const inc = increments[p.id];
          if (inc && inc > 0) {
            return {
              ...p,
              stock: Math.max(0, Math.round(((p.stock || 0) + inc) * 1000) / 1000),
              updatedAt: new Date().toISOString()
            };
          }
          return p;
        });

      const deletedCount = products.length - updatedProducts.length;

      setProducts(updatedProducts);
      try {
        localStorage.setItem('cached_pos_products', JSON.stringify(updatedProducts));
      } catch {}

      await saveStoreToCloud({ products: updatedProducts });
      broadcastSyncEvent('PRODUCTS_BATCH_UPDATED', { allProducts: updatedProducts }, currentSessionId, currentUser?.uid);
      return { success: true, deletedCount };
    } catch (err: any) {
      return { success: false, deletedCount: 0, error: err?.message || 'حدث خطأ أثناء الحذف' };
    }
  };

  const adjustStock = (id: string, delta: number, opts?: { log?: boolean }) => {
    setProducts(prev => {
      const t = prev.find(p => p.id === id);
      if (!t) return prev;
      const newStock = Math.max(0, Math.round((t.stock + delta) * 1000) / 1000);
      const realDiff = Math.round((newStock - t.stock) * 1000) / 1000;
      const logged = opts?.log && realDiff !== 0
        ? appendStockLog(t.purchaseLog, makeStockLog(Math.abs(realDiff), realDiff > 0 ? 'purchase' : 'adjust', 'تعديل من المخزن'))
        : t.purchaseLog;
      const updated = prev.map(p => p.id === id ? { ...p, stock: newStock, ...(logged ? { purchaseLog: logged } : {}), updatedAt: new Date().toISOString() } : p);
      try {
        localStorage.setItem('cached_pos_products', JSON.stringify(updated));
      } catch {}
      saveStoreToCloud({ products: updated });
      broadcastSyncEvent('STOCK_ADJUSTED', { productId: id, delta, updatedProducts: updated }, currentSessionId, currentUser?.uid);
      return updated;
    });
  };

  const addCustomer = (data: Omit<Customer, 'id' | 'createdAt' | 'totalDebt'> & { initialDebt?: number }) => {
    const newId = 'cust_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newCust: any = {
      id: newId,
      ownerUid: currentUser?.uid || '',
      name: data.name.trim(),
      phone: data.phone.trim(),
      address: data.address?.trim() || '',
      totalDebt: data.initialDebt || 0,
      notes: data.notes?.trim() || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newCust, ...customers];
    setCustomers(updated);
    try {
      localStorage.setItem('cached_pos_customers', JSON.stringify(updated));
    } catch {}
    saveStoreToCloud({ customers: updated });
    broadcastSyncEvent('CUSTOMERS_UPDATED', { customers: updated }, currentSessionId, currentUser?.uid);
    emitTelegram('customerAdded', ctx => ({
      store: formatSimple('👤 <b>إضافة زبون</b>', [
        `الاسم: ${tgEsc(newCust.name)}${newCust.phone ? ` — ${tgEsc(newCust.phone)}` : ''}`,
        newCust.address ? `العنوان: ${tgEsc(newCust.address)}` : '',
        newCust.totalDebt ? `دين افتتاحي: ${newCust.totalDebt.toLocaleString()} ${tgEsc(ctx.currency)}` : '',
        `🧑‍💼 المنفذ: ${tgEsc(ctx.actor || '')}`,
      ], ctx),
    }));
    return newCust;
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    const updated = customers.map(c => c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c);
    setCustomers(updated);
    try {
      localStorage.setItem('cached_pos_customers', JSON.stringify(updated));
    } catch {}
    saveStoreToCloud({ customers: updated });
    broadcastSyncEvent('CUSTOMERS_UPDATED', { customers: updated }, currentSessionId, currentUser?.uid);
  };

  const deleteCustomer = (id: string) => {
    moveToTrash('customers', customers.filter(c => c.id === id), x => x.name || 'زبون', 'يشمل رصيد الدين وقت الحذف');
    customers.filter(c => c.id === id).forEach(dc => emitTelegram('customerDeleted', ctx => ({
      store: formatSimple('🗑️ <b>حذف زبون</b>', [
        `👤 ${tgEsc(dc.name)}${dc.phone ? ` — ${tgEsc(dc.phone)}` : ''}`,
        `دينه وقت الحذف: ${Number(dc.totalDebt || 0).toLocaleString()} ${tgEsc(ctx.currency)}`,
        `🧑‍💼 المنفذ: ${tgEsc(ctx.actor || '')}`,
        'ℹ️ نُقل إلى سلة المحذوفات (3 أيام).',
      ], ctx),
    })));
    const updated = customers.filter(c => c.id !== id);
    setCustomers(updated);
    try {
      localStorage.setItem('cached_pos_customers', JSON.stringify(updated));
    } catch {}
    saveStoreToCloud({ customers: updated });
    broadcastSyncEvent('CUSTOMERS_UPDATED', { customers: updated }, currentSessionId, currentUser?.uid);
  };

  const createInvoice = (data: CreateInvoiceInput) => {
    const now = new Date().toISOString();
    const newId = 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    let subtotal = 0;
    let totalCost = 0;

    // خيار: هل تُحسب تكلفة الهدايا ضمن الأرباح (الافتراضي: نعم)
    const giftCostCounted = settings.giftCostCounted !== false;
    const items = data.items.map((i: InvoiceItem) => {
      const cost = i.isGift && !giftCostCounted ? 0 : i.costPrice;
      const lineNet = Math.max(0, i.unitPrice * i.quantity - (i.discount || 0));
      subtotal += lineNet;
      totalCost += cost * i.quantity;
      return { ...i, costPrice: cost, subtotal: lineNet };
    });

    const total = Math.max(0, subtotal - (data.discount || 0));
    const paidAmount = data.type === 'direct' ? total : (data.paidAmount || 0);
    const remainingAmount = Math.max(0, total - paidAmount);
    const status: InvoiceStatus = remainingAmount === 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'unpaid';

    const rawNetProfit = total - totalCost;

    let salesRepId: string | undefined = data.salesRepId;
    let salesRepName: string | undefined = data.salesRepName;
    let salesRepCommission = 0;
    let storeNetProfit = rawNetProfit;
    let showRepOnInvoice = data.showRepOnInvoice ?? true;

    if (salesRepId && settings.salesReps) {
      const rep = settings.salesReps.find(r => r.id === salesRepId);
      if (rep) {
        salesRepName = rep.name;
        if (data.showRepOnInvoice !== undefined) {
          showRepOnInvoice = data.showRepOnInvoice;
        } else if (rep.showOnInvoice !== undefined) {
          showRepOnInvoice = rep.showOnInvoice;
        } else {
          showRepOnInvoice = settings.defaultShowRepOnInvoice ?? true;
        }

        const type = rep.commissionType || settings.repCommissionDefaultType || 'percentage_profit';
        if (type === 'percentage_sales') {
          salesRepCommission = Math.round((total * (rep.commissionRate || 0)) / 100);
        } else if (type === 'fixed_per_invoice') {
          salesRepCommission = Math.round(Math.max(0, rep.commissionRate || 0));
        } else if (type === 'fixed_per_piece') {
          const pieces = items.reduce((sum: number, it: any) => sum + (it.isGift ? 0 : (it.deductedPieces ?? it.quantity ?? 0)), 0);
          salesRepCommission = Math.round(Math.max(0, pieces * (rep.commissionRate || 0)));
        } else {
          salesRepCommission = Math.round(Math.max(0, (rawNetProfit * (rep.commissionRate || 0)) / 100));
        }
        storeNetProfit = Math.max(0, rawNetProfit - salesRepCommission);
      }
    }

    // الدين السابق للزبون المسجل قبل هذه القائمة، ويُضاف إليه الباقي من هذه القائمة
    const debtCustomer = data.customerId ? customers.find(c => c.id === data.customerId) : undefined;
    const previousDebt = debtCustomer ? Math.max(0, Number(debtCustomer.totalDebt) || 0) : 0;
    const currentTotalDebt = previousDebt + remainingAmount;

    // بصمة التحقق الخاصة بالمتجر
    let storeSecret = settings.invoiceSecret;
    if (!storeSecret) {
      storeSecret = generateStoreSecret();
      updateSettings({ invoiceSecret: storeSecret });
    }
    // رقم القائمة يحمل رمز المتجر الخاص: INV-<رمز المتجر>-<السنة>-<تسلسل>
    // فلا يستطيع متجر آخر إنشاء قائمة بنفس الرقم. التسلسل = أعلى رقم موجود + 1 (لا يتكرر بعد الحذف).
    const storeCodeNew = getStoreCode(storeSecret);
    const numberPrefix = `INV-${storeCodeNew}-${new Date().getFullYear()}-`;
    const lastSeq = invoices.reduce((mx, i) => {
      const n = String(i.invoiceNumber || '');
      if (!n.startsWith(numberPrefix)) return mx;
      const v = parseInt(n.slice(numberPrefix.length), 10);
      return isNaN(v) ? mx : Math.max(mx, v);
    }, 0);
    const invoiceNumberNew = `${numberPrefix}${String(lastSeq + 1).padStart(4, '0')}`;
    const customerNameNew = data.customerName || (data.type === 'direct' ? 'زبون نقدي مباشر' : 'عميل غير مسجل');
    const sealNew = computeInvoiceSeal(storeSecret, {
      invoiceNumber: invoiceNumberNew,
      total,
      date: now,
      customerName: customerNameNew,
      itemsCount: items.length,
    });

    const newInv: any = {
      id: newId,
      storeCode: storeCodeNew,
      seal: sealNew,
      ownerUid: currentUser?.uid || '',
      invoiceNumber: invoiceNumberNew,
      date: now,
      createdAt: now,
      updatedAt: now,
      type: data.type,
      customerId: data.customerId || '',
      customerName: data.customerName || (data.type === 'direct' ? 'زبون نقدي مباشر' : 'عميل غير مسجل'),
      customerPhone: data.customerPhone || '',
      items,
      showDiscountColumn: data.showDiscountColumn === true,
      showGiftColumn: data.showGiftColumn === true,
      subtotal,
      discount: data.discount || 0,
      total,
      paidAmount,
      remainingAmount,
      previousDebt,
      currentTotalDebt,
      // يدل على أن الباقي أُضيف فعلاً إلى رصيد الزبون (لتصحيح الرصيد عند حذف القائمة)
      debtApplied: Boolean(debtCustomer && remainingAmount > 0),
      paymentDueDate: data.paymentDueDate || '',
      status,
      notes: data.notes || '',
      totalCost,
      netProfit: rawNetProfit,
      shiftId: activeShift ? activeShift.id : undefined,
      salesRepId: salesRepId || undefined,
      salesRepName: salesRepName || undefined,
      salesRepCommission,
      storeNetProfit,
      showRepOnInvoice,
    };

    const deductionsMap = new Map<string, number>();
    items.forEach(i => {
      const delta = (i.deductedPieces ?? i.quantity);
      deductionsMap.set(i.productId, (deductionsMap.get(i.productId) || 0) + delta);
    });

    const updatedProducts = products.map(p => {
      const deduct = deductionsMap.get(p.id);
      if (deduct && deduct > 0) {
        return {
          ...p,
          stock: Math.max(0, Math.round((p.stock - deduct) * 1000) / 1000),
          updatedAt: now,
        };
      }
      return p;
    });
    setProducts(updatedProducts);
    try {
      localStorage.setItem('cached_pos_products', JSON.stringify(updatedProducts));
    } catch {}

    const updatedInvoices = [newInv, ...invoices];
    setInvoices(updatedInvoices);
    try {
      localStorage.setItem('cached_pos_invoices', JSON.stringify(updatedInvoices));
    } catch {}

    let updatedShiftsList = shifts;
    let liveUpdatedShift: Shift | null = null;
    if (activeShift) {
      const currentUid = currentUser?.uid;
      const updatedShift: Shift = {
        ...activeShift,
        storeUid: currentUid || activeShift.storeUid,
        storeId: currentUid || activeShift.storeId,
        invoicesCount: (activeShift.invoicesCount || 0) + 1,
        invoicesIds: [...(activeShift.invoicesIds || []), newId],
        totalSales: (activeShift.totalSales || 0) + total,
        totalPaid: (activeShift.totalPaid || 0) + paidAmount,
        totalRemaining: (activeShift.totalRemaining || 0) + remainingAmount,
        totalCost: (activeShift.totalCost || 0) + totalCost,
        totalProfit: (activeShift.totalProfit || 0) + (total - totalCost),
      };
      liveUpdatedShift = updatedShift;
      setActiveShift(updatedShift);
      updatedShiftsList = shifts.map(s => s.id === updatedShift.id ? updatedShift : s);
      setShifts(updatedShiftsList);
      try {
        if (currentUid) {
          localStorage.setItem(`cached_pos_active_shift_${currentUid}_${currentDeviceId}`, JSON.stringify(updatedShift));
          localStorage.setItem(`cached_pos_shifts_${currentUid}`, JSON.stringify(updatedShiftsList));
        }
        localStorage.setItem(`cached_pos_active_shift_${currentDeviceId}`, JSON.stringify(updatedShift));
        localStorage.setItem('cached_pos_shifts', JSON.stringify(updatedShiftsList));
      } catch {}
    }

    // إضافة الباقي (الدين الجديد) إلى مجموع دين الزبون السابق
    let updatedCustomersList = customers;
    if (debtCustomer && remainingAmount > 0) {
      updatedCustomersList = customers.map(c =>
        c.id === debtCustomer.id ? { ...c, updatedAt: new Date().toISOString(), totalDebt: previousDebt + remainingAmount } : c
      );
      setCustomers(updatedCustomersList);
      try {
        localStorage.setItem('cached_pos_customers', JSON.stringify(updatedCustomersList));
      } catch {}
    }

    saveStoreToCloud({
      products: updatedProducts,
      invoices: updatedInvoices,
      shifts: updatedShiftsList,
      ...(updatedCustomersList !== customers ? { customers: updatedCustomersList } : {}),
    });
    if (updatedCustomersList !== customers) {
      broadcastSyncEvent('CUSTOMERS_UPDATED', { customers: updatedCustomersList }, currentSessionId, currentUser?.uid);
    }

    emitTelegram('invoiceSold', ctx => ({
      store: formatInvoice(newInv, ctx, '🛒 <b>بيع قائمة</b>'),
      customerId: newInv.customerId,
      customer: newInv.customerId ? formatInvoice(newInv, ctx, '🧾 <b>قائمة جديدة على حسابك</b>', true) : undefined,
    }));
    if (newInv.customerId && newInv.remainingAmount > 0) {
      emitTelegram('creditSale', ctx => ({
        store: formatSimple('💳 <b>بيع بالدين</b>', [
          `👤 الزبون: ${tgEsc(newInv.customerName)}`,
          `🧾 القائمة: <code>${tgEsc(newInv.invoiceNumber)}</code>`,
          `الدين القديم: ${newInv.previousDebt.toLocaleString()} ${tgEsc(ctx.currency)}`,
          `أُضيف عليه: <b>${newInv.remainingAmount.toLocaleString()} ${tgEsc(ctx.currency)}</b>`,
          `إجمالي دينه الآن: <b>${newInv.currentTotalDebt.toLocaleString()} ${tgEsc(ctx.currency)}</b>`,
          newInv.paymentDueDate ? `📅 الاستحقاق: ${tgEsc(newInv.paymentDueDate)}` : '',
          `🧑‍💼 المنفذ: ${tgEsc(ctx.actor || '')}`,
        ], ctx),
      }));
    }

    // بث فوري في الذاكرة (<1ms) لتحديث كميات المخزن والقوائم والشفت في جميع النوافذ المفتوحة
    broadcastSyncEvent('INVOICE_CREATED', {
      invoice: newInv,
      updatedProducts,
      updatedShift: liveUpdatedShift
    }, currentSessionId, currentUser?.uid);

    return newInv;
  };

  const deleteInvoice = (id: string) => {
    if (!hasPermission('canDeleteInvoice')) {
      setSyncNotice('⚠️ لا تملك صلاحية حذف الفواتير.');
      setTimeout(() => setSyncNotice(null), 4000);
      return;
    }
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;
    moveToTrash('invoices', [inv], x => `${x.invoiceNumber || ''} - ${x.customerName || ''}`);
    emitTelegram('invoiceDeleted', ctx => ({ store: formatDeletedInvoice(inv, ctx) }));
    inv.items.forEach(i => adjustStock(i.productId, i.deductedPieces ?? i.quantity));
    const updated = invoices.filter(i => i.id !== id);
    setInvoices(updated);
    try {
      localStorage.setItem('cached_pos_invoices', JSON.stringify(updated));
    } catch {}

    // إرجاع الدين الذي أضافته هذه القائمة (للقوائم المسجلة بعد إصلاح الدين فقط)
    let customersAfterDelete = customers;
    if ((inv as any).debtApplied && inv.customerId && inv.status !== 'returned' && inv.remainingAmount > 0) {
      customersAfterDelete = customers.map(c =>
        c.id === inv.customerId ? { ...c, updatedAt: new Date().toISOString(), totalDebt: Math.max(0, (c.totalDebt || 0) - inv.remainingAmount) } : c
      );
      setCustomers(customersAfterDelete);
      try {
        localStorage.setItem('cached_pos_customers', JSON.stringify(customersAfterDelete));
      } catch {}
    }
    saveStoreToCloud(customersAfterDelete !== customers ? { invoices: updated, customers: customersAfterDelete } : { invoices: updated });
    broadcastSyncEvent('INVOICE_DELETED', { invoiceId: id, updatedInvoices: updated }, currentSessionId, currentUser?.uid);
  };

  const returnInvoice = async (id: string, reason?: string): Promise<boolean> => {
    if (!hasPermission('canReturnInvoice')) {
      setSyncNotice('⚠️ لا تملك صلاحية استرجاع الفواتير.');
      setTimeout(() => setSyncNotice(null), 4000);
      return false;
    }
    const inv = invoices.find(i => i.id === id);
    if (!inv || inv.status === 'returned') return false;

    inv.items.forEach(i => {
      const alreadyReturned = i.returnedQuantity || 0;
      const unreturned = Math.max(0, i.quantity - alreadyReturned);
      if (unreturned > 0) {
        const factor = (i.unitType === 'carton' && i.piecesPerCarton) ? i.piecesPerCarton : 1;
        adjustStock(i.productId, unreturned * factor);
      }
    });

    let updatedCustomers = customers;
    if (inv.customerId && inv.remainingAmount > 0) {
      updatedCustomers = customers.map(c => c.id === inv.customerId ? { ...c, updatedAt: new Date().toISOString(), totalDebt: Math.max(0, c.totalDebt - inv.remainingAmount) } : c);
      setCustomers(updatedCustomers);
      try {
        localStorage.setItem('cached_pos_customers', JSON.stringify(updatedCustomers));
      } catch {}
    }

    const updatedInv: Invoice = {
      ...inv,
      status: 'returned' as const,
      isPartiallyReturned: false,
      items: inv.items.map(it => ({ ...it, returnedQuantity: it.quantity })),
      total: 0,
      paidAmount: 0,
      remainingAmount: 0,
      netProfit: 0,
      totalCost: 0,
      totalReturnedAmount: (inv.totalReturnedAmount || 0) + inv.total,
      updatedAt: new Date().toISOString(),
    };

    const updatedInvoices = invoices.map(i => i.id === id ? updatedInv : i);
    setInvoices(updatedInvoices);
    try {
      localStorage.setItem('cached_pos_invoices', JSON.stringify(updatedInvoices));
    } catch {}
    saveStoreToCloud({ invoices: updatedInvoices, customers: updatedCustomers });
    const debtAfter = updatedCustomers.find(c => c.id === inv.customerId)?.totalDebt;
    emitTelegram('invoiceReturnedFull', ctx => ({
      store: formatReturnFull(inv, ctx, reason || ''),
      customerId: inv.customerId,
      customer: inv.customerId
        ? formatSimple('↩️ <b>إرجاع كامل لقائمتك</b>', [
            `🧾 القائمة: <code>${tgEsc(inv.invoiceNumber)}</code>`,
            `📝 السبب: ${tgEsc(reason || 'غير مذكور')}`,
            `إجمالي دينك الآن: <b>${Number(debtAfter || 0).toLocaleString()} ${tgEsc(ctx.currency)}</b>`,
          ], ctx)
        : undefined,
    }));
    return true;
  };

  const returnPartialInvoice = async (
    invoiceId: string,
    itemsToReturn: { productId: string; quantity: number }[],
    reason: string,
    notes?: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!hasPermission('canReturnInvoice')) {
      return { success: false, error: '⚠️ لا تملك صلاحية استرجاع المواد.' };
    }
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv || inv.status === 'returned') return { success: false, error: 'القائمة غير صالحة للإرجاع.' };

    const validItemsToReturn = itemsToReturn.filter(it => it.quantity > 0);
    if (validItemsToReturn.length === 0) {
      return { success: false, error: 'يرجى تحديد كمية مادة واحدة على الأقل للإرجاع.' };
    }

    let totalRefundAmount = 0;
    let totalCostReduction = 0;
    const now = new Date().toISOString();
    const operatorName = currentUser?.displayName || currentUser?.storeName || 'المستخدم';

    const newReturnedRecords: ReturnedItemRecord[] = [];

    const updatedInvoiceItems = inv.items.map(item => {
      const returnTarget = validItemsToReturn.find(r => r.productId === item.productId);
      // هدايا العروض لا تُسترجع (وإلا تتكرر الكمية مع سطر المادة نفسها)
      if (!returnTarget || (item.isGift && item.promoLabel)) return item;

      const currentReturned = item.returnedQuantity || 0;
      const maxReturnable = Math.max(0, item.quantity - currentReturned);
      const qtyToReturn = Math.min(returnTarget.quantity, maxReturnable);

      if (qtyToReturn <= 0) return item;

      const lineRefund = Math.round(qtyToReturn * netUnitPrice(item));
      const lineCost = qtyToReturn * (item.costPrice || 0);

      totalRefundAmount += lineRefund;
      totalCostReduction += lineCost;

      const pieceMultiplier = (item.unitType === 'carton' && item.piecesPerCarton) ? item.piecesPerCarton : 1;
      adjustStock(item.productId, qtyToReturn * pieceMultiplier);

      newReturnedRecords.push({
        id: 'ret_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6) + '_' + item.productId,
        productId: item.productId,
        productName: item.productName || (item as any).name || 'مادة',
        code: item.code || '',
        unit: item.unit || 'قطعة',
        quantity: qtyToReturn,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice || 0,
        refundAmount: lineRefund,
        reason: reason.trim() || 'رغبة الزبون / تبديل',
        notes: notes?.trim() || '',
        returnedAt: now,
        returnedBy: operatorName,
      });

      return {
        ...item,
        returnedQuantity: currentReturned + qtyToReturn
      };
    });

    const allItemsFullyReturned = updatedInvoiceItems.every(i => (i.returnedQuantity || 0) >= i.quantity);

    let debtReduction = 0;
    let cashRefund = 0;

    if (inv.remainingAmount > 0) {
      debtReduction = Math.min(inv.remainingAmount, totalRefundAmount);
      cashRefund = Math.max(0, totalRefundAmount - debtReduction);
    } else {
      cashRefund = totalRefundAmount;
    }

    let updatedCustomers = customers;
    if (debtReduction > 0 && inv.customerId) {
      updatedCustomers = customers.map(c => c.id === inv.customerId ? { ...c, updatedAt: new Date().toISOString(), totalDebt: Math.max(0, c.totalDebt - debtReduction) } : c);
      setCustomers(updatedCustomers);
      try {
        localStorage.setItem('cached_pos_customers', JSON.stringify(updatedCustomers));
      } catch {}
    }

    const updatedInvoice: Invoice = {
      ...inv,
      items: updatedInvoiceItems,
      subtotal: Math.max(0, (inv.subtotal || inv.total) - totalRefundAmount),
      total: Math.max(0, inv.total - totalRefundAmount),
      paidAmount: Math.max(0, inv.paidAmount - cashRefund),
      remainingAmount: Math.max(0, inv.remainingAmount - debtReduction),
      totalCost: Math.max(0, (inv.totalCost || 0) - totalCostReduction),
      netProfit: Math.max(0, (inv.netProfit || 0) - (totalRefundAmount - totalCostReduction)),
      totalReturnedAmount: (inv.totalReturnedAmount || 0) + totalRefundAmount,
      returnedItems: [...(inv.returnedItems || []), ...newReturnedRecords],
      status: allItemsFullyReturned ? 'returned' : 'partially_returned',
      isPartiallyReturned: !allItemsFullyReturned,
      updatedAt: now,
    };

    const updatedInvoices = invoices.map(i => i.id === invoiceId ? updatedInvoice : i);
    setInvoices(updatedInvoices);
    try {
      localStorage.setItem('cached_pos_invoices', JSON.stringify(updatedInvoices));
    } catch {}
    saveStoreToCloud({ invoices: updatedInvoices, customers: updatedCustomers });

    const debtAfterPartial = updatedCustomers.find(c => c.id === inv.customerId)?.totalDebt;
    emitTelegram('invoiceReturnedPartial', ctx => ({
      store: formatReturnPartial(
        updatedInvoice,
        newReturnedRecords,
        ctx,
        reason,
        notes,
        { total: totalRefundAmount, debtReduction, cashRefund }
      ),
      customerId: inv.customerId,
      customer: inv.customerId
        ? formatSimple('↩️ <b>إرجاع جزئي من قائمتك</b>', [
            `🧾 القائمة: <code>${tgEsc(inv.invoiceNumber)}</code>`,
            ...newReturnedRecords.map(r => `• ${tgEsc(r.productName)} × ${r.quantity} = ${r.refundAmount.toLocaleString()} ${tgEsc(ctx.currency)}`),
            `📝 السبب: ${tgEsc(reason || 'غير مذكور')}`,
            `إجمالي دينك الآن: <b>${Number(debtAfterPartial || 0).toLocaleString()} ${tgEsc(ctx.currency)}</b>`,
          ], ctx)
        : undefined,
    }));

    return { success: true };
  };

  const applyBulkPriceAdjustment = async () => ({ updatedCount: 0 });

  const recordPayment = (customerId: string, amount: number, notes?: string): PaymentRecord => {
    const newId = 'pay_' + Date.now();
    const cust = customers.find(c => c.id === customerId);
    const paid = Math.max(0, Number(amount) || 0);
    const p: PaymentRecord = {
      id: newId,
      customerId,
      customerName: cust?.name || '',
      amount: paid,
      date: new Date().toISOString(),
      notes: notes || '',
      receiptNumber: `REC-${Date.now()}`
    };
    const updatedPayments = [p, ...payments];
    setPayments(updatedPayments);
    try {
      localStorage.setItem('cached_pos_payments', JSON.stringify(updatedPayments));
    } catch {}

    // تخفيض دين الزبون بمقدار الدفعة (لا يقل عن صفر)
    const updatedCustomers = customers.map(c =>
      c.id === customerId
        ? { ...c, updatedAt: new Date().toISOString(), totalDebt: Math.max(0, (Number(c.totalDebt) || 0) - paid) }
        : c
    );
    setCustomers(updatedCustomers);
    try {
      localStorage.setItem('cached_pos_customers', JSON.stringify(updatedCustomers));
    } catch {}
    saveStoreToCloud({ customers: updatedCustomers, payments: updatedPayments });
    broadcastSyncEvent('CUSTOMERS_UPDATED', { customers: updatedCustomers }, currentSessionId, currentUser?.uid);
    const remainingAfter = updatedCustomers.find(c => c.id === customerId)?.totalDebt || 0;
    emitTelegram('debtPayment', ctx => ({
      store: formatPayment(p, remainingAfter, ctx),
      customerId,
      customer: formatPayment(p, remainingAfter, ctx, true),
    }));
    return p;
  };

  // يحسب الديون القديمة غير المضافة لرصيد الزبائن (قوائم آجلة قبل هذا التحديث)
  const getUnappliedDebts = (): { customerId: string; customerName: string; amount: number; invoices: number }[] => {
    const map = new Map<string, { customerId: string; customerName: string; amount: number; invoices: number }>();
    invoices.forEach((inv: any) => {
      if (!inv.customerId || inv.status === 'returned' || inv.debtApplied) return;
      const rem = Number(inv.remainingAmount) || 0;
      if (rem <= 0) return;
      const cur = map.get(inv.customerId) || {
        customerId: inv.customerId,
        customerName: inv.customerName || '',
        amount: 0,
        invoices: 0,
      };
      cur.amount += rem;
      cur.invoices += 1;
      map.set(inv.customerId, cur);
    });
    return Array.from(map.values());
  };

  // يضيف الديون القديمة مرة واحدة ويعلّم القوائم كمحتسبة لمنع التكرار
  const reconcileCustomerDebts = (): number => {
    const unapplied = getUnappliedDebts();
    if (unapplied.length === 0) return 0;
    const byCust = new Map(unapplied.map(u => [u.customerId, u.amount]));
    const updatedCustomers = customers.map(c =>
      byCust.has(c.id) ? { ...c, updatedAt: new Date().toISOString(), totalDebt: (Number(c.totalDebt) || 0) + (byCust.get(c.id) || 0) } : c
    );
    const updatedInvoices = invoices.map((inv: any) =>
      inv.customerId && byCust.has(inv.customerId) && !inv.debtApplied && inv.status !== 'returned' && (Number(inv.remainingAmount) || 0) > 0
        ? { ...inv, debtApplied: true }
        : inv
    );
    setCustomers(updatedCustomers);
    setInvoices(updatedInvoices as any);
    try {
      localStorage.setItem('cached_pos_customers', JSON.stringify(updatedCustomers));
      localStorage.setItem('cached_pos_invoices', JSON.stringify(updatedInvoices));
    } catch {}
    saveStoreToCloud({ customers: updatedCustomers, invoices: updatedInvoices as any });
    broadcastSyncEvent('CUSTOMERS_UPDATED', { customers: updatedCustomers }, currentSessionId, currentUser?.uid);
    return unapplied.length;
  };

  const updateSettings = (newSettings: Partial<StoreSettings>) => {
    setSettings(prev => {
      const u = { ...prev, ...newSettings };
      try {
        localStorage.setItem('cached_pos_settings', JSON.stringify(u));
      } catch {}
      saveStoreToCloud({ settings: u });
      broadcastSyncEvent('SETTINGS_UPDATED', { settings: u }, currentSessionId, currentUser?.uid);
      return u;
    });
  };

  const resetToDemo = () => {};

  const resetToZero = () => {
    setProducts([]);
    setCustomers([]);
    setInvoices([]);
    setPayments([]);
    try {
      localStorage.removeItem('cached_pos_products');
      localStorage.removeItem('cached_pos_customers');
      localStorage.removeItem('cached_pos_invoices');
    } catch {}
    saveStoreToCloud({ products: [], customers: [], invoices: [], payments: [], __replace: true } as any);
  };

  const exportDataJSON = () => JSON.stringify({ products, customers, invoices, payments, settings }, null, 2);

  const exportCustomBackup = (options: CustomBackupOptions): string => {
    const isProductsOnly = options.scope === 'products_only' || options.anonymizeProducts;
    const isSettingsOnly = options.scope === 'settings_only';
    const isAll = options.scope === 'all';

    const incProducts = isAll || isProductsOnly || !!options.includeProducts;
    const incCustomers = !isProductsOnly && !isSettingsOnly && (isAll || !!options.includeCustomers);
    const incInvoices = !isProductsOnly && !isSettingsOnly && (isAll || !!options.includeInvoices);
    const incPayments = !isProductsOnly && !isSettingsOnly && (isAll || !!options.includePayments);
    const incShifts = !isProductsOnly && !isSettingsOnly && (isAll || !!options.includeShifts);
    const incSettings = isAll || isSettingsOnly || !!options.includeSettings;

    const payload: Record<string, any> = {
      app: 'pos-store-system',
      version: CURRENT_APP_VERSION,
      exportType: options.scope,
      exportedAt: new Date().toISOString(),
    };

    if (incProducts) payload.products = products;
    if (incCustomers) payload.customers = customers;
    if (incInvoices) payload.invoices = invoices;
    if (incPayments) payload.payments = payments;
    if (incShifts) payload.shifts = shifts;
    if (incSettings) payload.settings = settings;

    return JSON.stringify(payload, null, 2);
  };

  const importDataJSON = (jsonStr: string) => {
    try {
      const data = JSON.parse(jsonStr);
      let updatedP = products;
      let updatedC = customers;
      let updatedI = invoices;
      let updatedS = shifts;
      let updatedSet = settings;

      if (Array.isArray(data.products)) {
        updatedP = data.products;
        setProducts(updatedP);
        localStorage.setItem('cached_pos_products', JSON.stringify(updatedP));
      }
      if (Array.isArray(data.customers)) {
        updatedC = data.customers;
        setCustomers(updatedC);
        localStorage.setItem('cached_pos_customers', JSON.stringify(updatedC));
      }
      if (Array.isArray(data.invoices)) {
        updatedI = data.invoices;
        setInvoices(updatedI);
        localStorage.setItem('cached_pos_invoices', JSON.stringify(updatedI));
      }
      if (Array.isArray(data.shifts)) {
        updatedS = data.shifts;
        setShifts(updatedS);
        localStorage.setItem('cached_pos_shifts', JSON.stringify(updatedS));
      }
      if (data.settings) {
        updatedSet = { ...settings, ...data.settings };
        setSettings(updatedSet);
        localStorage.setItem('cached_pos_settings', JSON.stringify(updatedSet));
      }
      saveStoreToCloud({ products: updatedP, customers: updatedC, invoices: updatedI, shifts: updatedS, settings: updatedSet });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const importProductsOnly = async (
    jsonStr: string,
    mode: 'merge' | 'replace' = 'merge'
  ): Promise<{ success: boolean; count: number; error?: string }> => {
    try {
      const data = JSON.parse(jsonStr);
      const rawList: any[] = Array.isArray(data) ? data : Array.isArray(data.products) ? data.products : [];
      if (!rawList || rawList.length === 0) return { success: false, count: 0, error: 'الملف فارغ أو غير صالح.' };

      const now = new Date().toISOString();
      const currentUid = currentUser?.uid || '';

      const cleanList: Product[] = rawList.map((item, idx) => ({
        id: 'prod_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7) + '_' + idx,
        code: String(item.code || `${1000 + idx + 1}`).trim(),
        name: String(item.name || item.productName || `مادة ${idx + 1}`).trim(),
        category: String(item.category || 'عام').trim(),
        unit: String(item.unit || 'قطعة').trim(),
        costPrice: Number(item.costPrice) || 0,
        retailPrice: Number(item.retailPrice) || 0,
        wholesalePrice: Number(item.wholesalePrice) || Number(item.retailPrice) || 0,
        superWholesalePrice: Number(item.superWholesalePrice) > 0 ? Number(item.superWholesalePrice) : undefined,
        specialPrice: Number(item.specialPrice) > 0 ? Number(item.specialPrice) : undefined,
        stock: Number(item.stock) || 0,
        piecesPerCarton: item.piecesPerCarton ? Number(item.piecesPerCarton) : undefined,
        minStock: Number(item.minStock) || 5,
        notes: item.notes ? String(item.notes).trim() : '',
        ownerUid: currentUid,
        createdAt: now,
        updatedAt: now,
      })).map(p => (p.stock > 0 ? { ...p, purchaseLog: [makeStockLog(p.stock, 'purchase', 'استيراد')] } : p));

      let updatedList = cleanList;
      if (mode === 'merge') {
        const map = new Map<string, Product>();
        products.forEach(p => map.set(p.code, p));
        cleanList.forEach(p => map.set(p.code, p));
        updatedList = Array.from(map.values());
      }
      setProducts(updatedList);
      try {
        localStorage.setItem('cached_pos_products', JSON.stringify(updatedList));
      } catch {}
      await saveStoreToCloud({ products: updatedList });
      return { success: true, count: cleanList.length };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message };
    }
  };

  // إضافة (أو تحديث بالمعرّف) مجموعة مواد دفعة واحدة وحفظها في السحابة (Supabase)
  const addProductsBulk = async (
    newProducts: Product[]
  ): Promise<{ success: boolean; count: number; error?: string }> => {
    try {
      if (!Array.isArray(newProducts) || newProducts.length === 0) {
        return { success: false, count: 0, error: 'لا توجد مواد للإضافة.' };
      }
      const map = new Map<string, Product>();
      products.forEach(p => map.set(String(p.id), p));
      newProducts.forEach(p => {
        const old = map.get(String(p.id));
        let np = p;
        if (!old && (p.stock || 0) > 0 && !(p.purchaseLog && p.purchaseLog.length)) {
          np = { ...p, purchaseLog: [makeStockLog(p.stock, 'purchase', 'إضافة سريعة')] };
        } else if (old && typeof p.stock === 'number' && p.stock !== old.stock && !p.purchaseLog) {
          const diff = Math.round((p.stock - old.stock) * 1000) / 1000;
          np = { ...p, purchaseLog: appendStockLog(old.purchaseLog, makeStockLog(Math.abs(diff), diff > 0 ? 'purchase' : 'adjust', 'إضافة سريعة')) };
        } else if (old && !p.purchaseLog && old.purchaseLog) {
          np = { ...p, purchaseLog: old.purchaseLog };
        }
        map.set(String(p.id), np);
      });
      const updatedList = Array.from(map.values());
      setProducts(updatedList);
      try {
        localStorage.setItem('cached_pos_products', JSON.stringify(updatedList));
      } catch {}
      await saveStoreToCloud({ products: updatedList });
      return { success: true, count: newProducts.length };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message };
    }
  };

  const wipeAllProductsFromServer = async (
    verificationCode: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanCode = verificationCode.trim();
    if (!cleanCode) return { success: false, error: 'يرجى كتابة رمز الحساب للتأكيد.' };

    const supervisorPin = settings.supervisorPin || '1122';
    const isMatch = cleanCode === supervisorPin || (await verifyAccountPassword(currentUser, cleanCode));
    if (!isMatch) return { success: false, error: 'رمز الحساب غير مطابق!' };

    setProducts([]);
    try {
      localStorage.removeItem('cached_pos_products');
    } catch {}
    await saveStoreToCloud({ products: [] });
    return { success: true };
  };

  const formatMoney = (amount: number) => `${amount.toLocaleString('en-US')} ${settings.currency}`;

  const getShiftStats = (shift: Shift) => {
    const shiftInvoices = invoices.filter(inv => {
      if (inv.shiftId && inv.shiftId === shift.id) return true;
      if (!inv.shiftId && shift.startTime) {
        const invTime = new Date(inv.date).getTime();
        const startTime = new Date(shift.startTime).getTime();
        const endTime = shift.endTime ? new Date(shift.endTime).getTime() : Date.now();
        return invTime >= startTime && invTime <= endTime;
      }
      return false;
    });

    let totalSales = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let totalCost = 0;
    let totalProfit = 0;

    const itemsMap = new Map<string, ShiftItemSold>();

    shiftInvoices.forEach(inv => {
      if (inv.status === 'returned') return;
      totalSales += inv.total || 0;
      totalPaid += inv.paidAmount || 0;
      totalRemaining += inv.remainingAmount || 0;
      totalCost += inv.totalCost || 0;
      totalProfit += (inv.netProfit !== undefined ? inv.netProfit : ((inv.total || 0) - (inv.totalCost || 0)));

      (inv.items || []).forEach(item => {
        const netQty = Math.max(0, item.quantity - (item.returnedQuantity || 0));
        if (netQty <= 0) return;

        const key = item.productId || item.code || item.productName || 'unknown';
        const itemSales = item.unitPrice * netQty;
        const itemCost = (item.costPrice || 0) * netQty;
        const itemProfit = itemSales - itemCost;

        const existing = itemsMap.get(key);
        if (existing) {
          existing.quantity += netQty;
          existing.totalSales += itemSales;
          existing.totalCost += itemCost;
          existing.totalProfit += itemProfit;
        } else {
          itemsMap.set(key, {
            productId: item.productId || key,
            productName: item.productName || (item as any).name || 'مادة',
            code: item.code || '',
            unit: item.unit || 'قطعة',
            quantity: netQty,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice || 0,
            totalSales: itemSales,
            totalCost: itemCost,
            totalProfit: itemProfit,
          });
        }
      });
    });

    return {
      invoicesCount: shiftInvoices.filter(i => i.status !== 'returned').length,
      totalSales,
      totalPaid,
      totalRemaining,
      totalCost,
      totalProfit,
      itemsSold: Array.from(itemsMap.values()).sort((a, b) => b.totalSales - a.totalSales),
      invoices: shiftInvoices,
    };
  };

  const addPresetShift = async (preset: Omit<PresetShift, 'id' | 'createdAt'>): Promise<PresetShift> => {
    const newPreset: PresetShift = {
      ...preset,
      id: 'preset_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
      createdBy: sessionRole === 'admin' ? 'الأدمن' : (activeSupervisorName || 'المشرف'),
    };
    const currentList = settings.presetShifts || [];
    const updated = [...currentList, newPreset];
    updateSettings({ presetShifts: updated });
    return newPreset;
  };

  const updatePresetShift = async (id: string, updates: Partial<PresetShift>): Promise<void> => {
    const updated = (settings.presetShifts || []).map(p => p.id === id ? { ...p, ...updates } : p);
    updateSettings({ presetShifts: updated });
  };

  const deletePresetShift = async (id: string): Promise<void> => {
    const updated = (settings.presetShifts || []).filter(p => p.id !== id);
    updateSettings({ presetShifts: updated });
  };

  const addSupervisor = async (sup: Omit<StoreSupervisor, 'id' | 'createdAt'>): Promise<StoreSupervisor> => {
    const newSup: StoreSupervisor = {
      ...sup,
      id: 'sup_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
    };
    const currentList = settings.supervisors || [];
    const updated = [...currentList, newSup];
    updateSettings({ supervisors: updated });
    return newSup;
  };

  const updateSupervisor = async (id: string, updates: Partial<StoreSupervisor>): Promise<void> => {
    const updated = (settings.supervisors || []).map(s => s.id === id ? { ...s, ...updates } : s);
    updateSettings({ supervisors: updated });
  };

  const deleteSupervisor = async (id: string): Promise<void> => {
    const updated = (settings.supervisors || []).filter(s => s.id !== id);
    updateSettings({ supervisors: updated });
    if (activeSupervisorId === id) {
      setActiveSupervisorId(null);
      try {
        localStorage.removeItem('active_supervisor_id');
      } catch {}
    }
  };

  // بدء الشفت مع ربطه بهوية الحساب والمتجر والمشرف المنفذ
  const startShift = async (
    startingCash: number = 0,
    notes: string = '',
    presetShiftId?: string,
    shiftCode?: string
  ): Promise<{ success: boolean; error?: string; shift?: Shift }> => {
    if (storeFeatures?.enableShifts === false) {
      return { success: false, error: 'ميزة الشفتات معطلة لهذا المتجر من قبل الإدارة.' };
    }

    const presets = settings.presetShifts || [];
    if (presets.length === 0 || !presetShiftId) {
      return { success: false, error: 'يرجى اختيار شفت معد مسبقاً.' };
    }

    const selectedPreset = presets.find(p => p.id === presetShiftId);
    if (!selectedPreset) return { success: false, error: 'الشفت المختار غير موجود.' };

    const enteredCode = (shiftCode || '').trim();
    const correctCode = (selectedPreset.code || '').trim();
    const matchesAccountPass = sessionRole === 'admin' && enteredCode ? await verifyAccountPassword(currentUser, enteredCode) : false;

    if (!(enteredCode && enteredCode === correctCode) && !matchesAccountPass) {
      return { success: false, error: `الرمز السري الخاص بالشفت (${selectedPreset.name}) غير صحيح.` };
    }

    const now = new Date().toISOString();
    const nextNum = shifts.length > 0 ? Math.max(...shifts.map(s => s.shiftNumber || 0)) + 1 : 1;
    const newId = 'shift_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);

    const cashierName = sessionRole === 'supervisor' && activeSupervisorName
      ? `المشرف: ${activeSupervisorName}`
      : currentUser?.displayName || currentUser?.storeName || (
          sessionRole === 'admin' ? 'المدير العام' : sessionRole === 'supervisor' ? 'المشرف' : 'الكاشير'
        );

    const detected = detectSystemInfo();
    const currentUid = currentUser?.uid;

    const newShift: Shift = {
      id: newId,
      shiftNumber: nextNum,
      startTime: now,
      status: 'active',
      storeUid: currentUid,
      storeId: currentUid,
      openedBy: { 
        uid: currentUid || 'local', 
        name: cashierName, 
        role: sessionRole 
      },
      operatorId: currentAccountIdentifier,
      supervisorId: activeSupervisorId || undefined,
      startingCash,
      invoicesCount: 0,
      invoicesIds: [],
      totalSales: 0,
      totalPaid: 0,
      totalRemaining: 0,
      totalCost: 0,
      totalProfit: 0,
      itemsSold: [],
      presetShiftId: selectedPreset.id,
      presetShiftName: selectedPreset.name,
      sessionId: currentSessionId,
      deviceId: currentDeviceId,
      deviceName: detected.deviceName,
      deviceType: detected.deviceType,
      notes: notes.trim(),
      createdAt: now,
    };

    setActiveShift(newShift);
    const updatedShifts = [newShift, ...shifts.filter(s => s.id !== newId)];
    setShifts(updatedShifts);

    try {
      if (currentUid) {
        localStorage.setItem(`cached_pos_active_shift_${currentUid}_${currentDeviceId}`, JSON.stringify(newShift));
        localStorage.setItem(`cached_pos_shifts_${currentUid}`, JSON.stringify(updatedShifts));
      }
      localStorage.setItem(`cached_pos_active_shift_${currentDeviceId}`, JSON.stringify(newShift));
      localStorage.setItem('cached_pos_shifts', JSON.stringify(updatedShifts));
    } catch {}

    saveStoreToCloud({ shifts: updatedShifts });
    broadcastSyncEvent('SHIFT_UPDATED', { shift: newShift, allShifts: updatedShifts }, currentSessionId, currentUser?.uid);
    emitTelegram('shiftStarted', ctx => ({
      store: formatSimple('▶️ <b>بدء شفت</b>', [
        `الشفت: ${tgEsc(newShift.presetShiftName || '')} (رقم ${tgEsc(String((newShift as any).shiftNumber ?? ''))})`,
        `🧑‍💼 فتحه: ${tgEsc(newShift.openedBy?.name || '')} (${tgEsc(String(newShift.openedBy?.role || ''))})`,
        `📱 الجهاز: ${tgEsc(newShift.deviceName || '')}`,
        newShift.notes ? `📝 ${tgEsc(newShift.notes)}` : '',
      ], ctx),
    }));
    return { success: true, shift: newShift };
  };

  const endShift = async (notes?: string): Promise<Shift | null> => {
    if (!activeShift) return null;

    const now = new Date().toISOString();
    const stats = getShiftStats(activeShift);
    const currentUid = currentUser?.uid;

    const cashierName = currentUser?.displayName || currentUser?.storeName || (
      sessionRole === 'admin' ? 'المدير' : sessionRole === 'supervisor' ? 'المشرف' : 'الكاشير'
    );

    const closedShift: Shift = {
      ...activeShift,
      storeUid: currentUid || activeShift.storeUid,
      storeId: currentUid || activeShift.storeId,
      endTime: now,
      status: 'closed',
      closedBy: { uid: currentUid || 'local', name: cashierName, role: sessionRole },
      invoicesCount: stats.invoicesCount,
      invoicesIds: stats.invoices.map(i => i.id),
      totalSales: stats.totalSales,
      totalPaid: stats.totalPaid,
      totalRemaining: stats.totalRemaining,
      totalCost: stats.totalCost,
      totalProfit: stats.totalProfit,
      itemsSold: stats.itemsSold,
      notes: notes !== undefined && notes !== '' ? notes.trim() : activeShift.notes,
    };

    setActiveShift(null);
    const updatedShifts = [closedShift, ...shifts.filter(s => s.id !== closedShift.id)];
    setShifts(updatedShifts);

    try {
      if (currentUid) {
        localStorage.removeItem(`cached_pos_active_shift_${currentUid}_${currentDeviceId}`);
        localStorage.setItem(`cached_pos_shifts_${currentUid}`, JSON.stringify(updatedShifts));
      }
      localStorage.removeItem(`cached_pos_active_shift_${currentDeviceId}`);
      localStorage.removeItem('cached_pos_active_shift');
      localStorage.setItem('cached_pos_shifts', JSON.stringify(updatedShifts));
    } catch {}

    await saveStoreToCloud({ shifts: updatedShifts });
    broadcastSyncEvent('SHIFT_UPDATED', { shift: closedShift, allShifts: updatedShifts }, currentSessionId, currentUser?.uid);
    emitTelegram('shiftEnded', ctx => ({
      store: formatSimple('⏹️ <b>إنهاء شفت</b>', [
        `الشفت: ${tgEsc(closedShift.presetShiftName || '')} (رقم ${tgEsc(String((closedShift as any).shiftNumber ?? ''))})`,
        `🧑‍💼 فتحه: ${tgEsc(closedShift.openedBy?.name || '')} | أغلقه: ${tgEsc(closedShift.closedBy?.name || '')}`,
        `🕒 من ${new Date(closedShift.startTime).toLocaleString('ar-IQ')} إلى ${new Date(closedShift.endTime || Date.now()).toLocaleString('ar-IQ')}`,
        `عدد القوائم: ${closedShift.invoicesCount}`,
        `إجمالي المبيعات: <b>${closedShift.totalSales.toLocaleString()} ${tgEsc(ctx.currency)}</b>`,
        `الواصل: ${closedShift.totalPaid.toLocaleString()} | المتبقي (دين): ${closedShift.totalRemaining.toLocaleString()}`,
        ctx.includeProfit ? `📈 الربح: ${closedShift.totalProfit.toLocaleString()} ${tgEsc(ctx.currency)}` : '',
        closedShift.notes ? `📝 ${tgEsc(closedShift.notes)}` : '',
      ], ctx),
    }));
    return closedShift;
  };

  const deleteShift = async (shiftId: string) => {
    const currentUid = currentUser?.uid;
    moveToTrash('shifts', shifts.filter(s => s.id === shiftId), x => `شفت رقم ${x.shiftNumber ?? ''}`);
    const updated = shifts.filter(s => s.id !== shiftId);
    setShifts(updated);
    try {
      if (currentUid) {
        localStorage.setItem(`cached_pos_shifts_${currentUid}`, JSON.stringify(updated));
      }
      localStorage.setItem('cached_pos_shifts', JSON.stringify(updated));
    } catch {}

    if (activeShift?.id === shiftId) {
      setActiveShift(null);
      try {
        if (currentUid) {
          localStorage.removeItem(`cached_pos_active_shift_${currentUid}_${currentDeviceId}`);
        }
        localStorage.removeItem(`cached_pos_active_shift_${currentDeviceId}`);
        localStorage.removeItem('cached_pos_active_shift');
      } catch {}
    }

    saveStoreToCloud({ shifts: updated });
    broadcastSyncEvent('SHIFT_UPDATED', { shiftId, allShifts: updated }, currentSessionId, currentUser?.uid);
  };

  const refreshSessions = async () => {};

  const terminateSession = async (sessionIdToTerminate: string): Promise<{ success: boolean }> => {
    if (sessionIdToTerminate === currentSessionId) {
      await logout();
      return { success: true };
    }
    setDeviceSessions(prev => prev.filter(s => s.id !== sessionIdToTerminate));
    return { success: true };
  };

  const [duplicateGroupsCache, setDuplicateGroupsCache] = useState<DuplicateProductGroup[]>([]);
  const refreshDuplicates = useCallback((): DuplicateProductGroup[] => {
    const groups = findDuplicateGroups(products);
    setDuplicateGroupsCache(groups);
    return groups;
  }, [products]);

  useEffect(() => {
    if (isDuplicatesModalOpen) refreshDuplicates();
  }, [isDuplicatesModalOpen, refreshDuplicates]);

  const addSalesRep = async (repData: Omit<SalesRep, 'id' | 'createdAt'>): Promise<SalesRep> => {
    const newRep: SalesRep = {
      ...repData,
      id: 'rep_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as SalesRep;
    const updated = [...(settings.salesReps || []), newRep];
    updateSettings({ salesReps: updated });
    emitTelegram('repChanges', ctx => ({
      store: formatSimple('🚚 <b>إضافة مندوب</b>', [
        `الاسم: ${tgEsc(newRep.name)}${newRep.phone ? ` — ${tgEsc(newRep.phone)}` : ''}`,
        `العمولة: ${newRep.commissionRate}${newRep.commissionType?.startsWith('fixed') ? ` ${tgEsc(ctx.currency)}` : '%'}`,
        `🧑‍💼 المنفذ: ${tgEsc(ctx.actor || '')}`,
      ], ctx),
    }));
    return newRep;
  };

  const updateSalesRep = async (id: string, updates: Partial<SalesRep>) => {
    const updated = (settings.salesReps || []).map(r => r.id === id ? { ...r, ...updates, updatedAt: new Date().toISOString() } : r);
    updateSettings({ salesReps: updated });
    const repAfter = updated.find(r => r.id === id);
    if (repAfter) {
      emitTelegram('repChanges', ctx => ({
        store: formatSimple('🚚 <b>تعديل مندوب</b>', [
          `الاسم: ${tgEsc(repAfter.name)}`,
          `العمولة: ${repAfter.commissionRate}${repAfter.commissionType?.startsWith('fixed') ? ` ${tgEsc(ctx.currency)}` : '%'}`,
          `🧑‍💼 المنفذ: ${tgEsc(ctx.actor || '')}`,
        ], ctx),
      }));
    }
  };

  const deleteSalesRep = async (id: string) => {
    moveToTrash('reps', (settings.salesReps || []).filter(r => r.id === id), x => x.name || 'مندوب');
    const updated = (settings.salesReps || []).filter(r => r.id !== id);
    updateSettings({ salesReps: updated });
    const goneRep = (settings.salesReps || []).find(r => r.id === id);
    if (goneRep) {
      emitTelegram('repChanges', ctx => ({
        store: formatSimple('🗑️ <b>حذف مندوب</b>', [`الاسم: ${tgEsc(goneRep.name)}`, `🧑‍💼 المنفذ: ${tgEsc(ctx.actor || '')}`, 'ℹ️ نُقل إلى سلة المحذوفات (3 أيام).'], ctx),
      }));
    }
  };

  const loginUser = async (user: any): Promise<{ success: boolean; error?: string } | void> => {
    setCurrentUser(user);
    setShifts([]);
    setActiveShift(null);
    setAuthLoading(false);
    return { success: true };
  };

  return (
    <AppContext.Provider
      value={{
        products,
        customers,
        invoices,
        payments,
        settings,
        storeFeatures,
        draftOrders,
        activeDraftId,
        activeDraft,
        updateActiveDraft,
        addNewDraft,
        switchToDraft,
        clearCurrentDraft,
        deleteCurrentDraft,
        completeActiveDraft,
        shifts,
        activeShift,
        startShift,
        endShift,
        getShiftStats,
        deleteShift,
        isStartShiftModalOpen,
        setIsStartShiftModalOpen,
        isEndShiftModalOpen,
        setIsEndShiftModalOpen,
        selectedShiftForDetails,
        setSelectedShiftForDetails,
        addPresetShift,
        updatePresetShift,
        deletePresetShift,
        addSupervisor,
        updateSupervisor,
        deleteSupervisor,
        activeSupervisorId,
        activeSupervisorName,
        addProduct,
        addBulkProducts,
        updateProduct,
        deleteProduct,
        batchDeleteProducts,
        adjustStock,
        addCustomer,
        updateCustomer,
        deleteCustomer,
        createInvoice,
        deleteInvoice,
        returnInvoice,
        returnPartialInvoice,
        applyBulkPriceAdjustment,
        recordPayment,
        trash,
        restoreTrashEntry,
        purgeTrashEntry,
        emptyTrash,
        getUnappliedDebts,
        reconcileCustomerDebts,
        updateSettings,
        resetToDemo,
        resetToZero,
        exportDataJSON,
        exportCustomBackup,
        importDataJSON,
        importProductsOnly,
        addProductsBulk,
        wipeAllProductsFromServer,
        formatMoney,
        currentUser,
        authLoading,
        isCloudConnected,
        isSyncing,
        lastSyncTime,
        syncNotice,
        setSyncNotice,
        syncNow,
        loginUser,
        logout,
        sessionRole,
        permissions,
        switchSession,
        hasPermission,
        isSessionModalOpen,
        setIsSessionModalOpen,
        targetSessionForModal,
        setTargetSessionForModal,
        targetSupervisorIdForModal,
        setTargetSupervisorIdForModal,
        openSessionModal,
        currentDeviceId,
        currentSessionId,
        deviceSessions,
        refreshSessions,
        terminateSession,
        isDuplicatesModalOpen,
        setIsDuplicatesModalOpen,
        isActiveSessionsModalOpen,
        setIsActiveSessionsModalOpen,
        duplicateGroups: duplicateGroupsCache,
        refreshDuplicates,
        addSalesRep,
        updateSalesRep,
        deleteSalesRep,
        theme,
        setTheme,
        toggleTheme
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
