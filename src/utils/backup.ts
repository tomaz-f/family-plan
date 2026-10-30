import {
  AppSettings,
  AppState,
  Category,
  CreditCard,
  CreditCardBrand,
  FuelLog,
  RecurringTemplate,
  Transaction,
} from '../types';

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

export const BACKUP_FORMAT = 'familyplan-backup';
export const BACKUP_VERSION = 2;

const STORAGE_REPORTS_ORDER_KEY = 'familyplan_reports_section_order_v1';

export interface BackupPreferences {
  reportsSectionOrder?: string[] | null;
}

export interface BackupSummary {
  categories: number;
  transactions: number;
  creditCards: number;
  cardTransactions: number;
  invoiceBills: number;
  recurringTemplates: number;
  fuelLogs: number;
  pendingOfflineTransactions: number;
  transactionsPerCard: Record<string, { name: string; transactions: number; invoices: string[] }>;
}

export interface FamilyPlanBackup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  familyId: string | null;
  settings: AppSettings;
  categories: Category[];
  transactions: Transaction[];
  creditCards: CreditCard[];
  recurringTemplates: RecurringTemplate[];
  fuelLogs: FuelLog[];
  pendingOfflineTransactions: Transaction[];
  preferences: BackupPreferences;
  summary: BackupSummary;
}

/** Normalized result of parsing any backup version. */
export interface NormalizedBackup {
  version: number;
  settings: Partial<AppSettings>;
  categories: Category[];
  transactions: Transaction[];
  creditCards: CreditCard[];
  recurringTemplates: RecurringTemplate[];
  fuelLogs: FuelLog[];
  preferences: BackupPreferences;
  warnings: string[];
}

// =========================================================
// NORMALIZERS (shared by export and import)
// =========================================================

const str = (v: unknown, fallback = ''): string =>
  v === null || v === undefined ? fallback : String(v);
const optStr = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : String(v);
const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const optNum = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export function normalizeTransaction(raw: any): Transaction | null {
  if (!raw || !raw.id || !raw.date) return null;
  return {
    id: str(raw.id),
    type: raw.type === 'income' ? 'income' : 'expense',
    status: raw.status === 'unpaid' ? 'unpaid' : 'paid',
    amount: num(raw.amount),
    description: str(raw.description),
    categoryId: str(raw.categoryId),
    date: str(raw.date),
    notes: str(raw.notes),
    recurringId: optStr(raw.recurringId),
    dueDay: optNum(raw.dueDay),
    installmentCurrent: optNum(raw.installmentCurrent),
    installmentTotal: optNum(raw.installmentTotal),
    // Credit card & invoice links (must never be dropped)
    cardId: optStr(raw.cardId),
    invoiceMonth: optStr(raw.invoiceMonth),
    purchaseDate: optStr(raw.purchaseDate),
    settledInvoiceKey: optStr(raw.settledInvoiceKey),
    createdAt: str(raw.createdAt, new Date().toISOString()),
  };
}

export function normalizeCreditCard(raw: any): CreditCard | null {
  if (!raw || !raw.id) return null;
  const digits = str(raw.lastDigits ?? raw.last4Digits).slice(-4);
  return {
    id: str(raw.id),
    name: str(raw.name, 'Cartão'),
    brand: (str(raw.brand, 'other') || 'other') as CreditCardBrand,
    lastDigits: digits,
    last4Digits: digits,
    color: str(raw.color, '#8b5cf6'),
    totalLimit: num(raw.totalLimit),
    closingDay: num(raw.closingDay, 25),
    dueDay: num(raw.dueDay, 5),
    createdAt: str(raw.createdAt, new Date().toISOString()),
    updatedAt: optStr(raw.updatedAt) || undefined,
  };
}

export function normalizeCategory(raw: any): Category | null {
  if (!raw || !raw.id) return null;
  return {
    id: str(raw.id),
    name: str(raw.name),
    type: raw.type === 'income' ? 'income' : 'expense',
    color: str(raw.color, '#6366f1'),
    icon: str(raw.icon, 'Tag'),
    isDefault: raw.isDefault ? 1 : 0,
  };
}

export function normalizeRecurring(raw: any): RecurringTemplate | null {
  if (!raw || !raw.id) return null;
  return {
    id: str(raw.id),
    type: raw.type === 'income' ? 'income' : 'expense',
    amount: num(raw.amount),
    description: str(raw.description),
    categoryId: str(raw.categoryId),
    dayOfMonth: num(raw.dayOfMonth, 1),
    active: raw.active !== false && raw.active !== 0,
    isInstallment: Boolean(raw.isInstallment),
    totalInstallments: optNum(raw.totalInstallments),
    startMonth: optStr(raw.startMonth),
    createdAt: str(raw.createdAt, new Date().toISOString()),
  };
}

export function normalizeFuelLog(raw: any): FuelLog | null {
  if (!raw || !raw.id || !raw.date) return null;
  return {
    id: str(raw.id),
    date: str(raw.date),
    odometer: num(raw.odometer),
    pricePerLiter: num(raw.pricePerLiter),
    totalCost: num(raw.totalCost),
    liters: num(raw.liters),
    fuelType: raw.fuelType === 'ethanol' ? 'ethanol' : 'gasoline',
    stationName: str(raw.stationName),
    isFullTank: raw.isFullTank !== false && raw.isFullTank !== 0,
    transactionId: optStr(raw.transactionId) || `tx-fuel-${raw.id}`,
    notes: str(raw.notes),
    createdAt: str(raw.createdAt, new Date().toISOString()),
  };
}

function normalizeList<T>(list: unknown, fn: (raw: any) => T | null): T[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const raw of list) {
    const item = fn(raw) as any;
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

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

function buildSummary(
  transactions: Transaction[],
  creditCards: CreditCard[],
  categories: Category[],
  recurringTemplates: RecurringTemplate[],
  fuelLogs: FuelLog[],
  pendingCount: number
): BackupSummary {
  const perCard: BackupSummary['transactionsPerCard'] = {};
  for (const card of creditCards) {
    perCard[card.id] = { name: card.name, transactions: 0, invoices: [] };
  }
  let cardTransactions = 0;
  let invoiceBills = 0;
  for (const tx of transactions) {
    if (tx.settledInvoiceKey) invoiceBills++;
    if (!tx.cardId) continue;
    cardTransactions++;
    if (!perCard[tx.cardId]) {
      perCard[tx.cardId] = { name: '(cartão não encontrado)', transactions: 0, invoices: [] };
    }
    perCard[tx.cardId].transactions++;
    const inv = tx.invoiceMonth || (tx.purchaseDate || tx.date).slice(0, 7);
    if (!perCard[tx.cardId].invoices.includes(inv)) perCard[tx.cardId].invoices.push(inv);
  }
  for (const entry of Object.values(perCard)) entry.invoices.sort();

  return {
    categories: categories.length,
    transactions: transactions.length,
    creditCards: creditCards.length,
    cardTransactions,
    invoiceBills,
    recurringTemplates: recurringTemplates.length,
    fuelLogs: fuelLogs.length,
    pendingOfflineTransactions: pendingCount,
    transactionsPerCard: perCard,
  };
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
    familyName: str(s.familyName, 'FAMILY PLAN'),
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
  if (['light', 'dark', 'tokyo-night', 'oled'].includes(s.theme)) settings.theme = s.theme;
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
