import {
  AppState,
  CreditCard,
  Transaction,
} from '../types';
import {
  computeCardFirstInvoiceMonth,
  computeInvoiceDueDate,
  getTodayDateStr,
  shiftMonth,
} from '../utils/format';
import {
  apiFetch,
  encryptCategory,
  encryptCreditCard,
  encryptFuelLog,
  encryptRecurringTemplate,
  encryptTransaction,
} from '../services/tursoService';
import { parseBackupPayload } from '../utils/backup';

export function computeTxInvoiceMonth(tx: Transaction, card: CreditCard): string {
  if (tx.invoiceMonth) return tx.invoiceMonth;
  const firstMonth = computeCardFirstInvoiceMonth(
    tx.purchaseDate || tx.date,
    card.closingDay
  ).invoiceMonth;
  if (
    tx.installmentTotal &&
    tx.installmentTotal > 1 &&
    tx.installmentCurrent &&
    tx.installmentCurrent > 1
  ) {
    return shiftMonth(firstMonth, tx.installmentCurrent - 1);
  }
  return firstMonth;
}

export function reconcilePendingCardInvoices(state: AppState): {
  hasChanges: boolean;
  nextTxs: Transaction[];
  txsToSaveToServer: Transaction[];
  txsToUpdateOnServer: Transaction[];
  idsToDeleteOnServer: string[];
} {
  const todayStr = getTodayDateStr();
  const todayYm = todayStr.slice(0, 7);
  const todayDay = Number(todayStr.slice(8, 10)) || 1;

  let hasChanges = false;
  let nextTxs = [...state.transactions];
  const txsToSaveToServer: Transaction[] = [];
  const txsToUpdateOnServer: Transaction[] = [];
  const idsToDeleteOnServer: string[] = [];

  for (const card of state.creditCards || []) {
    const cardTxs = state.transactions.filter((tx) => tx.cardId === card.id);
    const invoiceMonths = new Set<string>();
    for (const tx of cardTxs) {
      invoiceMonths.add(computeTxInvoiceMonth(tx, card));
    }

    const cardSettlementTxs = nextTxs.filter(
      (tx) => tx.settledInvoiceKey && tx.settledInvoiceKey.startsWith(`${card.id}__`)
    );
    for (const sTx of cardSettlementTxs) {
      const invMonth = sTx.settledInvoiceKey!.split('__')[1];
      if (invMonth) invoiceMonths.add(invMonth);
    }

    for (const invMonth of invoiceMonths) {
      const isClosed =
        invMonth < todayYm || (invMonth === todayYm && todayDay >= card.closingDay);

      const cycleTxs = cardTxs.filter((tx) => computeTxInvoiceMonth(tx, card) === invMonth);
      const unpaidCycleTxs = cycleTxs.filter((tx) => (tx.status || 'paid') === 'unpaid');
      const unpaidCycleTotal = Number(
        unpaidCycleTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0).toFixed(2)
      );
      const settlementKey = `${card.id}__${invMonth}`;
      const existingTx = nextTxs.find((tx) => tx.settledInvoiceKey === settlementKey);
      const dueDate = computeInvoiceDueDate(invMonth, card.closingDay, card.dueDay);

      if (existingTx) {
        if (existingTx.status === 'unpaid') {
          if (unpaidCycleTotal <= 0) {
            nextTxs = nextTxs.filter((tx) => tx.id !== existingTx.id);
            idsToDeleteOnServer.push(existingTx.id);
            hasChanges = true;
          } else if (
            Math.abs(existingTx.amount - unpaidCycleTotal) > 0.001 ||
            existingTx.description !== `Fatura ${card.name}` ||
            existingTx.date !== dueDate
          ) {
            const updated: Transaction = {
              ...existingTx,
              amount: unpaidCycleTotal,
              description: `Fatura ${card.name}`,
              date: dueDate,
              notes: isClosed
                ? `Fatura fechada (${cycleTxs.length} compras)`
                : `Fatura em aberto (${cycleTxs.length} compras)`,
            };
            nextTxs = nextTxs.map((tx) => (tx.id === existingTx.id ? updated : tx));
            txsToUpdateOnServer.push(updated);
            hasChanges = true;
          }
        }
      } else if (unpaidCycleTotal > 0) {
        const invoiceCategory =
          state.categories.find(
            (c) =>
              c.type === 'expense' &&
              (c.name.toLowerCase().includes('cartão') ||
                c.name.toLowerCase().includes('fatura') ||
                c.id === 'exp-bills' ||
                c.name.toLowerCase() === 'contas')
          ) ||
          state.categories.find((c) => c.id === 'exp-bills') ||
          state.categories.find((c) => c.id === 'exp-other') ||
          state.categories[0];

        const newPendingTx: Transaction = {
          id: `tx-fatura-${card.id}-${invMonth}`,
          type: 'expense',
          status: 'unpaid',
          amount: unpaidCycleTotal,
          description: `Fatura ${card.name}`,
          categoryId: invoiceCategory?.id || 'exp-bills',
          date: dueDate,
          notes: isClosed
            ? `Fatura fechada (${cycleTxs.length} compras)`
            : `Fatura em aberto (${cycleTxs.length} compras)`,
          dueDay: card.dueDay,
          cardId: null,
          settledInvoiceKey: settlementKey,
          createdAt: new Date().toISOString(),
        };

        nextTxs = [newPendingTx, ...nextTxs];
        txsToSaveToServer.push(newPendingTx);
        hasChanges = true;
      }
    }
  }

  return {
    hasChanges,
    nextTxs,
    txsToSaveToServer,
    txsToUpdateOnServer,
    idsToDeleteOnServer,
  };
}

