import { Client } from '@libsql/client/web';
import { AppState, Category, Transaction, CreditCard, FuelLog, RecurringTemplate } from '../types';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'inc-deposit', name: 'Bank Input / Deposit', type: 'income', color: '#10b981', icon: 'Landmark', isDefault: 1 },
  { id: 'inc-salary', name: 'Salary / Paycheck', type: 'income', color: '#059669', icon: 'Briefcase', isDefault: 1 },
  { id: 'inc-freelance', name: 'Extra Income / Bonus', type: 'income', color: '#14b8a6', icon: 'Sparkles', isDefault: 1 },
  { id: 'inc-refund', name: 'Refund / Cashback', type: 'income', color: '#06b6d4', icon: 'RotateCcw', isDefault: 1 },
  { id: 'inc-other', name: 'Other Input', type: 'income', color: '#3b82f6', icon: 'PlusCircle', isDefault: 1 },
  { id: 'exp-groceries', name: 'Groceries & Market', type: 'expense', color: '#f59e0b', icon: 'ShoppingCart', isDefault: 1 },
  { id: 'exp-housing', name: 'Housing & Rent', type: 'expense', color: '#6366f1', icon: 'Home', isDefault: 1 },
  { id: 'exp-utilities', name: 'Bills & Utilities', type: 'expense', color: '#0ea5e9', icon: 'Zap', isDefault: 1 },
  { id: 'exp-dining', name: 'Dining & Food Delivery', type: 'expense', color: '#f97316', icon: 'Utensils', isDefault: 1 },
  { id: 'exp-transport', name: 'Transport & Fuel', type: 'expense', color: '#8b5cf6', icon: 'Car', isDefault: 1 },
  { id: 'exp-health', name: 'Health & Pharmacy', type: 'expense', color: '#ef4444', icon: 'HeartPulse', isDefault: 1 },
  { id: 'exp-education', name: 'Kids & Education', type: 'expense', color: '#ec4899', icon: 'GraduationCap', isDefault: 1 },
  { id: 'exp-shopping', name: 'Shopping & Home', type: 'expense', color: '#a855f7', icon: 'ShoppingBag', isDefault: 1 },
  { id: 'exp-leisure', name: 'Leisure & Subscriptions', type: 'expense', color: '#14b8a6', icon: 'Film', isDefault: 1 },
  { id: 'exp-other', name: 'Other Expenses', type: 'expense', color: '#64748b', icon: 'MoreHorizontal', isDefault: 1 },
];

export const DEFAULT_SETTINGS = {
  familyName: 'PRUMO',
  currency: 'BRL',
  language: 'pt-BR',
  theme: 'oled',
  initialBalance: 0,
  tankCapacity: 50,
  updatedAt: new Date().toISOString(),
};

let dbInitPromise: Promise<void> | null = null;

