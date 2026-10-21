/**
 * Centralized formatting and constants for the India-only operation of ReliefChain.
 */

export const INDIA_CURRENCY_CODE = 'INR';
export const INDIA_CURRENCY_SYMBOL = '₹';
export const INDIA_TIMEZONE = 'Asia/Kolkata';

/**
 * Formats a monetary value to the canonical Indian format.
 * Examples: 
 * 1000 -> ₹1,000
 * 100000 -> ₹1,00,000
 * 
 * @param amount - The numeric or string value to format
 * @param includeSymbol - Whether to prepend the '₹' symbol
 * @returns The formatted string
 */
export function formatINR(amount: number | string | null | undefined, includeSymbol: boolean = true): string {
  if (amount === null || amount === undefined) return includeSymbol ? `${INDIA_CURRENCY_SYMBOL}0` : '0';
  
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return String(amount);
  
  const formatted = num.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });
  
  return includeSymbol ? `${INDIA_CURRENCY_SYMBOL}${formatted}` : formatted;
}

/**
 * Formats a date string to the dd/mm/yyyy format.
 */
export function formatDate(dateString: string | Date): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return String(dateString);
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}
