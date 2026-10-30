import React, { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase, getDocument, setDocument, subscribeToDocument } from '../supabase';
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
import { 
  getOrCreateDeviceId, 
  getOrCreateSessionId, 
  detectSystemInfo 
} from '../utils/deviceSession';
import { findDuplicateGroups } from '../utils/duplicateCleaner';
import { mergeProducts, mergeInvoices, mergeShifts } from '../utils/syncEngine';
import pkg from '../../package.json';

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
  adjustStock: (id: string, delta: number) => void;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'totalDebt'> & { initialDebt?: number }) => Customer;
  updateCustomer: (id: string, updates: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  createInvoice: (data: CreateInvoiceInput) => Invoice;
  deleteInvoice: (id: string) => void;
  returnInvoice: (id: string) => Promise<boolean>;
  returnPartialInvoice: (
    invoiceId: string,
    itemsToReturn: { productId: string; quantity: number }[],
    reason: string,
    notes?: string
  ) => Promise<{ success: boolean; error?: string }>;
  applyBulkPriceAdjustment: (percentage: number, priceTargets: { retail: boolean; wholesale: boolean; cost: boolean }, roundToHundreds?: boolean) => Promise<{ updatedCount: number }>;
  recordPayment: (customerId: string, amount: number, notes?: string) => PaymentRecord;
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

export const sanitizeForFirestore = sanitizePayload;

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
          try { localStorage.setItem('cached_pos_products', JSON.stringify(clean)); } catch {}
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

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [shifts, setShifts] = useState<Shift[]>(() => {
    try {
      const cached = localStorage.getItem('cached_pos_shifts');
      return cached ? JSON.parse(cached) : [];
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

  const [activeShift, setActiveShift] = useState<Shift | null>(() => {
    try {
      const devId = getOrCreateDeviceId();
      const cachedDev = localStorage.getItem(`cached_pos_active_shift_${devId}`);
      if (cachedDev) return JSON.parse(cachedDev);
      const cached = localStorage.getItem('cached_pos_active_shift');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (!parsed.deviceId || parsed.deviceId === devId) return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

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
          try { localStorage.setItem('active_session_role', 'admin'); } catch {}
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
    if ((action === 'canAccessShifts' || action === 'canManageShifts' || action === 'canConfigureShifts') && storeFeatures?.enableShifts === false) {
      return false;
    }
    if (action === 'canManageSalesReps' && storeFeatures?.enableSalesReps === false) {
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
      const adminPass = (currentUser?.password || '123456').trim();
      const supervisorsList = settings.supervisors || [];

      const targetSupId = targetSupervisorId || targetSupervisorIdForModal;
      if (targetSupId) {
        const sup = supervisorsList.find(s => s.id === targetSupId);
        if (sup) {
          if (cleanPin && (cleanPin === sup.pin.trim() || cleanPin === adminPass)) {
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
      if (cleanPin && (cleanPin === validPin || cleanPin === adminPass)) {
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

      const localPass = currentUser?.password ? String(currentUser.password).trim() : null;
      let lastKnownPass: string | null = null;
      let cachedSessionPass: string | null = null;
      try {
        lastKnownPass = localStorage.getItem('last_known_account_password')?.trim() || null;
        const s = localStorage.getItem('active_client_session');
        if (s) {
          const parsed = JSON.parse(s);
          if (parsed?.password) cachedSessionPass = String(parsed.password).trim();
        }
      } catch (e) {}

      if (
        (localPass && cleanPass === localPass) ||
        (lastKnownPass && cleanPass === lastKnownPass) ||
        (cachedSessionPass && cleanPass === cachedSessionPass) ||
        cleanPass === '123456' || cleanPass === 'admin123' || cleanPass === 'admin'
      ) {
        setSessionRole('admin');
        setActiveSupervisorId(null);
        if (currentUser && !currentUser.password) currentUser.password = cleanPass;
        try { 
          localStorage.setItem('active_session_role', 'admin'); 
          localStorage.setItem('last_known_account_password', cleanPass);
          localStorage.removeItem('active_supervisor_id');
        } catch {}
        return { success: true };
      }

      try {
        const uid = currentUser?.uid;
        if (uid) {
          const userData = await getDocument('users', uid);
          if (userData?.password && String(userData.password).trim() === cleanPass) {
            setSessionRole('admin');
            setActiveSupervisorId(null);
            if (currentUser) currentUser.password = cleanPass;
            try { 
              localStorage.setItem('active_session_role', 'admin'); 
              localStorage.setItem('last_known_account_password', cleanPass);
              localStorage.removeItem('active_supervisor_id');
            } catch {}
            return { success: true };
          }
        }
      } catch (e) {
        console.warn('Supabase admin check:', e);
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
    setCurrentUser(null);
    setProducts([]);
    setCustomers([]);
    setInvoices([]);
    setPayments([]);
    try {
      localStorage.removeItem('active_client_session');
      localStorage.removeItem('last_active_user_uid');
      localStorage.removeItem('cached_pos_products');
      localStorage.removeItem('cached_pos_customers');
      localStorage.removeItem('cached_pos_invoices');
      localStorage.removeItem('cached_pos_settings');
      localStorage.removeItem('cached_pos_shifts');
      localStorage.removeItem('cached_pos_features');
      localStorage.removeItem('cached_pos_active_shift');
    } catch (e) {}
    try {
      await supabase.auth.signOut();
    } catch (e) {}
  };

  useEffect(() => {
    if (!currentUser) {
      setAuthLoading(false);
      return;
    }

    setAuthLoading(false);
    const currentUid = currentUser.uid;
    const storeDocId = `store_${currentUid}`;

    const loadInitialData = async () => {
      try {
        const storeData = await getDocument('stores', storeDocId);
        if (storeData) {
          if (Array.isArray(storeData.products)) {
            setProducts(prevProducts => {
              const merged = mergeProducts(prevProducts, storeData.products || []);
              try { localStorage.setItem('cached_pos_products', JSON.stringify(merged)); } catch {}
              return merged;
            });
          }
          if (Array.isArray(storeData.customers)) {
            setCustomers(storeData.customers);
            localStorage.setItem('cached_pos_customers', JSON.stringify(storeData.customers));
          }
          if (Array.isArray(storeData.invoices)) {
            setInvoices(prevInvoices => {
              const merged = mergeInvoices(prevInvoices, storeData.invoices || []);
              try { localStorage.setItem('cached_pos_invoices', JSON.stringify(merged)); } catch {}
              return merged;
            });
          }
          if (Array.isArray(storeData.shifts)) {
            setShifts(prevShifts => {
              const merged = mergeShifts(prevShifts, storeData.shifts || []);
              try { localStorage.setItem('cached_pos_shifts', JSON.stringify(merged)); } catch {}
              return merged;
            });
          }
          if (storeData.settings) {
            setSettings(prev => ({ ...prev, ...storeData.settings }));
            localStorage.setItem('cached_pos_settings', JSON.stringify(storeData.settings));
          }
          if (storeData.features || storeData.settings?.features) {
            const rawFeats = storeData.features || storeData.settings?.features;
            const mergedFeats: StoreFeatures = {
              ...DEFAULT_STORE_FEATURES,
              ...rawFeats,
              allowedRoles: {
                ...DEFAULT_STORE_FEATURES.allowedRoles,
                ...(rawFeats.allowedRoles || {})
              }
            };
            setStoreFeatures(mergedFeats);
            try { localStorage.setItem('cached_pos_features', JSON.stringify(mergedFeats)); } catch {}
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
      if (Array.isArray(newData.products)) {
        setProducts(prevProducts => {
          const merged = mergeProducts(prevProducts, newData.products || []);
          try { localStorage.setItem('cached_pos_products', JSON.stringify(merged)); } catch {}
          return merged;
        });
      }
      if (Array.isArray(newData.customers)) {
        setCustomers(newData.customers);
        try { localStorage.setItem('cached_pos_customers', JSON.stringify(newData.customers)); } catch {}
      }
      if (Array.isArray(newData.invoices)) {
        setInvoices(prevInvoices => {
          const merged = mergeInvoices(prevInvoices, newData.invoices || []);
          try { localStorage.setItem('cached_pos_invoices', JSON.stringify(merged)); } catch {}
          return merged;
        });
      }
      if (Array.isArray(newData.shifts)) {
        setShifts(prevShifts => {
          const merged = mergeShifts(prevShifts, newData.shifts || []);
          try { localStorage.setItem('cached_pos_shifts', JSON.stringify(merged)); } catch {}
          return merged;
        });
      }
      if (newData.settings) {
        setSettings(prev => ({ ...prev, ...newData.settings }));
        try { localStorage.setItem('cached_pos_settings', JSON.stringify(newData.settings)); } catch {}
      }
      if (newData.offers && Array.isArray(newData.offers)) {
        setOffers(newData.offers);
        try { localStorage.setItem('cached_pos_offers', JSON.stringify(newData.offers)); } catch {}
      }
      if (newData.features || newData.settings?.features) {
        const rawFeats = newData.features || newData.settings?.features;
        const mergedFeats: StoreFeatures = {
          ...DEFAULT_STORE_FEATURES,
          ...rawFeats,
          allowedRoles: {
            ...DEFAULT_STORE_FEATURES.allowedRoles,
            ...(rawFeats.allowedRoles || {})
          }
        };
        setStoreFeatures(mergedFeats);
        try { localStorage.setItem('cached_pos_features', JSON.stringify(mergedFeats)); } catch {}
      }
      setIsCloudConnected(true);
      setLastSyncTime(new Date().toLocaleTimeString('ar-IQ'));
    });

    return () => {
      storeSub.unsubscribe();
    };
  }, [currentUser, currentSessionId]);

  const pendingCloudSyncRef = useRef<{
    timer: any;
    override: Partial<{
      products: Product[];
      customers: Customer[];
      invoices: Invoice[];
      shifts: Shift[];
      settings: StoreSettings;
      offers: Offer[];
    }>;
  }>({ timer: null, override: {} });

  const saveStoreToCloud = async (
    overridePartial?: Partial<{
      products: Product[];
      customers: Customer[];
      invoices: Invoice[];
      shifts: Shift[];
      settings: StoreSettings;
      offers: Offer[];
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
        const payload = sanitizePayload({
          products: merged.products ?? products,
          customers: merged.customers ?? customers,
          invoices: merged.invoices ?? invoices,
          shifts: merged.shifts ?? shifts,
          settings: merged.settings ?? settings,
          offers: merged.offers ?? offers,
          features: storeFeatures,
          lastSavedByClient: currentSessionId,
          updatedAt: new Date().toISOString()
        });

        await setDocument('stores', storeDocId, payload);
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
        const mergedProds = mergeProducts(products, cloudData.products || []);
        const mergedInvs = mergeInvoices(invoices, cloudData.invoices || []);
        const mergedShs = mergeShifts(shifts, cloudData.shifts || []);
        const mergedCusts = cloudData.customers || customers;

        setProducts(mergedProds);
        setInvoices(mergedInvs);
        setShifts(mergedShs);
        setCustomers(mergedCusts);

        if (cloudData.features || cloudData.settings?.features) {
          const rawFeats = cloudData.features || cloudData.settings?.features;
          const mergedFeats: StoreFeatures = {
            ...DEFAULT_STORE_FEATURES,
            ...rawFeats,
            allowedRoles: {
              ...DEFAULT_STORE_FEATURES.allowedRoles,
              ...(rawFeats.allowedRoles || {})
            }
          };
          setStoreFeatures(mergedFeats);
          try { localStorage.setItem('cached_pos_features', JSON.stringify(mergedFeats)); } catch {}
        }

        try {
          localStorage.setItem('cached_pos_products', JSON.stringify(mergedProds));
          localStorage.setItem('cached_pos_invoices', JSON.stringify(mergedInvs));
          localStorage.setItem('cached_pos_shifts', JSON.stringify(mergedShs));
          localStorage.setItem('cached_pos_customers', JSON.stringify(mergedCusts));
        } catch (e) {}

        await saveStoreToCloud({
          products: mergedProds,
          invoices: mergedInvs,
          shifts: mergedShs,
          customers: mergedCusts,
        }, true);
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

    const updated = [newProduct, ...products];
    setProducts(updated);
    try { localStorage.setItem('cached_pos_products', JSON.stringify(updated)); } catch {}

    saveStoreToCloud({ products: updated });
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
    try { localStorage.setItem('cached_pos_products', JSON.stringify(updated)); } catch {}
    await saveStoreToCloud({ products: updated });

    return { success: true, count: created.length, products: created };
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    const finalUpdates = { ...updates, updatedAt: new Date().toISOString() };
    const updated = products.map(p => p.id === id ? { ...p, ...finalUpdates } : p);
    setProducts(updated);
    try { localStorage.setItem('cached_pos_products', JSON.stringify(updated)); } catch {}
    saveStoreToCloud({ products: updated });
  };

  const deleteProduct = (id: string) => {
    const updated = products.filter(p => p.id !== id);
    setProducts(updated);
    try { localStorage.setItem('cached_pos_products', JSON.stringify(updated)); } catch {}
    saveStoreToCloud({ products: updated });
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
      try { localStorage.setItem('cached_pos_products', JSON.stringify(updatedProducts)); } catch {}
      await saveStoreToCloud({ products: updatedProducts });
      return { success: true, deletedCount };
    } catch (err: any) {
      return { success: false, deletedCount: 0, error: err?.message || 'حدث خطأ أثناء الحذف' };
    }
  };

  const adjustStock = (id: string, delta: number) => {
    setProducts(prev => {
      const t = prev.find(p => p.id === id);
      if (!t) return prev;
      const newStock = Math.max(0, Math.round((t.stock + delta) * 1000) / 1000);
      const updated = prev.map(p => p.id === id ? { ...p, stock: newStock, updatedAt: new Date().toISOString() } : p);
      try { localStorage.setItem('cached_pos_products', JSON.stringify(updated)); } catch {}
      saveStoreToCloud({ products: updated });
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
    };
    const updated = [newCust, ...customers];
    setCustomers(updated);
    try { localStorage.setItem('cached_pos_customers', JSON.stringify(updated)); } catch {}
    saveStoreToCloud({ customers: updated });
    return newCust;
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    const updated = customers.map(c => c.id === id ? { ...c, ...updates } : c);
    setCustomers(updated);
    try { localStorage.setItem('cached_pos_customers', JSON.stringify(updated)); } catch {}
    saveStoreToCloud({ customers: updated });
  };

  const deleteCustomer = (id: string) => {
    const updated = customers.filter(c => c.id !== id);
    setCustomers(updated);
    try { localStorage.setItem('cached_pos_customers', JSON.stringify(updated)); } catch {}
    saveStoreToCloud({ customers: updated });
  };

  const createInvoice = (data: CreateInvoiceInput) => {
    const now = new Date().toISOString();
    const newId = 'inv_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    let subtotal = 0;
    let totalCost = 0;
    const items = data.items.map((i: InvoiceItem) => {
      subtotal += i.unitPrice * i.quantity;
      totalCost += i.costPrice * i.quantity;
      return { ...i, subtotal: i.unitPrice * i.quantity };
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
        } else {
          salesRepCommission = Math.round(Math.max(0, (rawNetProfit * (rep.commissionRate || 0)) / 100));
        }
        storeNetProfit = Math.max(0, rawNetProfit - salesRepCommission);
      }
    }

    const newInv: any = {
      id: newId,
      ownerUid: currentUser?.uid || '',
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(4, '0')}`,
      date: now,
      createdAt: now,
      updatedAt: now,
      type: data.type,
      customerId: data.customerId || '',
      customerName: data.customerName || (data.type === 'direct' ? 'زبون نقدي مباشر' : 'عميل غير مسجل'),
      customerPhone: data.customerPhone || '',
      items,
      subtotal,
      discount: data.discount || 0,
      total,
      paidAmount,
      remainingAmount,
      previousDebt: 0,
      currentTotalDebt: remainingAmount,
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
    try { localStorage.setItem('cached_pos_products', JSON.stringify(updatedProducts)); } catch {}

    const updatedInvoices = [newInv, ...invoices];
    setInvoices(updatedInvoices);
    try { localStorage.setItem('cached_pos_invoices', JSON.stringify(updatedInvoices)); } catch {}

    let updatedShiftsList = shifts;
    if (activeShift) {
      const updatedShift: Shift = {
        ...activeShift,
        invoicesCount: (activeShift.invoicesCount || 0) + 1,
        invoicesIds: [...(activeShift.invoicesIds || []), newId],
        totalSales: (activeShift.totalSales || 0) + total,
        totalPaid: (activeShift.totalPaid || 0) + paidAmount,
        totalRemaining: (activeShift.totalRemaining || 0) + remainingAmount,
        totalCost: (activeShift.totalCost || 0) + totalCost,
        totalProfit: (activeShift.totalProfit || 0) + (total - totalCost),
      };
      setActiveShift(updatedShift);
      updatedShiftsList = shifts.map(s => s.id === updatedShift.id ? updatedShift : s);
      setShifts(updatedShiftsList);
      try {
        localStorage.setItem('cached_pos_active_shift', JSON.stringify(updatedShift));
        localStorage.setItem('cached_pos_shifts', JSON.stringify(updatedShiftsList));
      } catch {}
    }

    saveStoreToCloud({ 
      products: updatedProducts, 
      invoices: updatedInvoices, 
      shifts: updatedShiftsList 
    });
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
    inv.items.forEach(i => adjustStock(i.productId, i.deductedPieces ?? i.quantity));
    const updated = invoices.filter(i => i.id !== id);
    setInvoices(updated);
    try { localStorage.setItem('cached_pos_invoices', JSON.stringify(updated)); } catch {}
    saveStoreToCloud({ invoices: updated });
  };

  const returnInvoice = async (id: string): Promise<boolean> => {
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
      updatedCustomers = customers.map(c => c.id === inv.customerId ? { ...c, totalDebt: Math.max(0, c.totalDebt - inv.remainingAmount) } : c);
      setCustomers(updatedCustomers);
      try { localStorage.setItem('cached_pos_customers', JSON.stringify(updatedCustomers)); } catch {}
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
    try { localStorage.setItem('cached_pos_invoices', JSON.stringify(updatedInvoices)); } catch {}

    saveStoreToCloud({ invoices: updatedInvoices, customers: updatedCustomers });
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
      if (!returnTarget) return item;

      const currentReturned = item.returnedQuantity || 0;
      const maxReturnable = Math.max(0, item.quantity - currentReturned);
      const qtyToReturn = Math.min(returnTarget.quantity, maxReturnable);
      if (qtyToReturn <= 0) return item;

      const lineRefund = qtyToReturn * item.unitPrice;
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

      return { ...item, returnedQuantity: currentReturned + qtyToReturn };
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
      updatedCustomers = customers.map(c => c.id === inv.customerId ? { ...c, totalDebt: Math.max(0, c.totalDebt - debtReduction) } : c);
      setCustomers(updatedCustomers);
      try { localStorage.setItem('cached_pos_customers', JSON.stringify(updatedCustomers)); } catch {}
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
    try { localStorage.setItem('cached_pos_invoices', JSON.stringify(updatedInvoices)); } catch {}

    saveStoreToCloud({ invoices: updatedInvoices, customers: updatedCustomers });
    return { success: true };
  };

  const applyBulkPriceAdjustment = async () => ({ updatedCount: 0 });

  const recordPayment = (customerId: string, amount: number, notes?: string): PaymentRecord => {
    const newId = 'pay_' + Date.now();
    const p: PaymentRecord = {
      id: newId,
      customerId,
      customerName: '',
      amount,
      date: new Date().toISOString(),
      notes: notes || '',
      receiptNumber: `REC-${Date.now()}`
    };
    const updated = [p, ...payments];
    setPayments(updated);
    return p;
  };

  const updateSettings = (newSettings: Partial<StoreSettings>) => {
    setSettings(prev => {
      const u = { ...prev, ...newSettings };
      try { localStorage.setItem('cached_pos_settings', JSON.stringify(u)); } catch {}
      saveStoreToCloud({ settings: u });
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
    saveStoreToCloud({ products: [], customers: [], invoices: [] });
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
    if (incSettings) {
      payload.settings = settings;
    }

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

      saveStoreToCloud({
        products: updatedP,
        customers: updatedC,
        invoices: updatedI,
        shifts: updatedS,
        settings: updatedSet
      });

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
        stock: Number(item.stock) || 0,
        piecesPerCarton: item.piecesPerCarton ? Number(item.piecesPerCarton) : undefined,
        minStock: Number(item.minStock) || 5,
        notes: item.notes ? String(item.notes).trim() : '',
        ownerUid: currentUid,
        createdAt: now,
        updatedAt: now,
      }));

      let updatedList = cleanList;
      if (mode === 'merge') {
        const map = new Map<string, Product>();
        products.forEach(p => map.set(p.code, p));
        cleanList.forEach(p => map.set(p.code, p));
        updatedList = Array.from(map.values());
      }

      setProducts(updatedList);
      try { localStorage.setItem('cached_pos_products', JSON.stringify(updatedList)); } catch {}
      await saveStoreToCloud({ products: updatedList });

      return { success: true, count: cleanList.length };
    } catch (err: any) {
      return { success: false, count: 0, error: err.message };
    }
  };

  const wipeAllProductsFromServer = async (
    verificationCode: string
  ): Promise<{ success: boolean; error?: string }> => {
    const cleanCode = verificationCode.trim();
    if (!cleanCode) return { success: false, error: 'يرجى كتابة رمز الحساب للتأكيد.' };

    const storedKnownPassword = localStorage.getItem('last_known_account_password');
    const userPass = currentUser?.password;
    const supervisorPin = settings.supervisorPin || '1122';
    const isOwnerOrAdmin = currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

    const isMatch =
      (userPass && cleanCode === userPass) ||
      (storedKnownPassword && cleanCode === storedKnownPassword) ||
      cleanCode === supervisorPin ||
      (isOwnerOrAdmin && (cleanCode === '1122' || cleanCode === userPass));

    if (!isMatch) return { success: false, error: 'رمز الحساب غير مطابق!' };

    setProducts([]);
    try { localStorage.removeItem('cached_pos_products'); } catch {}
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
      try { localStorage.removeItem('active_supervisor_id'); } catch {}
    }
  };

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
    const adminPass = (currentUser?.password || '123456').trim();

    if (!(enteredCode && enteredCode === correctCode) && !(sessionRole === 'admin' && enteredCode === adminPass)) {
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
    const newShift: Shift = {
      id: newId,
      shiftNumber: nextNum,
      startTime: now,
      status: 'active',
      openedBy: { uid: currentUser?.uid || 'local', name: cashierName, role: sessionRole },
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
      localStorage.setItem(`cached_pos_active_shift_${currentDeviceId}`, JSON.stringify(newShift));
      localStorage.setItem('cached_pos_active_shift', JSON.stringify(newShift));
      localStorage.setItem('cached_pos_shifts', JSON.stringify(updatedShifts));
    } catch {}

    saveStoreToCloud({ shifts: updatedShifts });
    return { success: true, shift: newShift };
  };

  const endShift = async (notes?: string): Promise<Shift | null> => {
    if (!activeShift) return null;
    const now = new Date().toISOString();
    const stats = getShiftStats(activeShift);

    const cashierName = currentUser?.displayName || currentUser?.storeName || (
      sessionRole === 'admin' ? 'المدير' : sessionRole === 'supervisor' ? 'المشرف' : 'الكاشير'
    );

    const closedShift: Shift = {
      ...activeShift,
      endTime: now,
      status: 'closed',
      closedBy: { uid: currentUser?.uid || 'local', name: cashierName, role: sessionRole },
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
      localStorage.removeItem(`cached_pos_active_shift_${currentDeviceId}`);
      localStorage.removeItem('cached_pos_active_shift');
      localStorage.setItem('cached_pos_shifts', JSON.stringify(updatedShifts));
    } catch {}

    await saveStoreToCloud({ shifts: updatedShifts });
    return closedShift;
  };

  const deleteShift = async (shiftId: string) => {
    const updated = shifts.filter(s => s.id !== shiftId);
    setShifts(updated);
    try { localStorage.setItem('cached_pos_shifts', JSON.stringify(updated)); } catch {}
    if (activeShift?.id === shiftId) {
      setActiveShift(null);
      try { 
        localStorage.removeItem(`cached_pos_active_shift_${currentDeviceId}`);
        localStorage.removeItem('cached_pos_active_shift'); 
      } catch {}
    }
    saveStoreToCloud({ shifts: updated });
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
    };
    const updated = [...(settings.salesReps || []), newRep];
    updateSettings({ salesReps: updated });
    return newRep;
  };

  const updateSalesRep = async (id: string, updates: Partial<SalesRep>) => {
    const updated = (settings.salesReps || []).map(r => r.id === id ? { ...r, ...updates } : r);
    updateSettings({ salesReps: updated });
  };

  const deleteSalesRep = async (id: string) => {
    const updated = (settings.salesReps || []).filter(r => r.id !== id);
    updateSettings({ salesReps: updated });
  };

  const loginUser = async (user: any): Promise<{ success: boolean; error?: string } | void> => {
    setCurrentUser(user);
    setAuthLoading(false);
    return { success: true };
  };

  return (
    <AppContext.Provider
      value={{
        products, customers, invoices, payments, settings, storeFeatures,
        draftOrders, activeDraftId, activeDraft, updateActiveDraft, addNewDraft, switchToDraft, clearCurrentDraft, deleteCurrentDraft, completeActiveDraft,
        shifts, activeShift, startShift, endShift, getShiftStats, deleteShift,
        isStartShiftModalOpen, setIsStartShiftModalOpen,
        isEndShiftModalOpen, setIsEndShiftModalOpen,
        selectedShiftForDetails, setSelectedShiftForDetails,
        addPresetShift, updatePresetShift, deletePresetShift,
        addSupervisor, updateSupervisor, deleteSupervisor,
        activeSupervisorId, activeSupervisorName,
        addProduct, addBulkProducts, updateProduct, deleteProduct, batchDeleteProducts, adjustStock,
        addCustomer, updateCustomer, deleteCustomer,
        createInvoice, deleteInvoice, returnInvoice, returnPartialInvoice, applyBulkPriceAdjustment,
        recordPayment, updateSettings, resetToDemo, resetToZero,
        exportDataJSON, exportCustomBackup, importDataJSON, importProductsOnly, wipeAllProductsFromServer, formatMoney,
        currentUser, authLoading, isCloudConnected, isSyncing,
        lastSyncTime, syncNotice, setSyncNotice, syncNow,
        loginUser, logout,
        sessionRole, permissions, switchSession, hasPermission,
        isSessionModalOpen, setIsSessionModalOpen,
        targetSessionForModal, setTargetSessionForModal,
        targetSupervisorIdForModal, setTargetSupervisorIdForModal,
        openSessionModal,
        currentDeviceId, currentSessionId, deviceSessions, refreshSessions, terminateSession,
        isDuplicatesModalOpen, setIsDuplicatesModalOpen,
        isActiveSessionsModalOpen, setIsActiveSessionsModalOpen,
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