export async function ensureClientSchema(client: Client): Promise<void> {
  if (dbInitPromise) return dbInitPromise;
  dbInitPromise = (async () => {
    const statements = [
      `CREATE TABLE IF NOT EXISTS families (
        family_id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS settings (
        family_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        encrypted_data TEXT DEFAULT NULL,
        PRIMARY KEY (family_id, key)
      )`,
      `CREATE TABLE IF NOT EXISTS categories (
        family_id TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        color TEXT,
        icon TEXT,
        isDefault INTEGER NOT NULL DEFAULT 0,
        iv TEXT DEFAULT NULL,
        encrypted_data TEXT DEFAULT NULL,
        payload TEXT DEFAULT NULL,
        PRIMARY KEY (family_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS transactions (
        family_id TEXT NOT NULL,
        id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount REAL,
        description TEXT,
        categoryId TEXT,
        date TEXT NOT NULL,
        notes TEXT DEFAULT '',
        recurringId TEXT DEFAULT NULL,
        dueDay INTEGER DEFAULT NULL,
        installmentCurrent INTEGER DEFAULT NULL,
        installmentTotal INTEGER DEFAULT NULL,
        status TEXT NOT NULL DEFAULT 'paid',
        cardId TEXT DEFAULT NULL,
        invoiceMonth TEXT DEFAULT NULL,
        purchaseDate TEXT DEFAULT NULL,
        settledInvoiceKey TEXT DEFAULT NULL,
        createdAt TEXT NOT NULL,
        iv TEXT DEFAULT NULL,
        encrypted_data TEXT DEFAULT NULL,
        payload TEXT DEFAULT NULL,
        PRIMARY KEY (family_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS recurring_templates (
        family_id TEXT NOT NULL,
        id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount REAL,
        description TEXT,
        categoryId TEXT,
        dayOfMonth INTEGER NOT NULL DEFAULT 1,
        active INTEGER NOT NULL DEFAULT 1,
        isInstallment INTEGER NOT NULL DEFAULT 0,
        totalInstallments INTEGER DEFAULT NULL,
        startMonth TEXT DEFAULT NULL,
        createdAt TEXT NOT NULL,
        iv TEXT DEFAULT NULL,
        encrypted_data TEXT DEFAULT NULL,
        payload TEXT DEFAULT NULL,
        PRIMARY KEY (family_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS fuel_logs (
        family_id TEXT NOT NULL,
        id TEXT NOT NULL,
        date TEXT NOT NULL,
        odometer REAL,
        pricePerLiter REAL,
        totalCost REAL,
        liters REAL,
        fuelType TEXT CHECK(fuelType IN ('gasoline', 'ethanol')),
        stationName TEXT DEFAULT '',
        isFullTank INTEGER NOT NULL DEFAULT 1,
        transactionId TEXT DEFAULT NULL,
        notes TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        iv TEXT DEFAULT NULL,
        encrypted_data TEXT DEFAULT NULL,
        payload TEXT DEFAULT NULL,
        PRIMARY KEY (family_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS credit_cards (
        family_id TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT,
        brand TEXT DEFAULT 'other',
        last4Digits TEXT DEFAULT '',
        color TEXT DEFAULT '#8b5cf6',
        totalLimit REAL DEFAULT 0,
        closingDay INTEGER DEFAULT 25,
        dueDay INTEGER DEFAULT 5,
        createdAt TEXT NOT NULL,
        iv TEXT DEFAULT NULL,
        encrypted_data TEXT DEFAULT NULL,
        payload TEXT DEFAULT NULL,
        PRIMARY KEY (family_id, id)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_tx_family_date ON transactions(family_id, date)`,
      `CREATE INDEX IF NOT EXISTS idx_fuel_family_date ON fuel_logs(family_id, date)`,
      `CREATE INDEX IF NOT EXISTS idx_cards_family ON credit_cards(family_id)`,
      `CREATE INDEX IF NOT EXISTS idx_recurring_family ON recurring_templates(family_id)`,
      `CREATE INDEX IF NOT EXISTS idx_categories_family ON categories(family_id)`,
    ];

    for (const sql of statements) {
      await client.execute(sql).catch(() => {});
    }
  })();
  return dbInitPromise;
}

export async function directVerifyFamily(client: Client, familyId: string): Promise<boolean> {
  await ensureClientSchema(client);
  const res = await client.execute({
    sql: 'SELECT family_id FROM families WHERE family_id = ?',
    args: [familyId],
  });
  return res.rows.length > 0;
}

export async function directCreateFamily(
  client: Client,
  requestedId?: string
): Promise<{ familyId: string; createdAt: string }> {
  await ensureClientSchema(client);
  const fid = requestedId || `FP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const now = new Date().toISOString();

  await client.execute({
    sql: 'INSERT OR REPLACE INTO families (family_id, created_at) VALUES (?, ?)',
    args: [fid, now],
  });

  // Seed default categories
  for (const c of DEFAULT_CATEGORIES) {
    await client.execute({
      sql: `INSERT OR IGNORE INTO categories (family_id, id, name, type, color, icon, isDefault)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [fid, c.id, c.name, c.type, c.color, c.icon, c.isDefault ? 1 : 0],
    });
  }

  // Seed default settings
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO settings (family_id, key, value) VALUES (?, ?, ?)',
      args: [fid, k, String(v)],
    });
  }

  return { familyId: fid, createdAt: now };
}

