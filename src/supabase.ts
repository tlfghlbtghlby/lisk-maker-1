import { createClient } from '@supabase/supabase-js';
import { ADMIN_EMAIL } from './types';
import { hashPassword, verifyPassword, isPasswordHash } from './utils/passwordHash';

// يمكن تغيير الإعدادات عبر ملف .env (VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY) دون تعديل الكود.
// المفتاح من نوع publishable/anon مصمم ليكون عاماً، وحماية البيانات الفعلية تتم عبر سياسات RLS في Supabase.
export const supabaseUrl: string =
  (import.meta.env?.VITE_SUPABASE_URL as string) || 'https://obodoxxzolgcwvzkkoua.supabase.co';
export const supabaseAnonKey: string =
  (import.meta.env?.VITE_SUPABASE_ANON_KEY as string) || 'sb_publishable_0aNPlD59KqYsmVr8r_tMEw_wpgmlj2o';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// دالة لجلب وثيقة محددة من السحابة (تُرجع null عند الخطأ أو عدم الوجود)
export async function getDocument(collectionName: string, docId: string) {
  try {
    const { data, error } = await supabase
      .from('documents')
      .select('data')
      .eq('collection', collectionName)
      .eq('id', docId)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching ${collectionName}/${docId}:`, error);
      return null;
    }
    return data ? data.data : null;
  } catch (err) {
    console.error('Network error fetching document:', err);
    return null;
  }
}

// نسخة صارمة: ترمي خطأ عند فشل الاتصال، لتمييز "غير موجود" عن "تعذر الاتصال" (مهم لتسجيل الدخول)
async function getDocumentStrict(collectionName: string, docId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('data')
    .eq('collection', collectionName)
    .eq('id', docId)
    .maybeSingle();
  if (error) throw error;
  return data ? data.data : null;
}

// دالة لحفظ أو تحديث وثيقة في السحابة
export async function setDocument(collectionName: string, docId: string, docData: any) {
  try {
    const { error } = await supabase
      .from('documents')
      .upsert({
        collection: collectionName,
        id: docId,
        data: docData,
        updated_at: new Date().toISOString()
      }, { onConflict: 'collection,id' });

    if (error) {
      console.error(`Error saving ${collectionName}/${docId}:`, error);
      throw error;
    }
  } catch (err) {
    console.error('Network error saving document:', err);
    throw err;
  }
}

// دالة الاستماع اللحظي للتعديلات
export function subscribeToDocument(collectionName: string, docId: string, callback: (data: any) => void) {
  const channel = supabase
    .channel(`realtime:${collectionName}:${docId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'documents',
        filter: `id=eq.${docId}`
      },
      (payload: any) => {
        if (payload.new && payload.new.data) {
          callback(payload.new.data);
        }
      }
    )
    .subscribe();

  return {
    unsubscribe: () => supabase.removeChannel(channel)
  };
}

// ---------------------------------------------------------------------------
// الجلسة المحلية
// ---------------------------------------------------------------------------

// تنظيف بقايا النسخ القديمة التي كانت تخزّن كلمة المرور نصاً في المتصفح
(function scrubLegacyLocalSecrets() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem('last_known_account_password');
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key || (key !== 'active_client_session' && !key.startsWith('profile_'))) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object' && 'password' in obj) {
          delete obj.password;
          localStorage.setItem(key, JSON.stringify(obj));
        }
      } catch {}
    }
  } catch {}
})();

// دالة تسجيل الخروج
export async function logoutAccount() {
  try {
    localStorage.removeItem('active_client_session');
    localStorage.removeItem('last_active_user_uid');
    localStorage.removeItem('active_session_role');
    localStorage.removeItem('last_known_account_password'); // مفتاح قديم كان يخزّن كلمة المرور نصاً
  } catch (e) {}
}

