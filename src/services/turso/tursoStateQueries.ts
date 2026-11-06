import { Client } from '@libsql/client/web';
import { AppState, Category, CreditCard, FuelLog, RecurringTemplate, Transaction } from '../../types';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
  directSeedDefaultCategories,
  ensureClientSchema,
} from './tursoSchema';

export async function directVerifyFamily(client: Client, familyId: string): Promise<boolean> {
  await ensureClientSchema(client);
  const res = await client.execute({
    sql: 'SELECT family_id FROM families WHERE family_id = ?',
    args: [familyId],
  });
  if (res.rows.length > 0) return true;

  for (const table of ['transactions', 'settings', 'categories']) {
    try {
      const fallback = await client.execute({
        sql: `SELECT 1 FROM ${table} WHERE family_id = ? LIMIT 1`,
        args: [familyId],
      });
      if (fallback.rows.length > 0) {
        await client.execute({
          sql: 'INSERT OR IGNORE INTO families (family_id, created_at) VALUES (?, ?)',
          args: [familyId, new Date().toISOString()],
        });
        return true;
      }
    } catch {}
  }
  return false;
}

export async function directGetSampleEncrypted(client: Client, familyId: string): Promise<string | null> {
  await ensureClientSchema(client);
  try {
    const resKeyCheck = await client.execute({
      sql: "SELECT encrypted_data FROM settings WHERE family_id = ? AND key = 'key_check' AND encrypted_data IS NOT NULL LIMIT 1",
      args: [familyId],
    });
    if (resKeyCheck.rows.length > 0 && resKeyCheck.rows[0].encrypted_data) {
      return String(resKeyCheck.rows[0].encrypted_data);
    }
  } catch {}

  const tables = ['settings', 'transactions', 'categories', 'credit_cards', 'fuel_logs', 'recurring_templates'];
  for (const table of tables) {
    try {
      const res = await client.execute({
        sql: `SELECT encrypted_data FROM ${table} WHERE family_id = ? AND encrypted_data IS NOT NULL LIMIT 1`,
        args: [familyId],
      });
      if (res.rows.length > 0 && res.rows[0].encrypted_data) {
        return String(res.rows[0].encrypted_data);
      }
    } catch {}
  }
  return null;
}

export async function directCreateFamily(
  client: Client,
  requestedId?: string
): Promise<{ familyId: string; createdAt: string }> {
  await ensureClientSchema(client);
  const fid = requestedId || `FP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const now = new Date().toISOString();

  const familyStmt = {
    sql: 'INSERT OR REPLACE INTO families (family_id, created_at) VALUES (?, ?)',
    args: [fid, now],
  };

  const catBatch = DEFAULT_CATEGORIES.map((c) => ({
    sql: `INSERT OR IGNORE INTO categories (family_id, id, name, type, color, icon, isDefault)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [fid, c.id, c.name, c.type, c.color, c.icon, c.isDefault ? 1 : 0],
  }));

  const settingBatch = Object.entries(DEFAULT_SETTINGS).map(([k, v]) => ({
    sql: 'INSERT OR IGNORE INTO settings (family_id, key, value) VALUES (?, ?, ?)',
    args: [fid, k, String(v)],
  }));

  // Atomic batch execution to guarantee family creation & default category initialization
  await client.batch([familyStmt, ...catBatch, ...settingBatch], 'write');

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

  let catRows = catRes.rows;
  if (catRows.length === 0) {
    console.log(`[Turso Direct Safeguard] Family ${familyId} has 0 categories. Seeding defaults...`);
    await directSeedDefaultCategories(client, familyId);
    const refreshed = await client.execute({
      sql: 'SELECT id, name, type, color, icon, isDefault, encrypted_data FROM categories WHERE family_id = ? ORDER BY type ASC, name ASC',
      args: [familyId],
    });
    catRows = refreshed.rows;
  }

  const settings: any = { ...DEFAULT_SETTINGS };
  for (const r of setRes.rows) {
    const k = String(r.key);
    const v = String(r.value);
    if (k === 'key_check' || k === 'encrypted_settings') {
      settings[k] = r.encrypted_data ? String(r.encrypted_data) : v;
    } else if (k === 'initialBalance' || k === 'tankCapacity') {
      settings[k] = Number(v) || 0;
    } else {
      settings[k] = v;
    }
  }

  const categories: Category[] = catRows.map((c: any) => ({
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
