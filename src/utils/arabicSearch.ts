/** توحيد النص العربي للبحث: ة/ه، أإآٱ/ا، ي/ى/ئ، ؤ/و، حذف التشكيل والتطويل، وتحويل الأرقام الهندية. */
export const normAr = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[يىئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/[ةه]/g, 'ه')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/\s+/g, ' ')
    .trim();

/** كل كلمات الاستعلام يجب أن تظهر (بأي ترتيب) في النص بعد التوحيد. */
export const matchAr = (text: unknown, query: string): boolean => {
  const q = normAr(query);
  if (!q) return true;
  const t = normAr(text);
  return q.split(' ').every((w) => t.includes(w));
};
