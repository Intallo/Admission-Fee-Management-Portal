import Decimal from 'decimal.js';
import { DecimalInrString, toDecimalInrString } from '../../modules/shared/types';

// Configure Decimal.js with 20 digits precision and ROUND_HALF_UP (banker's / commercial standard)
Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = string | number | Decimal;

/**
 * Converts any monetary input safely into an exact Decimal instance.
 * Throws if input is invalid or NaN.
 */
export function toDecimal(val: MoneyInput): Decimal {
  if (val instanceof Decimal) {
    return val;
  }
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) {
      throw new Error(`Invalid monetary number: ${val}`);
    }
    return new Decimal(val.toString());
  }
  if (typeof val === 'string') {
    const clean = val.replace(/,/g, '').trim();
    if (!clean || isNaN(Number(clean))) {
      throw new Error(`Invalid monetary string: "${val}"`);
    }
    return new Decimal(clean);
  }
  throw new Error(`Unsupported money input type: ${typeof val}`);
}

/**
 * Formats a monetary value to a canonical two-decimal INR string (e.g. "15000.00").
 */
export function formatInr(val: MoneyInput): DecimalInrString {
  const dec = toDecimal(val);
  return toDecimalInrString(dec.toFixed(2));
}

/**
 * Adds two monetary amounts with exact decimal precision.
 */
export function addInr(a: MoneyInput, b: MoneyInput): DecimalInrString {
  const sum = toDecimal(a).plus(toDecimal(b));
  return formatInr(sum);
}

/**
 * Subtracts b from a with exact decimal precision.
 */
export function subtractInr(a: MoneyInput, b: MoneyInput): DecimalInrString {
  const diff = toDecimal(a).minus(toDecimal(b));
  return formatInr(diff);
}

/**
 * Multiplies an amount by a factor (e.g., quantity or rate) with exact decimal precision.
 */
export function multiplyInr(amount: MoneyInput, factor: MoneyInput): DecimalInrString {
  const product = toDecimal(amount).times(toDecimal(factor));
  return formatInr(product);
}

/**
 * Compares two monetary amounts.
 * Returns:
 *   1 if a > b
 *  -1 if a < b
 *   0 if a == b
 */
export function compareInr(a: MoneyInput, b: MoneyInput): number {
  return toDecimal(a).comparedTo(toDecimal(b));
}

/**
 * Converts INR amount to integer paise (1 INR = 100 paise).
 */
export function toPaise(val: MoneyInput): number {
  const dec = toDecimal(val);
  return dec.times(100).round().toNumber();
}

/**
 * Converts integer paise back to canonical INR string.
 */
export function fromPaise(paise: number): DecimalInrString {
  if (!Number.isInteger(paise)) {
    throw new Error(`Paise must be an integer, got: ${paise}`);
  }
  const dec = new Decimal(paise).dividedBy(100);
  return formatInr(dec);
}

/**
 * Formats monetary amount in Indian comma style (e.g. "₹1,25,000.00").
 */
export function formatInrDisplay(val: MoneyInput): string {
  const dec = toDecimal(val);
  const isNegative = dec.isNegative();
  const absolute = dec.abs().toFixed(2);
  const [integerPart, decimalPart] = absolute.split('.');

  // Indian comma formatting: last 3 digits, then groups of 2 digits
  let lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInteger = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  return `${isNegative ? '-' : ''}₹${formattedInteger}.${decimalPart}`;
}

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

function convertLessThanThousand(n: number): string {
  let words = '';
  if (n >= 100) {
    words += ONES[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    words += TENS[Math.floor(n / 10)] + ' ';
    n %= 10;
  }
  if (n > 0) {
    words += ONES[n] + ' ';
  }
  return words.trim();
}

/**
 * Converts exact monetary amount into Words per the Indian Numbering System.
 * Example: 15250.50 => "Rupees Fifteen Thousand Two Hundred Fifty and Fifty Paise Only"
 */
export function amountInWordsInr(val: MoneyInput): string {
  const dec = toDecimal(val);
  if (dec.isZero()) {
    return 'Rupees Zero Only';
  }

  const isNegative = dec.isNegative();
  const absDec = dec.abs();
  const integerVal = absDec.floor().toNumber();
  const paiseVal = absDec.minus(integerVal).times(100).round().toNumber();

  let crore = Math.floor(integerVal / 10000000);
  let remainder = integerVal % 10000000;

  let lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;

  let thousand = Math.floor(remainder / 1000);
  let hundred = remainder % 1000;

  let result = '';

  if (crore > 0) {
    result += convertLessThanThousand(crore) + ' Crore ';
  }
  if (lakh > 0) {
    result += convertLessThanThousand(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    result += convertLessThanThousand(thousand) + ' Thousand ';
  }
  if (hundred > 0) {
    result += convertLessThanThousand(hundred) + ' ';
  }

  result = result.trim();
  const prefix = isNegative ? 'Minus Rupees ' : 'Rupees ';
  const rupeePart = result.length > 0 ? `${prefix}${result}` : 'Rupees Zero';

  let paisePart = '';
  if (paiseVal > 0) {
    paisePart = ` and ${convertLessThanThousand(paiseVal)} Paise`;
  }

  return `${rupeePart}${paisePart} Only`.replace(/\s+/g, ' ');
}
