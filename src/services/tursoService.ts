import { createClient } from '@libsql/client/web';
import {
  directCreateFamily,
  directGetFullState,
  directVerifyFamily,
  directSaveTransaction,
  directUpdateTransaction,
  directUpdateTransactionStatus,
  directDeleteTransaction,
  directUpdateSettings,
  directSaveCategory,
  directDeleteCategory,
  directSaveCard,
  directDeleteCard,
  directSaveFuel,
  directDeleteFuel,
  directSaveRecurring,
  directDeleteRecurring,
  directResetData,
  directImportData,
} from './tursoDirectClient';

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

// Turso DB Credentials read from Vite environment (with fallback to multiple aliases)
const clientUrl =
  (import.meta as any).env?.VITE_TURSO_DB_URL ||
  (import.meta as any).env?.turso_db_url ||
  (import.meta as any).env?.TURSO_DB_URL ||
  '';
const clientAuthToken =
  (import.meta as any).env?.VITE_TURSO_TOKEN ||
  (import.meta as any).env?.turso_token ||
  (import.meta as any).env?.TURSO_TOKEN ||
  '';

export const directWebTurso = clientUrl
  ? createClient({
      url: clientUrl,
      authToken: clientAuthToken || undefined,
    })
  : null;

function isStaticHosting(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host.endsWith('github.io') ||
    host.endsWith('pages.dev') ||
    host.endsWith('netlify.app') ||
    host.endsWith('vercel.app')
  );
}

function mockResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Executes operations directly against Turso when hosted statically (e.g. GitHub Pages)
 */
async function executeDirectTurso(path: string, options: RequestInit = {}): Promise<Response> {
  if (!directWebTurso) {
    throw new Error('Turso credentials are not configured.');
  }

  const currentFamilyId = getStoredFamilyId() || 'FP-DEFAULT';
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(options.body as string) : {};

  // 1. GET /api/state
  if (path.startsWith('/api/state')) {
    const state = await directGetFullState(directWebTurso, currentFamilyId);
    return mockResponse(state);
  }

  // 2. POST /api/sync
  if (path.startsWith('/api/sync') && method === 'POST') {
    if (Array.isArray(body.pendingTransactions)) {
      for (const tx of body.pendingTransactions) {
        await directSaveTransaction(directWebTurso, currentFamilyId, tx);
      }
    }
    const state = await directGetFullState(directWebTurso, currentFamilyId);
    return mockResponse(state);
  }

  // 3. Transactions
  if (path.startsWith('/api/transactions')) {
    if (path.includes('/status') && method === 'PATCH') {
      const parts = path.split('/');
      const id = parts[3];
      const state = await directUpdateTransactionStatus(directWebTurso, currentFamilyId, id, body.status);
      return mockResponse(state);
    }
    if (method === 'POST') {
      const state = await directSaveTransaction(directWebTurso, currentFamilyId, body);
      return mockResponse(state);
    }
    if (method === 'PUT') {
      const id = path.split('/').pop() || body.id;
      const state = await directUpdateTransaction(directWebTurso, currentFamilyId, id, body);
      return mockResponse(state);
    }
    if (method === 'DELETE') {
      const urlObj = new URL(path, 'http://localhost');
      const id = urlObj.pathname.split('/').pop() || '';
      const deleteIds = Array.isArray(body?.deleteIds) ? body.deleteIds : undefined;
      const state = await directDeleteTransaction(directWebTurso, currentFamilyId, id, deleteIds);
      return mockResponse(state);
    }
  }

  // 4. Settings
  if (path.startsWith('/api/settings') && method === 'PUT') {
    const state = await directUpdateSettings(directWebTurso, currentFamilyId, body);
    return mockResponse(state);
  }

  // 5. Categories
  if (path.startsWith('/api/categories')) {
    if (method === 'POST') {
      const state = await directSaveCategory(directWebTurso, currentFamilyId, body);
      return mockResponse(state);
    }
    if (method === 'PUT') {
      const id = path.split('/').pop() || body.id;
      const state = await directSaveCategory(directWebTurso, currentFamilyId, { id, ...body });
      return mockResponse(state);
    }
    if (method === 'DELETE') {
      const id = path.split('/').pop() || '';
      const state = await directDeleteCategory(directWebTurso, currentFamilyId, id);
      return mockResponse(state);
    }
  }

  // 6. Credit Cards
  if (path.startsWith('/api/cards')) {
    if (path.includes('/pay-invoice') && method === 'POST') {
      const state = await directGetFullState(directWebTurso, currentFamilyId);
      return mockResponse(state);
    }
    if (method === 'POST') {
      const state = await directSaveCard(directWebTurso, currentFamilyId, body);
      return mockResponse(state);
    }
    if (method === 'PUT') {
      const id = path.split('/').pop() || body.id;
      const state = await directSaveCard(directWebTurso, currentFamilyId, { id, ...body });
      return mockResponse(state);
    }
    if (method === 'DELETE') {
      const id = path.split('/').pop() || '';
      const state = await directDeleteCard(directWebTurso, currentFamilyId, id);
      return mockResponse(state);
    }
  }

  // 7. Fuel Logs
  if (path.startsWith('/api/fuel')) {
    if (method === 'POST') {
      const state = await directSaveFuel(directWebTurso, currentFamilyId, body);
      return mockResponse(state);
    }
    if (method === 'PUT') {
      const id = path.split('/').pop() || body.id;
      const state = await directSaveFuel(directWebTurso, currentFamilyId, { id, ...body });
      return mockResponse(state);
    }
    if (method === 'DELETE') {
      const id = path.split('/').pop() || '';
      const state = await directDeleteFuel(directWebTurso, currentFamilyId, id);
      return mockResponse(state);
    }
  }

  // 8. Recurring
  if (path.startsWith('/api/recurring')) {
    if (method === 'POST') {
      const state = await directSaveRecurring(directWebTurso, currentFamilyId, body);
      return mockResponse(state);
    }
    if (method === 'DELETE') {
      const id = path.split('/').pop() || '';
      const state = await directDeleteRecurring(directWebTurso, currentFamilyId, id);
      return mockResponse(state);
    }
  }

  // 9. Reset
  if (path.startsWith('/api/reset') && method === 'POST') {
    const state = await directResetData(directWebTurso, currentFamilyId);
    return mockResponse(state);
  }

  // 10. Import Full Backup
  if (path.startsWith('/api/import') && method === 'POST') {
    const state = await directImportData(directWebTurso, currentFamilyId, body);
    return mockResponse(state);
  }

  throw new Error(`Endpoint não suportado no modo direto: ${path}`);
}

