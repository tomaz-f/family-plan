import { Client } from '@libsql/client/web';
import { AppState } from '../../types';
import { ensureClientSchema } from './tursoSchema';
import { directGetFullState } from './tursoStateQueries';

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

  const mainStmt = {
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
  };

  const batchStatements: any[] = [mainStmt];

  if (Array.isArray(txData.futureEntries)) {
    for (const f of txData.futureEntries) {
      if (!f || !f.date) continue;
      const fEnc = Boolean(f.encrypted_data || f.payload);
      const fIv = f.iv || (f.encrypted_data && f.encrypted_data.startsWith('v1:') ? f.encrypted_data.split(':')[1] : null);
      const fPayload = f.payload || (f.encrypted_data && f.encrypted_data.startsWith('v1:') ? f.encrypted_data.split(':')[2] : (f.encrypted_data || null));
      const fEncData = f.encrypted_data || (fIv && fPayload ? `v1:${fIv}:${fPayload}` : fPayload);

      batchStatements.push({
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

  await client.batch(batchStatements, 'write');

  return directGetFullState(client, familyId);
}

export async function directUpdateTransaction(client: Client, familyId: string, id: string, txData: any): Promise<AppState> {
  await ensureClientSchema(client);

  const buildUpdateStmt = (rowId: string, rowData: any) => {
    const isEncrypted = Boolean(rowData.encrypted_data || rowData.payload);
    if (isEncrypted) {
      const cleanIv = rowData.iv || (rowData.encrypted_data && rowData.encrypted_data.startsWith('v1:') ? rowData.encrypted_data.split(':')[1] : null);
      const cleanPayload = rowData.payload || (rowData.encrypted_data && rowData.encrypted_data.startsWith('v1:') ? rowData.encrypted_data.split(':')[2] : (rowData.encrypted_data || null));
      const cleanEncrypted = rowData.encrypted_data || (cleanIv && cleanPayload ? `v1:${cleanIv}:${cleanPayload}` : cleanPayload);
      return {
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
      };
    } else {
      return {
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
      };
    }
  };

  const batchStatements: any[] = [buildUpdateStmt(id, txData)];

  if (Array.isArray(txData.updatedSeriesEntries)) {
    for (const sEntry of txData.updatedSeriesEntries) {
      if (sEntry && sEntry.id) {
        batchStatements.push(buildUpdateStmt(sEntry.id, sEntry));
      }
    }
  }

  await client.batch(batchStatements, 'write');

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
  const deleteBatch = ids
    .filter(Boolean)
    .map((targetId) => ({
      sql: 'DELETE FROM transactions WHERE family_id = ? AND id = ?',
      args: [familyId, targetId],
    }));
  if (deleteBatch.length > 0) {
    await client.batch(deleteBatch, 'write');
  }
  return directGetFullState(client, familyId);
}
