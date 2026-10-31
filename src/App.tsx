import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard,
  ListOrdered,
  CreditCard as CreditCardIcon,
  Fuel,
  ChevronLeft,
  ChevronRight,
  Settings,
  Sun,
  Moon,
  Sparkles,
  Languages,
  Plus,
  Minus,
  PieChart as PieChartIcon,
  FileText,
  FileSpreadsheet,
  Menu,
  Download,
} from 'lucide-react';
import {
  AppLanguage,
  AppState,
  AppTheme,
  Category,
  CreditCard,
  FuelType,
  Transaction,
  TransactionStatus,
  TransactionType,
} from './types';
import {
  computeCardFirstInvoiceMonth,
  computeInvoiceDueDate,
  formatMonthLabel,
  formatShortMonthLabel,
  getCurrentMonthStr,
  getTodayDateStr,
  shiftMonth,
} from './utils/format';
import { TRANSLATIONS } from './utils/i18n';
import {
  applyBackupPreferences,
  buildBackupPayload,
  downloadBackupFile,
  mergeBackupIntoState,
  parseBackupPayload,
} from './utils/backup';
import {
  exportFilteredHistoryToCSV,
  exportFilteredHistoryToPDF,
} from './utils/exportReport';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { CreditCardsView } from './components/CreditCardsView';
import { FuelView } from './components/FuelView';
import { ReportsView } from './components/ReportsView';
import { TransactionModal } from './components/TransactionModal';
import { BalanceModal } from './components/BalanceModal';
import { MobileSyncModal } from './components/MobileSyncModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FamilyOnboardingScreen } from './components/FamilyOnboardingScreen';
import { PrumoLogoIcon } from './components/PrumoLogoIcon';
import {
  getStoredFamilyId,
  clearStoredFamilyId,
  getStoredMasterKey,
  clearStoredMasterKey,
  apiFetch,
  decryptFullState,
  encryptTransaction,
  encryptCategory,
  encryptCreditCard,
  encryptFuelLog,
  encryptRecurringTemplate,
  encryptPayload,
} from './services/tursoService';
import {
  SeriesConfirmModal,
  SeriesScope,
  isPartOfSeries,
  getSubsequentPendingSeriesTransactions,
} from './components/SeriesConfirmModal';

const STORAGE_STATE_KEY = 'familyplan_cached_state_v1';
const STORAGE_PENDING_TX_KEY = 'familyplan_pending_tx_v1';

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

