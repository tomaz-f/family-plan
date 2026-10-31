import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import QRCode from 'qrcode';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Read .env if not loaded in process.env
function loadEnv() {
  const envPath = path.resolve(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const TURSO_URL = process.env.turso_db_url || process.env.TURSO_DB_URL;
const TURSO_TOKEN = process.env.turso_token || process.env.TURSO_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.warn('[Turso Warning] turso_db_url or turso_token is missing from environment.');
}

export const turso = createClient({
  url: TURSO_URL || 'file:data/familyplan.db',
  authToken: TURSO_TOKEN || undefined,
});

export const DEFAULT_CATEGORIES = [
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
  familyName: 'FAMILY PLAN',
  currency: 'BRL',
  language: 'pt-BR',
  theme: 'oled',
  initialBalance: '0',
  tankCapacity: '50',
  updatedAt: new Date().toISOString(),
};

// 32-character alphabet excluding ambiguous chars: 0, O, 1, I
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateFamilyCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(Math.random() * CODE_ALPHABET.length);
    code += CODE_ALPHABET[idx];
  }
  return `FP-${code}`;
}

export function sanitizeFamilyCode(code) {
  let clean = String(code || '').trim().toUpperCase();
  if (clean.startsWith('FP-')) {
    clean = clean.slice(3);
  } else if (clean.startsWith('FP')) {
    clean = clean.slice(2);
  }
  clean = clean.replace(/[^2-9A-HJ-NP-Z]/g, '').slice(0, 6);
  return clean ? `FP-${clean}` : '';
}

async function ensureColumn(table, column, def) {
  try {
    const res = await turso.execute(`PRAGMA table_info(${table})`);
    if (!res.rows.some((c) => c.name === column)) {
      await turso.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
    }
  } catch (err) {
    // column already exists or table is being created
  }
}

export async function initDb() {
  console.log('[Turso] Initializing database tables and indexes...');
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
    `CREATE INDEX IF NOT EXISTS idx_categories_family ON categories(family_id)`
  ];

  for (const sql of statements) {
    await turso.execute(sql);
  }

  // Ensure encrypted_data, iv, and payload columns exist on all tables
  await ensureColumn('transactions', 'iv', 'TEXT DEFAULT NULL');
  await ensureColumn('transactions', 'encrypted_data', 'TEXT DEFAULT NULL');
  await ensureColumn('transactions', 'payload', 'TEXT DEFAULT NULL');
  await ensureColumn('categories', 'iv', 'TEXT DEFAULT NULL');
  await ensureColumn('categories', 'encrypted_data', 'TEXT DEFAULT NULL');
  await ensureColumn('categories', 'payload', 'TEXT DEFAULT NULL');
  await ensureColumn('credit_cards', 'iv', 'TEXT DEFAULT NULL');
  await ensureColumn('credit_cards', 'encrypted_data', 'TEXT DEFAULT NULL');
  await ensureColumn('credit_cards', 'payload', 'TEXT DEFAULT NULL');
  await ensureColumn('recurring_templates', 'iv', 'TEXT DEFAULT NULL');
  await ensureColumn('recurring_templates', 'encrypted_data', 'TEXT DEFAULT NULL');
  await ensureColumn('recurring_templates', 'payload', 'TEXT DEFAULT NULL');
  await ensureColumn('fuel_logs', 'transactionId', 'TEXT DEFAULT NULL');
  await ensureColumn('fuel_logs', 'iv', 'TEXT DEFAULT NULL');
  await ensureColumn('fuel_logs', 'encrypted_data', 'TEXT DEFAULT NULL');
  await ensureColumn('fuel_logs', 'payload', 'TEXT DEFAULT NULL');
  await ensureColumn('settings', 'encrypted_data', 'TEXT DEFAULT NULL');

  console.log('[Turso] Database tables and indexes ready with Zero-Knowledge encryption support.');
}

export async function verifyFamily(familyId) {
  const fid = sanitizeFamilyCode(familyId);
  if (!fid) return false;
  const res = await turso.execute({
    sql: 'SELECT family_id FROM families WHERE family_id = ?',
    args: [fid],
  });
  return res.rows.length > 0;
}

export async function createFamily(requestedId = null) {
  let familyId = requestedId ? sanitizeFamilyCode(requestedId) : null;

  if (!familyId) {
    let attempts = 0;
    while (attempts < 10) {
      const candidate = generateFamilyCode();
      const exists = await verifyFamily(candidate);
      if (!exists) {
        familyId = candidate;
        break;
      }
      attempts++;
    }
    if (!familyId) {
      familyId = generateFamilyCode();
    }
  }

  const createdAt = new Date().toISOString();
  const familyStmt = {
    sql: 'INSERT OR IGNORE INTO families (family_id, created_at) VALUES (?, ?)',
    args: [familyId, createdAt],
  };

  // Seed default categories
  const catBatch = DEFAULT_CATEGORIES.map((c) => ({
    sql: 'INSERT OR IGNORE INTO categories (family_id, id, name, type, color, icon, isDefault) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [familyId, c.id, c.name, c.type, c.color, c.icon, c.isDefault],
  }));

  // Seed default settings
  const settingBatch = Object.entries(DEFAULT_SETTINGS).map(([k, v]) => ({
    sql: 'INSERT OR IGNORE INTO settings (family_id, key, value) VALUES (?, ?, ?)',
    args: [familyId, k, String(v)],
  }));

  // Atomic batch: family creation + default categories + default settings execute together
  await turso.batch([familyStmt, ...catBatch, ...settingBatch], 'write');

  return { familyId, createdAt };
}

