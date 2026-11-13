export type SaleType = 'direct' | 'credit';
export type PriceType = 'retail' | 'wholesale' | 'superWholesale' | 'special';
export type InvoiceStatus = 'paid' | 'partial' | 'unpaid' | 'returned' | 'partially_returned';

export interface StoreFeatures {
  enableDirectPrint: boolean;
  enableCustomerPriceChecker: boolean;
  enableShifts: boolean;
  enableSalesReps: boolean;
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
  /** جملة الجملة (اختياري) */
  superWholesalePrice?: number;
  /** السعر الخاص (اختياري) */
  specialPrice?: number;
  stock: number;
  piecesPerCarton?: number;
  minStock: number;
  isWeighted?: boolean;
  itemCount?: number;
  notes?: string;
  /** تاريخ الإنتاج وتاريخ انتهاء الصلاحية (YYYY-MM-DD) — اختياري، يُفعَّل من الإعدادات */
  productionDate?: string;
  expiryDate?: string;
  /** دفعات المخزون بتواريخ صلاحية مختلفة (الأقدم أولاً) */
  expiryBatches?: ExpiryBatch[];
  /** عملة إدخال الأسعار: الدولار يُحفظ في usdPrices وتُحسب أسعار الدينار منه بسعر التصريف */
  priceCurrency?: 'IQD' | 'USD';
  usdPrices?: { cost: number; retail: number; wholesale: number; superWholesale?: number; special?: number };
  ownerUid?: string;
  /** سجل الإضافات على المخزون (شراء/تعديل) لعرض تاريخ حركة المادة */
  purchaseLog?: StockLogEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpiryBatch {
  id: string;
  /** عدد القطع المسجّلة عند الإدخال (يُخصم منها الأقدم أولاً حسب المخزون الحالي) */
  qty: number;
  productionDate?: string;
  expiryDate?: string;
  addedAt: string;
}

export interface StockLogEntry {
  id: string;
  date: string;
  /** عدد القطع (موجب دائماً) */
  qty: number;
  /** purchase: شراء/إضافة مخزون، adjust: تنقيص يدوي */
  type: 'purchase' | 'adjust' | 'price';
  note?: string;
  /** سعر تكلفة الشراء وقت هذه الحركة */
  costPrice?: number;
  /** سعر التكلفة السابق إذا تغيّر في هذه الحركة */
  prevCostPrice?: number;
  /** تاريخ الإنتاج وانتهاء الصلاحية للكمية المضافة في هذه الحركة */
  productionDate?: string;
  expiryDate?: string;
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
  updatedAt?: string;
  telegramCode?: string;
  telegramLinked?: boolean;
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
  notes?: string;
  isGift?: boolean;
  // ---- العروض والخصومات ----
  discount?: number;          // مبلغ الخصم الإجمالي على هذا السطر (دينار)
  discountIsOffer?: boolean;  // الخصم ناتج عن عرض (مثل 2+1 داخل الكمية) وليس خصماً عادياً
  giftQty?: number;           // عدد القطع المجانية المذكورة في عمود «هدية»
  hiddenFromPrint?: boolean;  // سطر هدية لا يُطبع (يُخصم من المخزن فقط)
  promoLabel?: string;        // وصف العرض/الخصم المطبق
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

export type TelegramEventKey =
  | 'invoiceSold'
  | 'creditSale'
  | 'debtPayment'
  | 'invoiceDeleted'
  | 'invoiceReturnedFull'
  | 'invoiceReturnedPartial'
  | 'invoiceEdited'
  | 'productAdded'
  | 'productEdited'
  | 'productDeleted'
  | 'customerAdded'
  | 'customerDeleted'
  | 'shiftStarted'
  | 'shiftEnded'
  | 'repChanges'
  | 'trashRestored';

export interface TelegramSettings {
  enabled: boolean;
  /** رمز ربط المتجر الذي يرسله صاحب المتجر إلى البوت (ST-XXXXXXXX) */
  code: string;
  /** سرّ المتجر لمصادقة الطلبات على دالة التليجرام */
  secret: string;
  linked: boolean;
  linkedChats?: number;
  linkedAt?: string;
  botUsername?: string;
  events: Partial<Record<TelegramEventKey, boolean>>;
  includeItems: boolean;
  includeProfit: boolean;
  customerNotifications: boolean;
}

export interface SalesRep {
  id: string;
  name: string;
  phone: string;
  commissionRate: number;
  commissionType: 'percentage_profit' | 'percentage_sales' | 'fixed_per_invoice' | 'fixed_per_piece';
  showOnInvoice: boolean;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  telegramCode?: string;
  telegramLinked?: boolean;
  /** تاريخ آخر تصفية: الأرباح تُحسب من القوائم بعد هذا التاريخ */
  settledAt?: string;
  settlements?: RepSettlement[];
}

export interface RepSettlement {
  id: string;
  date: string;
  amount: number;
  invoiceCount: number;
  qty: number;
  sales: number;
}

export interface Invoice {
  id: string;
  showDiscountColumn?: boolean;
  showGiftColumn?: boolean;
  storeCode?: string;
  seal?: string;
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
  /** true إذا أُضيف باقي هذه القائمة إلى رصيد دين الزبون عند إنشائها */
  debtApplied?: boolean;
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
  editedAt?: string;
  editLog?: { date: string; by: string; summary: string }[];
}

export interface UpdateInvoiceInput {
  items: InvoiceItem[];
  type: SaleType;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  date?: string;
  discount: number;
  paidAmount: number;
  paymentDueDate?: string;
  notes?: string;
  salesRepId?: string;
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
  storeUid?: string;
  storeId?: string;
  operatorId?: string;
  supervisorId?: string;
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
  /** اسم الكاشير الذي يعمل على هذا الشفت (يظهر في القوائم وشريط الشفت) */
  cashierName?: string;
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
  /** بصمات مسجلة للمشرف (WebAuthn) */
  biometrics?: { id: string; publicKey?: string; alg?: number; label?: string; createdAt: string }[];
  createdAt: string;
}

export type PromotionKind = 'discount' | 'bonus_same' | 'bonus_other' | 'nth_free';

export interface Promotion {
  id: string;
  kind: PromotionKind;
  productId: string;
  productName?: string;
  active: boolean;             // تشغيل/إيقاف يدوي
  startDate?: string;          // YYYY-MM-DD (فارغ = من الآن)
  endDate?: string;            // YYYY-MM-DD (فارغ = حتى الإيقاف أو الحذف)
  discountType?: 'percent' | 'amount';
  discountValue?: number;      // نسبة مئوية، أو مبلغ لكل قطعة (لكل كغم للمواد الموزونة)
  buyQty?: number;             // اشترِ N
  getQty?: number;             // احصل على M مجاناً
  rewardProductId?: string;    // للعرض من مادة أخرى
  rewardProductName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceInput {
  showDiscountColumn?: boolean;
  showGiftColumn?: boolean;
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
  /** تجزئة PBKDF2 لكلمة المرور (لا تُخزَّن كلمة المرور نفسها أبداً) */
  passwordHash?: string;
  /** هل للحساب كلمة مرور؟ (للعرض في لوحة الإدارة فقط) */
  hasPassword?: boolean;
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
  enableTelegram?: boolean;
  enableModernDesign?: boolean;
  enableWholesalePrice?: boolean;
  enableSpecialPrice?: boolean;
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
  /** رأس القائمة: مخصص (ألوان ونصوص) أو صورة جاهزة مصممة من الزبون تحل محله بالكامل */
  headerMode?: 'custom' | 'image';
  // ملاحظة: الصورة نفسها تُحفظ محليًا على الجهاز فقط (IndexedDB) ولا تدخل في الإعدادات
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
  showSuperWholesale?: boolean;
  showSpecialPrice?: boolean;
  invoiceShowCartonColumns?: boolean;
  invoiceShowPiecePrice?: boolean;
  quickQuantityEntry?: boolean;
  invertEnterShortcuts?: boolean;
  /** وضع Enter: التنقل في نقطة البيع بلوحة المفاتيح بدون ماوس */
  posKeyboardMode?: boolean;
  /** حاسبة الباقي (F5): اختيار فئات النقود المستلمة لمعرفة الباقي للزبون. مفعّلة افتراضياً */
  enableChangeCalculator?: boolean;
  /** أقسام/تصنيفات المواد التي أضافها المستخدم يدوياً */
  productCategories?: string[];
  /** الشكل الكلاسيكي لقائمة البيع في نقطة البيع (جدول بخطوط كالقائمة المطبوعة) */
  posClassicCart?: boolean;
  /** فصل عدد الكراتين عن عدد القطع عند الإضافة */
  separateCartonPieces?: boolean;
  /** حرف التبديل إلى مربع الكرتون */
  cartonHotkey?: string;
  enableProductExpiry?: boolean;
  enableUsdPricing?: boolean;
  /** سعر تصريف الدولار: كم دينارًا يساوي دولار واحد */
  usdRate?: number;
  trackExpiryBatches?: boolean;
  globalBarcodeCapture?: boolean;
  promotions?: Promotion[];
  // طريقة ذكر الخصم في القائمة: عمود «الخصم» أو تطبيق مباشر على السعر دون ذكره
  promoDiscountDisplay?: 'column' | 'hidden';
  // طريقة ذكر العرض: عمود «هدية» | سطر هدية ظاهر | غير مذكور إطلاقاً
  promoOfferDisplay?: 'gift_column' | 'listed' | 'hidden';
  // السماح بشفت مستقل ومتزامن على كل جهاز (الافتراضي: مفعّل)
  allowMultiDeviceShifts?: boolean;
  /** إظهار الكمية المتوفرة للزبون في فاحص الأسعار: none=مخفية، count=الرقم، colors=ألوان */
  /** ما يُعرض للزبون في رابط جملة الجملة إذا لم يكن للمادة سعر جملة جملة */
  /** ما يُعرض/يُباع إذا لم يكن للمادة سعر جملة (في الروابط ونقطة البيع) */
  checkerFallbackWholesale?: 'retail' | 'none';
  checkerFallbackSuper?: 'wholesale' | 'retail' | 'none';
  /** ما يُعرض للزبون في رابط السعر الخاص إذا لم يكن للمادة سعر خاص */
  checkerFallbackSpecial?: 'wholesale' | 'retail' | 'none';
  checkerStockMode?: 'none' | 'count' | 'colors';
  /** آخر عدد يظهر باللون الأحمر (من 1 إلى هذا الرقم) */
  checkerRedMax?: number;
  /** آخر عدد يظهر باللون الأصفر (بعد الأحمر حتى هذا الرقم)، وما فوقه أخضر */
  checkerYellowMax?: number;
  giftCostCounted?: boolean;
  telegram?: TelegramSettings;
  invoiceSecret?: string;
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
  repCommissionDefaultType?: 'percentage_profit' | 'percentage_sales' | 'fixed_per_invoice' | 'fixed_per_piece';
  theme?: 'light' | 'dark';
  enableShifts?: boolean;
  enableCustomerPriceChecker?: boolean;
  enableSupervisor?: boolean;
  enableEmployee?: boolean;
  enableTelegram?: boolean;
  enableModernDesign?: boolean;
  enableWholesalePrice?: boolean;
  enableSpecialPrice?: boolean;
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
  canEditInvoice?: boolean;
  canViewCustomers: boolean;
  canViewReports: boolean;
  canAccessSettings: boolean;
  canAccessInventory: boolean;
  canAccessShifts: boolean;
  canManageShifts: boolean;
  canConfigureShifts: boolean;
  canManageSalesReps?: boolean;
  canViewCostPrice?: boolean; // الصلاحية الجديدة لمشاهدة أسعار التكلفة والشراء
}

export const DEFAULT_EMPLOYEE_PERMISSIONS: RolePermissions = {
  canSell: true,
  canAddNewProduct: true,
  canEditProductPrice: true,
  canViewInvoices: true,
  canReturnInvoice: false,
  canDeleteInvoice: false,
  canEditInvoice: false,
  canViewCustomers: false,
  canViewReports: false,
  canAccessSettings: false,
  canAccessInventory: true,
  canAccessShifts: true,
  canManageShifts: true,
  canConfigureShifts: false,
  canManageSalesReps: false,
  canViewCostPrice: false, // محظور افتراضياً للموظف
};

export const DEFAULT_SUPERVISOR_PERMISSIONS: RolePermissions = {
  canSell: true,
  canAddNewProduct: true,
  canEditProductPrice: true,
  canViewInvoices: true,
  canReturnInvoice: true,
  canDeleteInvoice: false,
  canEditInvoice: true,
  canViewCustomers: true,
  canViewReports: false,
  canAccessSettings: false,
  canAccessInventory: true,
  canAccessShifts: true,
  canManageShifts: true,
  canConfigureShifts: true,
  canManageSalesReps: true,
  canViewCostPrice: true, // مسموح افتراضياً للمشرف
};

export const DEFAULT_ADMIN_PERMISSIONS: RolePermissions = {
  canSell: true,
  canAddNewProduct: true,
  canEditProductPrice: true,
  canViewInvoices: true,
  canReturnInvoice: true,
  canDeleteInvoice: true,
  canEditInvoice: true,
  canViewCustomers: true,
  canViewReports: true,
  canAccessSettings: true,
  canAccessInventory: true,
  canAccessShifts: true,
  canManageShifts: true,
  canConfigureShifts: true,
  canManageSalesReps: true,
  canViewCostPrice: true,
};
