import React from 'react';
import {
  AppLanguage,
  AppState,
  AppTheme,
  Category,
  Transaction,
  TransactionType,
} from '../types';
import {
  applyBackupPreferences,
  buildBackupPayload,
  downloadBackupFile,
  mergeBackupIntoState,
  parseBackupPayload,
} from '../utils/backup';
import {
  apiFetch,
  decryptFullState,
  encryptCategory,
} from '../services/tursoService';
import { STORAGE_PENDING_TX_KEY } from './useAppStorageState';
import { encryptBackupEntities } from './cloudSyncHelpers';

interface UseSettingsCategoriesCrudParams {
  state: AppState;
  familyId: string | null;
  masterKey: string | null;
  language: AppLanguage;
  pendingOfflineTx: Transaction[];
  categoryManagerContext: 'standalone' | 'transaction' | 'cardExpense';
  setPendingOfflineTx: React.Dispatch<React.SetStateAction<Transaction[]>>;
  setIsOnlineWithServer: React.Dispatch<React.SetStateAction<boolean>>;
  setNewlyCreatedCategoryId: React.Dispatch<React.SetStateAction<string | null>>;
  setSyncModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCategoryManagerContext: React.Dispatch<
    React.SetStateAction<'standalone' | 'transaction' | 'cardExpense'>
  >;
  saveStateToCache: (nextState: AppState) => void;
}

