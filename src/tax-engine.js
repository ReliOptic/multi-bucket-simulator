/* ═══ TAX ENGINE ═══ */

export function getPensionTaxRate(age) {
  return age >= 80 ? 0.033 : age >= 70 ? 0.044 : 0.055;
}

export function calcRetTax(amt, yrs) {
  const d = yrs >= 11 ? 0.6 : yrs >= 6 ? 0.7 : yrs >= 1 ? 0.8 : 1.0;
  return amt * 0.03 * d;
}

export function calcRegNHI(inc, prop) {
  return Math.round(
    (Math.max(0, inc) * 0.08 + Math.max(0, prop - 5000) * 0.015) * 0.0699
  );
}

export function calcVolNHI(sal) {
  return Math.round(sal * 0.0699 * 0.5);
}
