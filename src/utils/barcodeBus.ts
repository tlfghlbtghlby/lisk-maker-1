// ناقل صغير بين نقطة البيع والمستمع العام للباركود داخل نفس النافذة
let posHandler: ((code: string) => void) | null = null;

/** تسجّل نقطة البيع المعروضة دالتها لاستقبال الباركود من نوافذ أخرى */
export function registerPosScanHandler(fn: ((code: string) => void) | null) {
  posHandler = fn;
}
export const isPosMountedHere = () => posHandler !== null;
export const handleByPos = (code: string): boolean => {
  if (!posHandler) return false;
  posHandler(code);
  return true;
};
