import React from 'react';
import { AppState, Transaction } from '../types';
import {
  apiFetch,
  decryptFullState,
  encryptRecurringTemplate,
  encryptTransaction,
} from '../services/tursoService';
import {
  SeriesScope,
  getSubsequentPendingSeriesTransactions,
  isPartOfSeries,
} from '../components/SeriesConfirmModal';
import { STORAGE_PENDING_TX_KEY } from './useAppStorageState';
import {
  RecurringPlanInput,
  TransactionSaveInput,
  buildToggledTransactionUpdate,
  buildTransactionSaveEntries,
} from './transactionCrudHelpers';

interface UseTransactionCrudParams {
  state: AppState;
  familyId: string | null;
  masterKey: string | null;
  pendingOfflineTx: Transaction[];
  setPendingOfflineTx: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setIsOnlineWithServer: React.Dispatch<React.SetStateAction<boolean>>;
  setDeletingSeriesTx: React.Dispatch<React.SetStateAction<Transaction | null>>;
  saveStateToCache: (nextState: AppState) => void;
  handleDecryptionFailure: (err: unknown) => boolean;
}

export function useTransactionCrud({
  state,
  familyId,
  masterKey,
  pendingOfflineTx,
  setPendingOfflineTx,
  setIsOnlineWithServer,
  setDeletingSeriesTx,
  saveStateToCache,
  handleDecryptionFailure,
}: UseTransactionCrudParams) {
  const handleSaveTransaction = async (
    txData: TransactionSaveInput,
    recurringPlan?: RecurringPlanInput,
    scope: SeriesScope = 'single'
  ) => {
    const {
      fullTx,
      generatedRecId,
      futureEntries,
      updatedSeriesEntries,
    } = buildTransactionSaveEntries(txData, recurringPlan, scope, state.transactions);

    try {
      let updatedState: AppState | null = null;

      if (!txData.id && recurringPlan && generatedRecId) {
        const rawRec = {
          id: generatedRecId,
          type: txData.type,
          amount: fullTx.amount,
          description: txData.description,
          categoryId: txData.categoryId,
          dayOfMonth: recurringPlan.dayOfMonth,
          isInstallment: recurringPlan.mode === 'installment',
          totalInstallments: recurringPlan.totalInstallments,
          startMonth: recurringPlan.startMonth,
          active: true,
          createdAt: new Date().toISOString(),
        };
        const recPayload =
          masterKey && familyId
            ? await encryptRecurringTemplate(rawRec, masterKey, familyId)
            : rawRec;
        const recRes = await apiFetch('/api/recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(recPayload),
        });
        if (recRes.ok) {
          const rawRecState = await recRes.json();
          updatedState =
            masterKey && familyId
              ? await decryptFullState(rawRecState, masterKey, familyId)
              : rawRecState;
        }
      }

      const url = txData.id ? `/api/transactions/${txData.id}` : '/api/transactions';
      const method = txData.id ? 'PUT' : 'POST';

      let txPayload: Record<string, unknown> = {
        ...fullTx,
        scope,
        futureEntries: futureEntries.length > 0 ? futureEntries : undefined,
        updatedSeriesEntries: updatedSeriesEntries.length > 0 ? updatedSeriesEntries : undefined,
      };

      if (masterKey && familyId) {
        const encFullTx = await encryptTransaction(fullTx, masterKey, familyId);
        let encFuture: unknown = undefined;
        if (futureEntries.length > 0) {
          encFuture = await Promise.all(
            futureEntries.map((f) => encryptTransaction(f, masterKey, familyId))
          );
        }
        let encUpdatedSeries: unknown = undefined;
        if (updatedSeriesEntries.length > 0) {
          encUpdatedSeries = await Promise.all(
            updatedSeriesEntries.map((u) => encryptTransaction(u, masterKey, familyId))
          );
        }
        txPayload = {
          ...encFullTx,
          scope,
          futureEntries: encFuture,
          updatedSeriesEntries: encUpdatedSeries,
        };
      }

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txPayload),
      });
      if (!res.ok) throw new Error('Failed');
      const rawResState = await res.json();
      updatedState =
        masterKey && familyId
          ? await decryptFullState(rawResState, masterKey, familyId)
          : rawResState;

      if (updatedState) {
        saveStateToCache(updatedState);
      }
      setIsOnlineWithServer(true);
    } catch (err: unknown) {
      if (handleDecryptionFailure(err)) return;
      setIsOnlineWithServer(false);
      let nextTransactions: Transaction[];
      if (txData.id) {
        const updatedMap = new Map<string, Transaction>(
          updatedSeriesEntries.map((u) => [u.id, u])
        );
        nextTransactions = state.transactions.map((tx) => {
          if (tx.id === txData.id) return fullTx;
          if (updatedMap.has(tx.id)) return updatedMap.get(tx.id)!;
          return tx;
        });
      } else {
        nextTransactions = [fullTx, ...futureEntries, ...state.transactions];
      }

      saveStateToCache({
        ...state,
        transactions: nextTransactions,
      });

      const updatedIds = new Set<string>([
        fullTx.id,
        ...futureEntries.map((f) => f.id),
        ...updatedSeriesEntries.map((u) => u.id),
      ]);
      const nextPending = [
        ...pendingOfflineTx.filter((p) => !updatedIds.has(p.id)),
        fullTx,
        ...futureEntries,
        ...updatedSeriesEntries,
      ];
      setPendingOfflineTx(nextPending);
      const pendingKey = familyId ? `${STORAGE_PENDING_TX_KEY}_${familyId}` : STORAGE_PENDING_TX_KEY;
      localStorage.setItem(pendingKey, JSON.stringify(nextPending));
    }
  };

  const handleToggleTransactionStatus = async (tx: Transaction) => {
    const {
      nextStatus,
      updatedTx,
      nextTransactions,
      cycleTxsToSync,
    } = buildToggledTransactionUpdate(tx, state.transactions, state.creditCards || []);

    saveStateToCache({
      ...state,
      transactions: nextTransactions,
    });

    try {
      const res = await apiFetch(`/api/transactions/${tx.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Failed');

      for (const cTx of cycleTxsToSync) {
        await apiFetch(`/api/transactions/${cTx.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        });
      }

      const rawData: AppState = await res.json();
      const data =
        masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
      saveStateToCache(data);
    } catch {
      const nextPending = [...pendingOfflineTx.filter((p) => p.id !== updatedTx.id), updatedTx];
      setPendingOfflineTx(nextPending);
      const pendingKey = familyId ? `${STORAGE_PENDING_TX_KEY}_${familyId}` : STORAGE_PENDING_TX_KEY;
      localStorage.setItem(pendingKey, JSON.stringify(nextPending));
    }
  };

  const executeDeleteTransaction = async (id: string, scope: SeriesScope = 'single') => {
    const originalTx = state.transactions.find((tx) => tx.id === id);
    const idsToDelete = new Set<string>([id]);
    if (scope === 'future' && originalTx) {
      for (const subTx of getSubsequentPendingSeriesTransactions(originalTx, state.transactions)) {
        idsToDelete.add(subTx.id);
      }
    }

    saveStateToCache({
      ...state,
      transactions: state.transactions.filter((tx) => !idsToDelete.has(tx.id)),
    });

    if (pendingOfflineTx.some((p) => idsToDelete.has(p.id))) {
      const nextPending = pendingOfflineTx.filter((p) => !idsToDelete.has(p.id));
      setPendingOfflineTx(nextPending);
      const pendingKey = familyId ? `${STORAGE_PENDING_TX_KEY}_${familyId}` : STORAGE_PENDING_TX_KEY;
      try {
        localStorage.setItem(pendingKey, JSON.stringify(nextPending));
      } catch {
        // ignore quota errors
      }
    }

    try {
      const res = await apiFetch(`/api/transactions/${id}?scope=${scope}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, deleteIds: Array.from(idsToDelete) }),
      });
      if (!res.ok) throw new Error('Failed');
      const rawData: AppState = await res.json();
      const data =
        masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
      saveStateToCache(data);
    } catch {
      // Optimistic deletion already applied to local cache above
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const targetTx = state.transactions.find((tx) => tx.id === id);
    if (targetTx && isPartOfSeries(targetTx, state.transactions)) {
      setDeletingSeriesTx(targetTx);
      return;
    }
    await executeDeleteTransaction(id, 'single');
  };

  return {
    handleSaveTransaction,
    handleToggleTransactionStatus,
    executeDeleteTransaction,
    handleDeleteTransaction,
  };
}
