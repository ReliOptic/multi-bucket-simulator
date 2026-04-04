/* ═══ TAX ENGINE ═══ */

export function getPensionTaxRate(age) {
  return age >= 80 ? 0.033 : age >= 70 ? 0.044 : 0.055;
}

/* IRP 퇴직급여 연금수령 시 세금
   퇴직소득세 × 70% (1~10년차), × 60% (11년차+) */
export function calcRetTax(amt, yrs) {
  const d = yrs >= 11 ? 0.6 : 0.7;
  return Math.round(amt * 0.03 * d);
}

/* 연금수령한도 = 잔액 ÷ (11 - min(연차,10)) × 120%
   11년차 이상: 무제한 */
export function calcPensionLimit(balance, year) {
  if (year >= 11 || balance <= 0) return balance;
  return Math.round(balance / (11 - Math.min(year, 10)) * 1.2);
}

export function calcRegNHI(inc, prop) {
  return Math.round(
    (Math.max(0, inc) * 0.08 + Math.max(0, prop - 5000) * 0.015) * 0.0699
  );
}

export function calcVolNHI(sal) {
  return Math.round(sal * 0.0699 * 0.5);
}