export async function directGetFullState(client: Client, familyId: string): Promise<AppState> {
  await ensureClientSchema(client);

  const [catRes, txRes, cardRes, recRes, fuelRes, setRes] = await Promise.all([
    client.execute({
      sql: 'SELECT id, name, type, color, icon, isDefault, encrypted_data FROM categories WHERE family_id = ? ORDER BY type ASC, name ASC',
      args: [familyId],
    }),
    client.execute({
      sql: 'SELECT * FROM transactions WHERE family_id = ? ORDER BY date DESC, createdAt DESC',
      args: [familyId],
    }),
    client.execute({
      sql: 'SELECT * FROM credit_cards WHERE family_id = ? ORDER BY createdAt ASC, name ASC',
      args: [familyId],
    }),
    client.execute({
      sql: 'SELECT * FROM recurring_templates WHERE family_id = ? ORDER BY dayOfMonth ASC, description ASC',
      args: [familyId],
    }),
    client.execute({
      sql: 'SELECT * FROM fuel_logs WHERE family_id = ? ORDER BY odometer DESC, date DESC, createdAt DESC',
      args: [familyId],
    }),
    client.execute({
      sql: 'SELECT key, value, encrypted_data FROM settings WHERE family_id = ?',
      args: [familyId],
    }),
  ]);

  const settings: any = { ...DEFAULT_SETTINGS };
  for (const r of setRes.rows) {
    const k = String(r.key);
    const v = String(r.value);
    if (k === 'initialBalance' || k === 'tankCapacity') {
      settings[k] = Number(v) || 0;
    } else {
      settings[k] = v;
    }
  }

  const categories: Category[] = catRes.rows.map((c: any) => ({
    id: String(c.id),
    name: String(c.name || ''),
    type: c.type === 'income' ? 'income' : 'expense',
    color: String(c.color || '#6366f1'),
    icon: String(c.icon || 'Tag'),
    isDefault: Number(c.isDefault || 0),
    iv: c.iv ? String(c.iv) : null,
    payload: c.payload ? String(c.payload) : null,
    encrypted_data: c.encrypted_data ? String(c.encrypted_data) : (c.iv && c.payload ? `v1:${c.iv}:${c.payload}` : null),
  }));

  const transactions: Transaction[] = txRes.rows.map((t: any) => ({
    id: String(t.id),
    type: t.type === 'income' ? 'income' : 'expense',
    amount: t.amount !== null && t.amount !== undefined ? Number(t.amount) : 0,
    description: String(t.description || ''),
    categoryId: String(t.categoryId || ''),
    date: String(t.date),
    notes: String(t.notes || ''),
    recurringId: t.recurringId ? String(t.recurringId) : null,
    dueDay: t.dueDay ? Number(t.dueDay) : null,
    installmentCurrent: t.installmentCurrent ? Number(t.installmentCurrent) : null,
    installmentTotal: t.installmentTotal ? Number(t.installmentTotal) : null,
    status: t.status === 'unpaid' ? 'unpaid' : 'paid',
    cardId: t.cardId ? String(t.cardId) : null,
    invoiceMonth: t.invoiceMonth ? String(t.invoiceMonth) : null,
    purchaseDate: t.purchaseDate ? String(t.purchaseDate) : null,
    settledInvoiceKey: t.settledInvoiceKey ? String(t.settledInvoiceKey) : null,
    createdAt: String(t.createdAt),
    iv: t.iv ? String(t.iv) : (t.encrypted_data && String(t.encrypted_data).startsWith('v1:') ? String(t.encrypted_data).split(':')[1] : null),
    payload: t.payload ? String(t.payload) : (t.encrypted_data && String(t.encrypted_data).startsWith('v1:') ? String(t.encrypted_data).split(':')[2] : (t.encrypted_data ? String(t.encrypted_data) : null)),
    encrypted_data: t.encrypted_data ? String(t.encrypted_data) : (t.iv && t.payload ? `v1:${t.iv}:${t.payload}` : null),
  }));

  const creditCards: CreditCard[] = cardRes.rows.map((c: any) => ({
    id: String(c.id),
    name: String(c.name || ''),
    brand: (c.brand || 'other') as any,
    last4Digits: String(c.last4Digits || ''),
    lastDigits: String(c.last4Digits || ''),
    color: String(c.color || '#8b5cf6'),
    totalLimit: Number(c.totalLimit || 0),
    closingDay: Number(c.closingDay || 25),
    dueDay: Number(c.dueDay || 5),
    createdAt: String(c.createdAt),
    updatedAt: String(c.createdAt),
    iv: c.iv ? String(c.iv) : null,
    payload: c.payload ? String(c.payload) : null,
    encrypted_data: c.encrypted_data ? String(c.encrypted_data) : (c.iv && c.payload ? `v1:${c.iv}:${c.payload}` : null),
  }));

  const recurringTemplates: RecurringTemplate[] = recRes.rows.map((r: any) => ({
    id: String(r.id),
    type: r.type === 'income' ? 'income' : 'expense',
    amount: Number(r.amount || 0),
    description: String(r.description || ''),
    categoryId: String(r.categoryId || ''),
    dayOfMonth: Number(r.dayOfMonth || 1),
    active: Boolean(r.active),
    isInstallment: Boolean(r.isInstallment),
    totalInstallments: r.totalInstallments ? Number(r.totalInstallments) : null,
    startMonth: r.startMonth ? String(r.startMonth) : null,
    createdAt: String(r.createdAt),
    iv: r.iv ? String(r.iv) : null,
    payload: r.payload ? String(r.payload) : null,
    encrypted_data: r.encrypted_data ? String(r.encrypted_data) : (r.iv && r.payload ? `v1:${r.iv}:${r.payload}` : null),
  }));

  const fuelLogs: FuelLog[] = fuelRes.rows.map((f: any) => ({
    id: String(f.id),
    date: String(f.date),
    odometer: Number(f.odometer || 0),
    pricePerLiter: Number(f.pricePerLiter || 0),
    totalCost: Number(f.totalCost || 0),
    liters: Number(f.liters || 0),
    fuelType: (f.fuelType || 'gasoline') as any,
    stationName: String(f.stationName || ''),
    isFullTank: Boolean(f.isFullTank),
    transactionId: f.transactionId ? String(f.transactionId) : null,
    notes: String(f.notes || ''),
    createdAt: String(f.createdAt),
    iv: f.iv ? String(f.iv) : (f.encrypted_data && String(f.encrypted_data).startsWith('v1:') ? String(f.encrypted_data).split(':')[1] : null),
    payload: f.payload ? String(f.payload) : (f.encrypted_data && String(f.encrypted_data).startsWith('v1:') ? String(f.encrypted_data).split(':')[2] : (f.encrypted_data ? String(f.encrypted_data) : null)),
    encrypted_data: f.encrypted_data ? String(f.encrypted_data) : (f.iv && f.payload ? `v1:${f.iv}:${f.payload}` : null),
  }));

  return {
    settings,
    categories,
    transactions,
    creditCards,
    recurringTemplates,
    fuelLogs,
    networkInfo: {
      port: 0,
      primaryUrl: window.location.origin,
      lanUrls: [],
      qrCodeDataUrl: '',
      dbPath: 'Turso Cloud / Web (E2EE)',
    },
  };
}

