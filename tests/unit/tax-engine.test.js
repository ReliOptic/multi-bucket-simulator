import { describe, it, expect } from 'vitest';
import {
  getPensionTaxRate,
  calcRetTax,
  calcRegNHI,
  calcVolNHI,
} from '../../src/tax-engine';

describe('getPensionTaxRate', () => {
  it('returns 3.3% for age >= 80', () => {
    expect(getPensionTaxRate(80)).toBe(0.033);
    expect(getPensionTaxRate(90)).toBe(0.033);
  });

  it('returns 4.4% for age 70-79', () => {
    expect(getPensionTaxRate(70)).toBe(0.044);
    expect(getPensionTaxRate(79)).toBe(0.044);
  });

  it('returns 5.5% for age < 70', () => {
    expect(getPensionTaxRate(69)).toBe(0.055);
    expect(getPensionTaxRate(55)).toBe(0.055);
  });

  it('handles boundary at exactly 70 and 80', () => {
    expect(getPensionTaxRate(69)).toBe(0.055);
    expect(getPensionTaxRate(70)).toBe(0.044);
    expect(getPensionTaxRate(79)).toBe(0.044);
    expect(getPensionTaxRate(80)).toBe(0.033);
  });
});

describe('calcRetTax', () => {
  it('applies 60% discount for yrs >= 11', () => {
    expect(calcRetTax(10000, 11)).toBe(10000 * 0.03 * 0.6);
    expect(calcRetTax(10000, 20)).toBe(10000 * 0.03 * 0.6);
  });

  it('applies 70% discount for yrs 6-10', () => {
    expect(calcRetTax(10000, 6)).toBe(10000 * 0.03 * 0.7);
    expect(calcRetTax(10000, 10)).toBe(10000 * 0.03 * 0.7);
  });

  it('applies 80% discount for yrs 1-5', () => {
    expect(calcRetTax(10000, 1)).toBe(10000 * 0.03 * 0.8);
    expect(calcRetTax(10000, 5)).toBe(10000 * 0.03 * 0.8);
  });

  it('applies no discount for yrs < 1', () => {
    expect(calcRetTax(10000, 0)).toBe(10000 * 0.03 * 1.0);
  });

  it('returns 0 for zero amount', () => {
    expect(calcRetTax(0, 15)).toBe(0);
  });
});

describe('calcRegNHI', () => {
  it('calculates NHI with income and property above threshold', () => {
    const inc = 20000;
    const prop = 10000;
    const expected = Math.round(
      (inc * 0.08 + (prop - 5000) * 0.015) * 0.0699
    );
    expect(calcRegNHI(inc, prop)).toBe(expected);
  });

  it('clamps negative income to zero', () => {
    expect(calcRegNHI(-1000, 10000)).toBe(
      Math.round((0 + 5000 * 0.015) * 0.0699)
    );
  });

  it('clamps property below 5000 to zero contribution', () => {
    const inc = 10000;
    expect(calcRegNHI(inc, 3000)).toBe(
      Math.round(inc * 0.08 * 0.0699)
    );
  });

  it('returns 0 when both income and property are zero', () => {
    expect(calcRegNHI(0, 0)).toBe(0);
  });

  it('handles property exactly at 5000 threshold', () => {
    const inc = 10000;
    expect(calcRegNHI(inc, 5000)).toBe(
      Math.round(inc * 0.08 * 0.0699)
    );
  });
});

describe('calcVolNHI', () => {
  it('calculates voluntary NHI as salary * 6.99% * 50%', () => {
    expect(calcVolNHI(10000)).toBe(Math.round(10000 * 0.0699 * 0.5));
  });

  it('returns 0 for zero salary', () => {
    expect(calcVolNHI(0)).toBe(0);
  });

  it('rounds to nearest integer', () => {
    const result = calcVolNHI(12345);
    expect(result).toBe(Math.round(12345 * 0.0699 * 0.5));
    expect(Number.isInteger(result)).toBe(true);
  });
});
