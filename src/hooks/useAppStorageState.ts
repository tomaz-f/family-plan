import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  AppLanguage,
  AppState,
  AppTheme,
  Category,
  Transaction,
} from '../types';
import {
  getStoredFamilyId,
  getStoredMasterKey,
} from '../services/tursoService';

export const STORAGE_STATE_KEY = 'familyplan_cached_state_v1';
export const STORAGE_PENDING_TX_KEY = 'familyplan_pending_tx_v1';

export const DEFAULT_CORE_CATEGORIES: Category[] = [
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

export const FALLBACK_STATE: AppState = {
  settings: {
    familyName: 'PRUMO',
    currency: 'BRL',
    language: 'pt-BR',
    theme: 'oled',
    initialBalance: 0,
    tankCapacity: 54,
    updatedAt: new Date().toISOString(),
  },
  categories: DEFAULT_CORE_CATEGORIES,
  transactions: [],
  recurringTemplates: [],
  creditCards: [],
};

export function splitInstallmentAmounts(totalAmount: number, totalInstallments: number): {
  firstAmount: number;
  regularAmount: number;
} {
  const count = Math.max(1, Math.round(totalInstallments));
  const totalCents = Math.round(Number(totalAmount || 0) * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;
  return {
    firstAmount: Number(((baseCents + remainderCents) / 100).toFixed(2)),
    regularAmount: Number((baseCents / 100).toFixed(2)),
  };
}

export function normalizeLegacyInstallmentTransactions(transactions: Transaction[]): {
  transactions: Transaction[];
  repaired: Transaction[];
} {
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return { transactions: [], repaired: [] };
  }
  const repaired: Transaction[] = [];
  const next = transactions.map((tx) => {
    const instTotal = Number(tx.installmentTotal || 0);
    if (instTotal > 1 && (!tx.totalPurchaseAmount || tx.totalPurchaseAmount <= 0)) {
      const totalVal = Number(tx.amount || 0);
      if (totalVal > 0) {
        const { firstAmount, regularAmount } = splitInstallmentAmounts(totalVal, instTotal);
        const instCur = Number(tx.installmentCurrent || 1);
        const fixedTx: Transaction = {
          ...tx,
          totalPurchaseAmount: totalVal,
          amount: instCur === 1 ? firstAmount : regularAmount,
        };
        repaired.push(fixedTx);
        return fixedTx;
      }
    }
    return tx;
  });
  return { transactions: next, repaired };
}

export function useAppStorageState() {
  const [familyId, setFamilyId] = useState<string | null>(() => getStoredFamilyId());
  const [masterKey, setMasterKey] = useState<string | null>(() => getStoredMasterKey());
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [authFamilyId, setAuthFamilyId] = useState<string | null>(null);

  const [state, setState] = useState<AppState>(() => {
    try {
      const fid = getStoredFamilyId();
      const key = fid ? `${STORAGE_STATE_KEY}_${fid}` : STORAGE_STATE_KEY;
      const cached = localStorage.getItem(key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (
          parsed?.settings?.familyName &&
          (parsed.settings.familyName.toUpperCase() === 'FAMILY PLAN' ||
            parsed.settings.familyName.toUpperCase() === 'FAMILY FINANCE')
        ) {
          parsed.settings.familyName = 'PRUMO';
        }
        if (parsed?.settings) {
          parsed.settings.theme = parsed.settings.theme === 'light' ? 'light' : 'oled';
        }
        if (Array.isArray(parsed?.transactions)) {
          if (
            parsed.transactions.length > 0 &&
            parsed.transactions.some(
              (tx: { description?: string }) => tx.description === '🔒 [Dado Cifrado]'
            )
          ) {
            parsed.transactions = [];
          } else {
            parsed.transactions = normalizeLegacyInstallmentTransactions(parsed.transactions).transactions;
          }
        }
        if (!parsed.categories || !Array.isArray(parsed.categories) || parsed.categories.length === 0) {
          parsed.categories = DEFAULT_CORE_CATEGORIES;
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return FALLBACK_STATE;
  });

  const [pendingOfflineTx, setPendingOfflineTx] = useState<Transaction[]>(() => {
    try {
      const fid = getStoredFamilyId();
      const key = fid ? `${STORAGE_PENDING_TX_KEY}_${fid}` : STORAGE_PENDING_TX_KEY;
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [];
  });

  const [isOnlineWithServer, setIsOnlineWithServer] = useState<boolean>(true);

  const stateRef = useRef<AppState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const language: AppLanguage = state.settings.language === 'en' ? 'en' : 'pt-BR';
  const theme: AppTheme = state.settings.theme === 'light' ? 'light' : 'oled';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('familyplan_theme', theme);
    } catch {
      // ignore quota errors
    }
  }, [theme]);

  const saveStateToCache = useCallback(
    (nextState: AppState) => {
      const normalizedName =
        nextState.settings?.familyName &&
        nextState.settings.familyName.toUpperCase() !== 'FAMILY PLAN' &&
        nextState.settings.familyName.toUpperCase() !== 'FAMILY FINANCE'
          ? nextState.settings.familyName
          : 'PRUMO';
      const normalizedTheme: AppTheme = nextState.settings?.theme === 'light' ? 'light' : 'oled';
      const { transactions: normalizedTransactions } = normalizeLegacyInstallmentTransactions(
        nextState.transactions || []
      );
      const normalizedCategories =
        Array.isArray(nextState.categories) && nextState.categories.length > 0
          ? nextState.categories
          : DEFAULT_CORE_CATEGORIES;
      const normalizedState: AppState = {
        ...nextState,
        categories: normalizedCategories,
        transactions: normalizedTransactions,
        settings: {
          ...nextState.settings,
          familyName: normalizedName,
          theme: normalizedTheme,
        },
      };

      const prevState = stateRef.current;
      const isSettingsSame = JSON.stringify(prevState.settings) === JSON.stringify(normalizedState.settings);
      const isCategoriesSame = JSON.stringify(prevState.categories) === JSON.stringify(normalizedState.categories);
      const isCreditCardsSame = JSON.stringify(prevState.creditCards) === JSON.stringify(normalizedState.creditCards);
      const isTransactionsSame = JSON.stringify(prevState.transactions) === JSON.stringify(normalizedState.transactions);
      const isFuelLogsSame = JSON.stringify(prevState.fuelLogs) === JSON.stringify(normalizedState.fuelLogs);
      const isRecurringSame = JSON.stringify(prevState.recurringTemplates) === JSON.stringify(normalizedState.recurringTemplates);

      if (!isSettingsSame || !isCategoriesSame || !isCreditCardsSame || !isTransactionsSame || !isFuelLogsSame || !isRecurringSame) {
        stateRef.current = normalizedState;
        setState(normalizedState);
      }
      try {
        const key = familyId ? `${STORAGE_STATE_KEY}_${familyId}` : STORAGE_STATE_KEY;
        localStorage.setItem(key, JSON.stringify(normalizedState));
      } catch {
        // ignore quota errors
      }
    },
    [familyId]
  );

  const currentBankBalance = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const tx of state.transactions) {
      if (tx.status === 'unpaid' || tx.cardId) continue;
      if (tx.type === 'income') inc += tx.amount;
      else exp += tx.amount;
    }
    return state.settings.initialBalance + inc - exp;
  }, [state.transactions, state.settings.initialBalance]);

  return {
    familyId,
    setFamilyId,
    masterKey,
    setMasterKey,
    authErrorMessage,
    setAuthErrorMessage,
    authFamilyId,
    setAuthFamilyId,
    state,
    setState,
    stateRef,
    pendingOfflineTx,
    setPendingOfflineTx,
    isOnlineWithServer,
    setIsOnlineWithServer,
    language,
    theme,
    saveStateToCache,
    currentBankBalance,
  };
}
