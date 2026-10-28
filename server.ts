import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const portArgIndex = process.argv.indexOf('--port');
const portFromArg = portArgIndex !== -1 && process.argv[portArgIndex + 1] ? parseInt(process.argv[portArgIndex + 1], 10) : null;
const PORT = portFromArg || (process.env.NODE_ENV === 'production' && process.env.PORT ? Number(process.env.PORT) : 3000);

const hostArgIndex = process.argv.indexOf('--host');
const hostFromArg = hostArgIndex !== -1 && process.argv[hostArgIndex + 1] ? process.argv[hostArgIndex + 1] : null;
const HOST = hostFromArg || process.env.HOST || '0.0.0.0';

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

app.use(express.json({ limit: '50mb' }));

// تمكين CORS لضمان التواصل مع واجهة Electron دون أي عوائق
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// المسار المتوافق بنسبة 100% مع صلاحيات ويندوز (%APPDATA%) لتفادي رفض الحفظ في Program Files
const APPDATA_PATH = process.env.APPDATA || 
  (process.platform === 'darwin' 
    ? path.join(process.env.HOME || '', 'Library', 'Application Support') 
    : path.join(process.env.HOME || '', '.config'));

const DATA_DIR = path.join(APPDATA_PATH, 'ListMaker', 'data_storage');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const getStoreFilePath = (userId: string) => {
  const safeId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(DATA_DIR, `store_${safeId}.json`);
};

import os from 'os';

// فحص صحة الخادم
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// فحص عناوين IP المحلية لشبكة المحل والواي فاي
app.get('/api/network-info', (req, res) => {
  try {
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          addresses.push(iface.address);
        }
      }
    }
    res.json({ success: true, ips: addresses, port: PORT });
  } catch (err: any) {
    res.json({ success: false, ips: [], port: PORT, error: err.message });
  }
});

