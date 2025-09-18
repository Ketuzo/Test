export const getRawFlags = (obj) =>
  (obj && (obj.filter_flags_code || obj.flags_code) || '').trim();

export const hasT = (obj) => /t/i.test(getRawFlags(obj));
export const hasS = (obj) => /s/i.test(getRawFlags(obj));
export const hasC = (obj) => /c/i.test(getRawFlags(obj));

export const flagsDisplay = (obj) => {
  const raw = getRawFlags(obj);
  if (raw) return raw; // zeigt z.B. "T.C"
  const t = hasT(obj) ? 'T' : '.';
  const s = hasS(obj) ? 'S' : '.';
  const c = hasC(obj) ? 'C' : '.';
  return `${t}${s}${c}`;
};
