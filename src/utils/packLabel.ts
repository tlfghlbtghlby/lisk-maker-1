/** اسم الفئة الوسطية للمادة (الافتراضي «درزن» ويمكن تغييره من نافذة المادة) */
export const dozenName = (p?: { dozenLabel?: string } | null): string => (p?.dozenLabel || '').trim() || 'درزن';