export async function directSaveTransaction(client: Client, familyId: string, txData: any): Promise<AppState> {
  await ensureClientSchema(client);
  const isEncrypted = Boolean(txData.encrypted_data || txData.payload);
  const cleanAmount = isEncrypted ? null : Number(txData.amount || 0);
  const cleanDesc = isEncrypted ? null : (txData.description ? String(txData.description).trim() : null);
  const cleanCatId = isEncrypted ? null : (txData.categoryId ? String(txData.categoryId) : null);
  const cleanNotes = isEncrypted ? null : (txData.notes ? String(txData.notes).trim() : '');

  const cleanIv = txData.iv || (txData.encrypted_data && txData.encrypted_data.startsWith('v1:') ? txData.encrypted_data.split(':')[1] : null);
  const cleanPayload = txData.payload || (txData.encrypted_data && txData.encrypted_data.startsWith('v1:') ? txData.encrypted_data.split(':')[2] : (txData.encrypted_data || null));
  const cleanEncrypted = txData.encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);

  await client.execute({
    sql: `INSERT OR REPLACE INTO transactions
     (family_id, id, type, status, amount, description, categoryId, date, notes, recurringId, dueDay, installmentCurrent, installmentTotal, cardId, invoiceMonth, purchaseDate, settledInvoiceKey, createdAt, iv, encrypted_data, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      familyId,
      txData.id,
      txData.type || 'expense',
      txData.status || 'paid',
      cleanAmount,
      cleanDesc,
      cleanCatId,
      String(txData.date),
      cleanNotes,
      txData.recurringId || null,
      txData.dueDay || null,
      txData.installmentCurrent || null,
      txData.installmentTotal || null,
      txData.cardId || null,
      txData.invoiceMonth || null,
      txData.purchaseDate || null,
      txData.settledInvoiceKey || null,
      txData.createdAt || new Date().toISOString(),
      cleanIv,
      cleanEncrypted,
      cleanPayload,
    ],
  });

  if (Array.isArray(txData.futureEntries)) {
    for (const f of txData.futureEntries) {
      if (!f || !f.date) continue;
      const fEnc = Boolean(f.encrypted_data || f.payload);
      const fIv = f.iv || (f.encrypted_data && f.encrypted_data.startsWith('v1:') ? f.encrypted_data.split(':')[1] : null);
      const fPayload = f.payload || (f.encrypted_data && f.encrypted_data.startsWith('v1:') ? f.encrypted_data.split(':')[2] : (f.encrypted_data || null));
      const fEncData = f.encrypted_data || (fIv && fPayload ? `v1:${fIv}:${fPayload}` : fPayload);

      await client.execute({
        sql: `INSERT OR REPLACE INTO transactions
         (family_id, id, type, status, amount, description, categoryId, date, notes, recurringId, dueDay, installmentCurrent, installmentTotal, cardId, invoiceMonth, purchaseDate, settledInvoiceKey, createdAt, iv, encrypted_data, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          familyId,
          f.id,
          f.type || 'expense',
          f.status || 'unpaid',
          fEnc ? null : Number(f.amount || 0),
          fEnc ? null : (f.description ? String(f.description).trim() : null),
          fEnc ? null : (f.categoryId ? String(f.categoryId) : null),
          String(f.date),
          fEnc ? null : String(f.notes || '').trim(),
          f.recurringId || null,
          f.dueDay || null,
          f.installmentCurrent || null,
          f.installmentTotal || null,
          f.cardId || null,
          f.invoiceMonth || null,
          f.purchaseDate || null,
          f.settledInvoiceKey || null,
          new Date().toISOString(),
          fIv,
          fEncData,
          fPayload,
        ],
      });
    }
  }

  return directGetFullState(client, familyId);
}

