export type SaleType = 'direct' | 'credit'; // بيع مباشر (نقدي) أو بيع آجل (دين)
export type PriceType = 'retail' | 'wholesale'; // سعر البيع العادي أو سعر الجملة
export type InvoiceStatus = 'paid' | 'partial' | 'unpaid' | 'returned' | 'partially_returned';

export interface Product {
  id: string;
  code: string; // كود المادة أو الباركود
  name: string; // اسم المادة
  category: string; // التصنيف (غذائية، إنشائية، كهربائية، أدوات منزلية، إلخ)
  unit: string; // الوحدة (قطعة، كرتونة، كيس، كيلو، لتر، متر)
  costPrice: number; // سعر الجملة / الشراء (التكلفة)
  retailPrice: number; // سعر البيع المباشر (مفرق)
  wholesalePrice: number; // سعر بيع الجملة
  stock: number; // إجمالي القطع المتوفرة بالمخزن
  piecesPerCarton?: number; // كم يحتوي الكارتون الواحد من قطع (مثال: 6 قطع في الكارتون)
  minStock: number; // الحد الأدنى للتنبيه عند قرب النفاد
  isWeighted?: boolean; // هل المادة تباع بالوزن (سعر الكيلو الواحد 1000g)
  itemCount?: number; // الرصيد بالعدد (اختياري للمواد الموزونة كالقطع أو الأكياس)
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
  totalDebt: number; // إجمالي الدين المستحق الحالي
  notes?: string;
  createdAt: string;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  name?: string; // اسم المادة (اختياري للتوافق)
  code: string;
  unit: string;
  priceType: PriceType; // سعر البيع المطبق
  unitType?: 'piece' | 'carton'; // نوع البيع: بالقطعة أو بالكرتون
  piecesPerCarton?: number; // سعة الكرتون
  deductedPieces?: number; // إجمالي القطع المخصومة من رصيد المخزن
  costPrice: number; // سعر الشراء لحساب الربح
  unitPrice: number; // سعر البيع للوحدة (أو سعر الكيلو للمواد الموزونة)
  quantity: number; // الكمية الأصلية المباعة (أو الوزن بالكيلوغرام مثلاً 0.350)
  isWeighted?: boolean; // مادة مباعة بالوزن
  weightGrams?: number; // الوزن المعادل بالغرام (مثلاً 350g)
  returnedQuantity?: number; // الكمية المسترجعة من هذا البند
  total: number; // المجموع للسطر
  isCustomPrice?: boolean; // تم تعديل السعر في هذه القائمة فقط
}

// سجل توثيق عملية استرجاع مادة معينة من القائمة مع السبب
export interface ReturnedItemRecord {
  id: string;
  productId: string;
  productName: string;
  code: string;
  unit: string;
  quantity: number; // الكمية المسترجعة في هذه العملية
  unitPrice: number; // سعر البيع وقت الشراء
  costPrice: number; // سعر التكلفة
  refundAmount: number; // المبلغ الإجمالي المخصوم لهذه المادة (quantity * unitPrice)
  reason: string; // سبب الاسترجاع (خانة السبب المطلوبة)
  notes?: string; // ملاحظات إضافية
  returnedAt: string; // تاريخ ووقت العملية
  returnedBy?: string; // منفذ العملية
}

export interface SalesRep {
  id: string;
  name: string; // اسم المندوب
  phone: string; // رقم هاتف المندوب
  commissionRate: number; // نسبة المندوب المئوية (مثلاً 5 تعني 5%)
  commissionType: 'percentage_profit' | 'percentage_sales'; // النسبة من صافي الأرباح أو من إجمالي المبيعات
  showOnInvoice: boolean; // خيار إظهار أو إخفاء اسمه في القائمة المطبوعة
  notes?: string;
  isActive: boolean; // هل المندوب نشط حالياً
  createdAt: string;
}

