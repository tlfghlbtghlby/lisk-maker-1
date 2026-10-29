export type SaleType = 'direct' | 'credit';
export type PriceType = 'retail' | 'wholesale';
export type InvoiceStatus = 'paid' | 'partial' | 'unpaid' | 'returned' | 'partially_returned';

export interface StoreFeatures {
  enableDirectPrint: boolean;
  enableCustomerPriceChecker: boolean;
  enableShifts: boolean;
  enableSalesReps: boolean;
  enableOffers: boolean;
  enableModernDesign: boolean;
  allowedRoles: {
    admin: boolean;
    supervisor: boolean;
    employee: boolean;
  };
}

export const DEFAULT_STORE_FEATURES: StoreFeatures = {
  enableDirectPrint: true,
  enableCustomerPriceChecker: true,
  enableShifts: true,
  enableSalesReps: true,
  enableOffers: true,
  enableModernDesign: true,
  allowedRoles: {
    admin: true,
    supervisor: true,
    employee: true,
  },
};

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
  piecesPerCarton?: number;
  minStock: number;
  isWeighted?: boolean;
  itemCount?: number;
  notes?: string;
  ownerUid?: string;
  createdAt: string;
  updatedAt: string;
}

export type Item = Product;

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  totalDebt: number;
  notes?: string;
  createdAt: string;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  name?: string;
  code: string;
  unit: string;
  priceType: PriceType;
  unitType?: 'piece' | 'carton';
  piecesPerCarton?: number;
  deductedPieces?: number;
  costPrice: number;
  unitPrice: number;
  quantity: number;
  isWeighted?: boolean;
  weightGrams?: number;
  returnedQuantity?: number;
  total: number;
  isCustomPrice?: boolean;
}

export interface ReturnedItemRecord {
  id: string;
  productId: string;
  productName: string;
  code: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  refundAmount: number;
  reason: string;
  notes?: string;
  returnedAt: string;
  returnedBy?: string;
}