const FALLBACK_STATE: AppState = {
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

function splitInstallmentAmounts(totalAmount: number, totalInstallments: number): {
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

function normalizeLegacyInstallmentTransactions(transactions: Transaction[]): {
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

export const App: React.FC = () => {
  const [familyId, setFamilyId] = useState<string | null>(() => getStoredFamilyId());
  const [masterKey, setMasterKey] = useState<string | null>(() => getStoredMasterKey());

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
          parsed.transactions = normalizeLegacyInstallmentTransactions(parsed.transactions).transactions;
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'cards' | 'fuel' | 'reports'>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());

  // Modals & Contextual FAB State
  const [txModalOpen, setTxModalOpen] = useState<boolean>(false);
  const [txModalInitialType, setTxModalInitialType] = useState<TransactionType>('expense');
  const [txModalInitialCardId, setTxModalInitialCardId] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingSeriesTx, setDeletingSeriesTx] = useState<Transaction | null>(null);
  const [balanceModalOpen, setBalanceModalOpen] = useState<boolean>(false);
  const [syncModalOpen, setSyncModalOpen] = useState<boolean>(false);
  const [syncModalTab, setSyncModalTab] = useState<'mobile' | 'settings' | 'categories' | 'export' | 'backup'>('settings');
  const [headerMenuOpen, setHeaderMenuOpen] = useState<boolean>(false);
  const [fabMenuOpen, setFabMenuOpen] = useState<boolean>(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [openRefuelTrigger, setOpenRefuelTrigger] = useState<number>(0);

  const language: AppLanguage = state.settings.language === 'en' ? 'en' : 'pt-BR';
  const theme: AppTheme = state.settings.theme === 'light' ? 'light' : 'oled';

  const t = TRANSLATIONS[language];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('familyplan_theme', theme);
    } catch {}
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
      setState(normalizedState);
      try {
        const key = familyId ? `${STORAGE_STATE_KEY}_${familyId}` : STORAGE_STATE_KEY;
        localStorage.setItem(key, JSON.stringify(normalizedState));
      } catch {
        // ignore quota errors
      }
    },
    [familyId]
  );

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
    setState(FALLBACK_STATE);
  }, []);

  const syncWithServer = useCallback(async () => {
    if (!familyId) return;
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
        let pendingToSend = pending;
        if (masterKey) {
          pendingToSend = await Promise.all(
            pending.map((p) => encryptTransaction(p, masterKey, familyId)) as any
          );
        }
        const res = await apiFetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pendingTransactions: pendingToSend }),
        });
        if (res.ok) {
          const rawData: any = await res.json();
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

      // Persist any auto-repaired legacy installment rows back to Turso so they are permanently fixed
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
    } catch {
      setIsOnlineWithServer(false);
    }
  }, [familyId, masterKey, saveStateToCache]);

  useEffect(() => {
    syncWithServer();
    const interval = setInterval(syncWithServer, 15000);
    return () => clearInterval(interval);
  }, [syncWithServer]);

  // Automatic Pending Invoice Sync for Closed Card Invoices (Cash Flow Forecast)
  useEffect(() => {
    if (!state.creditCards || state.creditCards.length === 0) return;

    const todayStr = getTodayDateStr();
    const todayYm = todayStr.slice(0, 7);
    const todayDay = Number(todayStr.slice(8, 10)) || 1;

    let hasChanges = false;
    let nextTxs = [...state.transactions];
    const txsToSaveToServer: Transaction[] = [];
    const txsToUpdateOnServer: Transaction[] = [];
    const idsToDeleteOnServer: string[] = [];

    const getTxInvoiceMonth = (tx: Transaction, card: CreditCard): string => {
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
    };

    for (const card of state.creditCards) {
      const cardTxs = state.transactions.filter((tx) => tx.cardId === card.id);
      const invoiceMonths = new Set<string>();
      for (const tx of cardTxs) {
        invoiceMonths.add(getTxInvoiceMonth(tx, card));
      }

      for (const invMonth of invoiceMonths) {
        const isClosed =
          invMonth < todayYm || (invMonth === todayYm && todayDay >= card.closingDay);

        if (!isClosed) continue;

        const cycleTxs = cardTxs.filter((tx) => getTxInvoiceMonth(tx, card) === invMonth);
        const cycleTotal = Number(
          cycleTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0).toFixed(2)
        );
        const settlementKey = `${card.id}__${invMonth}`;
        const existingTx = nextTxs.find((tx) => tx.settledInvoiceKey === settlementKey);

        if (existingTx) {
          // Keep unpaid invoice aligned with cycle purchases
          if (existingTx.status === 'unpaid') {
            if (cycleTotal <= 0) {
              nextTxs = nextTxs.filter((tx) => tx.id !== existingTx.id);
              idsToDeleteOnServer.push(existingTx.id);
              hasChanges = true;
            } else if (
              Math.abs(existingTx.amount - cycleTotal) > 0.001 ||
              existingTx.description !== `Fatura ${card.name}`
            ) {
              const updated: Transaction = {
                ...existingTx,
                amount: cycleTotal,
                description: `Fatura ${card.name}`,
                notes: `Fatura fechada (${cycleTxs.length} compras)`,
              };
              nextTxs = nextTxs.map((tx) => (tx.id === existingTx.id ? updated : tx));
              txsToUpdateOnServer.push(updated);
              hasChanges = true;
            }
          }
        } else if (cycleTotal > 0) {
          // If all card purchases in this cycle are already paid, do not recreate an unpaid invoice
          const hasUnpaidPurchases = cycleTxs.some((tx) => (tx.status || 'paid') === 'unpaid');
          if (!hasUnpaidPurchases) continue;

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

          const dueDate = computeInvoiceDueDate(invMonth, card.closingDay, card.dueDay);

          const newPendingTx: Transaction = {
            id: `tx-fatura-${card.id}-${invMonth}`,
            type: 'expense',
            status: 'unpaid',
            amount: cycleTotal,
            description: `Fatura ${card.name}`,
            categoryId: invoiceCategory?.id || 'exp-bills',
            date: dueDate,
            notes: `Fatura fechada (${cycleTxs.length} compras)`,
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

    if (hasChanges) {
      saveStateToCache({
        ...state,
        transactions: nextTxs,
      });

      (async () => {
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
      })();
    }
  }, [state.creditCards, state.transactions, state.categories, masterKey, familyId, saveStateToCache]);

  // Balance Impact Rule: Only transactions marked as 'paid' and not credit card purchases affect the current bank balance
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

  const handleOpenAddModal = (type: TransactionType, cardId?: string) => {
    setEditingTx(null);
    setTxModalInitialType(type);
    setTxModalInitialCardId(cardId || null);
    setTxModalOpen(true);
  };

  const handleOpenEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setTxModalInitialType(tx.type);
    setTxModalInitialCardId(tx.cardId || null);
    setTxModalOpen(true);
  };

  const handleSaveTransaction = async (
    txData: {
      id?: string;
      type: TransactionType;
      status: TransactionStatus;
      amount: number;
      totalPurchaseAmount?: number | null;
      description: string;
      categoryId: string;
      date: string;
      notes: string;
      dueDay?: number | null;
      installmentCurrent?: number | null;
      installmentTotal?: number | null;
      recurringId?: string | null;
      cardId?: string | null;
      invoiceMonth?: string | null;
      purchaseDate?: string | null;
    },
    recurringPlan?: {
      mode: 'recurring' | 'installment';
      dayOfMonth: number;
      totalInstallments?: number;
      currentInstallment?: number;
      startMonth?: string;
    },
    scope: SeriesScope = 'single'
  ) => {
    const txId = txData.id || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const generatedRecId =
      !txData.id && recurringPlan
        ? `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        : txData.recurringId || null;

    const isInstallmentSeries = Boolean(txData.installmentTotal && txData.installmentTotal > 1);
    const seriesTotalPurchaseAmount = isInstallmentSeries
      ? txData.totalPurchaseAmount && txData.totalPurchaseAmount > 0
        ? txData.totalPurchaseAmount
        : Number((txData.amount * (txData.installmentTotal || 1)).toFixed(2))
      : null;

    const installmentSplit =
      isInstallmentSeries && seriesTotalPurchaseAmount
        ? splitInstallmentAmounts(seriesTotalPurchaseAmount, txData.installmentTotal || 1)
        : null;

    const initialInstallmentAmount = installmentSplit
      ? (txData.installmentCurrent || 1) === 1
        ? installmentSplit.firstAmount
        : installmentSplit.regularAmount
      : txData.amount;

    const fullTx: Transaction = {
      id: txId,
      type: txData.type,
      status: txData.status,
      amount: initialInstallmentAmount,
      totalPurchaseAmount: seriesTotalPurchaseAmount,
      description: txData.description,
      categoryId: txData.categoryId,
      date: txData.date,
      notes: txData.notes,
      dueDay: txData.dueDay || null,
      installmentCurrent: txData.installmentCurrent || null,
      installmentTotal: txData.installmentTotal || null,
      recurringId: generatedRecId,
      cardId: txData.cardId || null,
      invoiceMonth: txData.invoiceMonth || null,
      purchaseDate: txData.purchaseDate || txData.date,
      createdAt: new Date().toISOString(),
    };

    // Build future 'unpaid' entries automatically for new installment or recurring entries
    const futureEntries: Transaction[] = [];
    if (!txData.id && recurringPlan && generatedRecId) {
      const baseMonth = txData.date.slice(0, 7);
      const dayOfMonth = Math.min(31, Math.max(1, recurringPlan.dayOfMonth || 10));

      const formatMonthDay = (monthStr: string, day: number) => {
        const [y, m] = monthStr.split('-').map(Number);
        const maxDay = new Date(y, m, 0).getDate() || 28;
        const clamped = Math.min(day, maxDay);
        return `${monthStr}-${String(clamped).padStart(2, '0')}`;
      };

      if (recurringPlan.mode === 'installment' && recurringPlan.totalInstallments) {
        const startCur = recurringPlan.currentInstallment || 1;
        const total = recurringPlan.totalInstallments;
        const baseInvMonth = txData.invoiceMonth || baseMonth;
        const split =
          installmentSplit ||
          splitInstallmentAmounts(
            seriesTotalPurchaseAmount || txData.amount * total,
            total
          );
        for (let step = 1; startCur + step <= total; step++) {
          const instNum = startCur + step;
          const fInvoiceMonth = shiftMonth(baseInvMonth, step);
          const fMonth = fInvoiceMonth;
          futureEntries.push({
            id: `tx-${Date.now()}-${step}-${Math.random().toString(36).slice(2, 7)}`,
            type: txData.type,
            status: 'unpaid',
            amount: instNum === 1 ? split.firstAmount : split.regularAmount,
            totalPurchaseAmount: seriesTotalPurchaseAmount,
            description: txData.description,
            categoryId: txData.categoryId,
            date: formatMonthDay(fMonth, dayOfMonth),
            notes: txData.notes,
            dueDay: dayOfMonth,
            installmentCurrent: instNum,
            installmentTotal: total,
            recurringId: generatedRecId,
            cardId: txData.cardId || null,
            invoiceMonth: txData.cardId ? fInvoiceMonth : null,
            purchaseDate: txData.purchaseDate || txData.date,
            createdAt: new Date().toISOString(),
          });
        }
      } else if (recurringPlan.mode === 'recurring') {
        // Pre-populate the next 11 months as 'unpaid' so they appear in future statements
        for (let step = 1; step <= 11; step++) {
          const fMonth = shiftMonth(baseMonth, step);
          futureEntries.push({
            id: `tx-${Date.now()}-${step}-${Math.random().toString(36).slice(2, 7)}`,
            type: txData.type,
            status: 'unpaid',
            amount: txData.amount,
            description: txData.description,
            categoryId: txData.categoryId,
            date: formatMonthDay(fMonth, dayOfMonth),
            notes: txData.notes,
            dueDay: dayOfMonth,
            installmentCurrent: null,
            installmentTotal: null,
            recurringId: generatedRecId,
            cardId: txData.cardId || null,
            invoiceMonth: txData.cardId ? shiftMonth(txData.invoiceMonth || baseMonth, step) : null,
            purchaseDate: txData.purchaseDate || txData.date,
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // Compute updated series entries on the client when editing a series (scope === 'future')
    const updatedSeriesEntries: Transaction[] = [];
    if (txData.id && scope === 'future') {
      const originalTx = state.transactions.find((tx) => tx.id === txData.id);
      if (originalTx) {
        const relatedTxs = getSubsequentPendingSeriesTransactions(originalTx, state.transactions);
        for (const relTx of relatedTxs) {
          let nextRowDate = relTx.date;
          if (fullTx.dueDay && relTx.date && relTx.date.length >= 7) {
            const monthPrefix = relTx.date.slice(0, 7);
            const [ry, rm] = monthPrefix.split('-').map(Number);
            const maxDay = new Date(ry, rm, 0).getDate() || 28;
            const clampedDay = Math.min(fullTx.dueDay, maxDay);
            nextRowDate = `${monthPrefix}-${String(clampedDay).padStart(2, '0')}`;
          }
          const relInstCur = relTx.installmentCurrent || 1;
          const relAmount = installmentSplit
            ? relInstCur === 1
              ? installmentSplit.firstAmount
              : installmentSplit.regularAmount
            : fullTx.amount;
          updatedSeriesEntries.push({
            ...relTx,
            type: fullTx.type,
            amount: relAmount,
            totalPurchaseAmount: seriesTotalPurchaseAmount,
            description: fullTx.description,
            categoryId: fullTx.categoryId,
            date: nextRowDate,
            notes: fullTx.notes,
            dueDay: fullTx.dueDay ?? relTx.dueDay,
            installmentTotal: fullTx.installmentTotal ?? relTx.installmentTotal,
            cardId: fullTx.cardId !== undefined ? fullTx.cardId : relTx.cardId,
            purchaseDate: fullTx.purchaseDate || relTx.purchaseDate,
          });
        }
      }
    }

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
        };
        const recPayload =
          masterKey && familyId
            ? await encryptRecurringTemplate(rawRec as any, masterKey, familyId)
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

      let txPayload: any = {
        ...fullTx,
        scope,
        futureEntries: futureEntries.length > 0 ? futureEntries : undefined,
        updatedSeriesEntries: updatedSeriesEntries.length > 0 ? updatedSeriesEntries : undefined,
      };

      if (masterKey && familyId) {
        const encFullTx = await encryptTransaction(fullTx, masterKey, familyId);
        let encFuture: any = undefined;
        if (futureEntries.length > 0) {
          encFuture = await Promise.all(
            futureEntries.map((f) => encryptTransaction(f, masterKey, familyId))
          );
        }
        let encUpdatedSeries: any = undefined;
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
    } catch {
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

      const nextState: AppState = {
        ...state,
        transactions: nextTransactions,
      };
      saveStateToCache(nextState);

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
    const nextStatus: TransactionStatus = tx.status === 'unpaid' ? 'paid' : 'unpaid';
    const updatedTx: Transaction = { ...tx, status: nextStatus };

    let nextTransactions = state.transactions.map((item) => (item.id === tx.id ? updatedTx : item));
    const cycleTxsToSync: Transaction[] = [];

    // If this transaction is a consolidated card invoice, synchronize all card purchases for this cycle
    if (tx.settledInvoiceKey) {
      const [cardId, invoiceMonth] = tx.settledInvoiceKey.split('__');
      const card = (state.creditCards || []).find((c) => c.id === cardId);
      if (card) {
        nextTransactions = nextTransactions.map((item) => {
          if (item.cardId === cardId) {
            const firstMonth = computeCardFirstInvoiceMonth(
              item.purchaseDate || item.date,
              card.closingDay
            ).invoiceMonth;
            const m =
              item.invoiceMonth ||
              (item.installmentTotal && item.installmentTotal > 1 && item.installmentCurrent && item.installmentCurrent > 1
                ? shiftMonth(firstMonth, item.installmentCurrent - 1)
                : firstMonth);
            if (m === invoiceMonth) {
              cycleTxsToSync.push({ ...item, status: nextStatus });
              return { ...item, status: nextStatus };
            }
          }
          return item;
        });
      }
    }

    // Optimistic UI update so balance & badge respond immediately
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

      // Synchronize associated credit card purchase statuses
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

    // Optimistic local state + pending offline queue cleanup
    const optimisticState: AppState = {
      ...state,
      transactions: state.transactions.filter((tx) => !idsToDelete.has(tx.id)),
    };
    saveStateToCache(optimisticState);

    if (pendingOfflineTx.some((p) => idsToDelete.has(p.id))) {
      const nextPending = pendingOfflineTx.filter((p) => !idsToDelete.has(p.id));
      setPendingOfflineTx(nextPending);
      const pendingKey = familyId ? `${STORAGE_PENDING_TX_KEY}_${familyId}` : STORAGE_PENDING_TX_KEY;
      try {
        localStorage.setItem(pendingKey, JSON.stringify(nextPending));
      } catch {}
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

  const handleUpdateSettings = async (payload: {
    familyName?: string;
    currency?: string;
    language?: AppLanguage;
    theme?: AppTheme;
    initialBalance?: number;
    tankCapacity?: number;
    targetCurrentBalance?: number;
  }) => {
    // Immediate optimistic update for responsive UI (theme, language, familyName, etc.)
    if (payload.theme) {
      document.documentElement.setAttribute('data-theme', payload.theme);
      try {
        localStorage.setItem('familyplan_theme', payload.theme);
      } catch {}
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

  const handleCycleTheme = () => {
    const next: AppTheme = theme === 'oled' ? 'light' : 'oled';
    handleUpdateSettings({ theme: next });
  };

  const handleToggleLanguage = () => {
    const nextLang: AppLanguage = language === 'pt-BR' ? 'en' : 'pt-BR';
    handleUpdateSettings({ language: nextLang });
  };

  const handleAddCategory = async (cat: {
    name: string;
    type: TransactionType;
    color: string;
    icon: string;
  }) => {
    try {
      const catPayload =
        masterKey && familyId ? await encryptCategory(cat as any, masterKey, familyId) : cat;
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
      }
    } catch {
      const newCat = {
        id: `cat-${Date.now()}`,
        ...cat,
        isDefault: 0,
      };
      saveStateToCache({
        ...state,
        categories: [...state.categories, newCat],
      });
    }
  };

  const handleUpdateCategory = async (
    id: string,
    cat: { name: string; type: TransactionType; color: string; icon: string }
  ) => {
    try {
      const catPayload =
        masterKey && familyId
          ? await encryptCategory({ id, ...cat } as any, masterKey, familyId)
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

  const handleCreateRecurring = async (tpl: {
    type: TransactionType;
    amount: number;
    description: string;
    categoryId: string;
    dayOfMonth: number;
    isInstallment?: boolean;
    totalInstallments?: number;
    startMonth?: string;
  }) => {
    const tplPayload =
      masterKey && familyId
        ? await encryptRecurringTemplate(tpl as any, masterKey, familyId)
        : tpl;
    const res = await apiFetch('/api/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tplPayload),
    });
    if (res.ok) {
      const rawData = await res.json();
      const data =
        masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
      saveStateToCache(data);
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    const res = await apiFetch(`/api/recurring/${id}`, { method: 'DELETE' });
    if (res.ok) {
      const rawData = await res.json();
      const data =
        masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
      saveStateToCache(data);
    }
  };

  const handleApplySingleRecurring = async (id: string, month: string) => {
    const res = await apiFetch(`/api/recurring/${id}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month }),
    });
    if (res.ok) {
      const rawData = await res.json();
      const data =
        masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
      saveStateToCache(data);
    }
  };

  const handleApplyAllRecurring = async (month: string) => {
    const res = await apiFetch('/api/recurring/apply-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month }),
    });
    if (res.ok) {
      const rawData = await res.json();
      const data =
        masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
      saveStateToCache(data);
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
    // 1. Validate + normalize (accepts legacy v1 and full v2 backups)
    const backup = parseBackupPayload(backupData);

    // 2. Zero-Knowledge pipeline: every sensitive entity is encrypted on this device
    //    before leaving the browser. Card links (cardId, invoiceMonth, purchaseDate,
    //    settledInvoiceKey) travel inside the encrypted transaction payload.
    const encryptAll = async () => {
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
    };

    applyBackupPreferences(backup.preferences);

    try {
      const encrypted = await encryptAll();
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
      if (data?.settings?.theme) document.documentElement.setAttribute('data-theme', data.settings.theme);
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
      // JSON content-type is required by the server's anti-CSRF guard
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

  const handleSaveFuelLog = async (fuelData: {
    id?: string;
    date: string;
    odometer: number;
    pricePerLiter: number;
    totalCost: number;
    liters: number;
    fuelType: FuelType;
    stationName: string;
    isFullTank: boolean;
    notes?: string;
  }) => {
    const fuelId = fuelData.id || `fuel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const txId = `tx-fuel-${fuelId}`;
    const fuelLabel =
      language === 'pt-BR'
        ? fuelData.fuelType === 'ethanol'
          ? 'Etanol'
          : 'Gasolina'
        : fuelData.fuelType === 'ethanol'
        ? 'Ethanol'
        : 'Gasoline';
    const baseDesc = language === 'pt-BR' ? `Abastecimento (${fuelLabel})` : `Refueling (${fuelLabel})`;
    const txDesc = `${baseDesc}${fuelData.stationName ? ` - ${fuelData.stationName}` : ''}${fuelData.liters ? ` [${Number(fuelData.liters).toFixed(2)}L]` : ''}`;

    const linkedTx: Transaction = {
      id: txId,
      type: 'expense',
      status: 'paid',
      amount: Number(fuelData.totalCost || 0),
      description: txDesc,
      categoryId: 'exp-transport',
      date: fuelData.date,
      notes: `${fuelData.odometer} km • ${fuelData.pricePerLiter}/L`,
      createdAt: new Date().toISOString(),
    };

    const fullFuelLog = {
      id: fuelId,
      ...fuelData,
      transactionId: txId,
      createdAt: new Date().toISOString(),
    };

    // Optimistic UI update for immediate response on balance, charts, and extrato
    const prevFuel = state.fuelLogs || [];
    const nextFuel = fuelData.id
      ? prevFuel.map((f) => (f.id === fuelData.id ? fullFuelLog : f))
      : [fullFuelLog, ...prevFuel];
    const nextTx = state.transactions.some((tx) => tx.id === txId)
      ? state.transactions.map((tx) => (tx.id === txId ? linkedTx : tx))
      : [linkedTx, ...state.transactions];

    saveStateToCache({
      ...state,
      fuelLogs: nextFuel,
      transactions: nextTx,
    });

    try {
      let fuelPayload: any;
      if (masterKey && familyId) {
        const encFuel = await encryptFuelLog(fullFuelLog as any, masterKey, familyId);
        const encTx = await encryptTransaction(linkedTx, masterKey, familyId);
        fuelPayload = {
          ...encFuel,
          transactionId: txId,
          transaction: encTx,
        };
      } else {
        fuelPayload = {
          ...fullFuelLog,
          transaction: linkedTx,
        };
      }

      const url = fuelData.id ? `/api/fuel/${fuelData.id}` : '/api/fuel';
      const method = fuelData.id ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fuelPayload),
      });
      if (res.ok) {
        const rawData = await res.json();
        const data =
          masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
        saveStateToCache(data);
      }
      setIsOnlineWithServer(true);
    } catch {
      setIsOnlineWithServer(false);
      // Fallback state already cached optimistically above
    }
  };

  const handleDeleteFuelLog = async (id: string) => {
    const target = (state.fuelLogs || []).find((f) => f.id === id);
    const txId = target?.transactionId || `tx-fuel-${id}`;

    // Optimistic UI update removing fuel log and associated expense transaction
    saveStateToCache({
      ...state,
      fuelLogs: (state.fuelLogs || []).filter((f) => f.id !== id),
      transactions: state.transactions.filter((tx) => tx.id !== txId && tx.id !== `tx-fuel-${id}`),
    });

    try {
      const res = await apiFetch(`/api/fuel/${id}`, { method: 'DELETE' });
      if (res.ok) {
        const rawData = await res.json();
        const data =
          masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
        saveStateToCache(data);
      }
      setIsOnlineWithServer(true);
    } catch {
      setIsOnlineWithServer(false);
    }
  };

  const handleSaveCard = async (cardData: Partial<CreditCard> & { name: string; totalLimit: number; closingDay: number; dueDay: number }) => {
    try {
      const cardPayload =
        masterKey && familyId
          ? await encryptCreditCard(cardData as any, masterKey, familyId)
          : cardData;
      const url = cardData.id ? `/api/cards/${cardData.id}` : '/api/cards';
      const method = cardData.id ? 'PUT' : 'POST';
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardPayload),
      });
      if (!res.ok) throw new Error('Failed');
      const rawData: AppState = await res.json();
      const data =
        masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
      saveStateToCache(data);
    } catch {
      const prevCards = state.creditCards || [];
      const newCard: CreditCard = {
        id: cardData.id || `card-${Date.now()}`,
        name: cardData.name,
        totalLimit: cardData.totalLimit,
        closingDay: cardData.closingDay,
        dueDay: cardData.dueDay,
        brand: cardData.brand || 'mastercard',
        color: cardData.color || '#6366f1',
        lastDigits: cardData.lastDigits || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const nextCards = cardData.id
        ? prevCards.map((c) => (c.id === cardData.id ? newCard : c))
        : [...prevCards, newCard];
      saveStateToCache({
        ...state,
        creditCards: nextCards,
      });
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      const res = await apiFetch(`/api/cards/${cardId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      const rawData: AppState = await res.json();
      const data =
        masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
      saveStateToCache(data);
    } catch {
      saveStateToCache({
        ...state,
        creditCards: (state.creditCards || []).filter((c) => c.id !== cardId),
      });
    }
  };

  const handlePayCardInvoice = async (cardId: string, invoiceMonth: string) => {
    const card = (state.creditCards || []).find((c) => c.id === cardId);
    if (!card) return;

    const getTxInvoiceMonth = (tx: Transaction): string => {
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
    };

    const cardTxs = state.transactions.filter((tx) => {
      if (tx.cardId !== cardId) return false;
      return getTxInvoiceMonth(tx) === invoiceMonth;
    });

    const total = Number(cardTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0).toFixed(2));
    if (total <= 0) return;

    const settlementKey = `${cardId}__${invoiceMonth}`;
    const todayStr = getTodayDateStr();

    // Check if a pending or existing invoice transaction with this settlementKey already exists to prevent duplicate entries
    const existingSettlementTx = state.transactions.find(
      (tx) => tx.settledInvoiceKey === settlementKey
    );

    // Standardize Category for invoice payment:
    // Prefer "Cartão de Crédito" or "Contas / Fatura" or fallback to "Contas" (exp-bills) or "Outros" (exp-other)
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
      state.categories.find((c) => c.id === 'exp-other');

    const settlementTx: Transaction = existingSettlementTx
      ? {
          ...existingSettlementTx,
          status: 'paid',
          amount: total,
          description: `Pagamento de Fatura - ${card.name}`,
          date: todayStr,
          notes: `Pagamento de fatura consolidada (${cardTxs.length} compras)`,
        }
      : {
          id: `tx-fatura-${cardId}-${invoiceMonth}`,
          type: 'expense',
          status: 'paid',
          amount: total,
          description: `Pagamento de Fatura - ${card.name}`,
          categoryId: invoiceCategory?.id || 'exp-bills',
          date: todayStr,
          notes: `Pagamento de fatura consolidada (${cardTxs.length} compras)`,
          dueDay: card.dueDay,
          cardId: null,
          settledInvoiceKey: settlementKey,
          createdAt: new Date().toISOString(),
        };

    const cardTxIds = new Set(cardTxs.map((t) => t.id));
    const optimisticTxs = [
      settlementTx,
      ...state.transactions
        .filter((tx) => tx.id !== settlementTx.id && tx.settledInvoiceKey !== settlementKey)
        .map((tx) => (cardTxIds.has(tx.id) ? { ...tx, status: 'paid' as TransactionStatus } : tx)),
    ];
    saveStateToCache({
      ...state,
      transactions: optimisticTxs,
    });

    try {
      const txPayload =
        masterKey && familyId
          ? await encryptTransaction(settlementTx, masterKey, familyId)
          : settlementTx;

      if (existingSettlementTx) {
        await apiFetch(`/api/transactions/${existingSettlementTx.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(txPayload),
        });
      } else {
        await apiFetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(txPayload),
        });
      }

      for (const cTx of cardTxs) {
        if (cTx.status !== 'paid') {
          await apiFetch(`/api/transactions/${cTx.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'paid' }),
          });
        }
      }
      const res = await apiFetch('/api/state');
      if (res.ok) {
        const rawData: AppState = await res.json();
        const data =
          masterKey && familyId ? await decryptFullState(rawData, masterKey, familyId) : rawData;
        saveStateToCache(data);
      }
    } catch {
      // Optimistic state is already cached above
    }
  };

  const themeBadgeLabel = theme === 'light' ? t.themeLight : t.themeOled;
  void themeBadgeLabel;

  const buildCurrentMonthExportOptions = useCallback(
    () => ({
      periodMode: 'monthly' as const,
      year: selectedMonth.slice(0, 4),
      month: selectedMonth.slice(5, 7),
      typeFilter: 'all' as const,
      familyName: state.settings.familyName,
      currency: state.settings.currency,
      language,
      initialBalance: state.settings.initialBalance,
      categories: state.categories,
      transactions: state.transactions,
      fuelLogs: state.fuelLogs || [],
    }),
    [
      selectedMonth,
      state.settings.familyName,
      state.settings.currency,
      state.settings.initialBalance,
      state.categories,
      state.transactions,
      state.fuelLogs,
      language,
    ]
  );

  const handleExportMonthlyPDF = () => {
    setFabMenuOpen(false);
    exportFilteredHistoryToPDF(buildCurrentMonthExportOptions());
  };

  const handleExportMonthlySpreadsheet = () => {
    setFabMenuOpen(false);
    exportFilteredHistoryToCSV(buildCurrentMonthExportOptions());
  };

  if (!familyId || !masterKey) {
    return (
      <FamilyOnboardingScreen
        onJoined={(newId, newKey) => {
          setFamilyId(newId);
          setMasterKey(newKey);
        }}
      />
    );
  }

  return (
    <div className="app-shell min-h-[100dvh] w-full flex flex-col bg-[#F8FAFC] text-slate-900 pb-28 transition-colors">
      {/* TOP NAVIGATION HEADER (Mobile-First Centered Container) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 print:hidden pt-[env(safe-area-inset-top,0px)]">
        <div className="max-w-lg w-full mx-auto px-4 h-16 flex items-center justify-between gap-2">
          {/* Brand */}
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center gap-2.5 shrink-0 cursor-pointer select-none text-left focus:outline-none group py-1 -my-1 min-h-[44px]"
            title="Prumo - Início"
          >
            <PrumoLogoIcon className="h-8 w-auto shrink-0 select-none drop-shadow-xs" />
            <div className="shrink-0">
              <span className="text-base font-black tracking-[0.14em] uppercase text-slate-900 group-hover:text-[#D0B595] transition-colors block leading-none whitespace-nowrap">
                {state.settings.familyName &&
                state.settings.familyName.toUpperCase() !== 'FAMILY PLAN' &&
                state.settings.familyName.toUpperCase() !== 'FAMILY FINANCE'
                  ? state.settings.familyName
                  : 'PRUMO'}
              </span>
            </div>
          </button>

          {/* Month Selector & Quick Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Compact Month Switcher with generous touch targets */}
            <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200/50 min-h-[44px]">
              <button
                type="button"
                onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white active:scale-95 transition-all"
                title={t.prevMonth}
              >
                <ChevronLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => setSelectedMonth(getCurrentMonthStr())}
                className="px-2 py-1 text-xs font-bold text-slate-800 hover:text-[#D0B595] active:scale-95 transition-all min-w-[78px] text-center capitalize"
                title={t.jumpCurrentMonth}
              >
                <span>{formatShortMonthLabel(selectedMonth, language)}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white active:scale-95 transition-all"
                title={t.nextMonth}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Hamburger Menu & Telegram-Style Floating Dropdown */}
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setHeaderMenuOpen((prev) => !prev)}
                className="w-10 h-10 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 active:opacity-75 transition-all shadow-xs shrink-0"
                title={language === 'pt-BR' ? 'Menu e Configurações' : 'Menu & Settings'}
                aria-expanded={headerMenuOpen}
                aria-haspopup="menu"
              >
                <Menu size={20} />
              </button>

              {headerMenuOpen && (
                <>
                  {/* Invisible click-outside backdrop */}
                  <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setHeaderMenuOpen(false)}
                  />

                  {/* Telegram-style dropdown popover */}
                  <div
                    role="menu"
                    className="telegram-dropdown-menu absolute right-0 top-full mt-2 min-w-[215px] py-1.5 rounded-2xl border shadow-2xl z-50 flex flex-col"
                  >
                    {/* 1. Theme Toggle: Modo Claro / Modo OLED */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        const nextTheme: AppTheme = theme === 'oled' ? 'light' : 'oled';
                        handleUpdateSettings({ theme: nextTheme });
                        setHeaderMenuOpen(false);
                      }}
                      className="telegram-dropdown-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-colors min-h-[44px]"
                    >
                      {theme === 'oled' ? (
                        <Sun size={18} className="text-amber-400 shrink-0" />
                      ) : (
                        <Moon size={18} className="text-slate-600 shrink-0" />
                      )}
                      <span>
                        {theme === 'oled'
                          ? language === 'pt-BR'
                            ? 'Modo Claro'
                            : 'Light Mode'
                          : language === 'pt-BR'
                          ? 'Modo OLED'
                          : 'OLED Mode'}
                      </span>
                    </button>

                    {/* 2. Configurações */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        setSyncModalTab('settings');
                        setSyncModalOpen(true);
                      }}
                      className="telegram-dropdown-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-colors min-h-[44px]"
                    >
                      <Settings size={18} className="text-slate-400 shrink-0" />
                      <span>{language === 'pt-BR' ? 'Configurações' : 'Settings'}</span>
                    </button>

                    {/* 3. Exportar Dados */}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        setSyncModalTab('export');
                        setSyncModalOpen(true);
                      }}
                      className="telegram-dropdown-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-colors min-h-[44px]"
                    >
                      <Download size={18} className="text-emerald-500 shrink-0" />
                      <span>{language === 'pt-BR' ? 'Exportar Dados' : 'Export Data'}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER (100% Mobile-First Centered Column) */}
      <main className="flex-1 max-w-lg w-full mx-auto px-4 pt-4 pb-28">
        {activeTab === 'dashboard' && (
          <ErrorBoundary fallbackTitle="Erro ao carregar o Painel Principal">
            <DashboardView
              selectedMonth={selectedMonth}
              currency={state.settings.currency}
              language={language}
              theme={theme}
              initialBalance={state.settings.initialBalance}
              categories={state.categories}
              creditCards={state.creditCards || []}
              transactions={state.transactions}
              onOpenAddModal={handleOpenAddModal}
              onOpenEditModal={handleOpenEditModal}
              onDeleteTransaction={handleDeleteTransaction}
              onToggleTransactionStatus={handleToggleTransactionStatus}
              onOpenBalanceModal={() => setBalanceModalOpen(true)}
              onNavigateTab={setActiveTab}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            selectedMonth={selectedMonth}
            currency={state.settings.currency}
            language={language}
            categories={state.categories}
            creditCards={state.creditCards || []}
            transactions={state.transactions}
            onOpenAddModal={handleOpenAddModal}
            onOpenEditModal={handleOpenEditModal}
            onDeleteTransaction={handleDeleteTransaction}
            onToggleTransactionStatus={handleToggleTransactionStatus}
          />
        )}

        {activeTab === 'cards' && (
          <ErrorBoundary fallbackTitle="Erro ao carregar Cartões de Crédito">
            <CreditCardsView
              creditCards={state.creditCards || []}
              transactions={state.transactions}
              categories={state.categories}
              currency={state.settings.currency}
              language={language}
              theme={theme}
              onSaveCard={handleSaveCard}
              onDeleteCard={handleDeleteCard}
              onPayInvoice={handlePayCardInvoice}
              onOpenAddExpense={(cardId) => handleOpenAddModal('expense', cardId)}
              onEditTransaction={handleOpenEditModal}
              onDeleteTransaction={(tx) => handleDeleteTransaction(tx.id)}
              onActiveCardChange={setActiveCardId}
            />
          </ErrorBoundary>
        )}

        {activeTab === 'fuel' && (
          <FuelView
            selectedMonth={selectedMonth}
            currency={state.settings.currency}
            language={language}
            theme={theme}
            tankCapacity={state.settings.tankCapacity || 50}
            fuelLogs={state.fuelLogs || []}
            onSaveFuelLog={handleSaveFuelLog}
            onDeleteFuelLog={handleDeleteFuelLog}
            onUpdateTankCapacity={(cap) => handleUpdateSettings({ tankCapacity: cap })}
            openRefuelTrigger={openRefuelTrigger}
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            selectedMonth={selectedMonth}
            familyName={state.settings.familyName}
            currency={state.settings.currency}
            language={language}
            theme={theme}
            initialBalance={state.settings.initialBalance}
            categories={state.categories}
            creditCards={state.creditCards || []}
            transactions={state.transactions}
            recurringTemplates={state.recurringTemplates}
            onSelectMonth={setSelectedMonth}
          />
        )}
      </main>

      {/* CONTEXTUAL FAB SPEED-DIAL OVERLAY (Home & Reports Tabs) */}
      <div
        aria-hidden={!(fabMenuOpen && (activeTab === 'dashboard' || activeTab === 'reports'))}
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] transition-opacity print:hidden ${
          fabMenuOpen && (activeTab === 'dashboard' || activeTab === 'reports')
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setFabMenuOpen(false)}
      />

      {/* STICKY BOTTOM NAVIGATION BAR WITH CENTRAL CONTEXTUAL FAB */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] print:hidden">
        {/* Expanding Speed Dial Options when on Início */}
        <div
          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex items-center gap-3 z-50 transition-all duration-150 ${
            fabMenuOpen && activeTab === 'dashboard'
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setFabMenuOpen(false);
              handleOpenAddModal('income');
            }}
            className="fab-option-btn flex items-center gap-2 pl-2.5 pr-4 py-2.5 rounded-full bg-slate-950 text-white border border-emerald-500/40 shadow-xl shadow-black/50 active:scale-95 transition-all whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-xs">
              <Plus size={16} strokeWidth={3} />
            </span>
            <span className="text-xs font-extrabold tracking-tight text-emerald-400">
              {language === 'en' ? 'Income' : 'Entrada'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFabMenuOpen(false);
              handleOpenAddModal('expense');
            }}
            className="fab-option-btn flex items-center gap-2 pl-2.5 pr-4 py-2.5 rounded-full bg-slate-950 text-white border border-rose-500/40 shadow-xl shadow-black/50 active:scale-95 transition-all whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center font-black shadow-xs">
              <Minus size={16} strokeWidth={3} />
            </span>
            <span className="text-xs font-extrabold tracking-tight text-rose-400">
              {language === 'en' ? 'Expense' : 'Despesa'}
            </span>
          </button>
        </div>

        {/* Expanding Speed Dial Options when on Relatórios */}
        <div
          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex items-center gap-2.5 z-50 transition-all duration-150 ${
            fabMenuOpen && activeTab === 'reports'
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={handleExportMonthlyPDF}
            className="fab-option-btn flex items-center gap-2 pl-2.5 pr-4 py-2.5 rounded-full bg-slate-950 text-white border border-[#D0B595]/40 shadow-xl shadow-black/50 active:scale-95 transition-all whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-full bg-[#6E5440] text-[#FFFDF5] flex items-center justify-center font-black shadow-xs">
              <FileText size={15} strokeWidth={2.5} />
            </span>
            <span className="text-xs font-extrabold tracking-tight text-[#D0B595]">
              {language === 'en' ? 'Monthly PDF Report' : 'Relatório PDF do Mês'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleExportMonthlySpreadsheet}
            className="fab-option-btn flex items-center gap-2 pl-2.5 pr-4 py-2.5 rounded-full bg-slate-950 text-white border border-emerald-500/40 shadow-xl shadow-black/50 active:scale-95 transition-all whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-xs">
              <FileSpreadsheet size={15} strokeWidth={2.5} />
            </span>
            <span className="text-xs font-extrabold tracking-tight text-emerald-400">
              {language === 'en' ? 'Export Spreadsheet' : 'Exportar Planilha'}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-5 items-center gap-1 max-w-lg mx-auto">
          {/* 1. Início */}
          <button
            type="button"
            onClick={() => {
              setFabMenuOpen(false);
              setActiveTab('dashboard');
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-semibold active:scale-95 active:opacity-75 transition-all select-none ${
              activeTab === 'dashboard' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="mt-0.5 truncate">{t.navHomeMobile}</span>
          </button>

          {/* 2. Cartões */}
          <button
            type="button"
            onClick={() => {
              setFabMenuOpen(false);
              setActiveTab('cards');
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-semibold active:scale-95 active:opacity-75 transition-all select-none ${
              activeTab === 'cards' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <CreditCardIcon size={20} />
            <span className="mt-0.5 truncate">{t.navCardsMobile}</span>
          </button>

          {/* Center: Elevated Contextual Primary Action Button (FAB) */}
          <div className="flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'dashboard' || activeTab === 'reports') {
                  setFabMenuOpen((prev) => !prev);
                } else if (activeTab === 'cards') {
                  setFabMenuOpen(false);
                  const targetCardId = activeCardId || state.creditCards?.[0]?.id || undefined;
                  handleOpenAddModal('expense', targetCardId);
                } else if (activeTab === 'fuel') {
                  setFabMenuOpen(false);
                  setOpenRefuelTrigger((n) => n + 1);
                } else {
                  setFabMenuOpen(false);
                  handleOpenAddModal('expense');
                }
              }}
              aria-label="Primary Action"
              className="fab-primary-btn -mt-5 w-[52px] h-[52px] rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/35 border-4 border-white flex items-center justify-center active:scale-95 transition-all select-none"
            >
              <Plus
                size={26}
                strokeWidth={2.75}
                className={`transition-transform duration-200 ${
                  fabMenuOpen && (activeTab === 'dashboard' || activeTab === 'reports')
                    ? 'rotate-45'
                    : 'rotate-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Combustível */}
          <button
            type="button"
            onClick={() => {
              setFabMenuOpen(false);
              setActiveTab('fuel');
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-semibold active:scale-95 active:opacity-75 transition-all select-none ${
              activeTab === 'fuel' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <Fuel size={20} />
            <span className="mt-0.5 truncate">{t.navFuelMobile}</span>
          </button>

          {/* 4. Relatórios */}
          <button
            type="button"
            onClick={() => {
              setFabMenuOpen(false);
              setActiveTab('reports');
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-semibold active:scale-95 active:opacity-75 transition-all select-none ${
              activeTab === 'reports' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <PieChartIcon size={20} />
            <span className="mt-0.5 truncate">
              {language === 'en' ? 'Reports' : 'Relatórios'}
            </span>
          </button>
        </div>
      </div>

      {/* MODALS */}
      <TransactionModal
        isOpen={txModalOpen}
        initialType={txModalInitialType}
        initialCardId={txModalInitialCardId}
        editingTransaction={editingTx}
        allTransactions={state.transactions}
        categories={state.categories}
        creditCards={state.creditCards || []}
        currency={state.settings.currency}
        language={language}
        onClose={() => setTxModalOpen(false)}
        onSave={handleSaveTransaction}
      />

      <SeriesConfirmModal
        isOpen={Boolean(deletingSeriesTx)}
        mode="delete"
        transaction={deletingSeriesTx}
        subsequentCount={
          deletingSeriesTx
            ? getSubsequentPendingSeriesTransactions(deletingSeriesTx, state.transactions).length
            : 0
        }
        currency={state.settings.currency}
        language={language}
        theme={theme}
        onSelectScope={async (scope) => {
          if (!deletingSeriesTx) return;
          const idToDel = deletingSeriesTx.id;
          setDeletingSeriesTx(null);
          await executeDeleteTransaction(idToDel, scope);
        }}
        onCancel={() => setDeletingSeriesTx(null)}
      />

      <BalanceModal
        isOpen={balanceModalOpen}
        currentBalance={currentBankBalance}
        initialBalance={state.settings.initialBalance}
        currency={state.settings.currency}
        language={language}
        onClose={() => setBalanceModalOpen(false)}
        onUpdateSettings={handleUpdateSettings}
      />

      <MobileSyncModal
        isOpen={syncModalOpen}
        activeTabInitial={syncModalTab}
        state={state}
        language={language}
        theme={theme}
        isOnlineWithServer={isOnlineWithServer}
        pendingOfflineCount={pendingOfflineTx.length}
        currentBankBalance={currentBankBalance}
        familyId={familyId}
        masterKey={masterKey}
        onLeaveFamily={handleLeaveFamily}
        onOpenBalanceModal={() => {
          setSyncModalOpen(false);
          setBalanceModalOpen(true);
        }}
        onClose={() => setSyncModalOpen(false)}
        onUpdateSettings={handleUpdateSettings}
        onAddCategory={handleAddCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
        onImportBackup={handleImportBackup}
        onExportBackup={handleExportBackup}
        onResetAccount={handleResetAccount}
      />
    </div>
  );
};