export interface Invoice {
  id: string;
  ownerUid?: string;
  invoiceNumber: string; // رقم القائمة
  type: SaleType; // مباشر أم آجل
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number; // خصم نقدي
  total: number; // المبلغ الإجمالي المطلوب (بعد خصم المرتجعات إن وجدت)
  paidAmount: number; // المبلغ المسدد حالياً
  remainingAmount: number; // المبلغ المتبقي (آجل)
  previousDebt: number; // دين الزبون السابق قبل هذه الفاتورة
  currentTotalDebt: number; // إجمالي دين الزبون الجديد بعد هذه الفاتورة
  paymentDueDate?: string; // موعد استحقاق الدفع للآجل
  status: InvoiceStatus;
  notes?: string;
  date: string; // تاريخ ووقت الإنشاء
  createdAt?: string;
  updatedAt?: string;
  totalCost: number; // تكلفة البضاعة المباعة
  netProfit: number; // صافي الربح المحقق (total - totalCost - discount)
  shiftId?: string; // معرف الشفت المرتبط بهذه الفاتورة
  returnedItems?: ReturnedItemRecord[]; // سجل المواد المرتجعة مع أسبابها
  totalReturnedAmount?: number; // إجمالي المبالغ المسترجعة
  isPartiallyReturned?: boolean; // وسم يوضح إذا كانت القائمة مسترجعة جزئياً
  
  // بيانات مبيعات المندوب
  salesRepId?: string; // معرف المندوب
  salesRepName?: string; // اسم المندوب
  salesRepCommission?: number; // ربح / عمولة المندوب المحسوبة
  storeNetProfit?: number; // أرباح المالك الصافية بعد خصم عمولة المندوب
  showRepOnInvoice?: boolean; // خيار إظهار اسم المندوب في القائمة المطبوعة
}

// مسودة قائمة نشطة أو معلقة في نقطة البيع
export interface POSDraftOrder {
  id: string;
  orderNumber: number; // رقم القائمة التسلسلي المعروض في المربع الأخضر [1]، [2]...
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
  selectedSalesRepId?: string; // المندوب المختار لهذه القائمة
  showRepOnInvoice?: boolean; // إظهار اسمه في القائمة المطبوعة
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
  shiftNumber: number; // رقم تسلسلي للشفت (مثلاً شفت 1، شفت 2...)
  startTime: string; // وقت بدء الشفت
  endTime?: string; // وقت إنهاء الشفت
  status: 'active' | 'closed'; // حالة الشفت
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
  startingCash?: number; // نقد البداية في القاصة
  invoicesCount: number; // عدد الفواتير الصادرة أثناء الشفت
  invoicesIds: string[]; // أرقام الفواتير
  totalSales: number; // إجمالي المبيعات (نقد + آجل)
  totalPaid: number; // إجمالي المقبوض نقداً
  totalRemaining: number; // إجمالي الآجل/الديون
  totalCost: number; // إجمالي تكلفة البضاعة المباعة
  totalProfit: number; // صافي الربح المحقق في الشفت
  itemsSold: ShiftItemSold[]; // قائمة المواد المباعة وإحصائيات كل مادة
  presetShiftId?: string; // معرف الشفت المعد مسبقاً
  presetShiftName?: string; // اسم الشفت المعد مسبقاً
  sessionId?: string; // معرف جلسة الجهاز التي فتحت هذا الشفت
  deviceId?: string; // معرف الجهاز المحدد (للعمل المتزامن لعدة أجهزة)
  deviceName?: string; // اسم الجهاز (مثال: هاتف سامسونج، كمبيوتر المحاسبة)
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  notes?: string;
  createdAt: string;
}

// واجهة جلسة الجهاز المسجل في النظام
export interface DeviceSession {
  id: string; // معرف الجلسة sessionId
  deviceId: string; // معرف الجهاز المستمر
  userId: string; // معرف المستخدم أو صاحب المتجر
  deviceName: string; // اسم الجهاز بالعربية (مثال: كمبيوتر ويندوز، هاتف أندرويد)
  deviceType: 'desktop' | 'mobile' | 'tablet'; // نوع الجهاز
  os: string; // نظام التشغيل
  browser: string; // المتصفح
  location: string; // الموقع التقريبي والمنطقة الزمنية
  ip?: string; // عنوان الآي بي
  isCurrentDevice?: boolean; // هل هذا الجهاز هو الجهاز الحالي
  lastActive: string; // وقت آخر نشاط للجلسة
  activeShiftId?: string | null; // الشفت المفتوح في هذا الجهاز حالياً
  activeShiftName?: string | null; // اسم الشفت المفتوح
  createdAt: string;
}