export async function directUpdateTransaction(client: Client, familyId: string, id: string, txData: any): Promise<AppState> {
  await ensureClientSchema(client);
  const updateSingleRow = async (rowId: string, rowData: any) => {
    const isEncrypted = Boolean(rowData.encrypted_data || rowData.payload);
    if (isEncrypted) {
      const cleanIv = rowData.iv || (rowData.encrypted_data && rowData.encrypted_data.startsWith('v1:') ? rowData.encrypted_data.split(':')[1] : null);
      const cleanPayload = rowData.payload || (rowData.encrypted_data && rowData.encrypted_data.startsWith('v1:') ? rowData.encrypted_data.split(':')[2] : (rowData.encrypted_data || null));
      const cleanEncrypted = rowData.encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);
      await client.execute({
        sql: `UPDATE transactions
         SET type = ?, status = ?, date = ?, amount = NULL, description = NULL, categoryId = NULL, notes = NULL,
             recurringId = ?, dueDay = ?, installmentCurrent = ?, installmentTotal = ?, cardId = ?, invoiceMonth = ?, purchaseDate = ?, settledInvoiceKey = ?,
             iv = ?, encrypted_data = ?, payload = ?
         WHERE family_id = ? AND id = ?`,
        args: [
          rowData.type || 'expense',
          rowData.status || 'paid',
          String(rowData.date),
          rowData.recurringId || null,
          rowData.dueDay || null,
          rowData.installmentCurrent || null,
          rowData.installmentTotal || null,
          rowData.cardId || null,
          rowData.invoiceMonth || null,
          rowData.purchaseDate || null,
          rowData.settledInvoiceKey || null,
          cleanIv,
          cleanEncrypted,
          cleanPayload,
          familyId,
          rowId,
        ],
      });
    } else {
      await client.execute({
        sql: `UPDATE transactions
         SET type = ?, status = ?, amount = ?, description = ?, categoryId = ?, date = ?, notes = ?,
             recurringId = ?, dueDay = ?, installmentCurrent = ?, installmentTotal = ?, cardId = ?, invoiceMonth = ?, purchaseDate = ?, settledInvoiceKey = ?
         WHERE family_id = ? AND id = ?`,
        args: [
          rowData.type || 'expense',
          rowData.status || 'paid',
          Number(rowData.amount || 0),
          String(rowData.description || ''),
          String(rowData.categoryId || ''),
          String(rowData.date),
          String(rowData.notes || ''),
          rowData.recurringId || null,
          rowData.dueDay || null,
          rowData.installmentCurrent || null,
          rowData.installmentTotal || null,
          rowData.cardId || null,
          rowData.invoiceMonth || null,
          rowData.purchaseDate || null,
          rowData.settledInvoiceKey || null,
          familyId,
          rowId,
        ],
      });
    }
  };

  await updateSingleRow(id, txData);

  if (Array.isArray(txData.updatedSeriesEntries)) {
    for (const sEntry of txData.updatedSeriesEntries) {
      if (sEntry && sEntry.id) {
        await updateSingleRow(sEntry.id, sEntry);
      }
    }
  }

  return directGetFullState(client, familyId);
}

export async function directUpdateTransactionStatus(client: Client, familyId: string, id: string, status: string): Promise<AppState> {
  await ensureClientSchema(client);
  await client.execute({
    sql: 'UPDATE transactions SET status = ? WHERE family_id = ? AND id = ?',
    args: [status, familyId, id],
  });
  return directGetFullState(client, familyId);
}