// دالة جلب الجلسة النشطة محلياً
export function getActiveLocalSession() {
  try {
    const raw = localStorage.getItem('active_client_session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// الحسابات وكلمات المرور
// ---------------------------------------------------------------------------

export const ADMIN_UID = `user_${ADMIN_EMAIL.toLowerCase()}`;
const LEGACY_ADMIN_UID = 'admin_master_001';

// أسماء محجوزة لا يجوز إنشاء حساب زبون بها حتى لا تنتحل حساب المدير
const RESERVED_USERNAMES = new Set([
  'admin',
  'admin_root',
  LEGACY_ADMIN_UID,
  ADMIN_EMAIL.toLowerCase(),
  ADMIN_EMAIL.toLowerCase().split('@')[0],
]);

const MIN_PASSWORD_LENGTH = 6;

// إزالة أي أسرار من بيانات الحساب قبل عرضها في الواجهة
function stripSecrets(record: any) {
  if (!record) return record;
  const { password, passwordHash, ...rest } = record;
  return { ...rest, hasPassword: Boolean(passwordHash || password) };
}

// الجلسة المحلية: لا تحوي كلمة المرور أبداً، وتحتفظ بالتجزئة فقط لتمكين التحقق دون اتصال
function toSession(record: any) {
  const { password, ...rest } = record;
  return rest;
}

function saveSession(session: any) {
  try {
    localStorage.setItem('active_client_session', JSON.stringify(session));
    localStorage.setItem('last_active_user_uid', session.uid);
    localStorage.setItem('active_session_role', session.role || 'client');
    localStorage.removeItem('last_known_account_password');
  } catch {}
}

// يُرجع التجزئة الخاصة بالسجل. إن كان السجل قديماً (كلمة مرور نصية) تُحوَّل إلى تجزئة ويُحذف النص.
async function upgradeLegacyPassword(record: any): Promise<{ record: any; changed: boolean }> {
  if (!record) return { record, changed: false };
  if (record.password !== undefined && record.password !== null && String(record.password).trim() !== '') {
    const next = { ...record };
    if (!isPasswordHash(next.passwordHash)) {
      next.passwordHash = await hashPassword(String(record.password).trim());
    }
    delete next.password;
    return { record: next, changed: true };
  }
  if ('password' in record) {
    const next = { ...record };
    delete next.password;
    return { record: next, changed: true };
  }
  return { record, changed: false };
}

// تحقق من كلمة المرور مقابل سجل (يدعم التجزئة والصيغة القديمة النصية)
async function checkRecordPassword(record: any, password: string): Promise<boolean> {
  if (!record) return false;
  if (isPasswordHash(record.passwordHash)) {
    return verifyPassword(password, record.passwordHash);
  }
  if (record.password !== undefined && record.password !== null && String(record.password).trim() !== '') {
    return String(record.password).trim() === password;
  }
  return false;
}

function hasAnyCredential(record: any): boolean {
  return Boolean(
    record && (isPasswordHash(record.passwordHash) || (record.password && String(record.password).trim() !== ''))
  );
}

// ---------------------------------------------------------------------------
// واجهات ودوال إدارة الحسابات
// ---------------------------------------------------------------------------

export interface CreateClientInput {
  username: string;
  password: string;
  displayName: string;
  storeName: string;
  phone: string;
}

export interface UpdateClientInput {
  uid: string;
  displayName?: string;
  storeName?: string;
  phone?: string;
  password?: string;
  isActive?: boolean;
  enableShifts?: boolean;
  enableSalesReps?: boolean;
  enableSupervisor?: boolean;
  enableEmployee?: boolean;
  enableCustomerPriceChecker?: boolean;
}

async function loadAllRawAccounts(): Promise<any[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, data')
    .eq('collection', 'users');

  if (error) {
    console.error('Error fetching clients:', error);
    return [];
  }
  return (data || []).map((row: any) => ({ uid: row.id, ...row.data }));
}

// قائمة الزبائن للوحة الإدارة (بدون أي كلمات مرور أو تجزئات)
export async function loadAllClientAccounts() {
  const all = await loadAllRawAccounts();
  return all.map(stripSecrets);
}

export async function createClientAccount(input: CreateClientInput) {
  const cleanUsername = input.username.trim().toLowerCase();
  if (!cleanUsername) throw new Error('يرجى إدخال اسم المستخدم.');
  if (RESERVED_USERNAMES.has(cleanUsername)) {
    throw new Error('هذا الاسم محجوز للنظام، يرجى اختيار اسم آخر.');
  }
  if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`يجب ألا تقل كلمة المرور عن ${MIN_PASSWORD_LENGTH} خانات.`);
  }

  const uid = 'user_' + cleanUsername;

  const existing = await getDocument('users', uid);
  if (existing) {
    const err: any = new Error('اسم المستخدم مستخدم مسبقاً، يرجى اختيار اسم آخر.');
    err.code = 'auth/email-already-in-use';
    throw err;
  }

  const now = new Date();
  const newClientData = {
    uid,
    username: cleanUsername,
    displayName: input.displayName,
    storeName: input.storeName,
    phone: input.phone,
    passwordHash: await hashPassword(input.password),
    role: 'client',
    isActive: true,
    isPermanent: false,
    trialExpiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
  };

  await setDocument('users', uid, newClientData);
  return stripSecrets(newClientData);
}

export async function updateClientAccount(updates: UpdateClientInput) {
  const existing = await getDocument('users', updates.uid);
  if (!existing) throw new Error('الحساب غير موجود');

  const { password: newPassword, ...otherUpdates } = updates;

  let merged: any = {
    ...existing,
    ...otherUpdates,
    updatedAt: new Date().toISOString()
  };

  if (newPassword !== undefined && newPassword !== '') {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`يجب ألا تقل كلمة المرور عن ${MIN_PASSWORD_LENGTH} خانات.`);
    }
    merged.passwordHash = await hashPassword(newPassword);
    delete merged.password;
  } else {
    // تحويل أي كلمة مرور نصية قديمة إلى تجزئة أثناء الحفظ
    merged = (await upgradeLegacyPassword(merged)).record;
  }

  await setDocument('users', updates.uid, merged);

  // تحديث الجلسة المحلية إذا كان المستخدم الحالي هو من قام بتغيير بياناته
  const currentSession = getActiveLocalSession();
  if (currentSession && currentSession.uid === updates.uid) {
    try {
      localStorage.setItem('active_client_session', JSON.stringify(toSession(merged)));
    } catch {}
  }

  return stripSecrets(merged);
}

