import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'familyplan.db');
const PORT = Number(process.env.PORT || 3456);
const isDev = process.argv.includes('--dev');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for fast concurrent access from Windows + Mobile
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    color TEXT NOT NULL,
    icon TEXT NOT NULL,
    isDefault INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    categoryId TEXT NOT NULL,
    date TEXT NOT NULL,
    notes TEXT DEFAULT '',
    recurringId TEXT DEFAULT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS recurring_templates (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    categoryId TEXT NOT NULL,
    dayOfMonth INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fuel_logs (
    id TEXT PRIMARY KEY,
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
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS credit_cards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT 'other',
    last4Digits TEXT DEFAULT '',
    color TEXT NOT NULL DEFAULT '#8b5cf6',
    totalLimit REAL NOT NULL DEFAULT 5000,
    closingDay INTEGER NOT NULL DEFAULT 25,
    dueDay INTEGER NOT NULL DEFAULT 5,
    createdAt TEXT NOT NULL
  );
`);

function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn('transactions', 'dueDay', 'INTEGER DEFAULT NULL');
ensureColumn('transactions', 'installmentCurrent', 'INTEGER DEFAULT NULL');
ensureColumn('transactions', 'installmentTotal', 'INTEGER DEFAULT NULL');
ensureColumn('transactions', 'status', "TEXT NOT NULL DEFAULT 'paid'");
ensureColumn('transactions', 'cardId', 'TEXT DEFAULT NULL');
ensureColumn('transactions', 'invoiceMonth', 'TEXT DEFAULT NULL');
ensureColumn('transactions', 'purchaseDate', 'TEXT DEFAULT NULL');
ensureColumn('transactions', 'settledInvoiceKey', 'TEXT DEFAULT NULL');

ensureColumn('recurring_templates', 'isInstallment', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('recurring_templates', 'totalInstallments', 'INTEGER DEFAULT NULL');
ensureColumn('recurring_templates', 'startMonth', 'TEXT DEFAULT NULL');

const DEFAULT_CATEGORIES = [
  // Income / Inputs
  { id: 'inc-deposit', name: 'Bank Input / Deposit', type: 'income', color: '#10b981', icon: 'Landmark', isDefault: 1 },
  { id: 'inc-salary', name: 'Salary / Paycheck', type: 'income', color: '#059669', icon: 'Briefcase', isDefault: 1 },
  { id: 'inc-freelance', name: 'Extra Income / Bonus', type: 'income', color: '#14b8a6', icon: 'Sparkles', isDefault: 1 },
  { id: 'inc-refund', name: 'Refund / Cashback', type: 'income', color: '#06b6d4', icon: 'RotateCcw', isDefault: 1 },
  { id: 'inc-other', name: 'Other Input', type: 'income', color: '#3b82f6', icon: 'PlusCircle', isDefault: 1 },
  // Expenses
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

const DEFAULT_SETTINGS = {
  familyName: 'Family Finance',
  currency: 'BRL',
  language: 'pt-BR',
  theme: 'tokyo-night',
  initialBalance: '0',
  tankCapacity: '50',
  updatedAt: new Date().toISOString(),
};

function seedDefaults() {
  const seededFlag = db.prepare("SELECT value FROM settings WHERE key = 'categoriesSeeded'").get();
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get();

  if (!seededFlag && (!catCount || catCount.count === 0)) {
    const insertCat = db.prepare(
      'INSERT OR IGNORE INTO categories (id, name, type, color, icon, isDefault) VALUES (?, ?, ?, ?, ?, ?)'
    );
    for (const c of DEFAULT_CATEGORIES) {
      insertCat.run(c.id, c.name, c.type, c.color, c.icon, c.isDefault);
    }
  }

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) {
    insertSetting.run(k, String(v));
  }
  insertSetting.run('categoriesSeeded', '1');
}

seedDefaults();

function getSettingsObject() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const map = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return {
    familyName: map.familyName || 'Family Finance',
    currency: map.currency || 'USD',
    language: map.language || 'en',
    theme: map.theme || 'light',
    initialBalance: Number(map.initialBalance || 0),
    tankCapacity: Number(map.tankCapacity || 50),
    updatedAt: map.updatedAt || new Date().toISOString(),
  };
}

function setSetting(key, value) {
  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  upsert.run(key, String(value));
  upsert.run('updatedAt', new Date().toISOString());
}

function getLocalNetworkAddresses() {
  const interfaces = os.networkInterfaces();
  const urls = [];
  for (const [name, netList] of Object.entries(interfaces)) {
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        urls.push({
          name,
          ip: net.address,
          url: `http://${net.address}:${PORT}`,
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

async function getFullState() {
  const settings = getSettingsObject();
  const categories = db.prepare('SELECT * FROM categories ORDER BY type ASC, name ASC').all();
  const transactions = db
    .prepare('SELECT * FROM transactions ORDER BY date DESC, createdAt DESC')
    .all()
    .map((t) => ({
      ...t,
      status: t.status === 'unpaid' ? 'unpaid' : 'paid',
      amount: Number(t.amount),
      dueDay: t.dueDay ? Number(t.dueDay) : null,
      installmentCurrent: t.installmentCurrent ? Number(t.installmentCurrent) : null,
      installmentTotal: t.installmentTotal ? Number(t.installmentTotal) : null,
      cardId: t.cardId || null,
      invoiceMonth: t.invoiceMonth || null,
      purchaseDate: t.purchaseDate || null,
      settledInvoiceKey: t.settledInvoiceKey || null,
    }));
  const creditCards = db
    .prepare('SELECT * FROM credit_cards ORDER BY createdAt ASC, name ASC')
    .all()
    .map((c) => ({
      ...c,
      lastDigits: c.last4Digits || c.lastDigits || '',
      totalLimit: Number(c.totalLimit),
      closingDay: Number(c.closingDay),
      dueDay: Number(c.dueDay),
    }));
  const recurringTemplates = db
    .prepare('SELECT * FROM recurring_templates ORDER BY dayOfMonth ASC, description ASC')
    .all()
    .map((r) => ({
      ...r,
      amount: Number(r.amount),
      active: Boolean(r.active),
      isInstallment: Boolean(r.isInstallment),
      totalInstallments: r.totalInstallments ? Number(r.totalInstallments) : null,
      startMonth: r.startMonth || null,
    }));
  const fuelLogs = db
    .prepare('SELECT * FROM fuel_logs ORDER BY odometer DESC, date DESC, createdAt DESC')
    .all()
    .map((f) => ({
      ...f,
      odometer: Number(f.odometer),
      pricePerLiter: Number(f.pricePerLiter),
      totalCost: Number(f.totalCost),
      liters: Number(f.liters),
      isFullTank: Boolean(f.isFullTank),
    }));

  const lanUrls = getLocalNetworkAddresses();
  const primaryUrl = lanUrls.length > 0 ? lanUrls[0].url : `http://localhost:${PORT}`;
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
    settings,
    categories,
    transactions,
    creditCards,
    recurringTemplates,
    fuelLogs,
    networkInfo: {
      port: PORT,
      primaryUrl,
      lanUrls,
      qrCodeDataUrl,
      dbPath: DB_PATH,
    },
  };
}

