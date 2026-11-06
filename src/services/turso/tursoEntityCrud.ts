import { Client } from '@libsql/client/web';
import { AppState } from '../../types';
import { ensureClientSchema } from './tursoSchema';
import { directGetFullState } from './tursoStateQueries';
import { directSaveTransaction } from './tursoTransactionCrud';

export async function directUpdateSettings(client: Client, familyId: string, payload: any): Promise<AppState> {
  await ensureClientSchema(client);
  for (const [k, v] of Object.entries(payload)) {
    if (v === undefined) continue;
    if (k === 'keyCheck' || k === 'key_check') {
      if (typeof v === 'string' && v.startsWith('v1:')) {
        await client.execute({
          sql: `INSERT INTO settings (family_id, key, value, encrypted_data) VALUES (?, 'key_check', '1', ?)
                ON CONFLICT(family_id, key) DO UPDATE SET value = '1', encrypted_data = excluded.encrypted_data`,
          args: [familyId, v],
        });
      }
      continue;
    }
    if (k === 'encrypted_data') {
      await client.execute({
        sql: `INSERT INTO settings (family_id, key, value, encrypted_data) VALUES (?, 'encrypted_settings', '1', ?)
              ON CONFLICT(family_id, key) DO UPDATE SET value = '1', encrypted_data = excluded.encrypted_data`,
        args: [familyId, String(v)],
      });
      continue;
    }
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
  await client.batch(
    [
      {
        sql: 'UPDATE transactions SET cardId = NULL WHERE family_id = ? AND cardId = ?',
        args: [familyId, id],
      },
      {
        sql: 'DELETE FROM credit_cards WHERE family_id = ? AND id = ?',
        args: [familyId, id],
      },
    ],
    'write'
  );
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