export function useSettingsCategoriesCrud({
  state,
  familyId,
  masterKey,
  language,
  pendingOfflineTx,
  categoryManagerContext,
  setPendingOfflineTx,
  setIsOnlineWithServer,
  setNewlyCreatedCategoryId,
  setSyncModalOpen,
  setCategoryManagerContext,
  saveStateToCache,
}: UseSettingsCategoriesCrudParams) {
  const handleUpdateSettings = async (payload: {
    familyName?: string;
    currency?: string;
    language?: AppLanguage;
    theme?: AppTheme;
    initialBalance?: number;
    tankCapacity?: number;
    targetCurrentBalance?: number;
  }) => {
    if (payload.theme) {
      document.documentElement.setAttribute('data-theme', payload.theme);
      try {
        localStorage.setItem('familyplan_theme', payload.theme);
      } catch {
        // ignore quota errors
      }
    }

    let nextInitial = payload.initialBalance ?? state.settings.initialBalance;
    if (typeof payload.targetCurrentBalance === 'number') {
      let inc = 0;
      let exp = 0;
      for (const tx of state.transactions) {
        if (tx.status === 'unpaid' || tx.cardId) continue;
        if (tx.type === 'income') inc += tx.amount;
        else exp += tx.amount;
      }
      nextInitial = payload.targetCurrentBalance - inc + exp;
    }

    const optimisticState: AppState = {
      ...state,
      settings: {
        ...state.settings,
        familyName: payload.familyName ?? state.settings.familyName,
        currency: payload.currency ?? state.settings.currency,
        language: payload.language ?? state.settings.language,
        theme: payload.theme ?? state.settings.theme,
        tankCapacity: payload.tankCapacity ?? state.settings.tankCapacity,
        initialBalance: nextInitial,
      },
    };
    saveStateToCache(optimisticState);

    try {
      const res = await apiFetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      const rawData: AppState = await res.json();
      const data =
        masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
      saveStateToCache(data);
    } catch {
      // Optimistic state is already applied and cached
    }
  };

  const handleAddCategory = async (cat: {
    name: string;
    type: TransactionType;
    color: string;
    icon: string;
  }): Promise<Category> => {
    const generatedId = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newCat: Category = {
      id: generatedId,
      name: cat.name.trim(),
      type: cat.type,
      color: cat.color,
      icon: cat.icon,
      isDefault: 0,
    };
    try {
      const catPayload =
        masterKey && familyId ? await encryptCategory(newCat, masterKey, familyId) : newCat;
      const res = await apiFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catPayload),
      });
      if (res.ok) {
        const rawData = await res.json();
        const data =
          masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
        saveStateToCache(data);
      } else {
        saveStateToCache({
          ...state,
          categories: [...state.categories, newCat],
        });
      }
    } catch {
      saveStateToCache({
        ...state,
        categories: [...state.categories, newCat],
      });
    }

    setNewlyCreatedCategoryId(generatedId);
    if (categoryManagerContext !== 'standalone') {
      setSyncModalOpen(false);
      setCategoryManagerContext('standalone');
    }
    return newCat;
  };

  const handleUpdateCategory = async (
    id: string,
    cat: { name: string; type: TransactionType; color: string; icon: string }
  ) => {
    try {
      const catPayload =
        masterKey && familyId
          ? await encryptCategory({ id, ...cat, isDefault: 0 }, masterKey, familyId)
          : cat;
      const res = await apiFetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catPayload),
      });
      if (res.ok) {
        const rawData = await res.json();
        const data =
          masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
        saveStateToCache(data);
      }
    } catch {
      saveStateToCache({
        ...state,
        categories: state.categories.map((c) => (c.id === id ? { ...c, ...cat, isDefault: 0 } : c)),
      });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const res = await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const rawData = await res.json();
        const data =
          masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
        saveStateToCache(data);
      }
    } catch {
      saveStateToCache({
        ...state,
        categories: state.categories.filter((c) => c.id !== id),
      });
    }
  };

  const handleExportBackup = () => {
    const payload = buildBackupPayload(state, { familyId, pendingOfflineTx });
    downloadBackupFile(payload);
    return payload.summary;
  };

  const handleImportBackup = async (
    backupData: unknown,
    mode: 'merge' | 'replace'
  ): Promise<{ warnings: string[]; offline: boolean }> => {
    const backup = parseBackupPayload(backupData);
    applyBackupPreferences(backup.preferences);

    try {
      const encrypted = await encryptBackupEntities(backup, masterKey, familyId);
      const res = await apiFetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, settings: backup.settings, ...encrypted }),
      });
      if (!res.ok) throw new Error(`Import failed (${res.status})`);
      const rawData = await res.json();
      const data =
        masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
      saveStateToCache(data);
      if (data?.settings?.theme) {
        document.documentElement.setAttribute('data-theme', data.settings.theme);
      }
      setIsOnlineWithServer(true);
      return { warnings: backup.warnings, offline: false };
    } catch (err) {
      console.error('[Backup] Remote restore failed, applying locally:', err);
      setIsOnlineWithServer(false);
      saveStateToCache(mergeBackupIntoState(state, backup, mode));
      return {
        warnings: [
          ...backup.warnings,
          language === 'pt-BR'
            ? 'Sem conexão com o servidor: dados restaurados apenas neste dispositivo.'
            : 'Server unreachable: data restored on this device only.',
        ],
        offline: true,
      };
    }
  };

  const handleResetAccount = async () => {
    try {
      const res = await apiFetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (res.ok) {
        const pendingKey = familyId ? `${STORAGE_PENDING_TX_KEY}_${familyId}` : STORAGE_PENDING_TX_KEY;
        localStorage.removeItem(pendingKey);
        setPendingOfflineTx([]);
        const rawData = await res.json();
        const data =
          masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
        saveStateToCache(data);
      }
    } catch {
      const pendingKey = familyId ? `${STORAGE_PENDING_TX_KEY}_${familyId}` : STORAGE_PENDING_TX_KEY;
      localStorage.removeItem(pendingKey);
      setPendingOfflineTx([]);
      saveStateToCache({
        ...state,
        settings: {
          ...state.settings,
          initialBalance: 0,
        },
        transactions: [],
        recurringTemplates: [],
        fuelLogs: [],
      });
    }
  };

  return {
    handleUpdateSettings,
    handleAddCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleExportBackup,
    handleImportBackup,
    handleResetAccount,
  };
}
