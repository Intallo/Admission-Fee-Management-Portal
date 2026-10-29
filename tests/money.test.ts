import { describe, it, expect } from 'vitest';
import {
  toDecimal,
  formatInr,
  addInr,
  subtractInr,
  multiplyInr,
  compareInr,
  toPaise,
  fromPaise,
  formatInrDisplay,
  amountInWordsInr,
} from '../src/lib/money/inr';

describe('Exact Decimal Money Utilities (DEC-11 / NFR-05)', () => {
  it('converts numbers, strings, and Decimals accurately', () => {
    expect(toDecimal('15000.00').toString()).toBe('15000');
    expect(toDecimal(15000).toString()).toBe('15000');
    expect(toDecimal('15,000.50').toString()).toBe('15000.5');
  });

  it('rejects invalid or NaN values', () => {
    expect(() => toDecimal('abc')).toThrow();
    expect(() => toDecimal(NaN)).toThrow();
    expect(() => toDecimal(Infinity)).toThrow();
  });

  it('proves immune to standard JavaScript binary floating-point precision flaws', () => {
    // In IEEE 754 float: 0.1 + 0.2 === 0.30000000000000004
    // In our exact decimal arithmetic: must equal exactly "0.30"
    const sum = addInr('0.10', '0.20');
    expect(sum).toBe('0.30');

    // 19.99 * 100 in JS float is 1998.9999999999998
    expect(toPaise('19.99')).toBe(1999);
  });

  it('performs exact addition, subtraction, and multiplication', () => {
    expect(addInr('1500.50', '250.25')).toBe('1750.75');
    expect(subtractInr('1000.00', '250.75')).toBe('749.25');
    expect(multiplyInr('1250.50', '2')).toBe('2501.00');
    expect(compareInr('500.00', '400.00')).toBe(1);
    expect(compareInr('400.00', '500.00')).toBe(-1);
    expect(compareInr('500.00', '500.00')).toBe(0);
  });

  it('converts to and from integer paise with exact rounding', () => {
    expect(toPaise('150.25')).toBe(15025);
    expect(toPaise('0.05')).toBe(5);
    expect(fromPaise(15025)).toBe('150.25');
    expect(fromPaise(5)).toBe('0.05');
  });

  it('formats monetary amounts in Indian numbering system display', () => {
    expect(formatInrDisplay('1000.00')).toBe('₹1,000.00');
    expect(formatInrDisplay('15000.50')).toBe('₹15,000.50');
    expect(formatInrDisplay('150000.00')).toBe('₹1,50,000.00');
    expect(formatInrDisplay('12500000.75')).toBe('₹1,25,00,000.75');
  });

  it('generates accurate Indian English words for receipts', () => {
    expect(amountInWordsInr('0.00')).toBe('Rupees Zero Only');
    expect(amountInWordsInr('15000.00')).toBe('Rupees Fifteen Thousand Only');
    expect(amountInWordsInr('250.50')).toBe('Rupees Two Hundred Fifty and Fifty Paise Only');
    expect(amountInWordsInr('100000.00')).toBe('Rupees One Lakh Only');
    expect(amountInWordsInr('15000000.00')).toBe('Rupees One Crore Fifty Lakh Only');
  });
});