// مجموعة المواد المكررة للمراجعة والحذف
export interface DuplicateProductGroup {
  id: string; // معرف المجموعة
  matchType: 'barcode' | 'exact_details' | 'name_price' | 'both'; // سبب التطابق
  matchLabel: string; // وصف سبب التطابق بالعربية
  matchKey: string; // القيمة المطابقة
  primaryItem: Product; // المادة الأساسية (الأقدم أو ذات المخزون)
  duplicateItems: Product[]; // المواد المكررة المقترح حذفها
  allProducts: Product[]; // جميع المواد في المجموعة
  isBarcodeMatch?: boolean;
  isExactMatch?: boolean;
  isNamePriceMatch?: boolean;
}

// قالب شفت معد مسبقاً له اسم ورمز سري خاص
export interface PresetShift {
  id: string;
  name: string; // اسم الشفت (مثل: شفت الصباح، شفت المساء)
  code: string; // الرمز السري الخاص بالشفت لبدئه
  notes?: string;
  createdAt: string;
  createdBy?: string;
}

// مشرف معتمد في النظام مع رمزه وصلاحياته
export interface StoreSupervisor {
  id: string;
  name: string; // اسم المشرف
  pin: string; // الرمز السري للمشرف
  canConfigureShifts?: boolean; // هل يملك صلاحية إعداد الشفتات المسبقة
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
export type DesktopLayoutMode = 'full' | 'partial'; // وضع الكمبيوتر الكامل | وضع الكمبيوتر الجزئي

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
  // تفاصيل الاشتراك والفترة التجريبية (3 أيام كحد أدنى للحسابات الجديدة)
  subscriptionType?: SubscriptionType;
  trialStartDate?: string;
  trialExpiresAt?: string; // تاريخ ووقت الانتهاء بصيغة ISO
  isPermanent?: boolean; // حساب دائمي مدى الحياة بنقرة واحدة من المدير العام
  subscriptionNotes?: string;
}

// أنواع مقاسات الورق المتاحة للطباعة
export type PrintFormatType = 'a4' | 'a5' | 'thermal' | 'thermal80' | 'thermal58';

export type InvoiceTemplateType = 'classic' | 'modern';

export interface ModernInvoiceHeaderConfig {
  badgeText?: string; // الكلمة في الدائرة البيضوية البيضاء فوق الاسم (مثال: قرطاسية، أسواق، تجارة، معرض...)
  fontFamily?: string; // خط كتابة اسم المحل (Cairo, Amiri, Aref Ruqaa, Reem Kufi, Changa, El Messiri, Tajawal)
  rightBannerColor?: string; // لون جهة الاسم (الافتراضي: #1e40af أزرق ملكي)
  leftBannerColor?: string; // لون جهة الأنشطة (الافتراضي: #ea580c برتقالي دافئ)
  activitiesText?: string; // نص الأنشطة والمواد (مثال: لوازم مدرسية - لوازم مكتبية - هدايا - لعب أطفال)
  badgeLeftText?: string; // وسم الجملة (مثال: جملة)
  badgeRightText?: string; // وسم المفرد (مثال: مفرد)
  centerIconType?: 'preset' | 'custom'; // نوع أيقونة الوسط
  centerIconPreset?: string; // اسم الأيقونة الجاهزة (stationery, market, hardware, clothes, electrical, gifts, general)
  centerIconCustomUrl?: string; // رابط أو صورة مرفوعة لوسط الترويسة
  barcodeImageUrl?: string; // صورة الباركود أو الـ QR المرفوعة من الجهاز
  showBarcode?: boolean; // تفعيل إظهار الباركود
  // شبكات التواصل الاجتماعي مع خيار إظهار/إخفاء كل منها
  showTelegram?: boolean;
  telegramHandle?: string; // معرف تليغرام
  showFacebook?: boolean;
  facebookName?: string; // اسم صفحة فيسبوك
  showWhatsapp?: boolean;
  whatsappNumber?: string; // رقم واتساب
  showInstagram?: boolean;
  instagramHandle?: string; // حساب انستغرام
  deliveryNote?: string; // عبارة التوصيل (مثال: توصيل جميع المحافظات)
}