export async function directDeleteTransaction(client: Client, familyId: string, id: string, deleteIds?: string[]): Promise<AppState> {
  await ensureClientSchema(client);
  const ids = Array.isArray(deleteIds) && deleteIds.length > 0 ? deleteIds : [id];
  for (const targetId of ids) {
    if (!targetId) continue;
    await client.execute({
      sql: 'DELETE FROM transactions WHERE family_id = ? AND id = ?',
      args: [familyId, targetId],
    });
  }
  return directGetFullState(client, familyId);
}

export async function directUpdateSettings(client: Client, familyId: string, payload: any): Promise<AppState> {
  await ensureClientSchema(client);
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined) continue;
    await client.execute({
      sql: 'INSERT OR REPLACE INTO settings (family_id, key, value) VALUES (?, ?, ?)',
      args: [familyId, k, String(v)],
    });
  }
  return directGetFullState(client, familyId);
}

export async function directSaveCategory(client: Client, familyId: string, catData: any): Promise<AppState> {
  await ensureClientSchema(client);
  const isEncrypted = Boolean(catData.encrypted_data || catData.payload);
  const cleanIv = catData.iv || (catData.encrypted_data && catData.encrypted_data.startsWith('v1:') ? catData.encrypted_data.split(':')[1] : null);
  const cleanPayload = catData.payload || (catData.encrypted_data && catData.encrypted_data.startsWith('v1:') ? catData.encrypted_data.split(':')[2] : (catData.encrypted_data || null));
  const cleanEncrypted = catData.encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);

  await client.execute({
    sql: `INSERT OR REPLACE INTO categories
     (family_id, id, name, type, color, icon, isDefault, iv, encrypted_data, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      familyId,
      catData.id || `cat-${Date.now()}`,
      isEncrypted ? null : String(catData.name || '').trim(),
      catData.type === 'income' ? 'income' : 'expense',
      isEncrypted ? '#6366f1' : String(catData.color || '#6366f1'),
      isEncrypted ? 'Tag' : String(catData.icon || 'Tag'),
      catData.isDefault ? 1 : 0,
      cleanIv,
      cleanEncrypted,
      cleanPayload,
    ],
  });
  return directGetFullState(client, familyId);
}

export async function directDeleteCategory(client: Client, familyId: string, id: string): Promise<AppState> {
  await ensureClientSchema(client);
  await client.execute({
    sql: 'DELETE FROM categories WHERE family_id = ? AND id = ?',
    args: [familyId, id],
  });
  return directGetFullState(client, familyId);
}

export async function directSaveCard(client: Client, familyId: string, cardData: any): Promise<AppState> {
  await ensureClientSchema(client);
  const isEncrypted = Boolean(cardData.encrypted_data || cardData.payload);
  const cleanIv = cardData.iv || (cardData.encrypted_data && cardData.encrypted_data.startsWith('v1:') ? cardData.encrypted_data.split(':')[1] : null);
  const cleanPayload = cardData.payload || (cardData.encrypted_data && cardData.encrypted_data.startsWith('v1:') ? cardData.encrypted_data.split(':')[2] : (cardData.encrypted_data || null));
  const cleanEncrypted = cardData.encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);

  await client.execute({
    sql: `INSERT OR REPLACE INTO credit_cards
     (family_id, id, name, brand, last4Digits, color, totalLimit, closingDay, dueDay, createdAt, iv, encrypted_data, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      familyId,
      cardData.id || `card-${Date.now()}`,
      isEncrypted ? null : String(cardData.name || 'Cartão').trim(),
      isEncrypted ? 'other' : String(cardData.brand || 'other'),
      isEncrypted ? '' : String(cardData.lastDigits || cardData.last4Digits || '').slice(-4),
      isEncrypted ? '#8b5cf6' : String(cardData.color || '#8b5cf6'),
      isEncrypted ? 0 : Number(cardData.totalLimit || 0),
      isEncrypted ? 25 : Number(cardData.closingDay || 25),
      isEncrypted ? 5 : Number(cardData.dueDay || 5),
      cardData.createdAt || new Date().toISOString(),
      cleanIv,
      cleanEncrypted,
      cleanPayload,
    ],
  });
  return directGetFullState(client, familyId);
}

export async function directDeleteCard(client: Client, familyId: string, id: string): Promise<AppState> {
  await ensureClientSchema(client);
  await client.execute({
    sql: 'DELETE FROM credit_cards WHERE family_id = ? AND id = ?',
    args: [familyId, id],
  });
  await client.execute({
    sql: 'DELETE FROM transactions WHERE family_id = ? AND cardId = ?',
    args: [familyId, id],
  });
  return directGetFullState(client, familyId);
}

