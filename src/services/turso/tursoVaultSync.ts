import { Client } from '@libsql/client/web';
import { AppState } from '../../types';
import {
  directSaveCard,
  directSaveCategory,
  directSaveFuel,
  directSaveRecurring,
} from './tursoEntityCrud';
import { DEFAULT_CATEGORIES, DEFAULT_SETTINGS, ensureClientSchema } from './tursoSchema';
import { directGetFullState } from './tursoStateQueries';
import { directSaveTransaction } from './tursoTransactionCrud';

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