export interface SalesRep {
  id: string;
  name: string;
  phone: string;
  commissionRate: number;
  commissionType: 'percentage_profit' | 'percentage_sales';
  showOnInvoice: boolean;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Invoice {
  id: string;
  ownerUid?: string;
  invoiceNumber: string;
  type: SaleType;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  previousDebt: number;
  currentTotalDebt: number;
  paymentDueDate?: string;
  status: InvoiceStatus;
  notes?: string;
  date: string;
  createdAt?: string;
  updatedAt?: string;
  totalCost: number;
  netProfit: number;
  shiftId?: string;
  returnedItems?: ReturnedItemRecord[];
  totalReturnedAmount?: number;
  isPartiallyReturned?: boolean;
  salesRepId?: string;
  salesRepName?: string;
  salesRepCommission?: number;
  storeNetProfit?: number;
  showRepOnInvoice?: boolean;
}

export interface POSDraftOrder {
  id: string;
  orderNumber: number;
  cartItems: InvoiceItem[];
  saleType: SaleType;
  globalPriceType: PriceType;
  selectedCustomerId: string;
  customCustomerName: string;
  customerPhone: string;
  discount: number;
  paidAmount: number;
  dueDate: string;
  notes: string;
  updatedAt: string;
  selectedSalesRepId?: string;
  showRepOnInvoice?: boolean;
}

export interface ShiftItemSold {
  productId: string;
  productName: string;
  code: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
}

export interface Shift {
  id: string;
  shiftNumber: number;
  startTime: string;
  endTime?: string;
  status: 'active' | 'closed';
  openedBy: {
    uid: string;
    name: string;
    role: SessionRole;
  };
  closedBy?: {
    uid: string;
    name: string;
    role: SessionRole;
  };
  startingCash?: number;
  invoicesCount: number;
  invoicesIds: string[];
  totalSales: number;
  totalPaid: number;
  totalRemaining: number;
  totalCost: number;
  totalProfit: number;
  itemsSold: ShiftItemSold[];
  presetShiftId?: string;
  presetShiftName?: string;
  sessionId?: string;
  deviceId?: string;
  deviceName?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  notes?: string;
  createdAt: string;
}

export interface DeviceSession {
  id: string;
  deviceId: string;
  userId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  os: string;
  browser: string;
  location: string;
  ip?: string;
  isCurrentDevice?: boolean;
  lastActive: string;
  activeShiftId?: string | null;
  activeShiftName?: string | null;
  createdAt: string;
}

export interface DuplicateProductGroup {
  id: string;
  matchType: 'barcode' | 'exact_details' | 'name_price' | 'both';
  matchLabel: string;
  matchKey: string;
  primaryItem: Product;
  duplicateItems: Product[];
  allProducts: Product[];
  isBarcodeMatch?: boolean;
  isExactMatch?: boolean;
  isNamePriceMatch?: boolean;
}

export interface PresetShift {
  id: string;
  name: string;
  code: string;
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

export interface StoreSupervisor {
  id: string;
  name: string;
  pin: string;
  canConfigureShifts?: boolean;
  permissions?: Partial<RolePermissions>;
  createdAt: string;
}

export interface CreateInvoiceInput {
  type: SaleType;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  items: InvoiceItem[];
  discount: number;
  paidAmount: number;
  paymentDueDate?: string;
  notes?: string;
  salesRepId?: string;
  salesRepName?: string;
  salesRepCommission?: number;
  storeNetProfit?: number;
  showRepOnInvoice?: boolean;
}

export interface PaymentRecord {
  id: string;
  customerId: string;
  customerName: string;
  amount: number;
  date: string;
  notes?: string;
  receiptNumber: string;
}

export type DeviceMode = 'desktop' | 'mobile';
export type DesktopLayoutMode = 'full' | 'partial';

export type UserRole = 'admin' | 'client';
export const ADMIN_EMAIL = 'tlfghlbtghlby@gmail.com';

export type SubscriptionType = 'trial' | 'extended' | 'monthly' | 'yearly' | 'permanent';

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName: string;
  storeName: string;
  phone?: string;
  password?: string;
  role: UserRole;
  isActive?: boolean;
  createdAt: string;
  subscriptionType?: SubscriptionType;
  trialStartDate?: string;
  trialExpiresAt?: string;
  isPermanent?: boolean;
  subscriptionNotes?: string;
  features?: StoreFeatures;
  enableShifts?: boolean;
  enableSalesReps?: boolean;
  enableSupervisor?: boolean;
  enableEmployee?: boolean;
  enableCustomerPriceChecker?: boolean;
}

export type PrintFormatType = 'a4' | 'a5' | 'thermal' | 'thermal80' | 'thermal58';
export type InvoiceTemplateType = 'classic' | 'modern';

export interface ModernInvoiceHeaderConfig {
  badgeText?: string;
  fontFamily?: string;
  rightBannerColor?: string;
  leftBannerColor?: string;
  activitiesText?: string;
  badgeLeftText?: string;
  badgeRightText?: string;
  centerIconType?: 'preset' | 'custom';
  centerIconPreset?: string;
  centerIconCustomUrl?: string;
  barcodeImageUrl?: string;
  showBarcode?: boolean;
  showTelegram?: boolean;
  telegramHandle?: string;
  showFacebook?: boolean;
  facebookName?: string;
  showWhatsapp?: boolean;
  whatsappNumber?: string;
  showInstagram?: boolean;
  instagramHandle?: string;
  deliveryNote?: string;
}

export interface StoreSettings {
  storeName: string;
  ownerName: string;
  phone: string;
  address: string;
  currency: string;
  invoiceFooterNote: string;
  printFormat: PrintFormatType;
  invoiceTemplate?: InvoiceTemplateType;
  modernHeader?: ModernInvoiceHeaderConfig;
  directPrintEnabled?: boolean;
  selectedPrinterName?: string;
  printerPaperSize?: PrintFormatType | string;
  enableWholesale: boolean;
  deviceMode: DeviceMode;
  desktopLayout: DesktopLayoutMode;
  headerRightSealText?: string;
  headerLeftSealText?: string;
  businessSubtitle?: string;
  managerLabel?: string;
  supervisorPin?: string;
  supervisors?: StoreSupervisor[];
  presetShifts?: PresetShift[];
  employeePermissions?: Partial<RolePermissions>;
  supervisorPermissions?: Partial<RolePermissions>;
  defaultSessionOnLaunch?: SessionRole;
  enableSalesReps?: boolean;
  salesReps?: SalesRep[];
  defaultShowRepOnInvoice?: boolean;
  repCommissionDefaultType?: 'percentage_profit' | 'percentage_sales';
  theme?: 'light' | 'dark';
  enableShifts?: boolean;
  enableCustomerPriceChecker?: boolean;
  enableSupervisor?: boolean;
  enableEmployee?: boolean;
  features?: StoreFeatures;
}

export type Settings = StoreSettings;
export type SessionRole = 'admin' | 'supervisor' | 'employee';

export interface RolePermissions {
  canSell: boolean;
  canAddNewProduct: boolean;
  canEditProductPrice: boolean;
  canViewInvoices: boolean;
  canReturnInvoice: boolean;
  canDeleteInvoice: boolean;
  canViewCustomers: boolean;
  canViewReports: boolean;
  canAccessSettings: boolean;
  canAccessInventory: boolean;
  canAccessShifts: boolean;
  canManageShifts: boolean;
  canConfigureShifts: boolean;
  canManageSalesReps?: boolean;
}

export const DEFAULT_EMPLOYEE_PERMISSIONS: RolePermissions = {
  canSell: true,
  canAddNewProduct: true,
  canEditProductPrice: true,
  canViewInvoices: true,
  canReturnInvoice: false,
  canDeleteInvoice: false,
  canViewCustomers: false,
  canViewReports: false,
  canAccessSettings: false,
  canAccessInventory: true,
  canAccessShifts: true,
  canManageShifts: true,
  canConfigureShifts: false,
  canManageSalesReps: false,
};

export const DEFAULT_SUPERVISOR_PERMISSIONS: RolePermissions = {
  canSell: true,
  canAddNewProduct: true,
  canEditProductPrice: true,
  canViewInvoices: true,
  canReturnInvoice: true,
  canDeleteInvoice: false,
  canViewCustomers: true,
  canViewReports: false,
  canAccessSettings: false,
  canAccessInventory: true,
  canAccessShifts: true,
  canManageShifts: true,
  canConfigureShifts: true,
  canManageSalesReps: true,
};

export const DEFAULT_ADMIN_PERMISSIONS: RolePermissions = {
  canSell: true,
  canAddNewProduct: true,
  canEditProductPrice: true,
  canViewInvoices: true,
  canReturnInvoice: true,
  canDeleteInvoice: true,
  canViewCustomers: true,
  canViewReports: true,
  canAccessSettings: true,
  canAccessInventory: true,
  canAccessShifts: true,
  canManageShifts: true,
  canConfigureShifts: true,
  canManageSalesReps: true,
};