export async function directSaveFuel(client: Client, familyId: string, fuelData: any): Promise<AppState> {
  await ensureClientSchema(client);
  const fuelId = fuelData.id || `fuel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const cleanDate = String(fuelData.date || new Date().toISOString().slice(0, 10));
  const entryCreated = fuelData.createdAt || new Date().toISOString();
  const txId = fuelData.transactionId || (fuelData.transaction && fuelData.transaction.id) || `tx-fuel-${fuelId}`;

  const isEncrypted = Boolean(fuelData.encrypted_data || fuelData.payload);
  const cleanIv = fuelData.iv || (fuelData.encrypted_data && fuelData.encrypted_data.startsWith('v1:') ? fuelData.encrypted_data.split(':')[1] : null);
  const cleanPayload = fuelData.payload || (fuelData.encrypted_data && fuelData.encrypted_data.startsWith('v1:') ? fuelData.encrypted_data.split(':')[2] : (fuelData.encrypted_data || null));
  const cleanEncrypted = fuelData.encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);

  await client.execute({
    sql: `INSERT OR REPLACE INTO fuel_logs
     (family_id, id, date, odometer, pricePerLiter, totalCost, liters, fuelType, stationName, isFullTank, transactionId, notes, createdAt, iv, encrypted_data, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      familyId,
      fuelId,
      cleanDate,
      isEncrypted ? null : Number(fuelData.odometer || 0),
      isEncrypted ? null : Number(fuelData.pricePerLiter || 0),
      isEncrypted ? null : Number(fuelData.totalCost || 0),
      isEncrypted ? null : Number(fuelData.liters || 0),
      isEncrypted ? 'gasoline' : (fuelData.fuelType || 'gasoline'),
      isEncrypted ? null : String(fuelData.stationName || ''),
      fuelData.isFullTank === false ? 0 : 1,
      txId,
      isEncrypted ? null : String(fuelData.notes || ''),
      entryCreated,
      cleanIv,
      cleanEncrypted,
      cleanPayload,
    ],
  });

  // Dual save: simultaneously insert or update the linked expense transaction
  if (fuelData.transaction) {
    await directSaveTransaction(client, familyId, {
      ...fuelData.transaction,
      id: txId,
    });
  } else if (!isEncrypted) {
    const fuelLabel = fuelData.fuelType === 'ethanol' ? 'Etanol' : 'Gasolina';
    const txDesc = `Abastecimento (${fuelLabel})${fuelData.stationName ? ` - ${fuelData.stationName}` : ''}${fuelData.liters ? ` [${Number(fuelData.liters).toFixed(2)}L]` : ''}`;
    await directSaveTransaction(client, familyId, {
      id: txId,
      type: 'expense',
      status: 'paid',
      amount: Number(fuelData.totalCost || 0),
      description: txDesc,
      categoryId: 'exp-transport',
      date: cleanDate,
      notes: `${fuelData.odometer || 0} km • ${fuelData.pricePerLiter || 0}/L`,
      createdAt: entryCreated,
    });
  }

  return directGetFullState(client, familyId);
}

export async function directDeleteFuel(client: Client, familyId: string, id: string): Promise<AppState> {
  await ensureClientSchema(client);
  const res = await client.execute({
    sql: 'SELECT transactionId FROM fuel_logs WHERE family_id = ? AND id = ?',
    args: [familyId, id],
  });
  const txId = res.rows[0]?.transactionId || `tx-fuel-${id}`;

  await client.execute({
    sql: 'DELETE FROM fuel_logs WHERE family_id = ? AND id = ?',
    args: [familyId, id],
  });

  await client.execute({
    sql: 'DELETE FROM transactions WHERE family_id = ? AND (id = ? OR id = ?)',
    args: [familyId, txId, `tx-fuel-${id}`],
  });

  return directGetFullState(client, familyId);
}