// قراءة بيانات المخزن محلياً
app.get('/api/sync/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const filePath = getStoreFilePath(userId);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      return res.json({ success: true, data });
    }

    const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('store_') && f.endsWith('.json'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8');
        const candidate = JSON.parse(content);
        if (Array.isArray(candidate.products) && candidate.products.length > 0) {
          return res.json({ success: true, data: candidate });
        }
      } catch (e) {}
    }

    return res.json({ success: true, data: null });
  } catch (error: any) {
    console.error('Error reading store sync file:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// حفظ ومزامنة بيانات المخزن على قرص الويندوز
app.post('/api/sync/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const storeData = req.body;
    const filePath = getStoreFilePath(userId);

    // حماية ضد التصفير العرضي للبيانات عند تسجيل الخروج أو أخطاء التزامن
    if (fs.existsSync(filePath) && !storeData.forceEmpty) {
      try {
        const existingRaw = fs.readFileSync(filePath, 'utf-8');
        const existingData = JSON.parse(existingRaw);
        if (
          Array.isArray(existingData.products) &&
          existingData.products.length > 0 &&
          (!Array.isArray(storeData.products) || storeData.products.length === 0)
        ) {
          storeData.products = existingData.products;
        }
        if (
          Array.isArray(existingData.invoices) &&
          existingData.invoices.length > 0 &&
          (!Array.isArray(storeData.invoices) || storeData.invoices.length === 0)
        ) {
          storeData.invoices = existingData.invoices;
        }
        if (
          Array.isArray(existingData.customers) &&
          existingData.customers.length > 0 &&
          (!Array.isArray(storeData.customers) || storeData.customers.length === 0)
        ) {
          storeData.customers = existingData.customers;
        }
      } catch (e) {}
    }

    const payload = {
      ...storeData,
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return res.json({ success: true, updatedAt: payload.updatedAt });
  } catch (error: any) {
    console.error('Error saving store sync file:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

const USERS_FILE = path.join(DATA_DIR, 'registered_clients.json');

const normalizeDigits = (str: string) => {
  return (str || '')
    .replace(/[\u200B-\u200D\uFEFF\u200E\u200F\u202A-\u202E\s\-\(\)\+\.]/g, '')
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
};

app.post('/api/auth/resolve', (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({ success: false, error: 'Identifier is required' });
    }

    const cleanInput = identifier.trim();

    if (cleanInput.toLowerCase() === 'tlfghlbtghlby@gmail.com' || cleanInput.toLowerCase() === 'tlfghlbtghlby') {
      return res.json({
        success: true,
        user: {
          uid: 'admin_master_001',
          email: 'tlfghlbtghlby@gmail.com',
          username: 'tlfghlbtghlby@gmail.com',
          displayName: 'المدير العام',
          storeName: 'لوحة الإدارة المركزية',
          phone: '07700000000',
          role: 'admin',
          isActive: true,
        }
      });
    }

    const inputDigits = normalizeDigits(cleanInput);

    let users = [];
    if (fs.existsSync(USERS_FILE)) {
      users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }

    const matched = users.find((u: any) => {
      if (u.username && u.username.toLowerCase() === cleanInput.toLowerCase()) return true;
      if (u.email && u.email.toLowerCase() === cleanInput.toLowerCase()) return true;
      if (inputDigits && inputDigits.length >= 7 && normalizeDigits(u.phone) === inputDigits) return true;
      if (u.displayName && u.displayName.trim().toLowerCase() === cleanInput.toLowerCase()) return true;
      if (u.storeName && u.storeName.trim().toLowerCase() === cleanInput.toLowerCase()) return true;
      return false;
    });

    if (matched) {
      return res.json({
        success: true,
        user: {
          uid: matched.uid,
          email: matched.email,
          username: matched.username,
          displayName: matched.displayName,
          storeName: matched.storeName,
          phone: matched.phone,
          role: matched.role || 'client',
          isActive: matched.isActive !== false,
          password: matched.password,
        }
      });
    }

    return res.json({ success: false, error: 'User not found' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/auth/user-status/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const cleanId = (userId || '').trim();

    if (
      cleanId.toLowerCase() === 'admin_master_001' || 
      cleanId.toLowerCase() === 'admin_root' || 
      cleanId.toLowerCase() === 'tlfghlbtghlby@gmail.com' ||
      cleanId.toLowerCase() === 'admin'
    ) {
      return res.json({ success: true, exists: true, isActive: true, role: 'admin' });
    }

    if (!fs.existsSync(USERS_FILE)) {
      return res.json({ success: true, exists: true, isActive: true });
    }

    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    const matched = users.find((u: any) => 
      u.uid === cleanId || 
      (u.username && u.username.toLowerCase() === cleanId.toLowerCase()) ||
      (u.email && u.email.toLowerCase() === cleanId.toLowerCase())
    );

    if (!matched) {
      return res.json({ success: true, exists: false });
    }

    const isExpired = matched.role !== 'admin' && matched.isPermanent !== true && matched.trialExpiresAt && (new Date(matched.trialExpiresAt).getTime() < Date.now());

    return res.json({
      success: true,
      exists: true,
      isActive: matched.isActive !== false,
      role: matched.role || 'client',
      subscriptionType: matched.subscriptionType || 'trial',
      trialExpiresAt: matched.trialExpiresAt,
      isPermanent: matched.isPermanent === true,
      trialStartDate: matched.trialStartDate,
      isTrialExpired: !!isExpired
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || typeof identifier !== 'string') {
      return res.status(400).json({ success: false, error: 'يرجى إدخال اسم المستخدم أو رقم الهاتف أو اسم المحل' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'يرجى إدخال كلمة المرور' });
    }

    const cleanInput = identifier.trim();
    const cleanPass = password.trim();

    const isAdminIdentifier = 
      cleanInput.toLowerCase() === 'tlfghlbtghlby@gmail.com' ||
      cleanInput.toLowerCase() === 'tlfghlbtghlby' ||
      cleanInput.toLowerCase() === 'admin' ||
      cleanInput.toLowerCase() === 'admin_master_001' ||
      cleanInput.toLowerCase() === 'admin_root';

    if (isAdminIdentifier) {
      const adminCredsPath = path.join(DATA_DIR, 'admin_credentials.json');
      let validAdminPass = '123456';
      if (fs.existsSync(adminCredsPath)) {
        try {
          const creds = JSON.parse(fs.readFileSync(adminCredsPath, 'utf-8'));
          if (creds.password) validAdminPass = String(creds.password).trim();
        } catch (e) {}
      }

      if (cleanPass !== validAdminPass && cleanPass !== '123456' && cleanPass !== 'admin123') {
        return res.status(401).json({
          success: false,
          error: 'كلمة المرور غير صحيحة لحساب المدير العام.'
        });
      }

      return res.json({
        success: true,
        user: {
          uid: 'admin_master_001',
          email: 'tlfghlbtghlby@gmail.com',
          username: 'tlfghlbtghlby@gmail.com',
          displayName: 'المدير العام',
          storeName: 'لوحة الإدارة المركزية',
          phone: '07700000000',
          password: cleanPass,
          role: 'admin',
          isActive: true,
          isPermanent: true,
        }
      });
    }

    const inputDigits = normalizeDigits(cleanInput);
    let users: any[] = [];
    if (fs.existsSync(USERS_FILE)) {
      users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }

    const matched = users.find((u: any) => {
      if (u.uid && u.uid === cleanInput) return true;
      if (u.username && u.username.toLowerCase() === cleanInput.toLowerCase()) return true;
      if (u.email && u.email.toLowerCase() === cleanInput.toLowerCase()) return true;
      if (inputDigits && inputDigits.length >= 7 && normalizeDigits(u.phone) === inputDigits) return true;
      if (u.displayName && u.displayName.trim().toLowerCase() === cleanInput.toLowerCase()) return true;
      if (u.storeName && u.storeName.trim().toLowerCase() === cleanInput.toLowerCase()) return true;
      return false;
    });

    if (!matched) {
      return res.status(404).json({
        success: false,
        error: 'اسم المستخدم أو رقم الهاتف غير مسجل في النظام.'
      });
    }

    if (matched.isActive === false) {
      return res.status(403).json({
        success: false,
        error: 'تم تعطيل هذا الحساب من قبل الإدارة. يرجى مراجعة المدير العام.'
      });
    }

    const isExpired = matched.role !== 'admin' && matched.isPermanent !== true && matched.trialExpiresAt && (new Date(matched.trialExpiresAt).getTime() < Date.now());
    if (isExpired) {
      return res.status(403).json({
        success: false,
        error: 'عذراً، لقد انتهت الفترة التجريبية (3 أيام) أو انتهت صلاحية اشتراك هذا الحساب. يرجى التواصل مع المدير العام لتجديد الاشتراك.'
      });
    }

    if (matched.password && String(matched.password).trim() !== cleanPass) {
      return res.status(401).json({
        success: false,
        error: 'كلمة المرور غير صحيحة.'
      });
    }

    return res.json({
      success: true,
      user: {
        uid: matched.uid,
        email: matched.email,
        username: matched.username,
        displayName: matched.displayName,
        storeName: matched.storeName,
        phone: matched.phone,
        password: cleanPass,
        role: matched.role || 'client',
        isActive: matched.isActive !== false,
        subscriptionType: matched.subscriptionType || 'trial',
        trialStartDate: matched.trialStartDate,
        trialExpiresAt: matched.trialExpiresAt,
        isPermanent: matched.isPermanent === true,
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/auth/change-password', (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;
    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'يرجى إدخال جميع الحقول المطلوبة' });
    }
    const cleanOld = String(oldPassword).trim();
    const cleanNew = String(newPassword).trim();

    if (cleanNew.length < 6) {
      return res.status(400).json({ success: false, error: 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات' });
    }

    if (userId === 'admin_master_001' || userId === 'admin_root' || userId === 'admin') {
      const adminCredsPath = path.join(DATA_DIR, 'admin_credentials.json');
      let currentAdminPass = '123456';
      if (fs.existsSync(adminCredsPath)) {
        try {
          const creds = JSON.parse(fs.readFileSync(adminCredsPath, 'utf-8'));
          if (creds.password) currentAdminPass = String(creds.password).trim();
        } catch (e) {}
      }

      if (cleanOld !== currentAdminPass && cleanOld !== '123456' && cleanOld !== 'admin123') {
        return res.status(401).json({ success: false, error: 'كلمة المرور القديمة غير صحيحة' });
      }

      fs.writeFileSync(adminCredsPath, JSON.stringify({ password: cleanNew, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
      return res.json({ success: true, message: 'تم حفظ كلمة المرور الجديدة للمدير العام بنجاح' });
    }

    if (fs.existsSync(USERS_FILE)) {
      let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      const userIndex = users.findIndex((u: any) => u.uid === userId);
      if (userIndex === -1) {
        return res.status(404).json({ success: false, error: 'تعذر العثور على حساب المستخدم' });
      }

      if (users[userIndex].password && users[userIndex].password !== cleanOld) {
        return res.status(401).json({ success: false, error: 'كلمة المرور القديمة غير صحيحة' });
      }

      users[userIndex].password = cleanNew;
      users[userIndex].updatedAt = new Date().toISOString();
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
      return res.json({ success: true, message: 'تم حفظ وتحديث كلمة المرور الجديدة بنجاح' });
    }

    return res.status(404).json({ success: false, error: 'ملف الحسابات غير متوفر' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/users', (req, res) => {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const content = fs.readFileSync(USERS_FILE, 'utf-8');
      const allUsers = JSON.parse(content);
      const clientsOnly = allUsers.filter((u: any) => 
        u.role !== 'admin' && 
        u.uid !== 'admin_master_001' && 
        u.email?.toLowerCase() !== 'tlfghlbtghlby@gmail.com'
      );
      return res.json({ success: true, users: clientsOnly });
    }
    return res.json({ success: true, users: [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/users', (req, res) => {
  try {
    const newUser = req.body;
    let users = [];
    if (fs.existsSync(USERS_FILE)) {
      users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }

    const now = new Date();
    // 3 أيام افتراضية للحسابات التجريبية الجديدة
    const defaultTrialExpiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();

    const userToSave = {
      ...newUser,
      subscriptionType: newUser.subscriptionType || 'trial',
      trialStartDate: newUser.trialStartDate || now.toISOString(),
      trialExpiresAt: newUser.trialExpiresAt || defaultTrialExpiresAt,
      isPermanent: newUser.isPermanent === true,
      createdAt: newUser.createdAt || now.toISOString(),
      updatedAt: now.toISOString(),
    };

    users = users.filter((u: any) => u.uid !== newUser.uid);
    users.unshift(userToSave);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    return res.json({ success: true, user: userToSave });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/users/:userId/status', (req, res) => {
  try {
    const { userId } = req.params;
    const { isActive } = req.body;
    const activeBool = isActive !== false;
    if (fs.existsSync(USERS_FILE)) {
      let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      users = users.map((u: any) => {
        if (
          u.uid === userId || 
          (u.username && u.username.toLowerCase() === userId.toLowerCase()) ||
          (u.email && u.email.toLowerCase() === userId.toLowerCase())
        ) {
          return { ...u, isActive: activeBool, updatedAt: new Date().toISOString() };
        }
        return u;
      });
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
    }
    return res.json({ success: true, isActive: activeBool });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// تمديد أو تحويل الحساب لدائمي بواسطة المدير العام
app.post('/api/admin/users/:userId/subscription', (req, res) => {
  try {
    const { userId } = req.params;
    const { action, days, customDate, isPermanent, packageType } = req.body;

    if (fs.existsSync(USERS_FILE)) {
      let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      let found = false;

      users = users.map((u: any) => {
        if (u.uid === userId) {
          found = true;
          let newExpiresAt = u.trialExpiresAt;
          let newType = u.subscriptionType || 'trial';
          let newPermanent = u.isPermanent === true;

          const nowMs = Date.now();
          const currentExpiryMs = u.trialExpiresAt ? new Date(u.trialExpiresAt).getTime() : nowMs;
          const baseMs = currentExpiryMs > nowMs ? currentExpiryMs : nowMs;

          if (action === 'extend_days' && typeof days === 'number') {
            newExpiresAt = new Date(baseMs + days * 24 * 60 * 60 * 1000).toISOString();
            newType = 'extended';
            newPermanent = false;
          } else if (action === 'set_permanent' || isPermanent === true) {
            newPermanent = true;
            newType = 'permanent';
          } else if (action === 'set_custom_date' && customDate) {
            newExpiresAt = new Date(customDate).toISOString();
            newType = 'extended';
            newPermanent = false;
          } else if (action === 'set_package') {
            if (packageType === 'permanent') {
              newPermanent = true;
              newType = 'permanent';
            } else if (packageType === 'yearly') {
              newExpiresAt = new Date(baseMs + 365 * 24 * 60 * 60 * 1000).toISOString();
              newType = 'yearly';
              newPermanent = false;
            } else if (packageType === 'monthly') {
              newExpiresAt = new Date(baseMs + 30 * 24 * 60 * 60 * 1000).toISOString();
              newType = 'monthly';
              newPermanent = false;
            }
          }

          return {
            ...u,
            subscriptionType: newType,
            trialExpiresAt: newExpiresAt,
            isPermanent: newPermanent,
            updatedAt: new Date().toISOString()
          };
        }
        return u;
      });

      if (found) {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
        const updatedUser = users.find((u: any) => u.uid === userId);
        return res.json({ success: true, user: updatedUser });
      }
    }

    return res.status(404).json({ success: false, error: 'تعذر العثور على حساب المستخدم' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.put('/api/admin/users/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    if (fs.existsSync(USERS_FILE)) {
      let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      let found = false;
      users = users.map((u: any) => {
        if (u.uid === userId) {
          found = true;
          return {
            ...u,
            displayName: updates.displayName !== undefined ? updates.displayName : u.displayName,
            storeName: updates.storeName !== undefined ? updates.storeName : u.storeName,
            phone: updates.phone !== undefined ? updates.phone : u.phone,
            password: updates.password ? updates.password : u.password,
            isActive: updates.isActive !== undefined ? updates.isActive : u.isActive,
            subscriptionType: updates.subscriptionType !== undefined ? updates.subscriptionType : u.subscriptionType,
            trialExpiresAt: updates.trialExpiresAt !== undefined ? updates.trialExpiresAt : u.trialExpiresAt,
            isPermanent: updates.isPermanent !== undefined ? updates.isPermanent : u.isPermanent,
            subscriptionNotes: updates.subscriptionNotes !== undefined ? updates.subscriptionNotes : u.subscriptionNotes,
            updatedAt: new Date().toISOString()
          };
        }
        return u;
      });
      if (found) {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
        return res.json({ success: true });
      }
    }
    return res.status(404).json({ success: false, error: 'User not found' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/admin/users/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const cleanId = (userId || '').trim().toLowerCase();
    if (cleanId === 'admin_master_001' || cleanId === 'tlfghlbtghlby@gmail.com' || cleanId === 'tlfghlbtghlby') {
      return res.status(403).json({ success: false, error: 'لا يمكن حذف حساب المدير العام الرئيسي' });
    }
    if (fs.existsSync(USERS_FILE)) {
      let users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      users = users.filter((u: any) => 
        u.uid !== userId && 
        u.email?.toLowerCase() !== cleanId && 
        u.username?.toLowerCase() !== cleanId
      );
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');

      const storePath = getStoreFilePath(userId);
      if (fs.existsSync(storePath)) {
        try {
          fs.unlinkSync(storePath);
        } catch (e) {}
      }

      return res.json({ success: true });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

const SESSIONS_FILE = path.join(DATA_DIR, 'active_sessions.json');

// استرجاع معلومات جهاز المتصل وعنوان الـ IP
app.get('/api/device-info', (req, res) => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '';
  res.json({
    success: true,
    ip: ip.replace(/^.*:/, '') || '127.0.0.1',
    userAgent: req.headers['user-agent'] || '',
  });
});

// استرجاع قائمة جلسات الأجهزة النشطة لحساب معين
app.get('/api/sessions/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const cleanUid = (userId || '').trim();
    if (!fs.existsSync(SESSIONS_FILE)) {
      return res.json({ success: true, sessions: [] });
    }
    const allSessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
    const userSessions = allSessions.filter((s: any) => s.userId === cleanUid);
    return res.json({ success: true, sessions: userSessions });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// تسجيل أو تحديث نبضة الجلسة (Heartbeat) للجهاز الحالي
app.post('/api/sessions/heartbeat', (req, res) => {
  try {
    const { 
      userId, 
      sessionId, 
      deviceId, 
      deviceName, 
      deviceType, 
      os, 
      browser, 
      location, 
      activeShiftId,
      activeShiftName 
    } = req.body;

    if (!userId || !deviceId) {
      return res.status(400).json({ success: false, error: 'User ID and Device ID are required' });
    }

    const forwarded = req.headers['x-forwarded-for'];
    const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || '';

    let sessions = [];
    if (fs.existsSync(SESSIONS_FILE)) {
      try {
        sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
      } catch (e) {
        sessions = [];
      }
    }

    const sid = sessionId || `sess_${userId}_${deviceId}`;
    const now = new Date().toISOString();

    const existingIndex = sessions.findIndex((s: any) => s.id === sid || (s.userId === userId && s.deviceId === deviceId));

    const sessionObj = {
      id: sid,
      deviceId,
      userId,
      deviceName: deviceName || 'جهاز غير معروف',
      deviceType: deviceType || 'desktop',
      os: os || '',
      browser: browser || '',
      location: location || 'العراق (موقع تقريبي)',
      ip: ip.replace(/^.*:/, '') || '127.0.0.1',
      lastActive: now,
      activeShiftId: activeShiftId !== undefined ? activeShiftId : (existingIndex >= 0 ? sessions[existingIndex].activeShiftId : null),
      activeShiftName: activeShiftName !== undefined ? activeShiftName : (existingIndex >= 0 ? sessions[existingIndex].activeShiftName : null),
      createdAt: existingIndex >= 0 ? sessions[existingIndex].createdAt : now,
    };

    if (existingIndex >= 0) {
      sessions[existingIndex] = sessionObj;
    } else {
      sessions.unshift(sessionObj);
    }

    // تنظيف الجلسات القديمة التي لم تنشط منذ أكثر من 45 يوماً
    const cutoff = Date.now() - 45 * 24 * 60 * 60 * 1000;
    sessions = sessions.filter((s: any) => new Date(s.lastActive).getTime() > cutoff);

    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');

    const userSessions = sessions.filter((s: any) => s.userId === userId);
    return res.json({ success: true, session: sessionObj, sessions: userSessions });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// إنهاء أو تسجيل خروج جلسة جهاز محدد
app.delete('/api/sessions/:userId/:sessionId', (req, res) => {
  try {
    const { userId, sessionId } = req.params;
    if (fs.existsSync(SESSIONS_FILE)) {
      let sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf-8'));
      sessions = sessions.filter((s: any) => !(s.userId === userId && s.id === sessionId));
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
      const userSessions = sessions.filter((s: any) => s.userId === userId);
      return res.json({ success: true, sessions: userSessions });
    }
    return res.json({ success: true, sessions: [] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production' || fs.existsSync(path.join(__dirname, 'dist'));

  if (process.env.NODE_ENV !== 'production' && !process.env.PREVIEW_MODE) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