export interface StoreSettings {
  storeName: string;
  ownerName: string;
  phone: string;
  address: string;
  currency: string; // مثلاً: د.ع (دينار عراقي) أو $ أو ر.س
  invoiceFooterNote: string;
  printFormat: PrintFormatType; // A4 أو A5 أو رول 80 مم أو رول 58 مم
  invoiceTemplate?: InvoiceTemplateType; // 'classic' = التقليدي ذو الأختام | 'modern' = العصري الملون
  modernHeader?: ModernInvoiceHeaderConfig; // إعدادات الترويسة العصرية
  directPrintEnabled?: boolean; // تفعيل الطباعة الفورية الصامتة بدون نافذة حوار
  selectedPrinterName?: string; // اسم طابعة الكاشير المحددة للطباعة اللحظية في أقل من ثانية
  printerPaperSize?: PrintFormatType | string; // مقاس ورق الطابعة
  enableWholesale: boolean; // تفعيل أو إلغاء إظهار سعر بيع الجملة
  deviceMode: DeviceMode; // وضع الحاسبة أو وضع الهاتف (Android / iPhone)
  desktopLayout: DesktopLayoutMode; // 'full' = وضع الكمبيوتر الكامل, 'partial' = وضع الكمبيوتر الجزئي
  
  // تخصيص نصوص وترويسة القائمة حسب رغبة صاحب المحل
  headerRightSealText?: string; // مثلاً "جملة" أو "تجزئة" أو "مورد"
  headerLeftSealText?: string; // مثلاً "مفرد" أو "قطع" أو "نقد"
  businessSubtitle?: string; // مثلاً "تجارة عامة وبيع الجملة والمفرد"
  managerLabel?: string; // مثلاً "بإدارة" أو "إشراف" أو "المدير العام"

  // إعدادات جلسات الموظفين والمشرفين
  supervisorPin?: string; // الرمز السري لجلسة المشرف
  supervisors?: StoreSupervisor[]; // قائمة المشرفين المتعددين مع رموزهم وصلاحياتهم
  presetShifts?: PresetShift[]; // قائمة قوالب الشفتات المعدة مسبقاً
  employeePermissions?: Partial<RolePermissions>; // تخصيص صلاحيات الموظف
  supervisorPermissions?: Partial<RolePermissions>; // تخصيص صلاحيات المشرف
  defaultSessionOnLaunch?: SessionRole; // الجلسة الافتراضية عند فتح البرنامج

  // إعدادات نظام المندوبين وتوزيع الأرباح
  enableSalesReps?: boolean; // تفعيل أو إطفاء ميزة بيع القوائم بواسطة المندوبين
  salesReps?: SalesRep[]; // قائمة المندوبين المسجلين
  defaultShowRepOnInvoice?: boolean; // الإعداد الافتراضي لإظهار اسم المندوب في القوائم المطبوعة
  repCommissionDefaultType?: 'percentage_profit' | 'percentage_sales'; // طريقة احتساب العمولة الافتراضية

  // مظهر وثيم البرنامج
  theme?: 'light' | 'dark'; // المظهر: فاتح أو داكن متناسق مع هوية المفكر المحاسبي
}

// اسم مستعار لضمان التوافق مع أي استدعاء باسم Settings في التطبيق
export type Settings = StoreSettings;

export type SessionRole = 'admin' | 'supervisor' | 'employee';

export interface RolePermissions {
  canSell: boolean; // البيع وإعداد الفواتير
  canAddNewProduct: boolean; // إضافة مادة جديدة للمخزن
  canEditProductPrice: boolean; // تعديل السعر في القائمة للزبون
  canViewInvoices: boolean; // معاينة سجل الفواتير والقوائم
  canReturnInvoice: boolean; // استعادة الفاتورة للمخزن
  canDeleteInvoice: boolean; // حذف الفاتورة نهائياً
  canViewCustomers: boolean; // الدخول لسجل الديون والعملاء
  canViewReports: boolean; // الدخول لسجل الأرباح والتقارير المالية
  canAccessSettings: boolean; // الدخول لشاشة الإعدادات
  canAccessInventory: boolean; // الدخول لجدول المخزن الكامل
  canAccessShifts: boolean; // الدخول لسجل وتبويب الشفتات
  canManageShifts: boolean; // بدء وإنهاء الشفت وحفظه
  canConfigureShifts: boolean; // إعداد وتعديل وحذف الشفتات المسبقة
  canManageSalesReps?: boolean; // الدخول وإدارة نظام المندوبين
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
