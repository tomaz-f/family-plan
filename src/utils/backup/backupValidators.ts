import {
  AppSettings,
  Category,
  CreditCard,
  CreditCardBrand,
  FuelLog,
  RecurringTemplate,
  Transaction,
} from '../../types';

export const BACKUP_FORMAT = 'familyplan-backup';
export const BACKUP_VERSION = 2;

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

export const str = (v: unknown, fallback = ''): string =>
  v === null || v === undefined ? fallback : String(v);
export const optStr = (v: unknown): string | null =>
  v === null || v === undefined || v === '' ? null : String(v);
export const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
export const optNum = (v: unknown): number | null => {
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
    totalPurchaseAmount: optNum(raw.totalPurchaseAmount),
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

export function normalizeList<T>(list: unknown, fn: (raw: any) => T | null): T[] {
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

export function buildSummary(
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