export async function syncPendingInvoiceChangesToServer(params: {
  txsToSaveToServer: Transaction[];
  txsToUpdateOnServer: Transaction[];
  idsToDeleteOnServer: string[];
  masterKey: string | null;
  familyId: string | null;
}): Promise<void> {
  const {
    txsToSaveToServer,
    txsToUpdateOnServer,
    idsToDeleteOnServer,
    masterKey,
    familyId,
  } = params;

  try {
    for (const newTx of txsToSaveToServer) {
      const payload =
        masterKey && familyId
          ? await encryptTransaction(newTx, masterKey, familyId)
          : newTx;
      await apiFetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    for (const updTx of txsToUpdateOnServer) {
      const payload =
        masterKey && familyId
          ? await encryptTransaction(updTx, masterKey, familyId)
          : updTx;
      await apiFetch(`/api/transactions/${updTx.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    for (const delId of idsToDeleteOnServer) {
      await apiFetch(`/api/transactions/${delId}`, {
        method: 'DELETE',
      });
    }
  } catch {
    // Local cache already updated optimistically
  }
}

export async function encryptBackupEntities(
  backup: ReturnType<typeof parseBackupPayload>,
  masterKey: string | null,
  familyId: string | null
) {
  if (!masterKey || !familyId) {
    return {
      categories: backup.categories,
      creditCards: backup.creditCards,
      transactions: backup.transactions,
      recurringTemplates: backup.recurringTemplates,
      fuelLogs: backup.fuelLogs,
    };
  }
  const categories = [];
  for (const c of backup.categories) categories.push(await encryptCategory(c, masterKey, familyId));
  const creditCards = [];
  for (const c of backup.creditCards) creditCards.push(await encryptCreditCard(c, masterKey, familyId));
  const transactions = [];
  for (const tx of backup.transactions) transactions.push(await encryptTransaction(tx, masterKey, familyId));
  const recurringTemplates = [];
  for (const r of backup.recurringTemplates) {
    recurringTemplates.push({
      ...(await encryptRecurringTemplate(r, masterKey, familyId)),
      dayOfMonth: r.dayOfMonth,
      isInstallment: r.isInstallment,
    });
  }
  const fuelLogs = [];
  for (const f of backup.fuelLogs) {
    fuelLogs.push({
      ...(await encryptFuelLog(f, masterKey, familyId)),
      isFullTank: f.isFullTank,
      fuelType: f.fuelType,
    });
  }
  return { categories, creditCards, transactions, recurringTemplates, fuelLogs };
}
