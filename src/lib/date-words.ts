/**
 * Converts a YYYY-MM-DD date string to formal English words.
 * Example: '2020-04-10' -> 'Tenth April Two Thousand Twenty'
 */

const DAYS_IN_WORDS: Record<number, string> = {
  1: 'First',
  2: 'Second',
  3: 'Third',
  4: 'Fourth',
  5: 'Fifth',
  6: 'Sixth',
  7: 'Seventh',
  8: 'Eighth',
  9: 'Ninth',
  10: 'Tenth',
  11: 'Eleventh',
  12: 'Twelfth',
  13: 'Thirteenth',
  14: 'Fourteenth',
  15: 'Fifteenth',
  16: 'Sixteenth',
  17: 'Seventeenth',
  18: 'Eighteenth',
  19: 'Nineteenth',
  20: 'Twentieth',
  21: 'Twenty First',
  22: 'Twenty Second',
  23: 'Twenty Third',
  24: 'Twenty Fourth',
  25: 'Twenty Fifth',
  26: 'Twenty Sixth',
  27: 'Twenty Seventh',
  28: 'Twenty Eighth',
  29: 'Twenty Ninth',
  30: 'Thirtieth',
  31: 'Thirty First',
};

const MONTHS: string[] = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const ONES: string[] = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS: string[] = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
];

function yearToWords(year: number): string {
  if (year >= 2000 && year < 2100) {
    const remainder = year - 2000;
    if (remainder === 0) return 'Two Thousand';
    if (remainder < 20) return `Two Thousand ${ONES[remainder]}`;
    const tens = Math.floor(remainder / 10);
    const ones = remainder % 10;
    return `Two Thousand ${TENS[tens]}${ones > 0 ? ' ' + ONES[ones] : ''}`.trim();
  }

  if (year >= 1900 && year < 2000) {
    const remainder = year - 1900;
    if (remainder === 0) return 'Nineteen Hundred';
    if (remainder < 20) return `Nineteen Hundred ${ONES[remainder]}`;
    const tens = Math.floor(remainder / 10);
    const ones = remainder % 10;
    return `Nineteen Hundred ${TENS[tens]}${ones > 0 ? ' ' + ONES[ones] : ''}`.trim();
  }

  return String(year);
}

export function formatDateInWords(dateStr: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr || '';
  }

  const parts = dateStr.slice(0, 10).split('-');
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  const dayWord = DAYS_IN_WORDS[day] || String(day);
  const monthWord = MONTHS[monthIdx] || '';
  const yearWord = yearToWords(year);

  return `${dayWord} ${monthWord} ${yearWord}`.trim();
}
