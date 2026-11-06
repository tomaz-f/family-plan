import { createClient } from '@libsql/client/web';
import {
  directCreateFamily,
  directGetSampleEncrypted,
  directVerifyFamily,
} from './tursoDirectClient';
import { executeDirectTurso, isStaticHosting } from './turso-service/tursoSyncHelpers';

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
  InvalidMasterKeyError,
} from './cryptoService';

const STORAGE_FAMILY_KEY = 'familyplan_family_id';
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function getStoredFamilyId(): string | null {
  try {
    if (typeof window !== 'undefined' && window.location) {
      const params = new URLSearchParams(window.location.search);
      const queryVal = params.get('code') || params.get('family') || params.get('familyId');
      if (queryVal) {
        const sanitized = sanitizeFamilyCode(queryVal);
        if (sanitized) {
          localStorage.setItem(STORAGE_FAMILY_KEY, sanitized);
          return sanitized;
        }
      }
    }
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

// Turso DB Credentials read safely from explicit VITE_ env or user-stored config
const clientUrl = (import.meta as any).env?.VITE_TURSO_DB_URL || '';
const clientAuthToken = (import.meta as any).env?.VITE_TURSO_TOKEN || '';

export const directWebTurso = clientUrl && clientAuthToken
  ? createClient({
      url: clientUrl,
      authToken: clientAuthToken,
    })
  : null;

/**
 * Unified API Fetch wrapper that automatically adds the X-Family-Id header
 * and falls back to Direct Turso on static hosting (GitHub Pages)
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const currentFamilyId = getStoredFamilyId();
  const fallbackFamilyId = currentFamilyId || 'FP-DEFAULT';
  const headers = new Headers(options.headers || {});

  if (currentFamilyId) {
    headers.set('X-Family-Id', currentFamilyId);
  }

  if (options.body && !headers.has('Content-Type') && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  // If on static hosting (e.g. GitHub Pages) and Direct Turso is configured, bypass local /api
  if (isStaticHosting() && directWebTurso) {
    return executeDirectTurso(directWebTurso, fallbackFamilyId, path, options);
  }

  try {
    const res = await fetch(path, { ...options, headers });
    const contentType = res.headers.get('content-type') || '';
    if ((!res.ok || !contentType.includes('application/json')) && directWebTurso) {
      return executeDirectTurso(directWebTurso, fallbackFamilyId, path, options);
    }
    return res;
  } catch (err) {
    if (directWebTurso) {
      return executeDirectTurso(directWebTurso, fallbackFamilyId, path, options);
    }
    throw err;
  }
}

/**
 * Creates a new Family space
 */
export async function createFamily(requestedId?: string): Promise<{ familyId: string; createdAt: string }> {
  if (isStaticHosting() && directWebTurso) {
    const result = await directCreateFamily(directWebTurso, requestedId);
    setStoredFamilyId(result.familyId);
    return result;
  }

  try {
    const res = await fetch('/api/families/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId: requestedId ? sanitizeFamilyCode(requestedId) : undefined }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.familyId) {
        setStoredFamilyId(data.familyId);
      }
      return data;
    }
    if (directWebTurso) {
      const result = await directCreateFamily(directWebTurso, requestedId);
      setStoredFamilyId(result.familyId);
      return result;
    }
    throw new Error('Falha ao criar novo espaço familiar.');
  } catch (err) {
    if (directWebTurso) {
      const result = await directCreateFamily(directWebTurso, requestedId);
      setStoredFamilyId(result.familyId);
      return result;
    }
    throw err;
  }
}

/**
 * Validates and joins an existing Family code without saving to storage until master key is verified
 */
export async function joinFamily(familyId: string): Promise<{
  valid: boolean;
  familyId?: string;
  sampleEncrypted?: string | null;
  error?: string;
}> {
  const sanitized = sanitizeFamilyCode(familyId);
  if (!sanitized) {
    return { valid: false, error: 'O código de pareamento deve conter o formato FP-XXXXXX.' };
  }

  if (isStaticHosting() && directWebTurso) {
    const valid = await directVerifyFamily(directWebTurso, sanitized);
    if (valid) {
      const sampleEncrypted = await directGetSampleEncrypted(directWebTurso, sanitized);
      return { valid: true, familyId: sanitized, sampleEncrypted };
    }
    return { valid: false, error: 'Código de pareamento não encontrado. Verifique os caracteres digitados.' };
  }

  try {
    const res = await fetch('/api/families/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familyId: sanitized }),
    });

    if (res.ok) {
      const data = await res.json();
      return data;
    }

    if (directWebTurso) {
      const valid = await directVerifyFamily(directWebTurso, sanitized);
      if (valid) {
        const sampleEncrypted = await directGetSampleEncrypted(directWebTurso, sanitized);
        return { valid: true, familyId: sanitized, sampleEncrypted };
      }
    }

    const data = await res.json().catch(() => ({}));
    return {
      valid: false,
      error: data.error || 'Código de pareamento não encontrado. Verifique os caracteres.',
    };
  } catch {
    if (directWebTurso) {
      const valid = await directVerifyFamily(directWebTurso, sanitized);
      if (valid) {
        const sampleEncrypted = await directGetSampleEncrypted(directWebTurso, sanitized);
        return { valid: true, familyId: sanitized, sampleEncrypted };
      }
    }
    return {
      valid: false,
      error: 'Erro ao conectar. Verifique sua conexão e tente novamente.',
    };
  }
}

/**
 * Checks if a family code is valid
 */
export async function verifyFamily(familyId: string): Promise<boolean> {
  const sanitized = sanitizeFamilyCode(familyId);
  if (!sanitized) return false;

  if (isStaticHosting() && directWebTurso) {
    return directVerifyFamily(directWebTurso, sanitized);
  }

  try {
    const res = await fetch(`/api/families/${sanitized}/verify`);
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.valid);
    }
    if (directWebTurso) {
      return directVerifyFamily(directWebTurso, sanitized);
    }
    return false;
  } catch {
    if (directWebTurso) {
      return directVerifyFamily(directWebTurso, sanitized);
    }
    return false;
  }
}