export async function directSaveRecurring(client: Client, familyId: string, recData: any): Promise<AppState> {
  await ensureClientSchema(client);
  const isEncrypted = Boolean(recData.encrypted_data || recData.payload);
  const cleanIv = recData.iv || (recData.encrypted_data && recData.encrypted_data.startsWith('v1:') ? recData.encrypted_data.split(':')[1] : null);
  const cleanPayload = recData.payload || (recData.encrypted_data && recData.encrypted_data.startsWith('v1:') ? recData.encrypted_data.split(':')[2] : (recData.encrypted_data || null));
  const cleanEncrypted = recData.encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);

  await client.execute({
    sql: `INSERT OR REPLACE INTO recurring_templates
     (family_id, id, type, amount, description, categoryId, dayOfMonth, active, isInstallment, totalInstallments, startMonth, createdAt, iv, encrypted_data, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      familyId,
      recData.id || `rec-${Date.now()}`,
      recData.type || 'expense',
      isEncrypted ? null : Number(recData.amount || 0),
      isEncrypted ? null : String(recData.description || '').trim(),
      isEncrypted ? null : String(recData.categoryId || ''),
      Number(recData.dayOfMonth || 1),
      recData.active === false ? 0 : 1,
      recData.isInstallment ? 1 : 0,
      recData.totalInstallments ? Number(recData.totalInstallments) : null,
      recData.startMonth || null,
      new Date().toISOString(),
      cleanIv,
      cleanEncrypted,
      cleanPayload,
    ],
  });
  return directGetFullState(client, familyId);
}

export async function directDeleteRecurring(client: Client, familyId: string, id: string): Promise<AppState> {
  await ensureClientSchema(client);
  await client.execute({
    sql: 'DELETE FROM recurring_templates WHERE family_id = ? AND id = ?',
    args: [familyId, id],
  });
  return directGetFullState(client, familyId);
}

export async function directResetData(client: Client, familyId: string): Promise<AppState> {
  await ensureClientSchema(client);
  await client.execute({ sql: 'DELETE FROM transactions WHERE family_id = ?', args: [familyId] });
  await client.execute({ sql: 'DELETE FROM recurring_templates WHERE family_id = ?', args: [familyId] });
  await client.execute({ sql: 'DELETE FROM fuel_logs WHERE family_id = ?', args: [familyId] });
  await client.execute({ sql: 'DELETE FROM credit_cards WHERE family_id = ?', args: [familyId] });
  await client.execute({ sql: 'DELETE FROM categories WHERE family_id = ?', args: [familyId] });
  await client.execute({ sql: 'DELETE FROM settings WHERE family_id = ?', args: [familyId] });

  for (const c of DEFAULT_CATEGORIES) {
    await client.execute({
      sql: 'INSERT INTO categories (family_id, id, name, type, color, icon, isDefault) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [familyId, c.id, c.name, c.type, c.color, c.icon, c.isDefault ? 1 : 0],
    });
  }
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await client.execute({
      sql: 'INSERT INTO settings (family_id, key, value) VALUES (?, ?, ?)',
      args: [familyId, k, String(v)],
    });
  }
  return directGetFullState(client, familyId);
}

export async function directImportData(client: Client, familyId: string, data: any): Promise<AppState> {
  await ensureClientSchema(client);

  if (data.mode === 'replace') {
    await client.execute({ sql: 'DELETE FROM transactions WHERE family_id = ?', args: [familyId] });
    await client.execute({ sql: 'DELETE FROM recurring_templates WHERE family_id = ?', args: [familyId] });
    await client.execute({ sql: 'DELETE FROM fuel_logs WHERE family_id = ?', args: [familyId] });
    await client.execute({ sql: 'DELETE FROM credit_cards WHERE family_id = ?', args: [familyId] });
    await client.execute({ sql: 'DELETE FROM categories WHERE family_id = ?', args: [familyId] });
  }

  // 1. Settings
  if (data.settings && typeof data.settings === 'object') {
    for (const [k, v] of Object.entries(data.settings)) {
      if (v === undefined) continue;
      await client.execute({
        sql: 'INSERT OR REPLACE INTO settings (family_id, key, value) VALUES (?, ?, ?)',
        args: [familyId, k, String(v)],
      });
    }
  }

  // 2. Categories
  if (Array.isArray(data.categories)) {
    for (const c of data.categories) {
      if (!c.id) continue;
      await directSaveCategory(client, familyId, c);
    }
  }

  // 3. Credit Cards
  if (Array.isArray(data.creditCards)) {
    for (const c of data.creditCards) {
      if (!c.id) continue;
      await directSaveCard(client, familyId, c);
    }
  }

  // 4. Recurring Templates
  if (Array.isArray(data.recurringTemplates)) {
    for (const r of data.recurringTemplates) {
      if (!r.id) continue;
      await directSaveRecurring(client, familyId, r);
    }
  }

  // 5. Fuel Logs
  if (Array.isArray(data.fuelLogs)) {
    for (const f of data.fuelLogs) {
      if (!f.id) continue;
      await directSaveFuel(client, familyId, f);
    }
  }

  // 6. Transactions (saved after fuel logs so transaction payloads take precedence)
  if (Array.isArray(data.transactions)) {
    for (const t of data.transactions) {
      if (!t.id) continue;
      await directSaveTransaction(client, familyId, t);
    }
  }

  return directGetFullState(client, familyId);
}

