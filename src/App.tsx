import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LayoutDashboard,
  ListOrdered,
  CreditCard as CreditCardIcon,
  Fuel,
  FileBarChart2,
  ChevronLeft,
  ChevronRight,
  Settings,
  TrendingUp,
  Sun,
  Moon,
  Sparkles,
  Languages,
} from 'lucide-react';
import {
  AppLanguage,
  AppState,
  AppTheme,
  CreditCard,
  FuelType,
  Transaction,
  TransactionStatus,
  TransactionType,
} from './types';
import {
  computeCardFirstInvoiceMonth,
  formatMonthLabel,
  formatShortMonthLabel,
  getCurrentMonthStr,
  shiftMonth,
} from './utils/format';
import { TRANSLATIONS } from './utils/i18n';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { CreditCardsView } from './components/CreditCardsView';
import { FuelView } from './components/FuelView';
import { ReportsView } from './components/ReportsView';
import { TransactionModal } from './components/TransactionModal';
import { BalanceModal } from './components/BalanceModal';
import { MobileSyncModal } from './components/MobileSyncModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import {
  SeriesConfirmModal,
  SeriesScope,
  isPartOfSeries,
  getSubsequentPendingSeriesTransactions,
} from './components/SeriesConfirmModal';

const STORAGE_STATE_KEY = 'familyplan_cached_state_v1';
const STORAGE_PENDING_TX_KEY = 'familyplan_pending_tx_v1';

const FALLBACK_STATE: AppState = {
  settings: {
    familyName: 'Family Finance',
    currency: 'BRL',
    language: 'pt-BR',
    theme: 'tokyo-night',
    initialBalance: 0,
    updatedAt: new Date().toISOString(),
  },
  categories: [
    { id: 'inc-deposit', name: 'Bank Input / Deposit', type: 'income', color: '#10b981', icon: 'Landmark', isDefault: 1 },
    { id: 'inc-salary', name: 'Salary / Paycheck', type: 'income', color: '#059669', icon: 'Briefcase', isDefault: 1 },
    { id: 'exp-groceries', name: 'Groceries & Market', type: 'expense', color: '#f59e0b', icon: 'ShoppingCart', isDefault: 1 },
    { id: 'exp-housing', name: 'Housing & Rent', type: 'expense', color: '#6366f1', icon: 'Home', isDefault: 1 },
    { id: 'exp-utilities', name: 'Bills & Utilities', type: 'expense', color: '#0ea5e9', icon: 'Zap', isDefault: 1 },
    { id: 'exp-dining', name: 'Dining & Food Delivery', type: 'expense', color: '#f97316', icon: 'Utensils', isDefault: 1 },
    { id: 'exp-transport', name: 'Transport & Fuel', type: 'expense', color: '#8b5cf6', icon: 'Car', isDefault: 1 },
    { id: 'exp-health', name: 'Health & Pharmacy', type: 'expense', color: '#ef4444', icon: 'HeartPulse', isDefault: 1 },
    { id: 'exp-other', name: 'Other Expenses', type: 'expense', color: '#64748b', icon: 'MoreHorizontal', isDefault: 1 },
  ],
  transactions: [],
  recurringTemplates: [],
  creditCards: [],
};