export async function seedDefaultCategories(familyId) {
  const catBatch = DEFAULT_CATEGORIES.map((c) => ({
    sql: 'INSERT OR IGNORE INTO categories (family_id, id, name, type, color, icon, isDefault) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [familyId, c.id, c.name, c.type, c.color, c.icon, c.isDefault],
  }));
  await turso.batch(catBatch, 'write');
}

export async function joinFamily(familyId) {
  const fid = sanitizeFamilyCode(familyId);
  if (!fid) {
    return { valid: false, error: 'O código de pareamento deve conter o formato FP-XXXXXX.' };
  }
  const exists = await verifyFamily(fid);
  if (!exists) {
    return { valid: false, error: 'Código de pareamento não encontrado. Verifique os caracteres.' };
  }
  return { valid: true, familyId: fid };
}

export async function getSettingsObject(familyId) {
  const res = await turso.execute({
    sql: 'SELECT key, value, encrypted_data FROM settings WHERE family_id = ?',
    args: [familyId],
  });
  const map = { ...DEFAULT_SETTINGS };
  let encrypted_settings = null;
  for (const r of res.rows) {
    map[r.key] = r.value;
    if (r.encrypted_data) encrypted_settings = r.encrypted_data;
  }
  return {
    familyName: map.familyName || 'FAMILY PLAN',
    currency: map.currency || 'BRL',
    language: map.language || 'pt-BR',
    theme: map.theme || 'oled',
    initialBalance: Number(map.initialBalance || 0),
    tankCapacity: Number(map.tankCapacity || 50),
    updatedAt: map.updatedAt || new Date().toISOString(),
    encrypted_settings,
  };
}

export async function setSetting(familyId, key, value, encrypted_data = null) {
  await turso.execute({
    sql: `INSERT INTO settings (family_id, key, value, encrypted_data) VALUES (?, ?, ?, ?)
          ON CONFLICT(family_id, key) DO UPDATE SET value = excluded.value, encrypted_data = excluded.encrypted_data`,
    args: [familyId, key, String(value), encrypted_data],
  });
  await turso.execute({
    sql: `INSERT INTO settings (family_id, key, value) VALUES (?, 'updatedAt', ?)
          ON CONFLICT(family_id, key) DO UPDATE SET value = excluded.value`,
    args: [familyId, new Date().toISOString()],
  });
}

export async function updateSettings(familyId, body) {
  const { familyName, currency, language, theme, initialBalance, tankCapacity, encrypted_data } = body;

  if (typeof familyName === 'string' && familyName.trim()) {
    await setSetting(familyId, 'familyName', familyName.trim(), encrypted_data);
  }
  if (typeof currency === 'string' && currency.trim()) {
    await setSetting(familyId, 'currency', currency.trim());
  }
  if (typeof language === 'string' && (language === 'en' || language === 'pt-BR')) {
    await setSetting(familyId, 'language', language);
  }
  if (typeof theme === 'string' && ['light', 'dark', 'tokyo-night', 'oled'].includes(theme)) {
    await setSetting(familyId, 'theme', theme);
  }
  if (typeof initialBalance === 'number' && !Number.isNaN(initialBalance)) {
    await setSetting(familyId, 'initialBalance', initialBalance.toFixed(2));
  }
  if (typeof tankCapacity === 'number' && !Number.isNaN(tankCapacity) && tankCapacity > 0) {
    await setSetting(familyId, 'tankCapacity', tankCapacity.toFixed(1));
  }
  if (encrypted_data) {
    await setSetting(familyId, 'encrypted_settings', '1', encrypted_data);
  }

  return getFullState(familyId);
}

function getLocalNetworkAddresses(port) {
  const interfaces = os.networkInterfaces();
  const urls = [];
  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push({
          name,
          ip: net.address,
          url: `http://${net.address}:${port}`,
        });
      }
    }
  }
  urls.sort((a, b) => {
    const aLan = a.ip.startsWith('192.168.') ? 0 : a.ip.startsWith('10.') ? 1 : 2;
    const bLan = b.ip.startsWith('192.168.') ? 0 : b.ip.startsWith('10.') ? 1 : 2;
    return aLan - bLan;
  });
  return urls;
}

