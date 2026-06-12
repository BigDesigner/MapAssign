export function isValidCountryCode(code: string): boolean {
  const c = code.toLowerCase();
  return /^[a-z]{2}$/.test(c) || /^gb-[a-z]{3}$/.test(c) || c === '_somaliland';
}

export function isValidColorHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

export function sanitizeInput(str: string): string {
  return str.replace(/[&<>"']/g, (match) => {
    switch (match) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#x27;';
      default: return match;
    }
  });
}
