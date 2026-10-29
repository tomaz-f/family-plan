import { createClient } from '@libsql/client/web';
export {
  getStoredMasterKey,
  setStoredMasterKey,
  clearStoredMasterKey,
  generateMasterKey,
  sanitizeMasterKey,
  deriveAesKey,
  encryptPayload,
  decryptPayload,
  encryptTransaction,
  decryptTransaction,
  encryptCategory,
  decryptCategory,
  encryptCreditCard,
  decryptCreditCard,
  encryptFuelLog,
  decryptFuelLog,
  encryptRecurringTemplate,
  decryptRecurringTemplate,
  decryptFullState,
} from './cryptoService';

const STORAGE_FAMILY_KEY = 'familyplan_family_id';
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function getStoredFamilyId(): string | null {
  try {
    const val = localStorage.getItem(STORAGE_FAMILY_KEY);
    return val ? sanitizeFamilyCode(val) : null;
  } catch {
    return null;
  }
}

export function setStoredFamilyId(familyId: string): void {
  try {
    const sanitized = sanitizeFamilyCode(familyId);
    if (sanitized) {
      localStorage.setItem(STORAGE_FAMILY_KEY, sanitized);
    }
  } catch {
    // ignore
  }
}

export function clearStoredFamilyId(): void {
  try {
    localStorage.removeItem(STORAGE_FAMILY_KEY);
  } catch {
    // ignore
  }
}

export function sanitizeFamilyCode(code: string): string {
  let clean = String(code || '').trim().toUpperCase();
  if (clean.startsWith('FP-')) {
    clean = clean.slice(3);
  } else if (clean.startsWith('FP')) {
    clean = clean.slice(2);
  }
  clean = clean.replace(/[^2-9A-HJ-NP-Z]/g, '').slice(0, 6);
  return clean ? `FP-${clean}` : '';
}

export function generateFamilyCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
    code += CODE_ALPHABET[idx];
  }
  return `FP-${code}`;
}

// Optional direct web client if VITE_TURSO_DB_URL is explicitly set in Vite environment
const clientUrl = (import.meta as any).env?.VITE_TURSO_DB_URL || '';
const clientAuthToken = (import.meta as any).env?.VITE_TURSO_TOKEN || '';

export const directWebTurso = clientUrl
  ? createClient({
      url: clientUrl,
      authToken: clientAuthToken || undefined,
    })
  : null;

/**
 * Unified API Fetch wrapper that automatically adds the X-Family-Id header
 * and Content-Type: application/json for state-modifying requests.
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const currentFamilyId = getStoredFamilyId();
  const headers = new Headers(options.headers || {});

  if (currentFamilyId) {
    headers.set('X-Family-Id', currentFamilyId);
  }

  if (
    options.body &&
    !headers.has('Content-Type') &&
    typeof options.body === 'string'
  ) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(path, {
    ...options,
    headers,
  });
}

/**
 * Creates a new Family space
 */
export async function createFamily(requestedId?: string): Promise<{ familyId: string; createdAt: string }> {
  const res = await fetch('/api/families/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familyId: requestedId ? sanitizeFamilyCode(requestedId) : undefined }),
  });

  if (!res.ok) {
    throw new Error('Falha ao criar novo espaço familiar.');
  }

  const data = await res.json();
  if (data?.familyId) {
    setStoredFamilyId(data.familyId);
  }
  return data;
}

/**
 * Validates and joins an existing Family code
 */
export async function joinFamily(familyId: string): Promise<{ valid: boolean; familyId?: string; error?: string }> {
  const sanitized = sanitizeFamilyCode(familyId);
  if (!sanitized) {
    return { valid: false, error: 'O código de pareamento deve conter o formato FP-XXXXXX.' };
  }

  const res = await fetch('/api/families/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ familyId: sanitized }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return {
      valid: false,
      error: data.error || 'Código de pareamento não encontrado. Verifique os caracteres.',
    };
  }

  const data = await res.json();
  if (data.valid && data.familyId) {
    setStoredFamilyId(data.familyId);
  }
  return data;
}

/**
 * Checks if a family code is valid
 */
export async function verifyFamily(familyId: string): Promise<boolean> {
  const sanitized = sanitizeFamilyCode(familyId);
  if (!sanitized) return false;

  try {
    const res = await fetch(`/api/families/${sanitized}/verify`);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data.valid);
  } catch {
    return false;
  }
}