export async function getFullState(familyId, port = 3456) {
  const [settings, catRes, txRes, cardRes, recRes, fuelRes] = await Promise.all([
    getSettingsObject(familyId),
    turso.execute({
      sql: 'SELECT id, name, type, color, icon, isDefault, encrypted_data FROM categories WHERE family_id = ? ORDER BY type ASC, name ASC',
      args: [familyId],
    }),
    turso.execute({
      sql: 'SELECT * FROM transactions WHERE family_id = ? ORDER BY date DESC, createdAt DESC',
      args: [familyId],
    }),
    turso.execute({
      sql: 'SELECT * FROM credit_cards WHERE family_id = ? ORDER BY createdAt ASC, name ASC',
      args: [familyId],
    }),
    turso.execute({
      sql: 'SELECT * FROM recurring_templates WHERE family_id = ? ORDER BY dayOfMonth ASC, description ASC',
      args: [familyId],
    }),
    turso.execute({
      sql: 'SELECT * FROM fuel_logs WHERE family_id = ? ORDER BY odometer DESC, date DESC, createdAt DESC',
      args: [familyId],
    }),
  ]);

  let catRows = catRes.rows;
  if (catRows.length === 0) {
    console.log(`[Turso Safeguard] Family ${familyId} has 0 categories. Seeding defaults...`);
    await seedDefaultCategories(familyId);
    const refreshed = await turso.execute({
      sql: 'SELECT id, name, type, color, icon, isDefault, encrypted_data FROM categories WHERE family_id = ? ORDER BY type ASC, name ASC',
      args: [familyId],
    });
    catRows = refreshed.rows;
  }

  const categories = catRows.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type,
    color: c.color,
    icon: c.icon,
    isDefault: Number(c.isDefault || 0),
    iv: c.iv || null,
    payload: c.payload || null,
    encrypted_data: c.encrypted_data || (c.iv && c.payload ? `v1:${c.iv}:${c.payload}` : c.payload) || null,
  }));

  const transactions = txRes.rows.map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount !== null && t.amount !== undefined ? Number(t.amount) : 0,
    description: t.description || '',
    categoryId: t.categoryId || '',
    date: t.date,
    notes: t.notes || '',
    recurringId: t.recurringId || null,
    dueDay: t.dueDay ? Number(t.dueDay) : null,
    installmentCurrent: t.installmentCurrent ? Number(t.installmentCurrent) : null,
    installmentTotal: t.installmentTotal ? Number(t.installmentTotal) : null,
    status: t.status === 'unpaid' ? 'unpaid' : 'paid',
    cardId: t.cardId || null,
    invoiceMonth: t.invoiceMonth || null,
    purchaseDate: t.purchaseDate || null,
    settledInvoiceKey: t.settledInvoiceKey || null,
    createdAt: t.createdAt,
    iv: t.iv || (t.encrypted_data && t.encrypted_data.startsWith('v1:') ? t.encrypted_data.split(':')[1] : null),
    payload: t.payload || (t.encrypted_data && t.encrypted_data.startsWith('v1:') ? t.encrypted_data.split(':')[2] : t.encrypted_data) || null,
    encrypted_data: t.encrypted_data || (t.iv && t.payload ? `v1:${t.iv}:${t.payload}` : t.payload) || null,
  }));

  const creditCards = cardRes.rows.map((c) => ({
    id: c.id,
    name: c.name || '',
    brand: c.brand || 'other',
    last4Digits: c.last4Digits || '',
    lastDigits: c.last4Digits || '',
    color: c.color || '#8b5cf6',
    totalLimit: Number(c.totalLimit || 0),
    closingDay: Number(c.closingDay || 25),
    dueDay: Number(c.dueDay || 5),
    createdAt: c.createdAt,
    iv: c.iv || null,
    payload: c.payload || null,
    encrypted_data: c.encrypted_data || (c.iv && c.payload ? `v1:${c.iv}:${c.payload}` : c.payload) || null,
  }));

  const recurringTemplates = recRes.rows.map((r) => ({
    id: r.id,
    type: r.type,
    amount: Number(r.amount || 0),
    description: r.description || '',
    categoryId: r.categoryId || '',
    dayOfMonth: Number(r.dayOfMonth || 1),
    active: Boolean(r.active),
    isInstallment: Boolean(r.isInstallment),
    totalInstallments: r.totalInstallments ? Number(r.totalInstallments) : null,
    startMonth: r.startMonth || null,
    createdAt: r.createdAt,
    iv: r.iv || null,
    payload: r.payload || null,
    encrypted_data: r.encrypted_data || (r.iv && r.payload ? `v1:${r.iv}:${r.payload}` : r.payload) || null,
  }));

  const fuelLogs = fuelRes.rows.map((f) => ({
    id: f.id,
    date: f.date,
    odometer: Number(f.odometer || 0),
    pricePerLiter: Number(f.pricePerLiter || 0),
    totalCost: Number(f.totalCost || 0),
    liters: Number(f.liters || 0),
    fuelType: f.fuelType || 'gasoline',
    stationName: f.stationName || '',
    isFullTank: Boolean(f.isFullTank),
    transactionId: f.transactionId || null,
    notes: f.notes || '',
    createdAt: f.createdAt,
    iv: f.iv || (f.encrypted_data && f.encrypted_data.startsWith('v1:') ? f.encrypted_data.split(':')[1] : null),
    payload: f.payload || (f.encrypted_data && f.encrypted_data.startsWith('v1:') ? f.encrypted_data.split(':')[2] : f.encrypted_data) || null,
    encrypted_data: f.encrypted_data || (f.iv && f.payload ? `v1:${f.iv}:${f.payload}` : f.payload) || null,
  }));

  const lanUrls = getLocalNetworkAddresses(port);
  const primaryUrl = lanUrls.length > 0 ? lanUrls[0].url : `http://localhost:${port}`;
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(primaryUrl, {
      margin: 1,
      width: 220,
      color: { dark: '#0f172a', light: '#ffffff' },
    });
  } catch {
    qrCodeDataUrl = '';
  }

  return {
    familyId,
    settings,
    categories,
    transactions,
    creditCards,
    recurringTemplates,
    fuelLogs,
    networkInfo: {
      port,
      primaryUrl,
      lanUrls,
      qrCodeDataUrl,
      dbProvider: 'Zero-Knowledge E2EE Cloud Storage',
      familyId,
    },
  };
}