export const App: React.FC = () => {
  const [state, setState] = useState<AppState>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_STATE_KEY);
      if (cached) return JSON.parse(cached);
    } catch {
      // ignore
    }
    return FALLBACK_STATE;
  });

  const [pendingOfflineTx, setPendingOfflineTx] = useState<Transaction[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_PENDING_TX_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [];
  });

  const [isOnlineWithServer, setIsOnlineWithServer] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'transactions' | 'cards' | 'fuel' | 'reports'>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());

  // Modals
  const [txModalOpen, setTxModalOpen] = useState<boolean>(false);
  const [txModalInitialType, setTxModalInitialType] = useState<TransactionType>('expense');
  const [txModalInitialCardId, setTxModalInitialCardId] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [deletingSeriesTx, setDeletingSeriesTx] = useState<Transaction | null>(null);
  const [balanceModalOpen, setBalanceModalOpen] = useState<boolean>(false);
  const [syncModalOpen, setSyncModalOpen] = useState<boolean>(false);
  const [syncModalTab, setSyncModalTab] = useState<'mobile' | 'settings' | 'categories' | 'export' | 'backup'>('mobile');

  const language: AppLanguage = state.settings.language === 'en' ? 'en' : 'pt-BR';
  const theme: AppTheme =
    state.settings.theme === 'dark' ||
    state.settings.theme === 'tokyo-night' ||
    state.settings.theme === 'light' ||
    state.settings.theme === 'oled'
      ? state.settings.theme
      : 'tokyo-night';

  const t = TRANSLATIONS[language];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('familyplan_theme', theme);
    } catch {}
  }, [theme]);

  const saveStateToCache = useCallback((nextState: AppState) => {
    setState(nextState);
    try {
      localStorage.setItem(STORAGE_STATE_KEY, JSON.stringify(nextState));
    } catch {
      // ignore quota errors
    }
  }, []);

  const syncWithServer = useCallback(async () => {
    try {
      let pending: Transaction[] = [];
      try {
        const raw = localStorage.getItem(STORAGE_PENDING_TX_KEY);
        if (raw) pending = JSON.parse(raw);
      } catch {
        pending = [];
      }

      if (pending.length > 0) {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pendingTransactions: pending }),
        });
        if (res.ok) {
          const data: AppState = await res.json();
          localStorage.removeItem(STORAGE_PENDING_TX_KEY);
          setPendingOfflineTx([]);
          saveStateToCache(data);
          setIsOnlineWithServer(true);
          return;
        }
      }

      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('Server unreachable');
      const data: AppState = await res.json();
      saveStateToCache(data);
      setIsOnlineWithServer(true);
    } catch {
      setIsOnlineWithServer(false);
    }
  }, [saveStateToCache]);

  useEffect(() => {
    syncWithServer();
    const interval = setInterval(syncWithServer, 15000);
    return () => clearInterval(interval);
  }, [syncWithServer]);

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

    const fullTx: Transaction = {
      id: txId,
      type: txData.type,
      status: txData.status,
      amount: txData.amount,
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
        for (let step = 1; startCur + step <= total; step++) {
          const instNum = startCur + step;
          const fInvoiceMonth = shiftMonth(baseInvMonth, step);
          const fMonth = fInvoiceMonth;
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
            installmentCurrent: instNum,
            installmentTotal: total,
            recurringId: generatedRecId,
            cardId: txData.cardId || null,
            invoiceMonth: fInvoiceMonth,
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

    try {
      let updatedState: AppState | null = null;

      if (!txData.id && recurringPlan && generatedRecId) {
        const recRes = await fetch('/api/recurring', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: generatedRecId,
            type: txData.type,
            amount: txData.amount,
            description: txData.description,
            categoryId: txData.categoryId,
            dayOfMonth: recurringPlan.dayOfMonth,
            isInstallment: recurringPlan.mode === 'installment',
            totalInstallments: recurringPlan.totalInstallments,
            startMonth: recurringPlan.startMonth,
            active: true,
          }),
        });
        if (recRes.ok) {
          updatedState = await recRes.json();
        }
      }

      const url = txData.id ? `/api/transactions/${txData.id}` : '/api/transactions';
      const method = txData.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fullTx,
          scope,
          futureEntries: futureEntries.length > 0 ? futureEntries : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      updatedState = await res.json();

      if (updatedState) {
        saveStateToCache(updatedState);
      }
      setIsOnlineWithServer(true);
    } catch {
      setIsOnlineWithServer(false);
      let nextTransactions: Transaction[];
      if (txData.id) {
        const originalTx = state.transactions.find((tx) => tx.id === txData.id);
        const subsequentIds =
          scope === 'future' && originalTx
            ? new Set(
                getSubsequentPendingSeriesTransactions(originalTx, state.transactions).map(
                  (t) => t.id
                )
              )
            : new Set<string>();

        nextTransactions = state.transactions.map((tx) => {
          if (tx.id === txData.id) return fullTx;
          if (subsequentIds.has(tx.id)) {
            let nextRowDate = tx.date;
            if (fullTx.dueDay && tx.date && tx.date.length >= 7) {
              const monthPrefix = tx.date.slice(0, 7);
              const [ry, rm] = monthPrefix.split('-').map(Number);
              const maxDay = new Date(ry, rm, 0).getDate() || 28;
              const clampedDay = Math.min(fullTx.dueDay, maxDay);
              nextRowDate = `${monthPrefix}-${String(clampedDay).padStart(2, '0')}`;
            }
            return {
              ...tx,
              type: fullTx.type,
              amount: fullTx.amount,
              description: fullTx.description,
              categoryId: fullTx.categoryId,
              date: nextRowDate,
              notes: fullTx.notes,
              dueDay: fullTx.dueDay ?? tx.dueDay,
              installmentTotal: fullTx.installmentTotal ?? tx.installmentTotal,
              cardId: fullTx.cardId !== undefined ? fullTx.cardId : tx.cardId,
            };
          }
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

      const nextPending = [
        ...pendingOfflineTx.filter((p) => p.id !== fullTx.id),
        fullTx,
        ...futureEntries,
      ];
      setPendingOfflineTx(nextPending);
      localStorage.setItem(STORAGE_PENDING_TX_KEY, JSON.stringify(nextPending));
    }
  };

  const handleToggleTransactionStatus = async (tx: Transaction) => {
    const nextStatus: TransactionStatus = tx.status === 'unpaid' ? 'paid' : 'unpaid';
    const updatedTx: Transaction = { ...tx, status: nextStatus };

    // Optimistic UI update so balance & badge respond immediately
    saveStateToCache({
      ...state,
      transactions: state.transactions.map((item) => (item.id === tx.id ? updatedTx : item)),
    });

    try {
      const res = await fetch(`/api/transactions/${tx.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Failed');
      const data: AppState = await res.json();
      saveStateToCache(data);
    } catch {
      const nextPending = [...pendingOfflineTx.filter((p) => p.id !== updatedTx.id), updatedTx];
      setPendingOfflineTx(nextPending);
      localStorage.setItem(STORAGE_PENDING_TX_KEY, JSON.stringify(nextPending));
    }
  };

  const executeDeleteTransaction = async (id: string, scope: SeriesScope = 'single') => {
    try {
      const res = await fetch(`/api/transactions/${id}?scope=${scope}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      const data: AppState = await res.json();
      saveStateToCache(data);
    } catch {
      const originalTx = state.transactions.find((tx) => tx.id === id);
      const idsToDelete = new Set<string>([id]);
      if (scope === 'future' && originalTx) {
        for (const subTx of getSubsequentPendingSeriesTransactions(
          originalTx,
          state.transactions
        )) {
          idsToDelete.add(subTx.id);
        }
      }
      const nextState: AppState = {
        ...state,
        transactions: state.transactions.filter((tx) => !idsToDelete.has(tx.id)),
      };
      saveStateToCache(nextState);
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
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed');
      const data: AppState = await res.json();
      saveStateToCache(data);
    } catch {
      // Optimistic state is already applied and cached
    }
  };

  const handleCycleTheme = () => {
    const order: AppTheme[] = ['light', 'dark', 'tokyo-night', 'oled'];
    const next = order[(order.indexOf(theme) + 1) % order.length];
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
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cat),
      });
      if (res.ok) {
        saveStateToCache(await res.json());
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
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cat),
      });
      if (res.ok) {
        saveStateToCache(await res.json());
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
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        saveStateToCache(await res.json());
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
    const res = await fetch('/api/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tpl),
    });
    if (res.ok) {
      saveStateToCache(await res.json());
    }
  };

  const handleDeleteRecurring = async (id: string) => {
    const res = await fetch(`/api/recurring/${id}`, { method: 'DELETE' });
    if (res.ok) {
      saveStateToCache(await res.json());
    }
  };

  const handleApplySingleRecurring = async (id: string, month: string) => {
    const res = await fetch(`/api/recurring/${id}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month }),
    });
    if (res.ok) {
      saveStateToCache(await res.json());
    }
  };

  const handleApplyAllRecurring = async (month: string) => {
    const res = await fetch('/api/recurring/apply-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month }),
    });
    if (res.ok) {
      saveStateToCache(await res.json());
    }
  };

  const handleImportBackup = async (backupData: Partial<AppState>, mode: 'merge' | 'replace') => {
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...backupData, mode }),
    });
    if (res.ok) {
      saveStateToCache(await res.json());
    }
  };

  const handleResetAccount = async () => {
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      if (res.ok) {
        localStorage.removeItem(STORAGE_PENDING_TX_KEY);
        setPendingOfflineTx([]);
        saveStateToCache(await res.json());
      }
    } catch {
      localStorage.removeItem(STORAGE_PENDING_TX_KEY);
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
    try {
      const url = fuelData.id ? `/api/fuel/${fuelData.id}` : '/api/fuel';
      const method = fuelData.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fuelData),
      });
      if (res.ok) {
        saveStateToCache(await res.json());
      }
    } catch {
      const fuelId = fuelData.id || `fuel-${Date.now()}`;
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
      const txDesc = `${baseDesc}${fuelData.stationName ? ` - ${fuelData.stationName}` : ''} [${fuelData.liters.toFixed(2)}L]`;
      const newFuelLog = {
        id: fuelId,
        ...fuelData,
        transactionId: txId,
        createdAt: new Date().toISOString(),
      };
      const newTx: Transaction = {
        id: txId,
        type: 'expense',
        amount: fuelData.totalCost,
        description: txDesc,
        categoryId: 'exp-transport',
        date: fuelData.date,
        notes: `${fuelData.odometer} km • ${fuelData.pricePerLiter}/L`,
        createdAt: new Date().toISOString(),
      };
      const prevFuel = state.fuelLogs || [];
      const nextFuel = fuelData.id
        ? prevFuel.map((f) => (f.id === fuelData.id ? newFuelLog : f))
        : [newFuelLog, ...prevFuel];
      const nextTx = state.transactions.some((tx) => tx.id === txId)
        ? state.transactions.map((tx) => (tx.id === txId ? newTx : tx))
        : [newTx, ...state.transactions];
      saveStateToCache({
        ...state,
        fuelLogs: nextFuel,
        transactions: nextTx,
      });
    }
  };

  const handleDeleteFuelLog = async (id: string) => {
    try {
      const res = await fetch(`/api/fuel/${id}`, { method: 'DELETE' });
      if (res.ok) {
        saveStateToCache(await res.json());
      }
    } catch {
      const target = (state.fuelLogs || []).find((f) => f.id === id);
      const txId = target?.transactionId || `tx-fuel-${id}`;
      saveStateToCache({
        ...state,
        fuelLogs: (state.fuelLogs || []).filter((f) => f.id !== id),
        transactions: state.transactions.filter((tx) => tx.id !== txId),
      });
    }
  };

  const handleSaveCard = async (cardData: Partial<CreditCard> & { name: string; totalLimit: number; closingDay: number; dueDay: number }) => {
    try {
      const url = cardData.id ? `/api/cards/${cardData.id}` : '/api/cards';
      const method = cardData.id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardData),
      });
      if (!res.ok) throw new Error('Failed');
      const data: AppState = await res.json();
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
      const res = await fetch(`/api/cards/${cardId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      const data: AppState = await res.json();
      saveStateToCache(data);
    } catch {
      saveStateToCache({
        ...state,
        creditCards: (state.creditCards || []).filter((c) => c.id !== cardId),
      });
    }
  };

  const handlePayCardInvoice = async (cardId: string, invoiceMonth: string) => {
    try {
      const res = await fetch(`/api/cards/${cardId}/pay-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceMonth }),
      });
      if (!res.ok) throw new Error('Failed');
      const data: AppState = await res.json();
      saveStateToCache(data);
    } catch {
      const card = (state.creditCards || []).find((c) => c.id === cardId);
      if (!card) return;
      const cardTxs = state.transactions.filter((tx) => {
        if (tx.cardId !== cardId) return false;
        const invMonth =
          tx.invoiceMonth ||
          computeCardFirstInvoiceMonth(tx.purchaseDate || tx.date, card.closingDay).invoiceMonth;
        return invMonth === invoiceMonth;
      });
      const total = cardTxs.reduce((sum, tx) => sum + tx.amount, 0);
      if (total <= 0) return;
      const [invYear, invMonth] = invoiceMonth.split('-').map(Number);
      const nextMonthDate = new Date(invYear, invMonth, 0);
      const dueDayClamped = Math.min(card.dueDay, nextMonthDate.getDate() || 28);
      const dueDate = `${invoiceMonth}-${String(dueDayClamped).padStart(2, '0')}`;
      const settlementKey = `${cardId}__${invoiceMonth}`;
      const newTx: Transaction = {
        id: `tx-fatura-${cardId}-${invoiceMonth}`,
        type: 'expense',
        status: 'unpaid',
        amount: total,
        description: `Fatura Cartão ${card.name} - ${formatMonthLabel(invoiceMonth, language)}`,
        categoryId: 'exp-others',
        date: dueDate,
        notes: `Pagamento de fatura consolidada (${cardTxs.length} compras)`,
        dueDay: card.dueDay,
        settledInvoiceKey: settlementKey,
        createdAt: new Date().toISOString(),
      };
      saveStateToCache({
        ...state,
        transactions: [newTx, ...state.transactions],
      });
    }
  };

  const themeBadgeLabel =
    theme === 'oled'
      ? t.themeOled
      : theme === 'tokyo-night'
      ? t.themeTokyo
      : theme === 'dark'
      ? t.themeDark
      : t.themeLight;

  return (
    <div className="app-shell min-h-screen flex flex-col bg-slate-50 text-slate-900 pb-24 transition-colors">
      {/* TOP NAVIGATION HEADER */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-3">
          {/* Brand */}
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center shadow-sm shrink-0">
              <TrendingUp size={20} strokeWidth={2.5} />
            </div>
            <div className="shrink-0">
              <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 block leading-none whitespace-nowrap">
                {state.settings.familyName}
              </span>
              <span className="text-[11px] font-medium text-slate-400 hidden sm:block whitespace-nowrap mt-1">
                {t.subtitle}
              </span>
            </div>
          </div>

          {/* Month Selector & Quick Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Compact Month Switcher */}
            <div className="flex items-center bg-slate-100 rounded-xl p-0.5 sm:p-1 border border-slate-200/50">
              <button
                type="button"
                onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
                className="p-1 sm:p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
                title={t.prevMonth}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                onClick={() => setSelectedMonth(getCurrentMonthStr())}
                className="px-1.5 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold text-slate-800 hover:text-indigo-500 transition-colors min-w-[76px] sm:min-w-[115px] text-center capitalize"
                title={t.jumpCurrentMonth}
              >
                <span className="inline sm:hidden">{formatShortMonthLabel(selectedMonth, language)}</span>
                <span className="hidden sm:inline">{formatMonthLabel(selectedMonth, language)}</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
                className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
                title={t.nextMonth}
              >
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Settings (Gear) Button */}
            <button
              type="button"
              onClick={() => {
                setSyncModalTab('settings');
                setSyncModalOpen(true);
              }}
              className="p-2 sm:p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-xs shrink-0"
              title={t.preferencesTooltip}
            >
              <Settings size={17} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
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
            transactions={state.transactions}
            recurringTemplates={state.recurringTemplates}
            onSelectMonth={setSelectedMonth}
          />
        )}
      </main>

      {/* STICKY BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 print:hidden">
        <div className="grid grid-cols-5 items-center gap-1 max-w-lg mx-auto">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] font-semibold ${
              activeTab === 'dashboard' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <LayoutDashboard size={19} />
            <span className="mt-0.5">{t.navHomeMobile}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] font-semibold ${
              activeTab === 'transactions' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <ListOrdered size={19} />
            <span className="mt-0.5">{t.navHistoryMobile}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cards')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] font-semibold ${
              activeTab === 'cards' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <CreditCardIcon size={19} />
            <span className="mt-0.5">{t.navCardsMobile}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fuel')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] font-semibold ${
              activeTab === 'fuel' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <Fuel size={19} />
            <span className="mt-0.5">{t.navFuelMobile}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center py-1.5 rounded-xl text-[11px] font-semibold ${
              activeTab === 'reports' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <FileBarChart2 size={19} />
            <span className="mt-0.5">{t.navReportsMobile}</span>
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
        onResetAccount={handleResetAccount}
      />
    </div>
  );
};
