import { useEffect, useCallback, useRef } from 'react';
import { AppState, Transaction } from '../types';
import {
  apiFetch,
  clearStoredFamilyId,
  clearStoredMasterKey,
  decryptFullState,
  encryptTransaction,
  getStoredFamilyId,
  InvalidMasterKeyError,
} from '../services/tursoService';
import {
  FALLBACK_STATE,
  normalizeLegacyInstallmentTransactions,
  STORAGE_PENDING_TX_KEY,
  STORAGE_STATE_KEY,
} from './useAppStorageState';
import {
  reconcilePendingCardInvoices,
  syncPendingInvoiceChangesToServer,
} from './cloudSyncHelpers';

interface UseCloudSyncLifecycleParams {
  familyId: string | null;
  masterKey: string | null;
  state: AppState;
  isAnyModalOpen: boolean;
  setFamilyId: React.Dispatch<React.SetStateAction<string | null>>;
  setMasterKey: React.Dispatch<React.SetStateAction<string | null>>;
  setAuthFamilyId: React.Dispatch<React.SetStateAction<string | null>>;
  setAuthErrorMessage: React.Dispatch<React.SetStateAction<string | null>>;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  setPendingOfflineTx: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setIsOnlineWithServer: React.Dispatch<React.SetStateAction<boolean>>;
  saveStateToCache: (nextState: AppState) => void;
}

export function useCloudSyncLifecycle({
  familyId,
  masterKey,
  state,
  isAnyModalOpen,
  setFamilyId,
  setMasterKey,
  setAuthFamilyId,
  setAuthErrorMessage,
  setState,
  setPendingOfflineTx,
  setIsOnlineWithServer,
  saveStateToCache,
}: UseCloudSyncLifecycleParams) {
  const isAnyModalOpenRef = useRef<boolean>(isAnyModalOpen);
  useEffect(() => {
    isAnyModalOpenRef.current = isAnyModalOpen;
  }, [isAnyModalOpen]);

  const handleLeaveFamily = useCallback(() => {
    clearStoredFamilyId();
    clearStoredMasterKey();
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith(STORAGE_STATE_KEY) ||
            key.startsWith(STORAGE_PENDING_TX_KEY) ||
            key === 'familyplan_family_id' ||
            key === 'familyplan_master_key')
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {
      // ignore
    }
    setPendingOfflineTx([]);
    setFamilyId(null);
    setMasterKey(null);
    setAuthFamilyId(null);
    setAuthErrorMessage(null);
    setState(FALLBACK_STATE);
  }, [setFamilyId, setMasterKey, setAuthFamilyId, setAuthErrorMessage, setPendingOfflineTx, setState]);

  const handleDecryptionFailure = useCallback(
    (err: unknown) => {
      const errObj = err as { name?: string } | null;
      if (err instanceof InvalidMasterKeyError || errObj?.name === 'InvalidMasterKeyError') {
        console.error('[E2EE] Invalid Master Key detected. Resetting invalid credentials.');
        const fid = getStoredFamilyId() || familyId;
        setAuthFamilyId(fid || null);
        clearStoredMasterKey();
        clearStoredFamilyId();
        if (fid) {
          try {
            localStorage.removeItem(`${STORAGE_STATE_KEY}_${fid}`);
            localStorage.removeItem(`${STORAGE_PENDING_TX_KEY}_${fid}`);
          } catch {
            // ignore
          }
        }
        try {
          localStorage.removeItem(STORAGE_STATE_KEY);
        } catch {
          // ignore
        }
        setState(FALLBACK_STATE);
        setMasterKey(null);
        setFamilyId(null);
        setAuthErrorMessage(
          'Chave Mestre de Segurança inválida para este espaço familiar. Verifique os 12 dígitos digitados.'
        );
        return true;
      }
      return false;
    },
    [familyId, setAuthFamilyId, setState, setMasterKey, setFamilyId, setAuthErrorMessage]
  );

  const syncWithServer = useCallback(async () => {
    if (!familyId) return;
    if (isAnyModalOpenRef.current) return;
    try {
      let pending: Transaction[] = [];
      const pendingKey = `${STORAGE_PENDING_TX_KEY}_${familyId}`;
      try {
        const raw = localStorage.getItem(pendingKey);
        if (raw) pending = JSON.parse(raw);
      } catch {
        pending = [];
      }

      if (pending.length > 0) {
        let pendingToSend: unknown[] = pending;
        if (masterKey) {
          pendingToSend = await Promise.all(
            pending.map((p) => encryptTransaction(p, masterKey, familyId))
          );
        }
        const res = await apiFetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pendingTransactions: pendingToSend }),
        });
        if (res.ok) {
          const rawData: AppState = await res.json();
          const data = masterKey ? await decryptFullState(rawData, masterKey, familyId) : rawData;
          localStorage.removeItem(pendingKey);
          setPendingOfflineTx([]);
          saveStateToCache(data);
          setIsOnlineWithServer(true);
          return;
        }
      }

      const res = await apiFetch('/api/state');
      if (!res.ok) throw new Error('Server unreachable');
      const rawData = await res.json();
      const data = masterKey ? await decryptFullState(rawData, masterKey, familyId) : rawData;
      const { repaired } = normalizeLegacyInstallmentTransactions(data.transactions || []);
      saveStateToCache(data);
      setIsOnlineWithServer(true);

      if (repaired.length > 0) {
        const repairedPayload = masterKey
          ? await Promise.all(repaired.map((r) => encryptTransaction(r, masterKey, familyId)))
          : repaired;
        await apiFetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pendingTransactions: repairedPayload }),
        }).catch(() => {});
      }
    } catch (err: unknown) {
      if (handleDecryptionFailure(err)) return;
      setIsOnlineWithServer(false);
    }
  }, [familyId, masterKey, saveStateToCache, handleDecryptionFailure, setPendingOfflineTx, setIsOnlineWithServer]);

  useEffect(() => {
    if (isAnyModalOpen) return;
    syncWithServer();
    const interval = setInterval(() => {
      if (!isAnyModalOpenRef.current) {
        syncWithServer();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isAnyModalOpen, syncWithServer]);

  // Automatic Pending Invoice Sync for Closed Card Invoices (Cash Flow Forecast)
  useEffect(() => {
    if (!state.creditCards || state.creditCards.length === 0) return;

    const {
      hasChanges,
      nextTxs,
      txsToSaveToServer,
      txsToUpdateOnServer,
      idsToDeleteOnServer,
    } = reconcilePendingCardInvoices(state);

    if (hasChanges) {
      saveStateToCache({
        ...state,
        transactions: nextTxs,
      });

      void syncPendingInvoiceChangesToServer({
        txsToSaveToServer,
        txsToUpdateOnServer,
        idsToDeleteOnServer,
        masterKey,
        familyId,
      });
    }
  }, [state, masterKey, familyId, saveStateToCache]);

  return {
    handleLeaveFamily,
    handleDecryptionFailure,
    syncWithServer,
  };
}
