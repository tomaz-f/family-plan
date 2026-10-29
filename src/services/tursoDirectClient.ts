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
  familyName: 'FAMILY PLAN',
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
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        color TEXT NOT NULL,
        icon TEXT NOT NULL,
        isDefault INTEGER NOT NULL DEFAULT 0,
        encrypted_data TEXT DEFAULT NULL,
        PRIMARY KEY (family_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS transactions (
        family_id TEXT NOT NULL,
        id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount REAL NOT NULL,
        description TEXT NOT NULL,
        categoryId TEXT NOT NULL,
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
        encrypted_data TEXT DEFAULT NULL,
        PRIMARY KEY (family_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS recurring_templates (
        family_id TEXT NOT NULL,
        id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        amount REAL NOT NULL,
        description TEXT NOT NULL,
        categoryId TEXT NOT NULL,
        dayOfMonth INTEGER NOT NULL DEFAULT 1,
        active INTEGER NOT NULL DEFAULT 1,
        isInstallment INTEGER NOT NULL DEFAULT 0,
        totalInstallments INTEGER DEFAULT NULL,
        startMonth TEXT DEFAULT NULL,
        createdAt TEXT NOT NULL,
        encrypted_data TEXT DEFAULT NULL,
        PRIMARY KEY (family_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS fuel_logs (
        family_id TEXT NOT NULL,
        id TEXT NOT NULL,
        date TEXT NOT NULL,
        odometer REAL NOT NULL,
        pricePerLiter REAL NOT NULL,
        totalCost REAL NOT NULL,
        liters REAL NOT NULL,
        fuelType TEXT NOT NULL CHECK(fuelType IN ('gasoline', 'ethanol')),
        stationName TEXT DEFAULT '',
        isFullTank INTEGER NOT NULL DEFAULT 1,
        transactionId TEXT DEFAULT NULL,
        notes TEXT DEFAULT '',
        createdAt TEXT NOT NULL,
        encrypted_data TEXT DEFAULT NULL,
        PRIMARY KEY (family_id, id)
      )`,
      `CREATE TABLE IF NOT EXISTS credit_cards (
        family_id TEXT NOT NULL,
        id TEXT NOT NULL,
        name TEXT NOT NULL,
        brand TEXT NOT NULL DEFAULT 'other',
        last4Digits TEXT DEFAULT '',
        color TEXT NOT NULL DEFAULT '#8b5cf6',
        totalLimit REAL NOT NULL DEFAULT 5000,
        closingDay INTEGER NOT NULL DEFAULT 25,
        dueDay INTEGER NOT NULL DEFAULT 5,
        createdAt TEXT NOT NULL,
        encrypted_data TEXT DEFAULT NULL,
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
    name: String(c.name),
    type: c.type === 'income' ? 'income' : 'expense',
    color: String(c.color || '#6366f1'),
    icon: String(c.icon || 'Tag'),
    isDefault: Number(c.isDefault || 0),
    encrypted_data: c.encrypted_data || null,
  }));

  const transactions: Transaction[] = txRes.rows.map((t: any) => ({
    id: String(t.id),
    type: t.type === 'income' ? 'income' : 'expense',
    amount: Number(t.amount || 0),
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
    encrypted_data: t.encrypted_data || null,
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
    encrypted_data: c.encrypted_data || null,
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
    encrypted_data: r.encrypted_data || null,
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
    encrypted_data: f.encrypted_data || null,
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
  const cleanAmount = txData.encrypted_data ? 0 : Number(txData.amount || 0);
  const cleanDesc = txData.encrypted_data ? '🔒 Encrypted' : String(txData.description || '').trim();
  const cleanCatId = txData.encrypted_data ? 'encrypted' : String(txData.categoryId || '');
  const cleanNotes = txData.encrypted_data ? '' : String(txData.notes || '').trim();

  await client.execute({
    sql: `INSERT OR REPLACE INTO transactions
     (family_id, id, type, status, amount, description, categoryId, date, notes, recurringId, dueDay, installmentCurrent, installmentTotal, cardId, invoiceMonth, purchaseDate, settledInvoiceKey, createdAt, encrypted_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      txData.encrypted_data || null,
    ],
  });

  if (Array.isArray(txData.futureEntries)) {
    for (const f of txData.futureEntries) {
      if (!f || !f.date) continue;
      await client.execute({
        sql: `INSERT OR REPLACE INTO transactions
         (family_id, id, type, status, amount, description, categoryId, date, notes, recurringId, dueDay, installmentCurrent, installmentTotal, cardId, invoiceMonth, purchaseDate, settledInvoiceKey, createdAt, encrypted_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          familyId,
          f.id,
          f.type || 'expense',
          f.status || 'unpaid',
          f.encrypted_data ? 0 : Number(f.amount || 0),
          f.encrypted_data ? '🔒 Encrypted' : String(f.description || '').trim(),
          f.encrypted_data ? 'encrypted' : String(f.categoryId || ''),
          String(f.date),
          f.encrypted_data ? '' : String(f.notes || '').trim(),
          f.recurringId || null,
          f.dueDay || null,
          f.installmentCurrent || null,
          f.installmentTotal || null,
          f.cardId || null,
          f.invoiceMonth || null,
          f.purchaseDate || null,
          f.settledInvoiceKey || null,
          new Date().toISOString(),
          f.encrypted_data || null,
        ],
      });
    }
  }

  return directGetFullState(client, familyId);
}

export async function directUpdateTransaction(client: Client, familyId: string, id: string, txData: any): Promise<AppState> {
  await ensureClientSchema(client);
  if (txData.encrypted_data) {
    await client.execute({
      sql: `UPDATE transactions
       SET type = ?, status = ?, date = ?, encrypted_data = ?
       WHERE family_id = ? AND id = ?`,
      args: [txData.type || 'expense', txData.status || 'paid', String(txData.date), txData.encrypted_data, familyId, id],
    });
  } else {
    await client.execute({
      sql: `UPDATE transactions
       SET type = ?, status = ?, amount = ?, description = ?, categoryId = ?, date = ?, notes = ?
       WHERE family_id = ? AND id = ?`,
      args: [
        txData.type || 'expense',
        txData.status || 'paid',
        Number(txData.amount || 0),
        String(txData.description || ''),
        String(txData.categoryId || ''),
        String(txData.date),
        String(txData.notes || ''),
        familyId,
        id,
      ],
    });
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

export async function directDeleteTransaction(client: Client, familyId: string, id: string): Promise<AppState> {
  await ensureClientSchema(client);
  await client.execute({
    sql: 'DELETE FROM transactions WHERE family_id = ? AND id = ?',
    args: [familyId, id],
  });
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
  await client.execute({
    sql: `INSERT OR REPLACE INTO categories
     (family_id, id, name, type, color, icon, isDefault, encrypted_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      familyId,
      catData.id || `cat-${Date.now()}`,
      catData.encrypted_data ? '🔒 Encrypted' : String(catData.name || '').trim(),
      catData.type === 'income' ? 'income' : 'expense',
      catData.encrypted_data ? '#6366f1' : String(catData.color || '#6366f1'),
      catData.encrypted_data ? 'Tag' : String(catData.icon || 'Tag'),
      catData.isDefault ? 1 : 0,
      catData.encrypted_data || null,
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
  await client.execute({
    sql: `INSERT OR REPLACE INTO credit_cards
     (family_id, id, name, brand, last4Digits, color, totalLimit, closingDay, dueDay, createdAt, encrypted_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      familyId,
      cardData.id || `card-${Date.now()}`,
      cardData.encrypted_data ? '🔒 Encrypted' : String(cardData.name || 'Cartão').trim(),
      cardData.encrypted_data ? 'other' : String(cardData.brand || 'other'),
      cardData.encrypted_data ? '' : String(cardData.lastDigits || cardData.last4Digits || '').slice(-4),
      cardData.encrypted_data ? '#8b5cf6' : String(cardData.color || '#8b5cf6'),
      cardData.encrypted_data ? 0 : Number(cardData.totalLimit || 0),
      cardData.encrypted_data ? 25 : Number(cardData.closingDay || 25),
      cardData.encrypted_data ? 5 : Number(cardData.dueDay || 5),
      new Date().toISOString(),
      cardData.encrypted_data || null,
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
  await client.execute({
    sql: `INSERT OR REPLACE INTO fuel_logs
     (family_id, id, date, odometer, pricePerLiter, totalCost, liters, fuelType, stationName, isFullTank, notes, createdAt, encrypted_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      familyId,
      fuelData.id || `fuel-${Date.now()}`,
      String(fuelData.date),
      fuelData.encrypted_data ? 0 : Number(fuelData.odometer || 0),
      fuelData.encrypted_data ? 0 : Number(fuelData.pricePerLiter || 0),
      fuelData.encrypted_data ? 0 : Number(fuelData.totalCost || 0),
      fuelData.encrypted_data ? 0 : Number(fuelData.liters || 0),
      fuelData.encrypted_data ? 'gasoline' : fuelData.fuelType || 'gasoline',
      fuelData.encrypted_data ? '' : String(fuelData.stationName || ''),
      fuelData.isFullTank === false ? 0 : 1,
      fuelData.encrypted_data ? '' : String(fuelData.notes || ''),
      new Date().toISOString(),
      fuelData.encrypted_data || null,
    ],
  });
  return directGetFullState(client, familyId);
}

export async function directDeleteFuel(client: Client, familyId: string, id: string): Promise<AppState> {
  await ensureClientSchema(client);
  await client.execute({
    sql: 'DELETE FROM fuel_logs WHERE family_id = ? AND id = ?',
    args: [familyId, id],
  });
  return directGetFullState(client, familyId);
}

export async function directSaveRecurring(client: Client, familyId: string, recData: any): Promise<AppState> {
  await ensureClientSchema(client);
  await client.execute({
    sql: `INSERT OR REPLACE INTO recurring_templates
     (family_id, id, type, amount, description, categoryId, dayOfMonth, active, isInstallment, totalInstallments, startMonth, createdAt, encrypted_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      familyId,
      recData.id || `rec-${Date.now()}`,
      recData.type || 'expense',
      recData.encrypted_data ? 0 : Number(recData.amount || 0),
      recData.encrypted_data ? '🔒 Encrypted' : String(recData.description || '').trim(),
      recData.encrypted_data ? 'encrypted' : String(recData.categoryId || ''),
      Number(recData.dayOfMonth || 1),
      recData.active === false ? 0 : 1,
      recData.isInstallment ? 1 : 0,
      recData.totalInstallments ? Number(recData.totalInstallments) : null,
      recData.startMonth || null,
      new Date().toISOString(),
      recData.encrypted_data || null,
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