/**
 * Unified API Fetch wrapper that automatically adds the X-Family-Id header
 * and falls back to Direct Turso on static hosting (GitHub Pages)
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const currentFamilyId = getStoredFamilyId();
  const headers = new Headers(options.headers || {});

  if (currentFamilyId) {
    headers.set('X-Family-Id', currentFamilyId);
  }

  if (options.body && !headers.has('Content-Type') && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  // If on static hosting (e.g. GitHub Pages) and Direct Turso is configured, bypass local /api
  if (isStaticHosting() && directWebTurso) {
    return executeDirectTurso(path, options);
  }

  try {
    const res = await fetch(path, { ...options, headers });
    const contentType = res.headers.get('content-type') || '';
    if ((!res.ok || !contentType.includes('application/json')) && directWebTurso) {
      return executeDirectTurso(path, options);
    }
    return res;
  } catch (err) {
    if (directWebTurso) {
      return executeDirectTurso(path, options);
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
 * Validates and joins an existing Family code
 */
export async function joinFamily(familyId: string): Promise<{ valid: boolean; familyId?: string; error?: string }> {
  const sanitized = sanitizeFamilyCode(familyId);
  if (!sanitized) {
    return { valid: false, error: 'O código de pareamento deve conter o formato FP-XXXXXX.' };
  }

  if (isStaticHosting() && directWebTurso) {
    const valid = await directVerifyFamily(directWebTurso, sanitized);
    if (valid) {
      setStoredFamilyId(sanitized);
      return { valid: true, familyId: sanitized };
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
      if (data.valid && data.familyId) {
        setStoredFamilyId(data.familyId);
      }
      return data;
    }

    if (directWebTurso) {
      const valid = await directVerifyFamily(directWebTurso, sanitized);
      if (valid) {
        setStoredFamilyId(sanitized);
        return { valid: true, familyId: sanitized };
      }
    }

    const data = await res.json().catch(() => ({}));
    return {
      valid: false,
      error: data.error || 'Código de pareamento não encontrado. Verifique os caracteres.',
    };
  } catch (err) {
    if (directWebTurso) {
      const valid = await directVerifyFamily(directWebTurso, sanitized);
      if (valid) {
        setStoredFamilyId(sanitized);
        return { valid: true, familyId: sanitized };
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