export async function saveTransaction(familyId, txData) {
  const {
    id,
    type,
    amount,
    description,
    categoryId,
    date,
    notes,
    recurringId,
    dueDay,
    installmentCurrent,
    installmentTotal,
    status,
    cardId,
    invoiceMonth,
    purchaseDate,
    settledInvoiceKey,
    createdAt,
    iv,
    encrypted_data,
    payload,
    futureEntries,
  } = txData;

  const txId = id || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const cleanType = type === 'income' ? 'income' : 'expense';
  const cleanStatus = cardId ? (status === 'paid' ? 'paid' : 'unpaid') : status === 'unpaid' ? 'unpaid' : 'paid';
  const cleanDate = String(date || new Date().toISOString().slice(0, 10));
  const entryCreated = createdAt || new Date().toISOString();

  // Zero-Knowledge: when encrypted, sensitive columns are strictly NULL in database
  const isEncrypted = Boolean(encrypted_data || payload);
  const cleanAmount = isEncrypted ? null : Number(amount || 0);
  const cleanDesc = isEncrypted ? null : (description ? String(description).trim() : null);
  const cleanCatId = isEncrypted ? null : (categoryId ? String(categoryId) : null);
  const cleanNotes = isEncrypted ? null : (notes ? String(notes).trim() : '');

  const cleanIv = iv || (encrypted_data && encrypted_data.startsWith('v1:') ? encrypted_data.split(':')[1] : null);
  const cleanPayload = payload || (encrypted_data && encrypted_data.startsWith('v1:') ? encrypted_data.split(':')[2] : (encrypted_data || null));
  const cleanEncrypted = encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);

  await turso.execute({
    sql: `INSERT OR REPLACE INTO transactions
     (family_id, id, type, status, amount, description, categoryId, date, notes, recurringId, dueDay, installmentCurrent, installmentTotal, cardId, invoiceMonth, purchaseDate, settledInvoiceKey, createdAt, iv, encrypted_data, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      familyId,
      txId,
      cleanType,
      cleanStatus,
      cleanAmount,
      cleanDesc,
      cleanCatId,
      cleanDate,
      cleanNotes,
      recurringId || null,
      dueDay ? Number(dueDay) : null,
      installmentCurrent ? Number(installmentCurrent) : null,
      installmentTotal ? Number(installmentTotal) : null,
      cardId || null,
      invoiceMonth || null,
      purchaseDate || null,
      settledInvoiceKey || null,
      entryCreated,
      cleanIv,
      cleanEncrypted,
      cleanPayload,
    ],
  });

  if (Array.isArray(futureEntries) && futureEntries.length > 0) {
    for (const fTx of futureEntries) {
      if (!fTx || !fTx.date) continue;
      const fId = fTx.id || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const fEnc = Boolean(fTx.encrypted_data || fTx.payload);
      const fIv = fTx.iv || (fTx.encrypted_data && fTx.encrypted_data.startsWith('v1:') ? fTx.encrypted_data.split(':')[1] : null);
      const fPayload = fTx.payload || (fTx.encrypted_data && fTx.encrypted_data.startsWith('v1:') ? fTx.encrypted_data.split(':')[2] : (fTx.encrypted_data || null));
      const fEncData = fTx.encrypted_data || (fIv && fPayload ? `v1:${fIv}:${fPayload}` : fPayload);

      await turso.execute({
        sql: `INSERT OR REPLACE INTO transactions
         (family_id, id, type, status, amount, description, categoryId, date, notes, recurringId, dueDay, installmentCurrent, installmentTotal, cardId, invoiceMonth, purchaseDate, settledInvoiceKey, createdAt, iv, encrypted_data, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          familyId,
          fId,
          fTx.type === 'income' ? 'income' : 'expense',
          fTx.status === 'paid' ? 'paid' : 'unpaid',
          fEnc ? null : Number(fTx.amount ?? amount ?? 0),
          fEnc ? null : (fTx.description || description ? String(fTx.description || description).trim() : null),
          fEnc ? null : (fTx.categoryId || categoryId ? String(fTx.categoryId || categoryId) : null),
          String(fTx.date),
          fEnc ? null : String(fTx.notes ?? notes ?? '').trim(),
          fTx.recurringId || recurringId || null,
          fTx.dueDay ? Number(fTx.dueDay) : dueDay ? Number(dueDay) : null,
          fTx.installmentCurrent ? Number(fTx.installmentCurrent) : null,
          fTx.installmentTotal ? Number(fTx.installmentTotal) : null,
          fTx.cardId !== undefined ? fTx.cardId : cardId || null,
          fTx.invoiceMonth || null,
          fTx.purchaseDate || purchaseDate || null,
          fTx.settledInvoiceKey || null,
          new Date().toISOString(),
          fIv,
          fEncData,
          fPayload,
        ],
      });
    }
  }

  return getFullState(familyId);
}

