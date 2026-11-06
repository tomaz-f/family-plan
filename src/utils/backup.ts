import {
  AppSettings,
  AppState,
  CreditCard,
  Transaction,
} from '../types';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupPreferences,
  BackupSummary,
  FamilyPlanBackup,
  NormalizedBackup,
  str,
  num,
  normalizeTransaction,
  normalizeCreditCard,
  normalizeCategory,
  normalizeRecurring,
  normalizeFuelLog,
  normalizeList,
  buildSummary,
} from './backup/backupValidators';

/**
 * FAMILY PLAN - Full backup format (v2)
 *
 * v1 (legacy) exported only: settings, categories, transactions, recurringTemplates, fuelLogs.
 * v2 adds: creditCards (cards + limits), invoice links preserved on every transaction
 * (cardId, invoiceMonth, purchaseDate, settledInvoiceKey), pending offline entries,
 * UI preferences and an integrity summary to validate the file at a glance.
 *
 * The backup file itself is a plaintext (decrypted) snapshot generated on the client.
 * On restore, every sensitive entity goes back through the Zero-Knowledge encryption
 * pipeline before reaching Turso.
 */

export {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type BackupPreferences,
  type BackupSummary,
  type FamilyPlanBackup,
  type NormalizedBackup,
  normalizeTransaction,
  normalizeCreditCard,
  normalizeCategory,
  normalizeRecurring,
  normalizeFuelLog,
};

const STORAGE_REPORTS_ORDER_KEY = 'familyplan_reports_section_order_v1';

function readReportsOrder(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_REPORTS_ORDER_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

export function applyBackupPreferences(prefs: BackupPreferences | undefined): void {
  if (!prefs) return;
  try {
    if (Array.isArray(prefs.reportsSectionOrder) && prefs.reportsSectionOrder.length > 0) {
      localStorage.setItem(STORAGE_REPORTS_ORDER_KEY, JSON.stringify(prefs.reportsSectionOrder));
    }
  } catch {
    // ignore storage quota errors
  }
}

// =========================================================
// EXPORT
// =========================================================

export function buildBackupPayload(
  state: AppState,
  options: { familyId?: string | null; pendingOfflineTx?: Transaction[] } = {}
): FamilyPlanBackup {
  const pending = normalizeList(options.pendingOfflineTx || [], normalizeTransaction);

  // Merge pending offline entries so nothing typed while offline is lost
  const txMap = new Map<string, Transaction>();
  for (const tx of normalizeList(state.transactions, normalizeTransaction)) txMap.set(tx.id, tx);
  for (const tx of pending) if (!txMap.has(tx.id)) txMap.set(tx.id, tx);
  const transactions = Array.from(txMap.values()).sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)
  );

  const categories = normalizeList(state.categories, normalizeCategory);
  const creditCards = normalizeList(state.creditCards || [], normalizeCreditCard);
  const recurringTemplates = normalizeList(state.recurringTemplates, normalizeRecurring);
  const fuelLogs = normalizeList(state.fuelLogs || [], normalizeFuelLog);

  const s = state.settings;
  const settings: AppSettings = {
    familyName: str(s.familyName, 'PRUMO'),
    currency: str(s.currency, 'BRL'),
    language: s.language === 'en' ? 'en' : 'pt-BR',
    theme: s.theme || 'oled',
    initialBalance: num(s.initialBalance),
    tankCapacity: num(s.tankCapacity, 50),
    updatedAt: str(s.updatedAt, new Date().toISOString()),
  };

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    familyId: options.familyId || null,
    settings,
    categories,
    transactions,
    creditCards,
    recurringTemplates,
    fuelLogs,
    pendingOfflineTransactions: pending,
    preferences: { reportsSectionOrder: readReportsOrder() },
    summary: buildSummary(transactions, creditCards, categories, recurringTemplates, fuelLogs, pending.length),
  };
}

