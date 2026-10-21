export function canonicalizeQuantity(value: string | number): string {
  const str = String(value).trim();
  
  // Reject negative, exponent, or non-numeric formats
  if (!/^\d+(\.\d+)?$/.test(str)) {
    throw new Error('Invalid quantity format. Must be a positive decimal string without exponents.');
  }

  let [intPart, decPart] = str.split('.');
  
  // Normalize integer part (remove leading zeros)
  intPart = intPart.replace(/^0+/, '');
  if (intPart === '') intPart = '0';

  // Normalize decimal part (remove trailing zeros)
  if (decPart) {
    decPart = decPart.replace(/0+$/, '');
    if (decPart === '') {
      return intPart; // 1.00 -> 1
    }
    return `${intPart}.${decPart}`;
  }

  return intPart;
}
