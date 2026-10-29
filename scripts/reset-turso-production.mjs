import { createClient } from '@libsql/client';
import fs from 'node:fs';

const env = fs.readFileSync('.env', 'utf8');
const url = env.match(/turso_db_url=(.+)/)[1].trim();
const token = env.match(/turso_token=(.+)/)[1].trim();

const client = createClient({ url, authToken: token });

async function resetDatabase() {
  console.log('--- RESETTING TURSO DATABASE FOR PRODUCTION ---');
  console.log('Connecting to:', url);

  const tablesToDrop = [
    'transactions',
    'fuel_logs',
    'credit_cards',
    'recurring_templates',
    'categories',
    'settings',
    'families',
  ];

  for (const t of tablesToDrop) {
    console.log(`Dropping table ${t}...`);
    await client.execute(`DROP TABLE IF EXISTS ${t}`);
  }

  console.log('\nCreating clean production schema...');

  const schemaStatements = [
    `CREATE TABLE families (
      family_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL
    )`,
    `CREATE TABLE settings (
      family_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      iv TEXT DEFAULT NULL,
      encrypted_data TEXT DEFAULT NULL,
      PRIMARY KEY (family_id, key)
    )`,
    `CREATE TABLE categories (
      family_id TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT DEFAULT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT 'Tag',
      isDefault INTEGER NOT NULL DEFAULT 0,
      iv TEXT DEFAULT NULL,
      encrypted_data TEXT DEFAULT NULL,
      payload TEXT DEFAULT NULL,
      PRIMARY KEY (family_id, id)
    )`,
    `CREATE TABLE transactions (
      family_id TEXT NOT NULL,
      id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      amount REAL DEFAULT NULL,
      description TEXT DEFAULT NULL,
      categoryId TEXT DEFAULT NULL,
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
    `CREATE TABLE recurring_templates (
      family_id TEXT NOT NULL,
      id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
      amount REAL DEFAULT NULL,
      description TEXT DEFAULT NULL,
      categoryId TEXT DEFAULT NULL,
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
    `CREATE TABLE fuel_logs (
      family_id TEXT NOT NULL,
      id TEXT NOT NULL,
      date TEXT NOT NULL,
      odometer REAL DEFAULT NULL,
      pricePerLiter REAL DEFAULT NULL,
      totalCost REAL DEFAULT NULL,
      liters REAL DEFAULT NULL,
      fuelType TEXT CHECK(fuelType IN ('gasoline', 'ethanol') OR fuelType IS NULL) DEFAULT 'gasoline',
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
    `CREATE TABLE credit_cards (
      family_id TEXT NOT NULL,
      id TEXT NOT NULL,
      name TEXT DEFAULT NULL,
      brand TEXT NOT NULL DEFAULT 'other',
      last4Digits TEXT DEFAULT '',
      color TEXT NOT NULL DEFAULT '#8b5cf6',
      totalLimit REAL NOT NULL DEFAULT 5000,
      closingDay INTEGER NOT NULL DEFAULT 25,
      dueDay INTEGER NOT NULL DEFAULT 5,
      createdAt TEXT NOT NULL,
      iv TEXT DEFAULT NULL,
      encrypted_data TEXT DEFAULT NULL,
      payload TEXT DEFAULT NULL,
      PRIMARY KEY (family_id, id)
    )`,
    `CREATE INDEX idx_tx_family_date ON transactions(family_id, date)`,
    `CREATE INDEX idx_fuel_family_date ON fuel_logs(family_id, date)`,
    `CREATE INDEX idx_cards_family ON credit_cards(family_id)`,
    `CREATE INDEX idx_recurring_family ON recurring_templates(family_id)`,
    `CREATE INDEX idx_categories_family ON categories(family_id)`,
  ];

  for (const stmt of schemaStatements) {
    await client.execute(stmt);
  }

  console.log('\n--- VERIFYING CLEAN TABLES ---');
  for (const t of tablesToDrop) {
    const res = await client.execute(`SELECT COUNT(*) as c FROM ${t}`);
    const cols = await client.execute(`PRAGMA table_info(${t})`);
    console.log(`✓ Table ${t}: ${res.rows[0].c} rows (Cols: ${cols.rows.map(c => c.name).join(', ')})`);
  }

  console.log('\n🎉 TURSO DATABASE COMPLETELY RESET AND READY FOR PRODUCTION!');
}

resetDatabase().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
