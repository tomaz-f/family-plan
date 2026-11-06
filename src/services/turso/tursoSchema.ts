import { Client } from '@libsql/client/web';
import { Category } from '../../types';

export const DEFAULT_CATEGORIES: Category[] = [
  // Expense Categories (Strict Single-Word Names)
  { id: 'exp-housing', name: 'Moradia', type: 'expense', color: '#F97316', icon: 'Home', isDefault: 1 },
  { id: 'exp-groceries', name: 'Mercado', type: 'expense', color: '#10B981', icon: 'ShoppingBag', isDefault: 1 },
  { id: 'exp-transport', name: 'Transporte', type: 'expense', color: '#06B6D4', icon: 'Car', isDefault: 1 },
  { id: 'exp-health', name: 'Saúde', type: 'expense', color: '#F43F5E', icon: 'HeartPulse', isDefault: 1 },
  { id: 'exp-leisure', name: 'Lazer', type: 'expense', color: '#8B5CF6', icon: 'Gamepad2', isDefault: 1 },
  { id: 'exp-education', name: 'Educação', type: 'expense', color: '#3B82F6', icon: 'GraduationCap', isDefault: 1 },
  { id: 'exp-subscriptions', name: 'Assinaturas', type: 'expense', color: '#EC4899', icon: 'Tv', isDefault: 1 },
  { id: 'exp-bills', name: 'Contas', type: 'expense', color: '#EAB308', icon: 'Zap', isDefault: 1 },
  { id: 'exp-other', name: 'Outros', type: 'expense', color: '#64748B', icon: 'Layers', isDefault: 1 },

  // Income Categories (Strict Single-Word Names)
  { id: 'inc-salary', name: 'Salário', type: 'income', color: '#22C55E', icon: 'Briefcase', isDefault: 1 },
  { id: 'inc-extra', name: 'Extra', type: 'income', color: '#14B8A6', icon: 'Sparkles', isDefault: 1 },
  { id: 'inc-investments', name: 'Investimentos', type: 'income', color: '#38BDF8', icon: 'TrendingUp', isDefault: 1 },
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

export async function directSeedDefaultCategories(client: Client, familyId: string): Promise<void> {
  const catBatch = DEFAULT_CATEGORIES.map((c) => ({
    sql: `INSERT OR IGNORE INTO categories (family_id, id, name, type, color, icon, isDefault)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [familyId, c.id, c.name, c.type, c.color, c.icon, c.isDefault ? 1 : 0],
  }));
  await client.batch(catBatch, 'write');
}