export async function updateTransaction(familyId, id, txData) {
  const { type, date, status, iv, encrypted_data, payload } = txData;

  const res = await turso.execute({
    sql: 'SELECT * FROM transactions WHERE family_id = ? AND id = ?',
    args: [familyId, id],
  });
  const existing = res.rows[0];
  if (!existing) {
    throw new Error('Transaction not found');
  }

  const nextStatus =
    status === 'unpaid' || status === 'paid'
      ? status
      : existing.status === 'unpaid'
      ? 'unpaid'
      : 'paid';

  const isEncrypted = Boolean(encrypted_data || payload);
  if (isEncrypted) {
    const cleanIv = iv || (encrypted_data && encrypted_data.startsWith('v1:') ? encrypted_data.split(':')[1] : null);
    const cleanPayload = payload || (encrypted_data && encrypted_data.startsWith('v1:') ? encrypted_data.split(':')[2] : (encrypted_data || null));
    const cleanEncrypted = encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);

    await turso.execute({
      sql: `UPDATE transactions
       SET type = ?, status = ?, date = ?, amount = NULL, description = NULL, categoryId = NULL, notes = NULL, iv = ?, encrypted_data = ?, payload = ?
       WHERE family_id = ? AND id = ?`,
      args: [type || existing.type, nextStatus, date || existing.date, cleanIv, cleanEncrypted, cleanPayload, familyId, id],
    });
  } else {
    // Unencrypted update fallback
    await turso.execute({
      sql: `UPDATE transactions
       SET type = ?, status = ?, amount = ?, description = ?, categoryId = ?, date = ?, notes = ?
       WHERE family_id = ? AND id = ?`,
      args: [
        type || existing.type,
        nextStatus,
        Number(txData.amount ?? existing.amount),
        String(txData.description ?? existing.description),
        String(txData.categoryId ?? existing.categoryId),
        String(date ?? existing.date),
        String(txData.notes ?? existing.notes),
        familyId,
        id,
      ],
    });
  }

  if (Array.isArray(txData.updatedSeriesEntries)) {
    for (const sEntry of txData.updatedSeriesEntries) {
      if (!sEntry || !sEntry.id) continue;
      const sEnc = Boolean(sEntry.encrypted_data || sEntry.payload);
      if (sEnc) {
        const sIv = sEntry.iv || (sEntry.encrypted_data && sEntry.encrypted_data.startsWith('v1:') ? sEntry.encrypted_data.split(':')[1] : null);
        const sPayload = sEntry.payload || (sEntry.encrypted_data && sEntry.encrypted_data.startsWith('v1:') ? sEntry.encrypted_data.split(':')[2] : (sEntry.encrypted_data || null));
        const sEncrypted = sEntry.encrypted_data || (sIv && sPayload ? `v1:${sIv}:${sPayload}` : sPayload);
        await turso.execute({
          sql: `UPDATE transactions
           SET type = ?, status = ?, date = ?, amount = NULL, description = NULL, categoryId = NULL, notes = NULL, iv = ?, encrypted_data = ?, payload = ?
           WHERE family_id = ? AND id = ?`,
          args: [sEntry.type || 'expense', sEntry.status || 'unpaid', sEntry.date, sIv, sEncrypted, sPayload, familyId, sEntry.id],
        });
      } else {
        await turso.execute({
          sql: `UPDATE transactions
           SET type = ?, status = ?, amount = ?, description = ?, categoryId = ?, date = ?, notes = ?
           WHERE family_id = ? AND id = ?`,
          args: [
            sEntry.type || 'expense',
            sEntry.status || 'unpaid',
            Number(sEntry.amount || 0),
            String(sEntry.description || ''),
            String(sEntry.categoryId || ''),
            String(sEntry.date),
            String(sEntry.notes || ''),
            familyId,
            sEntry.id,
          ],
        });
      }
    }
  }

  return getFullState(familyId);
}

export async function updateTransactionStatus(familyId, id, status) {
  const res = await turso.execute({
    sql: 'SELECT * FROM transactions WHERE family_id = ? AND id = ?',
    args: [familyId, id],
  });
  const existing = res.rows[0];
  if (!existing) {
    throw new Error('Transaction not found');
  }

  const nextStatus =
    status === 'paid' || status === 'unpaid'
      ? status
      : existing.status === 'unpaid'
      ? 'paid'
      : 'unpaid';

  await turso.execute({
    sql: 'UPDATE transactions SET status = ? WHERE family_id = ? AND id = ?',
    args: [nextStatus, familyId, id],
  });

  return getFullState(familyId);
}

export async function deleteTransaction(familyId, id, _scope = 'single', deleteIds = null) {
  const ids = Array.isArray(deleteIds) && deleteIds.length > 0 ? deleteIds : [id];
  for (const targetId of ids) {
    if (!targetId) continue;
    await turso.execute({
      sql: 'DELETE FROM transactions WHERE family_id = ? AND id = ?',
      args: [familyId, targetId],
    });
  }
  return getFullState(familyId);
}

export async function saveCreditCard(familyId, cardData) {
  const { id, name, brand, lastDigits, last4Digits, color, totalLimit, closingDay, dueDay, iv, encrypted_data, payload } = cardData;
  const cardId = id || `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const isEncrypted = Boolean(encrypted_data || payload);
  const cleanIv = iv || (encrypted_data && encrypted_data.startsWith('v1:') ? encrypted_data.split(':')[1] : null);
  const cleanPayload = payload || (encrypted_data && encrypted_data.startsWith('v1:') ? encrypted_data.split(':')[2] : (encrypted_data || null));
  const cleanEncrypted = encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);

  await turso.execute({
    sql: `INSERT OR REPLACE INTO credit_cards
     (family_id, id, name, brand, last4Digits, color, totalLimit, closingDay, dueDay, createdAt, iv, encrypted_data, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      familyId,
      cardId,
      isEncrypted ? null : String(name || 'Cartão').trim(),
      isEncrypted ? 'other' : String(brand || 'other'),
      isEncrypted ? '' : String(lastDigits || last4Digits || '').slice(-4),
      isEncrypted ? '#8b5cf6' : String(color || '#8b5cf6'),
      isEncrypted ? 0 : Number(totalLimit || 0),
      isEncrypted ? 25 : Number(closingDay || 25),
      isEncrypted ? 5 : Number(dueDay || 5),
      cardData.createdAt || new Date().toISOString(),
      cleanIv,
      cleanEncrypted,
      cleanPayload,
    ],
  });
  return getFullState(familyId);
}

