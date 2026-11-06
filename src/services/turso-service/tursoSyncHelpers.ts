import { Client } from '@libsql/client/web';
import {
  directDeleteCard,
  directDeleteCategory,
  directDeleteFuel,
  directDeleteRecurring,
  directDeleteTransaction,
  directGetFullState,
  directImportData,
  directResetData,
  directSaveCard,
  directSaveCategory,
  directSaveFuel,
  directSaveRecurring,
  directSaveTransaction,
  directUpdateSettings,
  directUpdateTransaction,
  directUpdateTransactionStatus,
} from '../tursoDirectClient';

export function isStaticHosting(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host.endsWith('github.io') ||
    host.endsWith('pages.dev') ||
    host.endsWith('netlify.app') ||
    host.endsWith('vercel.app')
  );
}

export function mockResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Executes operations directly against Turso when hosted statically (e.g. GitHub Pages)
 */
export async function executeDirectTurso(
  directWebTurso: Client | null,
  currentFamilyId: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  if (!directWebTurso) {
    throw new Error('Turso credentials are not configured.');
  }

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