export async function toggleClientAccountStatus(uid: string, nextStatus: boolean) {
  const existing = await getDocument('users', uid);
  if (!existing) throw new Error('الحساب غير موجود');

  existing.isActive = nextStatus;
  await setDocument('users', uid, (await upgradeLegacyPassword(existing)).record);
}

export async function updateClientSubscription(
  uid: string,
  options: {
    action: 'set_permanent' | 'set_custom_date' | 'extend_days';
    isPermanent?: boolean;
    customDate?: string;
    days?: number;
  }
) {
  try {
    const existing = await getDocument('users', uid);
    if (!existing) return { success: false, error: 'الحساب غير موجود' };

    if (options.action === 'set_permanent') {
      existing.isPermanent = true;
      existing.trialExpiresAt = null;
    } else if (options.action === 'set_custom_date') {
      existing.isPermanent = false;
      existing.trialExpiresAt = options.customDate;
    } else if (options.action === 'extend_days' && options.days) {
      existing.isPermanent = false;
      const baseMs = existing.trialExpiresAt ? new Date(existing.trialExpiresAt).getTime() : Date.now();
      const currentStart = Math.max(baseMs, Date.now());
      existing.trialExpiresAt = new Date(currentStart + options.days * 24 * 60 * 60 * 1000).toISOString();
    }

    await setDocument('users', uid, (await upgradeLegacyPassword(existing)).record);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteClientAccount(uid: string) {
  if (uid === ADMIN_UID || uid === LEGACY_ADMIN_UID) {
    throw new Error('لا يمكن حذف حساب المدير العام.');
  }
  await supabase.from('documents').delete().eq('collection', 'users').eq('id', uid);
  await supabase.from('documents').delete().eq('collection', 'stores').eq('id', `store_${uid}`);
}

// تحويل كل كلمات المرور النصية القديمة في السحابة إلى تجزئات مشفرة (تُستدعى تلقائياً بعد دخول المدير)
export async function secureAllPasswords(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const all = await loadAllRawAccounts();
    let count = 0;
    for (const record of all) {
      const { record: upgraded, changed } = await upgradeLegacyPassword(record);
      if (changed) {
        const { uid, ...data } = upgraded;
        await setDocument('users', record.uid, { uid: record.uid, ...data });
        count++;
      }
    }
    return { success: true, count };
  } catch (err: any) {
    console.error('secureAllPasswords error:', err);
    return { success: false, count: 0, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// تسجيل الدخول
// ---------------------------------------------------------------------------

const GENERIC_LOGIN_ERROR = 'اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التأكد من البيانات.';
export const ADMIN_SETUP_REQUIRED = 'ADMIN_SETUP_REQUIRED';

async function fetchAdminRecord(): Promise<any | null> {
  const current = await getDocumentStrict('users', ADMIN_UID);
  if (current) return current;
  return getDocumentStrict('users', LEGACY_ADMIN_UID);
}

function buildAdminSession(record: any) {
  return {
    ...toSession(record),
    uid: record?.uid || ADMIN_UID,
    username: record?.username || ADMIN_EMAIL.split('@')[0],
    email: ADMIN_EMAIL,
    displayName: record?.displayName || 'المدير العام (أدمن)',
    storeName: record?.storeName || 'المفكر المحاسبي',
    role: 'admin',
    isAdmin: true,
    isActive: true,
    isPermanent: true,
  };
}

// تعيين كلمة مرور المدير لأول مرة فقط (عندما لا توجد أي كلمة مرور محفوظة للمدير في السحابة)
export async function setupAdminPassword(newPassword: string) {
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`يجب ألا تقل كلمة المرور عن ${MIN_PASSWORD_LENGTH} خانات.`);
  }
  let existing: any = null;
  try {
    existing = await fetchAdminRecord();
  } catch {
    throw new Error('تعذر الاتصال بالسيرفر. يلزم اتصال بالإنترنت لتعيين كلمة المرور.');
  }
  if (hasAnyCredential(existing)) {
    throw new Error('تم تعيين كلمة مرور للمدير مسبقاً. سجّل الدخول بها، ويمكنك تغييرها من الإعدادات.');
  }

  const record = {
    ...(existing || {}),
    uid: existing?.uid || ADMIN_UID,
    username: existing?.username || ADMIN_EMAIL.split('@')[0],
    email: ADMIN_EMAIL,
    displayName: existing?.displayName || 'المدير العام (أدمن)',
    storeName: existing?.storeName || 'المفكر المحاسبي',
    role: 'admin',
    isActive: true,
    isPermanent: true,
    createdAt: existing?.createdAt || new Date().toISOString(),
    passwordHash: await hashPassword(newPassword),
    updatedAt: new Date().toISOString(),
  };
  await setDocument('users', record.uid, record);
  return loginWithEmailOrUsername(ADMIN_EMAIL, newPassword);
}

// دالة تسجيل الدخول عبر Supabase الموحدة سحابياً
export async function loginWithEmailOrUsername(identifier: string, password: string) {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPass = password.trim();

  // ----- المدير: عبر البريد الإلكتروني المحدد فقط -----
  if (cleanId === ADMIN_EMAIL.toLowerCase()) {
    let adminRecord: any = null;
    let online = true;
    try {
      adminRecord = await fetchAdminRecord();
    } catch {
      online = false;
    }

    if (!online) {
      // دخول دون اتصال: يُسمح فقط إذا كانت هناك جلسة مدير محفوظة على هذا الجهاز وكلمة المرور تطابق تجزئتها
      const cached = getActiveLocalSession();
      if (cached?.role === 'admin' && (await verifyPassword(cleanPass, cached.passwordHash))) {
        saveSession(cached);
        return cached;
      }
      throw new Error('تعذر الاتصال بالسيرفر، ولا توجد جلسة مدير محفوظة على هذا الجهاز.');
    }

    if (!hasAnyCredential(adminRecord)) {
      const err: any = new Error('لم يتم تعيين كلمة مرور للمدير بعد. يرجى تعيينها الآن.');
      err.code = ADMIN_SETUP_REQUIRED;
      throw err;
    }

    if (!(await checkRecordPassword(adminRecord, cleanPass))) {
      throw new Error('كلمة المرور غير صحيحة لحساب المدير العام.');
    }

    // ترقية كلمة المرور القديمة (نص) إلى تجزئة إن وُجدت
    const upgraded = await upgradeLegacyPassword(adminRecord);
    if (upgraded.changed) {
      try {
        await setDocument('users', upgraded.record.uid || ADMIN_UID, upgraded.record);
      } catch (e) {
        console.warn('Admin password upgrade failed:', e);
      }
    }

    const adminSession = buildAdminSession(upgraded.record);
    saveSession(adminSession);

    // تأمين كلمات مرور جميع الزبائن القدامى في الخلفية
    secureAllPasswords().catch(() => {});
    return adminSession;
  }

  // ----- الزبائن والكاشيرات -----
  if (RESERVED_USERNAMES.has(cleanId)) {
    throw new Error(GENERIC_LOGIN_ERROR);
  }

  let userData = await getDocument('users', 'user_' + cleanId);
  if (!userData) {
    userData = await getDocument('users', cleanId);
  }

  if (!userData) {
    const allUsers = await loadAllRawAccounts();
    userData = allUsers.find((u: any) =>
      u.username?.toLowerCase() === cleanId ||
      u.phone === cleanId ||
      u.email?.toLowerCase() === cleanId
    ) || null;
  }

  if (!userData || userData.role === 'admin') {
    throw new Error(GENERIC_LOGIN_ERROR);
  }

  if (!hasAnyCredential(userData)) {
    throw new Error('لا توجد كلمة مرور لهذا الحساب. يرجى مراجعة الإدارة لتعيين كلمة مرور.');
  }

  if (!(await checkRecordPassword(userData, cleanPass))) {
    throw new Error(GENERIC_LOGIN_ERROR);
  }

  if (userData.isActive === false) {
    throw new Error('⚠️ هذا الحساب معطل وموقوف من قبل الإدارة.');
  }

  if (!userData.isPermanent && userData.trialExpiresAt) {
    const expiresMs = new Date(userData.trialExpiresAt).getTime();
    if (expiresMs > 0 && expiresMs < Date.now()) {
      throw new Error('⏳ عذراً، انتهت صلاحية هذا الحساب. يرجى مراجعة الإدارة لتجديد الاشتراك.');
    }
  }

  // ترقية كلمة المرور القديمة (نص) إلى تجزئة عند أول دخول ناجح
  const upgraded = await upgradeLegacyPassword(userData);
  if (upgraded.changed) {
    try {
      const { uid, ...data } = upgraded.record;
      await setDocument('users', userData.uid, { uid: userData.uid, ...data });
    } catch (e) {
      console.warn('Password upgrade failed:', e);
    }
  }

  const session = toSession(upgraded.record);
  saveSession(session);
  return session;
}

// ---------------------------------------------------------------------------
// التحقق من كلمة مرور الحساب الحالي (لتبديل الجلسات، رموز الشفت، تصفير المواد...)
// ---------------------------------------------------------------------------
export async function verifyAccountPassword(
  user: { uid?: string; passwordHash?: string } | null | undefined,
  password: string
): Promise<boolean> {
  const clean = (password || '').trim();
  if (!clean || !user) return false;

  // 1) التجزئة المحفوظة في الجلسة (تعمل دون اتصال)
  if (isPasswordHash(user.passwordHash) && (await verifyPassword(clean, user.passwordHash))) {
    return true;
  }

  // 2) أحدث نسخة من السحابة (مثلاً بعد تغيير كلمة المرور من جهاز آخر)
  if (user.uid) {
    try {
      const record = await getDocumentStrict('users', user.uid);
      if (record) return await checkRecordPassword(record, clean);
    } catch {
      /* لا اتصال: نكتفي بنتيجة التحقق المحلي */
    }
  }
  return false;
}

// تغيير كلمة مرور الحساب الحالي من داخل البرنامج (للزبون وللمدير)
export async function changeAccountPassword(
  uid: string,
  oldPass: string,
  newPass: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  const cleanOld = oldPass.trim();
  const cleanNew = newPass.trim();

  if (cleanNew.length < MIN_PASSWORD_LENGTH) {
    return { success: false, error: `يجب ألا تقل كلمة المرور الجديدة عن ${MIN_PASSWORD_LENGTH} خانات` };
  }

  try {
    let record = await getDocumentStrict('users', uid);
    if (!record && uid === ADMIN_UID) record = await getDocumentStrict('users', LEGACY_ADMIN_UID);
    if (!record) return { success: false, error: 'الحساب غير موجود' };

    if (!hasAnyCredential(record)) {
      return { success: false, error: 'لا توجد كلمة مرور محفوظة لهذا الحساب. راجع الإدارة.' };
    }
    if (!(await checkRecordPassword(record, cleanOld))) {
      return { success: false, error: 'كلمة المرور القديمة غير صحيحة' };
    }

    const next: any = {
      ...record,
      passwordHash: await hashPassword(cleanNew),
      updatedAt: new Date().toISOString(),
    };
    delete next.password;

    await setDocument('users', record.uid || uid, next);

    const session = getActiveLocalSession();
    if (session && session.uid === uid) {
      try {
        localStorage.setItem('active_client_session', JSON.stringify({ ...session, passwordHash: next.passwordHash }));
        localStorage.removeItem('last_known_account_password');
      } catch {}
    }

    return { success: true, message: 'تم حفظ كلمة المرور الجديدة بنجاح' };
  } catch (err: any) {
    return { success: false, error: err.message || 'تعذر الاتصال بقاعدة البيانات لتغيير كلمة المرور' };
  }
}