export async function updateCreditCard(familyId, id, cardData) {
  if (cardData.encrypted_data || cardData.payload) {
    const cleanIv = cardData.iv || (cardData.encrypted_data && cardData.encrypted_data.startsWith('v1:') ? cardData.encrypted_data.split(':')[1] : null);
    const cleanPayload = cardData.payload || (cardData.encrypted_data && cardData.encrypted_data.startsWith('v1:') ? cardData.encrypted_data.split(':')[2] : (cardData.encrypted_data || null));
    const cleanEncrypted = cardData.encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);
    await turso.execute({
      sql: 'UPDATE credit_cards SET name = NULL, iv = ?, encrypted_data = ?, payload = ? WHERE family_id = ? AND id = ?',
      args: [cleanIv, cleanEncrypted, cleanPayload, familyId, id],
    });
  } else {
    await turso.execute({
      sql: `UPDATE credit_cards
       SET name = ?, brand = ?, last4Digits = ?, color = ?, totalLimit = ?, closingDay = ?, dueDay = ?
       WHERE family_id = ? AND id = ?`,
      args: [
        String(cardData.name || '').trim(),
        String(cardData.brand || 'other'),
        String(cardData.last4Digits || '').slice(-4),
        String(cardData.color || '#8b5cf6'),
        Number(cardData.totalLimit || 0),
        Number(cardData.closingDay || 25),
        Number(cardData.dueDay || 5),
        familyId,
        id,
      ],
    });
  }
  return getFullState(familyId);
}

export async function deleteCreditCard(familyId, id) {
  await turso.execute({
    sql: 'DELETE FROM credit_cards WHERE family_id = ? AND id = ?',
    args: [familyId, id],
  });
  await turso.execute({
    sql: 'DELETE FROM transactions WHERE family_id = ? AND cardId = ?',
    args: [familyId, id],
  });
  return getFullState(familyId);
}

export async function saveCategory(familyId, catData) {
  const { id, name, type, color, icon, isDefault, iv, encrypted_data, payload } = catData;
  const catId = id || `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const isEncrypted = Boolean(encrypted_data || payload);
  const cleanIv = iv || (encrypted_data && encrypted_data.startsWith('v1:') ? encrypted_data.split(':')[1] : null);
  const cleanPayload = payload || (encrypted_data && encrypted_data.startsWith('v1:') ? encrypted_data.split(':')[2] : (encrypted_data || null));
  const cleanEncrypted = encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);

  await turso.execute({
    sql: `INSERT OR REPLACE INTO categories
     (family_id, id, name, type, color, icon, isDefault, iv, encrypted_data, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      familyId,
      catId,
      isEncrypted ? null : String(name || '').trim(),
      type === 'income' ? 'income' : 'expense',
      isEncrypted ? '#6366f1' : String(color || '#6366f1'),
      isEncrypted ? 'Tag' : String(icon || 'Tag'),
      isDefault ? 1 : 0,
      cleanIv,
      cleanEncrypted,
      cleanPayload,
    ],
  });
  return getFullState(familyId);
}

export async function updateCategory(familyId, id, catData) {
  if (catData.encrypted_data || catData.payload) {
    const cleanIv = catData.iv || (catData.encrypted_data && catData.encrypted_data.startsWith('v1:') ? catData.encrypted_data.split(':')[1] : null);
    const cleanPayload = catData.payload || (catData.encrypted_data && catData.encrypted_data.startsWith('v1:') ? catData.encrypted_data.split(':')[2] : (catData.encrypted_data || null));
    const cleanEncrypted = catData.encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);
    await turso.execute({
      sql: 'UPDATE categories SET name = NULL, type = ?, iv = ?, encrypted_data = ?, payload = ? WHERE family_id = ? AND id = ?',
      args: [catData.type === 'income' ? 'income' : 'expense', cleanIv, cleanEncrypted, cleanPayload, familyId, id],
    });
  } else {
    await turso.execute({
      sql: `UPDATE categories
       SET name = ?, type = ?, color = ?, icon = ?, isDefault = 0
       WHERE family_id = ? AND id = ?`,
      args: [
        String(catData.name || '').trim(),
        catData.type === 'income' ? 'income' : 'expense',
        String(catData.color || '#6366f1'),
        String(catData.icon || 'Tag'),
        familyId,
        id,
      ],
    });
  }
  return getFullState(familyId);
}

export async function deleteCategory(familyId, id) {
  await turso.execute({
    sql: 'DELETE FROM categories WHERE family_id = ? AND id = ?',
    args: [familyId, id],
  });
  return getFullState(familyId);
}

