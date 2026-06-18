export function isValidCountryCode(code: string): boolean {
  const c = code.toLowerCase();
  return /^[a-z]{2}$/.test(c) || /^gb-[a-z]{3}$/.test(c) || c === '_somaliland';
}

export function isValidColorHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

export function isValidRepresentativeCode(code: string): boolean {
  return /^[a-zA-Z0-9_.-]{3,30}$/.test(code);
}

export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 8 && password.length <= 100;
}

export function sanitizeInput(str: string): string {
  return str.replace(/[&<>"']/g, (match) => {
    switch (match) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#x27;';
      case '`': return '&#x60;';
      default: return match;
    }
  });
}