const app = express();
app.use(express.json({ limit: '10mb' }));

// GET full application state
app.get('/api/state', async (_req, res) => {
  try {
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT settings (and optional direct current bank balance adjustment)
app.put('/api/settings', async (req, res) => {
  try {
    const { familyName, currency, language, theme, initialBalance, tankCapacity, targetCurrentBalance } = req.body;

    if (typeof familyName === 'string' && familyName.trim()) {
      setSetting('familyName', familyName.trim());
    }
    if (typeof currency === 'string' && currency.trim()) {
      setSetting('currency', currency.trim());
    }
    if (typeof language === 'string' && (language === 'en' || language === 'pt-BR')) {
      setSetting('language', language);
    }
    if (typeof theme === 'string' && ['light', 'dark', 'tokyo-night', 'oled'].includes(theme)) {
      setSetting('theme', theme);
    }
    if (typeof initialBalance === 'number' && !Number.isNaN(initialBalance)) {
      setSetting('initialBalance', initialBalance.toFixed(2));
    }
    if (typeof tankCapacity === 'number' && !Number.isNaN(tankCapacity) && tankCapacity > 0) {
      setSetting('tankCapacity', tankCapacity.toFixed(1));
    }

    if (typeof targetCurrentBalance === 'number' && !Number.isNaN(targetCurrentBalance)) {
      const totals = db
        .prepare(
          `SELECT 
            COALESCE(SUM(CASE WHEN type = 'income' AND COALESCE(status, 'paid') = 'paid' AND cardId IS NULL THEN amount ELSE 0 END), 0) as totalIncome,
            COALESCE(SUM(CASE WHEN type = 'expense' AND COALESCE(status, 'paid') = 'paid' AND cardId IS NULL THEN amount ELSE 0 END), 0) as totalExpense
           FROM transactions`
        )
        .get();
      const computedInitial =
        targetCurrentBalance - Number(totals.totalIncome || 0) + Number(totals.totalExpense || 0);
      setSetting('initialBalance', computedInitial.toFixed(2));
    }

    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST create transaction (supports optional futureEntries for recurring / installment schedules & credit cards)
app.post('/api/transactions', async (req, res) => {
  try {
    const {
      id,
      type,
      status,
      amount,
      description,
      categoryId,
      date,
      notes,
      recurringId,
      dueDay,
      installmentCurrent,
      installmentTotal,
      cardId,
      invoiceMonth,
      purchaseDate,
      settledInvoiceKey,
      createdAt,
      futureEntries,
    } = req.body;
    const txId = id || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const txDate = date || new Date().toISOString().slice(0, 10);
    const txCreated = createdAt || new Date().toISOString();
    const txStatus = cardId ? (status === 'paid' ? 'paid' : 'unpaid') : status === 'unpaid' ? 'unpaid' : 'paid';

    const insertStmt = db.prepare(
      `INSERT OR REPLACE INTO transactions
       (id, type, status, amount, description, categoryId, date, notes, recurringId, dueDay, installmentCurrent, installmentTotal, cardId, invoiceMonth, purchaseDate, settledInvoiceKey, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    insertStmt.run(
      txId,
      type === 'income' ? 'income' : 'expense',
      txStatus,
      Number(amount),
      String(description || '').trim(),
      String(categoryId),
      txDate,
      String(notes || '').trim(),
      recurringId || null,
      dueDay ? Number(dueDay) : null,
      installmentCurrent ? Number(installmentCurrent) : null,
      installmentTotal ? Number(installmentTotal) : null,
      cardId || null,
      invoiceMonth || null,
      purchaseDate || null,
      settledInvoiceKey || null,
      txCreated
    );

    if (Array.isArray(futureEntries)) {
      for (const fTx of futureEntries) {
        if (!fTx || !fTx.date) continue;
        const fId = fTx.id || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        insertStmt.run(
          fId,
          fTx.type === 'income' ? 'income' : 'expense',
          fTx.status === 'paid' ? 'paid' : 'unpaid',
          Number(fTx.amount ?? amount),
          String(fTx.description || description || '').trim(),
          String(fTx.categoryId || categoryId),
          String(fTx.date),
          String(fTx.notes ?? notes ?? '').trim(),
          fTx.recurringId || recurringId || null,
          fTx.dueDay ? Number(fTx.dueDay) : dueDay ? Number(dueDay) : null,
          fTx.installmentCurrent ? Number(fTx.installmentCurrent) : null,
          fTx.installmentTotal ? Number(fTx.installmentTotal) : null,
          fTx.cardId !== undefined ? fTx.cardId : cardId || null,
          fTx.invoiceMonth || null,
          fTx.purchaseDate || purchaseDate || null,
          fTx.settledInvoiceKey || null,
          new Date().toISOString()
        );
      }
    }

    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT update transaction (supports scope: 'single' | 'future' for series cascade)
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      type,
      status,
      amount,
      description,
      categoryId,
      date,
      notes,
      dueDay,
      installmentCurrent,
      installmentTotal,
      cardId,
      invoiceMonth,
      purchaseDate,
      scope = 'single',
    } = req.body;
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    const nextStatus =
      status === 'unpaid' || status === 'paid'
        ? status
        : existing?.status === 'unpaid'
        ? 'unpaid'
        : 'paid';

    const cleanType = type === 'income' ? 'income' : 'expense';
    const cleanAmount = Number(amount);
    const cleanDesc = String(description || '').trim();
    const cleanCatId = String(categoryId);
    const cleanDate = String(date);
    const cleanNotes = String(notes || '').trim();
    const cleanDueDay = dueDay ? Number(dueDay) : null;
    const cleanInstCur = installmentCurrent ? Number(installmentCurrent) : null;
    const cleanInstTot = installmentTotal ? Number(installmentTotal) : null;
    const cleanCardId = cardId !== undefined ? cardId || null : existing?.cardId || null;
    const cleanInvoiceMonth =
      invoiceMonth !== undefined ? invoiceMonth || null : existing?.invoiceMonth || null;
    const cleanPurchaseDate =
      purchaseDate !== undefined ? purchaseDate || null : existing?.purchaseDate || null;

    db.prepare(
      `UPDATE transactions
       SET type = ?, status = ?, amount = ?, description = ?, categoryId = ?, date = ?, notes = ?, dueDay = ?, installmentCurrent = ?, installmentTotal = ?, cardId = ?, invoiceMonth = ?, purchaseDate = ?
       WHERE id = ?`
    ).run(
      cleanType,
      nextStatus,
      cleanAmount,
      cleanDesc,
      cleanCatId,
      cleanDate,
      cleanNotes,
      cleanDueDay,
      cleanInstCur,
      cleanInstTot,
      cleanCardId,
      cleanInvoiceMonth,
      cleanPurchaseDate,
      id
    );

    if (scope === 'future' && existing) {
      let candidates = [];
      if (existing.recurringId) {
        candidates = db
          .prepare('SELECT * FROM transactions WHERE recurringId = ? AND id != ?')
          .all(existing.recurringId, id);
      } else if (existing.installmentTotal && existing.installmentTotal > 1) {
        candidates = db
          .prepare(
            `SELECT * FROM transactions
             WHERE recurringId IS NULL
               AND LOWER(TRIM(description)) = LOWER(TRIM(?))
               AND categoryId = ?
               AND installmentTotal = ?
               AND id != ?`
          )
          .all(existing.description, existing.categoryId, existing.installmentTotal, id);
      }

      const updateFutureStmt = db.prepare(
        `UPDATE transactions
         SET type = ?, amount = ?, description = ?, categoryId = ?, date = ?, notes = ?, dueDay = ?, installmentTotal = ?, cardId = ?
         WHERE id = ?`
      );

      for (const row of candidates) {
        const isRowUnpaid = (row.status || 'paid') === 'unpaid';
        if (!isRowUnpaid) continue;

        const isSubsequent =
          existing.installmentTotal > 1 && existing.installmentCurrent && row.installmentCurrent
            ? row.installmentCurrent > existing.installmentCurrent ||
              (row.installmentCurrent === existing.installmentCurrent && row.date >= existing.date)
            : row.date >= existing.date;

        if (!isSubsequent) continue;

        let nextRowDate = row.date;
        if (cleanDueDay && row.date && row.date.length >= 7) {
          const monthPrefix = row.date.slice(0, 7);
          const [ry, rm] = monthPrefix.split('-').map(Number);
          const maxDay = new Date(ry, rm, 0).getDate() || 28;
          const clampedDay = Math.min(cleanDueDay, maxDay);
          nextRowDate = `${monthPrefix}-${String(clampedDay).padStart(2, '0')}`;
        }

        updateFutureStmt.run(
          cleanType,
          cleanAmount,
          cleanDesc,
          cleanCatId,
          nextRowDate,
          cleanNotes,
          cleanDueDay ?? row.dueDay ?? null,
          cleanInstTot ?? row.installmentTotal ?? null,
          cleanCardId,
          row.id
        );
      }

      if (existing.recurringId) {
        db.prepare(
          `UPDATE recurring_templates
           SET type = ?, amount = ?, description = ?, categoryId = ?, dayOfMonth = COALESCE(?, dayOfMonth), totalInstallments = COALESCE(?, totalInstallments)
           WHERE id = ?`
        ).run(
          cleanType,
          cleanAmount,
          cleanDesc,
          cleanCatId,
          cleanDueDay,
          cleanInstTot,
          existing.recurringId
        );
      }
    }

    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PATCH toggle or set transaction payment status ('paid' | 'unpaid')
app.patch('/api/transactions/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    const nextStatus =
      status === 'paid' || status === 'unpaid'
        ? status
        : existing.status === 'unpaid'
        ? 'paid'
        : 'unpaid';

    db.prepare('UPDATE transactions SET status = ? WHERE id = ?').run(nextStatus, id);

    // If this transaction is a settled credit card invoice bill, sync status on all card purchases in that invoice cycle
    if (existing.settledInvoiceKey && existing.settledInvoiceKey.includes('__')) {
      const [cId, invMonth] = existing.settledInvoiceKey.split('__');
      if (cId && invMonth) {
        db.prepare(
          'UPDATE transactions SET status = ? WHERE cardId = ? AND invoiceMonth = ?'
        ).run(nextStatus, cId, invMonth);
      }
    }

    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE transaction (supports ?scope=single | future)
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const scope = req.query.scope || req.body?.scope || 'single';
    const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);

    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);

    if (scope === 'future' && existing) {
      let candidates = [];
      if (existing.recurringId) {
        candidates = db
          .prepare('SELECT * FROM transactions WHERE recurringId = ? AND id != ?')
          .all(existing.recurringId, id);
      } else if (existing.installmentTotal && existing.installmentTotal > 1) {
        candidates = db
          .prepare(
            `SELECT * FROM transactions
             WHERE recurringId IS NULL
               AND LOWER(TRIM(description)) = LOWER(TRIM(?))
               AND categoryId = ?
               AND installmentTotal = ?
               AND id != ?`
          )
          .all(existing.description, existing.categoryId, existing.installmentTotal, id);
      }

      const deleteStmt = db.prepare('DELETE FROM transactions WHERE id = ?');
      for (const row of candidates) {
        const isRowUnpaid = (row.status || 'paid') === 'unpaid';
        if (!isRowUnpaid) continue;

        const isSubsequent =
          existing.installmentTotal > 1 && existing.installmentCurrent && row.installmentCurrent
            ? row.installmentCurrent >= existing.installmentCurrent || row.date >= existing.date
            : row.date >= existing.date;

        if (isSubsequent) {
          deleteStmt.run(row.id);
        }
      }

      if (existing.recurringId) {
        db.prepare('UPDATE recurring_templates SET active = 0 WHERE id = ?').run(
          existing.recurringId
        );
      }
    }

    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// =========================================================
// CREDIT CARDS CRUD & INVOICE SETTLEMENT ENDPOINTS
// =========================================================
function resolveCreditBillCategoryId() {
  const billCat = db
    .prepare(
      "SELECT id FROM categories WHERE type = 'expense' AND (LOWER(name) LIKE '%fatura%' OR LOWER(name) LIKE '%cart%' OR id = 'exp-utilities') LIMIT 1"
    )
    .get();
  if (billCat) return billCat.id;
  const anyExp = db.prepare("SELECT id FROM categories WHERE type = 'expense' LIMIT 1").get();
  return anyExp ? anyExp.id : 'exp-utilities';
}

app.post('/api/cards', async (req, res) => {
  try {
    const { id, name, brand, lastDigits, last4Digits, color, totalLimit, closingDay, dueDay } = req.body;
    const cardId = id || `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const digits = String(lastDigits || last4Digits || '').replace(/\D/g, '').slice(-4);
    db.prepare(
      `INSERT OR REPLACE INTO credit_cards
       (id, name, brand, last4Digits, color, totalLimit, closingDay, dueDay, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      cardId,
      String(name || 'Cartão de Crédito').trim(),
      String(brand || 'other'),
      digits,
      String(color || '#8b5cf6'),
      Math.max(0, Number(totalLimit) || 0),
      Math.min(31, Math.max(1, Number(closingDay) || 25)),
      Math.min(31, Math.max(1, Number(dueDay) || 5)),
      new Date().toISOString()
    );
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.put('/api/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, brand, lastDigits, last4Digits, color, totalLimit, closingDay, dueDay } = req.body;
    const digits = String(lastDigits || last4Digits || '').replace(/\D/g, '').slice(-4);
    db.prepare(
      `UPDATE credit_cards
       SET name = ?, brand = ?, last4Digits = ?, color = ?, totalLimit = ?, closingDay = ?, dueDay = ?
       WHERE id = ?`
    ).run(
      String(name || 'Cartão de Crédito').trim(),
      String(brand || 'other'),
      digits,
      String(color || '#8b5cf6'),
      Math.max(0, Number(totalLimit) || 0),
      Math.min(31, Math.max(1, Number(closingDay) || 25)),
      Math.min(31, Math.max(1, Number(dueDay) || 5)),
      id
    );
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.delete('/api/cards/:id', async (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM credit_cards WHERE id = ?').run(id);
    db.prepare('DELETE FROM transactions WHERE cardId = ?').run(id);
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST generate or settle a card's monthly invoice on the main bank statement ('Pagar Fatura')
app.post('/api/cards/:id/pay-invoice', async (req, res) => {
  try {
    const { id } = req.params;
    const { invoiceMonth, markAsPaid = false } = req.body || {};
    const card = db.prepare('SELECT * FROM credit_cards WHERE id = ?').get(id);
    if (!card) {
      return res.status(404).json({ error: 'Credit card not found' });
    }
    const targetMonth = invoiceMonth || new Date().toISOString().slice(0, 7);
    const cardPurchases = db
      .prepare(
        `SELECT * FROM transactions
         WHERE cardId = ?
           AND COALESCE(invoiceMonth, substr(date, 1, 7)) = ?
           AND type = 'expense'`
      )
      .all(id, targetMonth);

    const invoiceTotal = cardPurchases.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
    if (invoiceTotal <= 0) {
      return res.status(400).json({ error: 'No expenses in this invoice cycle' });
    }

    const settledKey = `${id}__${targetMonth}`;
    const existingSettlement = db
      .prepare('SELECT * FROM transactions WHERE settledInvoiceKey = ?')
      .get(settledKey);

    const dueDateStr = buildMonthDate(targetMonth, card.dueDay);
    const categoryId = resolveCreditBillCategoryId();
    const settings = getSettingsObject();
    const isPt = settings.language === 'pt-BR';
    const desc = isPt
      ? `Fatura Cartão ${card.name}`
      : `Credit Card Bill - ${card.name}`;
    const notes = isPt
      ? `Fatura ${targetMonth} (${cardPurchases.length} lançamentos)`
      : `Statement ${targetMonth} (${cardPurchases.length} items)`;
    const targetStatus = markAsPaid ? 'paid' : 'unpaid';

    if (existingSettlement) {
      db.prepare(
        `UPDATE transactions
         SET amount = ?, description = ?, date = ?, dueDay = ?, status = ?, notes = ?
         WHERE id = ?`
      ).run(
        Number(invoiceTotal.toFixed(2)),
        desc,
        dueDateStr,
        Number(card.dueDay),
        targetStatus,
        notes,
        existingSettlement.id
      );
    } else {
      const settlementId = `tx-inv-${id}-${targetMonth}`;
      db.prepare(
        `INSERT OR REPLACE INTO transactions
         (id, type, status, amount, description, categoryId, date, notes, recurringId, dueDay, installmentCurrent, installmentTotal, cardId, invoiceMonth, purchaseDate, settledInvoiceKey, createdAt)
         VALUES (?, 'expense', ?, ?, ?, ?, ?, ?, NULL, ?, NULL, NULL, NULL, NULL, NULL, ?, ?)`
      ).run(
        settlementId,
        targetStatus,
        Number(invoiceTotal.toFixed(2)),
        desc,
        categoryId,
        dueDateStr,
        notes,
        Number(card.dueDay),
        settledKey,
        new Date().toISOString()
      );
    }

    // Sync underlying card purchases status with the invoice settlement status
    db.prepare(
      `UPDATE transactions
       SET status = ?
       WHERE cardId = ? AND COALESCE(invoiceMonth, substr(date, 1, 7)) = ?`
    ).run(targetStatus, id, targetMonth);

    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST create category
app.post('/api/categories', async (req, res) => {
  try {
    const { id, name, type, color, icon } = req.body;
    const catId = id || `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    db.prepare(
      'INSERT OR REPLACE INTO categories (id, name, type, color, icon, isDefault) VALUES (?, ?, ?, ?, ?, 0)'
    ).run(
      catId,
      String(name || '').trim(),
      type === 'income' ? 'income' : 'expense',
      String(color || '#6366f1'),
      String(icon || 'Tag')
    );
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT update any category (including built-in ones)
app.put('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, color, icon } = req.body;
    db.prepare(
      `UPDATE categories
       SET name = ?, type = ?, color = ?, icon = ?, isDefault = 0
       WHERE id = ?`
    ).run(
      String(name || '').trim(),
      type === 'income' ? 'income' : 'expense',
      String(color || '#6366f1'),
      String(icon || 'Tag'),
      id
    );
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE any category (both default and custom categories can be deleted)
app.delete('/api/categories/:id', async (req, res) => {
  try {
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST create recurring template (supports both fixed monthly and installment plans)
app.post('/api/recurring', async (req, res) => {
  try {
    const {
      id,
      type,
      amount,
      description,
      categoryId,
      dayOfMonth,
      active,
      isInstallment,
      totalInstallments,
      startMonth,
    } = req.body;
    const recId = id || `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    db.prepare(
      `INSERT OR REPLACE INTO recurring_templates
       (id, type, amount, description, categoryId, dayOfMonth, active, isInstallment, totalInstallments, startMonth, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      recId,
      type === 'income' ? 'income' : 'expense',
      Number(amount),
      String(description || '').trim(),
      String(categoryId),
      Math.min(31, Math.max(1, Number(dayOfMonth || 1))),
      active === false ? 0 : 1,
      isInstallment ? 1 : 0,
      isInstallment && totalInstallments ? Number(totalInstallments) : null,
      isInstallment && startMonth ? String(startMonth) : null,
      new Date().toISOString()
    );
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT update recurring template
app.put('/api/recurring/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, description, categoryId, dayOfMonth, active, isInstallment, totalInstallments, startMonth } =
      req.body;
    db.prepare(
      `UPDATE recurring_templates
       SET type = ?, amount = ?, description = ?, categoryId = ?, dayOfMonth = ?, active = ?, isInstallment = ?, totalInstallments = ?, startMonth = ?
       WHERE id = ?`
    ).run(
      type === 'income' ? 'income' : 'expense',
      Number(amount),
      String(description || '').trim(),
      String(categoryId),
      Math.min(31, Math.max(1, Number(dayOfMonth || 1))),
      active ? 1 : 0,
      isInstallment ? 1 : 0,
      isInstallment && totalInstallments ? Number(totalInstallments) : null,
      isInstallment && startMonth ? String(startMonth) : null,
      id
    );
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE recurring template
app.delete('/api/recurring/:id', async (req, res) => {
  try {
    db.prepare('DELETE FROM recurring_templates WHERE id = ?').run(req.params.id);
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

function resolveFuelCategoryId() {
  const transportCat = db.prepare("SELECT id FROM categories WHERE id = 'exp-transport'").get();
  if (transportCat) return transportCat.id;
  const anyExp = db.prepare("SELECT id FROM categories WHERE type = 'expense' LIMIT 1").get();
  return anyExp ? anyExp.id : 'exp-transport';
}

function buildFuelExpenseDescription(fuelType, liters, stationName, lang) {
  const isPt = lang === 'pt-BR';
  const fuelLabel = isPt
    ? fuelType === 'ethanol'
      ? 'Etanol'
      : 'Gasolina'
    : fuelType === 'ethanol'
    ? 'Ethanol'
    : 'Gasoline';
  const base = isPt ? `Abastecimento (${fuelLabel})` : `Refueling (${fuelLabel})`;
  const stationPart = stationName ? ` - ${stationName}` : '';
  return `${base}${stationPart} [${Number(liters).toFixed(2)}L]`;
}

// POST create fuel log + automatically record as an Expense transaction
app.post('/api/fuel', async (req, res) => {
  try {
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
    } = req.body;

    const fuelId = id || `fuel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const txId = `tx-fuel-${fuelId}`;
    const entryDate = date || new Date().toISOString().slice(0, 10);
    const entryCreated = createdAt || new Date().toISOString();
    const cleanStation = String(stationName || '').trim();
    const cleanNotes = String(notes || '').trim();
    const fType = fuelType === 'ethanol' ? 'ethanol' : 'gasoline';
    const settings = getSettingsObject();
    const categoryId = resolveFuelCategoryId();

    const txDescription = buildFuelExpenseDescription(fType, liters, cleanStation, settings.language);
    const txNotes = `${ Number(odometer).toFixed(0) } km • ${Number(pricePerLiter).toFixed(2)}/L${
      cleanNotes ? ` • ${cleanNotes}` : ''
    }`;

    db.prepare(
      `INSERT OR REPLACE INTO fuel_logs
       (id, date, odometer, pricePerLiter, totalCost, liters, fuelType, stationName, isFullTank, transactionId, notes, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      fuelId,
      entryDate,
      Number(odometer),
      Number(pricePerLiter),
      Number(totalCost),
      Number(liters),
      fType,
      cleanStation,
      isFullTank === false ? 0 : 1,
      txId,
      cleanNotes,
      entryCreated
    );

    db.prepare(
      `INSERT OR REPLACE INTO transactions
       (id, type, amount, description, categoryId, date, notes, recurringId, createdAt)
       VALUES (?, 'expense', ?, ?, ?, ?, ?, NULL, ?)`
    ).run(txId, Number(totalCost), txDescription, categoryId, entryDate, txNotes, entryCreated);

    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT update fuel log + update its linked Expense transaction
app.put('/api/fuel/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, odometer, pricePerLiter, totalCost, liters, fuelType, stationName, isFullTank, notes } = req.body;

    const existing = db.prepare('SELECT * FROM fuel_logs WHERE id = ?').get(id);
    const txId = existing?.transactionId || `tx-fuel-${id}`;
    const cleanStation = String(stationName || '').trim();
    const cleanNotes = String(notes || '').trim();
    const fType = fuelType === 'ethanol' ? 'ethanol' : 'gasoline';
    const settings = getSettingsObject();
    const categoryId = resolveFuelCategoryId();

    const txDescription = buildFuelExpenseDescription(fType, liters, cleanStation, settings.language);
    const txNotes = `${Number(odometer).toFixed(0)} km • ${Number(pricePerLiter).toFixed(2)}/L${
      cleanNotes ? ` • ${cleanNotes}` : ''
    }`;

    db.prepare(
      `UPDATE fuel_logs
       SET date = ?, odometer = ?, pricePerLiter = ?, totalCost = ?, liters = ?, fuelType = ?, stationName = ?, isFullTank = ?, transactionId = ?, notes = ?
       WHERE id = ?`
    ).run(
      String(date),
      Number(odometer),
      Number(pricePerLiter),
      Number(totalCost),
      Number(liters),
      fType,
      cleanStation,
      isFullTank === false ? 0 : 1,
      txId,
      cleanNotes,
      id
    );

    const txExists = db.prepare('SELECT id FROM transactions WHERE id = ?').get(txId);
    if (txExists) {
      db.prepare(
        `UPDATE transactions
         SET amount = ?, description = ?, date = ?, notes = ?
         WHERE id = ?`
      ).run(Number(totalCost), txDescription, String(date), txNotes, txId);
    } else {
      db.prepare(
        `INSERT INTO transactions (id, type, amount, description, categoryId, date, notes, recurringId, createdAt)
         VALUES (?, 'expense', ?, ?, ?, ?, ?, NULL, ?)`
      ).run(txId, Number(totalCost), txDescription, categoryId, String(date), txNotes, new Date().toISOString());
    }

    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE fuel log + delete its linked Expense transaction
app.delete('/api/fuel/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT transactionId FROM fuel_logs WHERE id = ?').get(id);
    db.prepare('DELETE FROM fuel_logs WHERE id = ?').run(id);
    if (existing?.transactionId) {
      db.prepare('DELETE FROM transactions WHERE id = ?').run(existing.transactionId);
    } else {
      db.prepare('DELETE FROM transactions WHERE id = ?').run(`tx-fuel-${id}`);
    }
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

function buildMonthDate(monthStr, dayOfMonth) {
  const [yearStr, monStr] = monthStr.split('-');
  const year = Number(yearStr);
  const month = Number(monStr);
  const maxDays = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(maxDays, Math.max(1, Number(dayOfMonth || 1)));
  return `${yearStr}-${String(month).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

function getInstallmentNumberForMonth(startMonth, targetMonth) {
  if (!startMonth || !targetMonth) return null;
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ty, tm] = targetMonth.split('-').map(Number);
  if (!sy || !sm || !ty || !tm) return null;
  return (ty - sy) * 12 + (tm - sm) + 1;
}

// POST apply single recurring template to a month (YYYY-MM)
app.post('/api/recurring/:id/apply', async (req, res) => {
  try {
    const { id } = req.params;
    const { month } = req.body;
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const template = db.prepare('SELECT * FROM recurring_templates WHERE id = ?').get(id);
    if (!template) {
      return res.status(404).json({ error: 'Recurring template not found' });
    }

    const txDate = buildMonthDate(targetMonth, template.dayOfMonth);
    const txId = `tx-rec-${id}-${targetMonth}`;

    let instCur = null;
    let instTot = null;
    if (template.isInstallment && template.totalInstallments && template.startMonth) {
      instCur = getInstallmentNumberForMonth(template.startMonth, targetMonth);
      instTot = Number(template.totalInstallments);
    }

    db.prepare(
      `INSERT OR REPLACE INTO transactions
       (id, type, amount, description, categoryId, date, notes, recurringId, dueDay, installmentCurrent, installmentTotal, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      txId,
      template.type,
      Number(template.amount),
      template.description,
      template.categoryId,
      txDate,
      instCur && instTot ? `${instCur}/${instTot}` : `Recurring (${targetMonth})`,
      id,
      Number(template.dayOfMonth || 1),
      instCur,
      instTot,
      new Date().toISOString()
    );

    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST apply all active unapplied recurring templates for a month (YYYY-MM)
app.post('/api/recurring/apply-all', async (req, res) => {
  try {
    const { month } = req.body;
    const targetMonth = month || new Date().toISOString().slice(0, 7);
    const templates = db.prepare('SELECT * FROM recurring_templates WHERE active = 1').all();
    const existingRows = db
      .prepare('SELECT recurringId FROM transactions WHERE date LIKE ? AND recurringId IS NOT NULL')
      .all(`${targetMonth}-%`);
    const appliedSet = new Set(existingRows.map((r) => r.recurringId));

    const insertTx = db.prepare(
      `INSERT OR REPLACE INTO transactions
       (id, type, amount, description, categoryId, date, notes, recurringId, dueDay, installmentCurrent, installmentTotal, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const tpl of templates) {
      if (appliedSet.has(tpl.id)) continue;

      let instCur = null;
      let instTot = null;
      if (tpl.isInstallment && tpl.totalInstallments && tpl.startMonth) {
        instCur = getInstallmentNumberForMonth(tpl.startMonth, targetMonth);
        instTot = Number(tpl.totalInstallments);
        // Skip if targetMonth is before installment start or after installment end
        if (!instCur || instCur < 1 || instCur > instTot) continue;
      }

      const txDate = buildMonthDate(targetMonth, tpl.dayOfMonth);
      const txId = `tx-rec-${tpl.id}-${targetMonth}`;
      insertTx.run(
        txId,
        tpl.type,
        Number(tpl.amount),
        tpl.description,
        tpl.categoryId,
        txDate,
        instCur && instTot ? `${instCur}/${instTot}` : `Recurring (${targetMonth})`,
        tpl.id,
        Number(tpl.dayOfMonth || 1),
        instCur,
        instTot,
        new Date().toISOString()
      );
    }

    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST sync offline transactions from mobile devices
app.post('/api/sync', async (req, res) => {
  try {
    const { pendingTransactions = [] } = req.body;
    const insertTx = db.prepare(
      `INSERT OR REPLACE INTO transactions (id, type, status, amount, description, categoryId, date, notes, recurringId, dueDay, installmentCurrent, installmentTotal, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const tx of pendingTransactions) {
      if (!tx || !tx.id) continue;
      insertTx.run(
        tx.id,
        tx.type === 'income' ? 'income' : 'expense',
        tx.status === 'unpaid' ? 'unpaid' : 'paid',
        Number(tx.amount),
        String(tx.description || '').trim(),
        String(tx.categoryId),
        String(tx.date),
        String(tx.notes || '').trim(),
        tx.recurringId || null,
        tx.dueDay ? Number(tx.dueDay) : null,
        tx.installmentCurrent ? Number(tx.installmentCurrent) : null,
        tx.installmentTotal ? Number(tx.installmentTotal) : null,
        tx.createdAt || new Date().toISOString()
      );
    }
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST import full backup JSON
app.post('/api/import', async (req, res) => {
  try {
    const { settings, categories, transactions, recurringTemplates, fuelLogs, mode = 'merge' } = req.body;

    if (mode === 'replace') {
      db.exec('DELETE FROM transactions; DELETE FROM recurring_templates; DELETE FROM fuel_logs;');
    }

    if (settings) {
      if (typeof settings.familyName === 'string') setSetting('familyName', settings.familyName);
      if (typeof settings.currency === 'string') setSetting('currency', settings.currency);
      if (typeof settings.language === 'string') setSetting('language', settings.language);
      if (typeof settings.theme === 'string') setSetting('theme', settings.theme);
      if (typeof settings.initialBalance === 'number') setSetting('initialBalance', settings.initialBalance);
      if (typeof settings.tankCapacity === 'number') setSetting('tankCapacity', settings.tankCapacity);
    }

    if (Array.isArray(categories)) {
      const insertCat = db.prepare(
        'INSERT OR REPLACE INTO categories (id, name, type, color, icon, isDefault) VALUES (?, ?, ?, ?, ?, ?)'
      );
      for (const c of categories) {
        insertCat.run(c.id, c.name, c.type, c.color, c.icon, c.isDefault ? 1 : 0);
      }
    }

    if (Array.isArray(transactions)) {
      const insertTx = db.prepare(
        `INSERT OR REPLACE INTO transactions (id, type, status, amount, description, categoryId, date, notes, recurringId, dueDay, installmentCurrent, installmentTotal, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const tx of transactions) {
        insertTx.run(
          tx.id,
          tx.type,
          tx.status === 'unpaid' ? 'unpaid' : 'paid',
          Number(tx.amount),
          tx.description,
          tx.categoryId,
          tx.date,
          tx.notes || '',
          tx.recurringId || null,
          tx.dueDay ? Number(tx.dueDay) : null,
          tx.installmentCurrent ? Number(tx.installmentCurrent) : null,
          tx.installmentTotal ? Number(tx.installmentTotal) : null,
          tx.createdAt || new Date().toISOString()
        );
      }
    }

    if (Array.isArray(recurringTemplates)) {
      const insertRec = db.prepare(
        `INSERT OR REPLACE INTO recurring_templates (id, type, amount, description, categoryId, dayOfMonth, active, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const r of recurringTemplates) {
        insertRec.run(
          r.id,
          r.type,
          Number(r.amount),
          r.description,
          r.categoryId,
          Number(r.dayOfMonth || 1),
          r.active ? 1 : 0,
          r.createdAt || new Date().toISOString()
        );
      }
    }

    if (Array.isArray(fuelLogs)) {
      const insertFuel = db.prepare(
        `INSERT OR REPLACE INTO fuel_logs (id, date, odometer, pricePerLiter, totalCost, liters, fuelType, stationName, isFullTank, transactionId, notes, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const f of fuelLogs) {
        insertFuel.run(
          f.id,
          f.date,
          Number(f.odometer),
          Number(f.pricePerLiter),
          Number(f.totalCost),
          Number(f.liters),
          f.fuelType === 'ethanol' ? 'ethanol' : 'gasoline',
          f.stationName || '',
          f.isFullTank ? 1 : 0,
          f.transactionId || `tx-fuel-${f.id}`,
          f.notes || '',
          f.createdAt || new Date().toISOString()
        );
      }
    }

    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST reset / clear all account history (transactions, recurring templates, fuel logs, and reset initial balance)
app.post('/api/reset', async (_req, res) => {
  try {
    db.exec('DELETE FROM transactions; DELETE FROM recurring_templates; DELETE FROM fuel_logs; DELETE FROM credit_cards;');
    setSetting('initialBalance', '0');
    const state = await getFullState();
    res.json(state);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

async function startServer() {
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(ROOT_DIR, 'dist');
    if (fs.existsSync(distPath)) {
      app.use((req, res, next) => {
        if (req.path === '/' || req.path === '/index.html' || req.path === '/sw.js') {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
        next();
      });
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    const lanUrls = getLocalNetworkAddresses();
    console.log('\n========================================================');
    console.log('  FamilyPlan — Local Family Finance Server is Running!');
    console.log('========================================================');
    console.log(`  Windows PC URL : http://localhost:${PORT}`);
    if (lanUrls.length > 0) {
      for (const net of lanUrls) {
        console.log(`  Mobile Wi-Fi   : ${net.url} (${net.name})`);
      }
    }
    console.log(`  Local Database : ${DB_PATH}`);
    console.log('========================================================\n');
  });
}

startServer();