export async function saveRecurring(familyId, recData) {
  const { id, type, amount, description, categoryId, dayOfMonth, active, isInstallment, totalInstallments, startMonth, iv, encrypted_data, payload } = recData;
  const recId = id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const isEncrypted = Boolean(encrypted_data || payload);
  const cleanIv = iv || (encrypted_data && encrypted_data.startsWith('v1:') ? encrypted_data.split(':')[1] : null);
  const cleanPayload = payload || (encrypted_data && encrypted_data.startsWith('v1:') ? encrypted_data.split(':')[2] : (encrypted_data || null));
  const cleanEncrypted = encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);

  await turso.execute({
    sql: `INSERT OR REPLACE INTO recurring_templates
     (family_id, id, type, amount, description, categoryId, dayOfMonth, active, isInstallment, totalInstallments, startMonth, createdAt, iv, encrypted_data, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      familyId,
      recId,
      type === 'income' ? 'income' : 'expense',
      isEncrypted ? null : Number(amount || 0),
      isEncrypted ? null : String(description || '').trim(),
      isEncrypted ? null : String(categoryId || ''),
      Number(dayOfMonth || 1),
      active === false ? 0 : 1,
      isInstallment ? 1 : 0,
      totalInstallments ? Number(totalInstallments) : null,
      startMonth || null,
      new Date().toISOString(),
      cleanIv,
      cleanEncrypted,
      cleanPayload,
    ],
  });
  return getFullState(familyId);
}

export async function updateRecurring(familyId, id, recData) {
  if (recData.encrypted_data || recData.payload) {
    const cleanIv = recData.iv || (recData.encrypted_data && recData.encrypted_data.startsWith('v1:') ? recData.encrypted_data.split(':')[1] : null);
    const cleanPayload = recData.payload || (recData.encrypted_data && recData.encrypted_data.startsWith('v1:') ? recData.encrypted_data.split(':')[2] : (recData.encrypted_data || null));
    const cleanEncrypted = recData.encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);
    await turso.execute({
      sql: 'UPDATE recurring_templates SET type = ?, active = ?, amount = NULL, description = NULL, categoryId = NULL, iv = ?, encrypted_data = ?, payload = ? WHERE family_id = ? AND id = ?',
      args: [recData.type || 'expense', recData.active ? 1 : 0, cleanIv, cleanEncrypted, cleanPayload, familyId, id],
    });
  } else {
    await turso.execute({
      sql: `UPDATE recurring_templates
       SET type = ?, amount = ?, description = ?, categoryId = ?, dayOfMonth = ?, active = ?
       WHERE family_id = ? AND id = ?`,
      args: [
        recData.type || 'expense',
        Number(recData.amount || 0),
        String(recData.description || '').trim(),
        String(recData.categoryId || ''),
        Number(recData.dayOfMonth || 1),
        recData.active ? 1 : 0,
        familyId,
        id,
      ],
    });
  }
  return getFullState(familyId);
}

export async function deleteRecurring(familyId, id) {
  await turso.execute({
    sql: 'DELETE FROM recurring_templates WHERE family_id = ? AND id = ?',
    args: [familyId, id],
  });
  return getFullState(familyId);
}

export async function saveFuelLog(familyId, fuelData) {
  const {
    id,
    date,
    odometer,
    pricePerLiter,
    totalCost,
    liters,
    fuelType,
    stationName,
    isFullTank,
    notes,
    createdAt,
    transactionId,
    transaction,
    iv,
    encrypted_data,
    payload,
  } = fuelData;

  const fuelId = id || `fuel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const cleanDate = String(date || new Date().toISOString().slice(0, 10));
  const entryCreated = createdAt || new Date().toISOString();
  const txId = transactionId || (transaction && transaction.id) || `tx-fuel-${fuelId}`;

  const isEncrypted = Boolean(encrypted_data || payload);
  const cleanIv = iv || (encrypted_data && encrypted_data.startsWith('v1:') ? encrypted_data.split(':')[1] : null);
  const cleanPayload = payload || (encrypted_data && encrypted_data.startsWith('v1:') ? encrypted_data.split(':')[2] : (encrypted_data || null));
  const cleanEncrypted = encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);

  await turso.execute({
    sql: `INSERT OR REPLACE INTO fuel_logs
     (family_id, id, date, odometer, pricePerLiter, totalCost, liters, fuelType, stationName, isFullTank, transactionId, notes, createdAt, iv, encrypted_data, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      familyId,
      fuelId,
      cleanDate,
      isEncrypted ? null : Number(odometer || 0),
      isEncrypted ? null : Number(pricePerLiter || 0),
      isEncrypted ? null : Number(totalCost || 0),
      isEncrypted ? null : Number(liters || 0),
      isEncrypted ? 'gasoline' : (fuelType || 'gasoline'),
      isEncrypted ? null : String(stationName || ''),
      isFullTank === false ? 0 : 1,
      txId,
      isEncrypted ? null : String(notes || ''),
      entryCreated,
      cleanIv,
      cleanEncrypted,
      cleanPayload,
    ],
  });

  // Dual save: simultaneously insert or update the linked expense transaction
  if (transaction) {
    await saveTransaction(familyId, {
      ...transaction,
      id: txId,
    });
  } else if (!isEncrypted) {
    const fuelLabel = fuelType === 'ethanol' ? 'Etanol' : 'Gasolina';
    const txDesc = `Abastecimento (${fuelLabel})${stationName ? ` - ${stationName}` : ''}${liters ? ` [${Number(liters).toFixed(2)}L]` : ''}`;
    await saveTransaction(familyId, {
      id: txId,
      type: 'expense',
      status: 'paid',
      amount: Number(totalCost || 0),
      description: txDesc,
      categoryId: 'exp-transport',
      date: cleanDate,
      notes: `${odometer || 0} km • ${pricePerLiter || 0}/L`,
      createdAt: entryCreated,
    });
  }

  return getFullState(familyId);
}

export async function updateFuelLog(familyId, id, fuelData) {
  const isEncrypted = Boolean(fuelData.encrypted_data || fuelData.payload);
  if (isEncrypted) {
    const cleanIv = fuelData.iv || (fuelData.encrypted_data && fuelData.encrypted_data.startsWith('v1:') ? fuelData.encrypted_data.split(':')[1] : null);
    const cleanPayload = fuelData.payload || (fuelData.encrypted_data && fuelData.encrypted_data.startsWith('v1:') ? fuelData.encrypted_data.split(':')[2] : (fuelData.encrypted_data || null));
    const cleanEncrypted = fuelData.encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);
    await turso.execute({
      sql: 'UPDATE fuel_logs SET date = ?, odometer = NULL, pricePerLiter = NULL, totalCost = NULL, liters = NULL, stationName = NULL, notes = NULL, iv = ?, encrypted_data = ?, payload = ? WHERE family_id = ? AND id = ?',
      args: [String(fuelData.date), cleanIv, cleanEncrypted, cleanPayload, familyId, id],
    });
  } else {
    await turso.execute({
      sql: `UPDATE fuel_logs
       SET date = ?, odometer = ?, pricePerLiter = ?, totalCost = ?, liters = ?, fuelType = ?, stationName = ?, isFullTank = ?, notes = ?
       WHERE family_id = ? AND id = ?`,
      args: [
        String(fuelData.date),
        Number(fuelData.odometer || 0),
        Number(fuelData.pricePerLiter || 0),
        Number(fuelData.totalCost || 0),
        Number(fuelData.liters || 0),
        fuelData.fuelType || 'gasoline',
        String(fuelData.stationName || ''),
        fuelData.isFullTank === false ? 0 : 1,
        String(fuelData.notes || ''),
        familyId,
        id,
      ],
    });
  }

  if (fuelData.transaction) {
    const txId = fuelData.transactionId || fuelData.transaction.id || `tx-fuel-${id}`;
    await saveTransaction(familyId, {
      ...fuelData.transaction,
      id: txId,
    });
  }

  return getFullState(familyId);
}

export async function deleteFuelLog(familyId, id) {
  // Query transactionId before deletion
  const res = await turso.execute({
    sql: 'SELECT transactionId FROM fuel_logs WHERE family_id = ? AND id = ?',
    args: [familyId, id],
  });
  const txId = res.rows[0]?.transactionId || `tx-fuel-${id}`;

  await turso.execute({
    sql: 'DELETE FROM fuel_logs WHERE family_id = ? AND id = ?',
    args: [familyId, id],
  });

  // Delete associated transaction
  await turso.execute({
    sql: 'DELETE FROM transactions WHERE family_id = ? AND (id = ? OR id = ?)',
    args: [familyId, txId, `tx-fuel-${id}`],
  });

  return getFullState(familyId);
}

export async function syncPendingTransactions(familyId, pendingTransactions) {
  for (const tx of pendingTransactions) {
    if (!tx || !tx.id) continue;
    await saveTransaction(familyId, tx);
  }
  return getFullState(familyId);
}

export async function resetData(familyId) {
  await turso.execute({ sql: 'DELETE FROM transactions WHERE family_id = ?', args: [familyId] });
  await turso.execute({ sql: 'DELETE FROM recurring_templates WHERE family_id = ?', args: [familyId] });
  await turso.execute({ sql: 'DELETE FROM fuel_logs WHERE family_id = ?', args: [familyId] });
  await turso.execute({ sql: 'DELETE FROM credit_cards WHERE family_id = ?', args: [familyId] });
  await turso.execute({ sql: 'DELETE FROM categories WHERE family_id = ?', args: [familyId] });
  await turso.execute({ sql: 'DELETE FROM settings WHERE family_id = ?', args: [familyId] });

  // Re-seed defaults
  for (const c of DEFAULT_CATEGORIES) {
    await turso.execute({
      sql: 'INSERT INTO categories (family_id, id, name, type, color, icon, isDefault) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [familyId, c.id, c.name, c.type, c.color, c.icon, c.isDefault],
    });
  }
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    await turso.execute({
      sql: 'INSERT INTO settings (family_id, key, value) VALUES (?, ?, ?)',
      args: [familyId, k, String(v)],
    });
  }
  return getFullState(familyId);
}

export async function importData(familyId, data) {
  if (data.mode === 'replace') {
    await turso.execute({ sql: 'DELETE FROM transactions WHERE family_id = ?', args: [familyId] });
    await turso.execute({ sql: 'DELETE FROM recurring_templates WHERE family_id = ?', args: [familyId] });
    await turso.execute({ sql: 'DELETE FROM fuel_logs WHERE family_id = ?', args: [familyId] });
    await turso.execute({ sql: 'DELETE FROM credit_cards WHERE family_id = ?', args: [familyId] });
    await turso.execute({ sql: 'DELETE FROM categories WHERE family_id = ?', args: [familyId] });
  }

  if (data.settings && typeof data.settings === 'object') {
    for (const [k, v] of Object.entries(data.settings)) {
      if (v === undefined) continue;
      await turso.execute({
        sql: 'INSERT OR REPLACE INTO settings (family_id, key, value) VALUES (?, ?, ?)',
        args: [familyId, k, String(v)],
      });
    }
  }

  if (Array.isArray(data.categories)) {
    for (const c of data.categories) {
      if (!c.id) continue;
      await saveCategory(familyId, c);
    }
  }

  if (Array.isArray(data.creditCards)) {
    for (const c of data.creditCards) {
      if (!c.id) continue;
      await saveCreditCard(familyId, c);
    }
  }

  if (Array.isArray(data.recurringTemplates)) {
    for (const r of data.recurringTemplates) {
      if (!r.id) continue;
      await saveRecurring(familyId, r);
    }
  }

  if (Array.isArray(data.fuelLogs)) {
    for (const f of data.fuelLogs) {
      if (!f.id) continue;
      await saveFuelLog(familyId, f);
    }
  }

  if (Array.isArray(data.transactions)) {
    for (const t of data.transactions) {
      if (!t.id) continue;
      await saveTransaction(familyId, t);
    }
  }

  return getFullState(familyId);
}