export function downloadBackupFile(payload: FamilyPlanBackup): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `familyplan-backup-${payload.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// =========================================================
// IMPORT (accepts legacy v1 and v2)
// =========================================================

export function parseBackupPayload(raw: unknown): NormalizedBackup {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Arquivo de backup inválido.');
  }
  const data = raw as any;
  const hasAnyCollection = ['transactions', 'categories', 'creditCards', 'recurringTemplates', 'fuelLogs'].some(
    (k) => Array.isArray(data[k])
  );
  if (!hasAnyCollection && !data.settings) {
    throw new Error('O arquivo não contém dados do FAMILY PLAN.');
  }

  const version = data.format === BACKUP_FORMAT ? num(data.version, 2) : 1;
  const warnings: string[] = [];

  const creditCards = normalizeList(data.creditCards, normalizeCreditCard);

  // Pending offline entries from v2 are restored as regular transactions
  const txMap = new Map<string, Transaction>();
  for (const tx of normalizeList(data.transactions, normalizeTransaction)) txMap.set(tx.id, tx);
  for (const tx of normalizeList(data.pendingOfflineTransactions, normalizeTransaction)) {
    if (!txMap.has(tx.id)) txMap.set(tx.id, tx);
  }
  const transactions = Array.from(txMap.values());

  const cardIds = new Set(creditCards.map((c) => c.id));
  const orphanCardIds = new Set(
    transactions.filter((tx) => tx.cardId && !cardIds.has(tx.cardId)).map((tx) => tx.cardId as string)
  );
  if (orphanCardIds.size > 0) {
    for (const orphanId of orphanCardIds) {
      const suffix = orphanId.replace(/[^A-Za-z0-9]/g, '').slice(-4).toUpperCase();
      const fallbackCard: CreditCard = {
        id: orphanId,
        name: `Cartão ${suffix || 'Restaurado'}`,
        brand: 'other',
        lastDigits: suffix,
        last4Digits: suffix,
        color: '#8b5cf6',
        totalLimit: 0,
        closingDay: 25,
        dueDay: 5,
        createdAt: new Date().toISOString(),
      };
      creditCards.push(fallbackCard);
      cardIds.add(orphanId);
    }
    warnings.push(
      `${orphanCardIds.size} cartão(ões) ausente(s) no backup foram reconstruídos automaticamente a partir dos lançamentos.`
    );
  }
  if (version < 2) {
    warnings.push('Backup no formato legado (v1): não contém cadastro de cartões de crédito.');
  }

  const s = data.settings || {};
  const settings: Partial<AppSettings> = {};
  if (typeof s.familyName === 'string' && s.familyName.trim()) settings.familyName = s.familyName.trim();
  if (typeof s.currency === 'string' && s.currency.trim()) settings.currency = s.currency.trim();
  if (s.language === 'en' || s.language === 'pt-BR') settings.language = s.language;
  if (s.theme !== undefined) {
    settings.theme = s.theme === 'light' ? 'light' : 'oled';
  }
  if (s.initialBalance !== undefined && Number.isFinite(Number(s.initialBalance))) {
    settings.initialBalance = Number(s.initialBalance);
  }
  if (s.tankCapacity !== undefined && Number(s.tankCapacity) > 0) settings.tankCapacity = Number(s.tankCapacity);

  return {
    version,
    settings,
    categories: normalizeList(data.categories, normalizeCategory),
    transactions,
    creditCards,
    recurringTemplates: normalizeList(data.recurringTemplates, normalizeRecurring),
    fuelLogs: normalizeList(data.fuelLogs, normalizeFuelLog),
    preferences: {
      reportsSectionOrder: Array.isArray(data.preferences?.reportsSectionOrder)
        ? data.preferences.reportsSectionOrder.map(String)
        : null,
    },
    warnings,
  };
}

/** Applies a normalized backup to the local (decrypted) state — used as offline fallback. */
export function mergeBackupIntoState(
  state: AppState,
  backup: NormalizedBackup,
  mode: 'merge' | 'replace'
): AppState {
  const mergeById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
    if (mode === 'replace') return incoming;
    const map = new Map<string, T>();
    for (const item of current) map.set(item.id, item);
    for (const item of incoming) map.set(item.id, item);
    return Array.from(map.values());
  };

  return {
    ...state,
    settings: { ...state.settings, ...backup.settings, updatedAt: new Date().toISOString() },
    categories: mergeById(state.categories, backup.categories),
    transactions: mergeById(state.transactions, backup.transactions),
    creditCards: mergeById(state.creditCards || [], backup.creditCards),
    recurringTemplates: mergeById(state.recurringTemplates, backup.recurringTemplates),
    fuelLogs: mergeById(state.fuelLogs || [], backup.fuelLogs),
  };
}
