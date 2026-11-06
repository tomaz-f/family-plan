const STORAGE_MASTER_KEY = 'familyplan_master_key';
const KEY_CHARSET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function getStoredMasterKey(): string | null {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const queryKey = params.get('key') || params.get('masterKey');
      if (queryKey) {
        const sanitized = sanitizeMasterKey(queryKey);
        if (sanitized) {
          localStorage.setItem(STORAGE_MASTER_KEY, sanitized);
          // Scrub sensitive master key from browser address bar & history
          params.delete('key');
          params.delete('masterKey');
          const remainingQuery = params.toString() ? `?${params.toString()}` : '';
          const cleanUrl = `${window.location.pathname}${remainingQuery}${window.location.hash}`;
          window.history.replaceState({}, document.title, cleanUrl);
          return sanitized;
        }
      }
    }
    const raw = localStorage.getItem(STORAGE_MASTER_KEY);
    return raw ? sanitizeMasterKey(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredMasterKey(masterKey: string): void {
  try {
    const sanitized = sanitizeMasterKey(masterKey);
    if (sanitized) {
      localStorage.setItem(STORAGE_MASTER_KEY, sanitized);
    }
  } catch {
    // ignore
  }
}

export function clearStoredMasterKey(): void {
  try {
    localStorage.removeItem(STORAGE_MASTER_KEY);
  } catch {
    // ignore
  }
}

export function sanitizeMasterKey(input: string): string {
  const clean = String(input || '')
    .toUpperCase()
    .replace(/[^2-9A-HJ-NP-Z]/g, '')
    .slice(0, 12);

  // Group into XXXX-XXXX-XXXX
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    parts.push(clean.slice(i, i + 4));
  }
  return parts.join('-');
}

export function generateMasterKey(): string {
  const bytes = new Uint8Array(12);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 12; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  let code = '';
  for (let i = 0; i < 12; i++) {
    code += KEY_CHARSET[bytes[i] % KEY_CHARSET.length];
  }

  return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}`;
}

export class InvalidMasterKeyError extends Error {
  constructor(message = 'Chave Mestre de Segurança inválida para este espaço familiar. Verifique os 12 dígitos digitados.') {
    super(message);
    this.name = 'InvalidMasterKeyError';
  }
}
