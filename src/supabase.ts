import { createClient } from '@supabase/supabase-js';
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase'; // مؤقتاً لسحب الحسابات القديمة

export const supabaseUrl = 'https://obodoxxzolgcwvzkkoua.supabase.co';
export const supabaseAnonKey = 'sb_publishable_0aNPlD59KqYsmVr8r_tMEw_wpgmlj2o';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// دالة لجلب وثيقة محددة من السحابة
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

// دالة تسجيل الخروج
export async function logoutAccount() {
  try {
    localStorage.removeItem('active_client_session');
    localStorage.removeItem('last_active_user_uid');
    localStorage.removeItem('active_session_role');
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

// واجهات ودوال إدارة الحسابات
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
}

export async function loadAllClientAccounts() {
  const { data, error } = await supabase
    .from('documents')
    .select('id, data')
    .eq('collection', 'users');

  if (error) {
    console.error('Error fetching clients:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    uid: row.id,
    ...row.data
  }));
}

export async function createClientAccount(input: CreateClientInput) {
  const cleanUsername = input.username.trim().toLowerCase();
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
    password: input.password,
    role: 'client',
    isActive: true,
    isPermanent: false,
    trialExpiresAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: now.toISOString(),
  };

  await setDocument('users', uid, newClientData);
  return newClientData;
}

export async function updateClientAccount(updates: UpdateClientInput) {
  const existing = await getDocument('users', updates.uid);
  if (!existing) throw new Error('الحساب غير موجود');

  const updatedData = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString()
  };

  await setDocument('users', updates.uid, updatedData);

  // تحديث الجلسة المحلية إذا كان المستخدم الحالي هو من قام بتغيير بياناته
  const currentSession = getActiveLocalSession();
  if (currentSession && currentSession.uid === updates.uid) {
    localStorage.setItem('active_client_session', JSON.stringify(updatedData));
  }

  return updatedData;
}

export async function toggleClientAccountStatus(uid: string, nextStatus: boolean) {
  const existing = await getDocument('users', uid);
  if (!existing) throw new Error('الحساب غير موجود');

  existing.isActive = nextStatus;
  await setDocument('users', uid, existing);
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

    await setDocument('users', uid, existing);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteClientAccount(uid: string) {
  await supabase.from('documents').delete().eq('collection', 'users').eq('id', uid);
  await supabase.from('documents').delete().eq('collection', 'stores').eq('id', `store_${uid}`);
}

// دالة تسجيل الدخول عبر Supabase الموحدة سحابياً
export async function loginWithEmailOrUsername(identifier: string, password: string) {
  const cleanId = identifier.trim().toLowerCase();
  const cleanPass = password.trim();

  // فحص حساب الأدمن
  const isOwnerAdmin =
    cleanId === 'tlfghlbtghlby@gmail.com' ||
    cleanId === 'tlfghlbtghlby' ||
    cleanId === 'admin';

  if (isOwnerAdmin) {
    // جلب بيانات الأدمن المحدثة سحابياً من جدول documents
    let adminData = await getDocument('users', 'user_tlfghlbtghlby@gmail.com');

    // إذا لم يجدها يبحث بالمعرف القديم البديل
    if (!adminData) {
      adminData = await getDocument('users', 'admin_master_001');
    }

    // كلمة المرور الفعلية (من السحابة أو الافتراضية 123456)
    const expectedPassword = String(adminData?.password || '123456').trim();

    if (cleanPass !== expectedPassword) {
      throw new Error('كلمة المرور غير صحيحة لحساب المدير العام.');
    }

    const adminUser = {
      uid: adminData?.uid || 'user_tlfghlbtghlby@gmail.com',
      username: adminData?.username || 'tlfghlbtghlby',
      email: 'tlfghlbtghlby@gmail.com',
      displayName: adminData?.displayName || 'المدير العام (أدمن)',
      storeName: adminData?.storeName || 'المفكر المحاسبي',
      role: 'admin',
      isAdmin: true,
      isActive: true,
      isPermanent: true,
      password: cleanPass
    };

    localStorage.setItem('active_client_session', JSON.stringify(adminUser));
    localStorage.setItem('last_active_user_uid', adminUser.uid);
    localStorage.setItem('active_session_role', 'admin');
    return adminUser;
  }

  // حسابات المشتركين والكاشيرات العاديين
  let userData = await getDocument('users', 'user_' + cleanId);
  if (!userData) {
    userData = await getDocument('users', cleanId);
  }

  if (!userData) {
    const allUsers = await loadAllClientAccounts();
    const matched = allUsers.find((u: any) => 
      u.username?.toLowerCase() === cleanId || 
      u.phone === cleanId || 
      u.email?.toLowerCase() === cleanId
    );
    if (matched) {
      userData = matched;
    }
  }

  if (!userData) {
    throw new Error('اسم المستخدم أو كلمة المرور غير صحيحة. يرجى التأكد من البيانات.');
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

  if (userData.password && String(userData.password).trim() !== cleanPass) {
    throw new Error('كلمة المرور غير صحيحة.');
  }

  localStorage.setItem('active_client_session', JSON.stringify(userData));
  localStorage.setItem('last_active_user_uid', userData.uid);
  localStorage.setItem('active_session_role', userData.role || 'client');
  return userData;
}

// دالة ترحيل المستخدمين والمخازن من Firebase إلى Supabase
export async function migrateAllUsersFromFirebase(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      return { success: false, count: 0, error: 'لم يتم العثور على أي حسابات في Firebase.' };
    }

    let count = 0;
    const rowsToInsert: any[] = [];

    for (const docSnap of usersSnap.docs) {
      const userData = docSnap.data();
      const uid = docSnap.id;

      rowsToInsert.push({
        collection: 'users',
        id: uid,
        data: userData,
        updated_at: new Date().toISOString()
      });
      count++;

      try {
        const storeSubSnap = await getDocs(collection(db, 'users', uid, 'store'));
        storeSubSnap.forEach((sDoc) => {
          rowsToInsert.push({
            collection: 'stores',
            id: `store_${uid}`,
            data: sDoc.data(),
            updated_at: new Date().toISOString()
          });
        });
      } catch (e) {}
    }

    const { error } = await supabase
      .from('documents')
      .upsert(rowsToInsert, { onConflict: 'collection,id' });

    if (error) throw error;

    return { success: true, count };
  } catch (err: any) {
    console.error('Migration error:', err);
    return { success: false, count: 0, error: err.message };
  }
}
