import React from 'react';
import {
  AppLanguage,
  Category,
  CreditCard,
  Transaction,
  TransactionType,
} from '../../types';
import { getCategoryDisplayName } from '../../utils/i18n';

export type FilterChipId =
  | 'all'
  | 'pending-expense'
  | 'pending-income'
  | 'paid-expense'
  | 'paid-income'
  | 'fixed'
  | 'installment';

export type FeedViewMode = 'timeline' | 'date-desc' | 'date-asc';
export type SortByMode = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

export const PAGE_SIZE = 30;
export const SWIPE_REVEAL_WIDTH = 140;
export const SWIPE_SNAP_THRESHOLD = 55;
export const SWIPE_MAX_DRAG = 165;

export interface DayGroup {
  date: string;
  label: string;
  transactions: Transaction[];
  dailyNet: number;
}

export interface TransactionsViewProps {
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  categories: Category[];
  creditCards?: CreditCard[];
  transactions: Transaction[];
  onOpenAddModal: (type: TransactionType) => void;
  onOpenEditModal: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
  onToggleTransactionStatus: (tx: Transaction) => Promise<void>;
  balanceCard?: React.ReactNode;
  currentBankBalance?: number;
  monthStats?: {
    income: number;
    expense: number;
    pendingIncome: number;
    pendingExpense: number;
  };
  onOpenBalanceModal?: () => void;
}

const toLocalIsoDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const getTimelineDateKeys = (now: Date = new Date()) => {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return {
    todayStr: toLocalIsoDateKey(today),
    yesterdayStr: toLocalIsoDateKey(yesterday),
    tomorrowStr: toLocalIsoDateKey(tomorrow),
  };
};

export const getTimelinePriority = (
  dateStr: string,
  todayStr: string,
  yesterdayStr: string,
  tomorrowStr: string
): number => {
  if (dateStr === todayStr) return 0;
  if (dateStr === yesterdayStr) return 1;
  if (dateStr === tomorrowStr) return 2;
  return 3;
};

export const formatNumericDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(date.getTime())) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const parseTxDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    const parsed = new Date(y, m, d);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getDayGroupLabel = (
  dateStr: string,
  language: AppLanguage = 'pt-BR',
  mode: FeedViewMode = 'timeline'
): string => {
  const targetDate = parseTxDate(dateStr);
  if (!targetDate) return dateStr;

  if (mode === 'timeline') {
    const { todayStr, yesterdayStr, tomorrowStr } = getTimelineDateKeys();
    if (dateStr === todayStr) return language === 'pt-BR' ? 'Hoje' : 'Today';
    if (dateStr === yesterdayStr) return language === 'pt-BR' ? 'Ontem' : 'Yesterday';
    if (dateStr === tomorrowStr) return language === 'pt-BR' ? 'Amanhã' : 'Tomorrow';
  }

  if (language === 'pt-BR') {
    const weekday = targetDate.toLocaleDateString('pt-BR', { weekday: 'short' });
    const cleanWeekday = weekday.replace('.', '').trim();
    const capitalizedWeekday = cleanWeekday.charAt(0).toUpperCase() + cleanWeekday.slice(1);
    const day = targetDate.toLocaleDateString('pt-BR', { day: '2-digit' });
    const month = targetDate.toLocaleDateString('pt-BR', { month: 'long' });
    return `${capitalizedWeekday}, ${day} de ${month}`;
  } else {
    const weekday = targetDate.toLocaleDateString('en-US', { weekday: 'short' });
    const dayAndMonth = targetDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    return `${weekday}, ${dayAndMonth}`;
  }
};

export const computeFilteredTransactions = (params: {
  transactions: Transaction[];
  scope: 'month' | 'all';
  selectedMonth: string;
  activeFilterChip: FilterChipId;
  typeFilter: 'all' | 'income' | 'expense';
  statusFilter: 'all' | 'paid' | 'unpaid';
  categoryFilter: string;
  searchQuery: string;
  sortBy: SortByMode;
  feedViewMode: FeedViewMode;
  categoryMap: Map<string, Category>;
  language: AppLanguage;
}): Transaction[] => {
  const {
    transactions,
    scope,
    selectedMonth,
    activeFilterChip,
    typeFilter,
    statusFilter,
    categoryFilter,
    searchQuery,
    sortBy,
    feedViewMode,
    categoryMap,
    language,
  } = params;

  const { todayStr, yesterdayStr, tomorrowStr } = getTimelineDateKeys();

  return transactions
    .filter((tx) => {
      if (tx.cardId) return false;
      if (scope === 'month' && !tx.date.startsWith(selectedMonth)) return false;

      const isUnpaid = tx.status === 'unpaid';
      if (activeFilterChip === 'pending-expense' && !(tx.type === 'expense' && isUnpaid)) return false;
      if (activeFilterChip === 'pending-income' && !(tx.type === 'income' && isUnpaid)) return false;
      if (activeFilterChip === 'paid-expense' && !(tx.type === 'expense' && !isUnpaid)) return false;
      if (activeFilterChip === 'paid-income' && !(tx.type === 'income' && !isUnpaid)) return false;
      if (activeFilterChip === 'fixed' && !(tx.recurringId || tx.isRecurring)) return false;
      if (activeFilterChip === 'installment' && !(tx.installmentTotal && tx.installmentTotal > 1)) return false;

      if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
      const txStatus = tx.status === 'unpaid' ? 'unpaid' : 'paid';
      if (statusFilter !== 'all' && txStatus !== statusFilter) return false;
      if (categoryFilter !== 'all' && tx.categoryId !== categoryFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const cat = categoryMap.get(tx.categoryId);
        const catName = getCategoryDisplayName(cat, language).toLowerCase();
        const matchDesc = tx.description.toLowerCase().includes(q);
        const matchNotes = (tx.notes || '').toLowerCase().includes(q);
        const matchCat = catName.includes(q);
        if (!matchDesc && !matchNotes && !matchCat) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'amount-desc') return b.amount - a.amount;
      if (sortBy === 'amount-asc') return a.amount - b.amount;
      if (feedViewMode === 'date-asc' || sortBy === 'date-asc') {
        return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
      }
      if (feedViewMode === 'timeline') {
        const priorityA = getTimelinePriority(a.date, todayStr, yesterdayStr, tomorrowStr);
        const priorityB = getTimelinePriority(b.date, todayStr, yesterdayStr, tomorrowStr);
        if (priorityA !== priorityB) return priorityA - priorityB;
      }
      return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
    });
};

export const computeTransactionsSummary = (filteredTransactions: Transaction[]) => {
  let income = 0;
  let expense = 0;
  let pendingAmount = 0;
  let pendingCount = 0;
  for (const tx of filteredTransactions) {
    if (tx.status === 'unpaid') {
      pendingCount++;
      pendingAmount += tx.amount;
      continue;
    }
    if (tx.type === 'income') income += tx.amount;
    else expense += tx.amount;
  }
  return {
    income,
    expense,
    net: income - expense,
    pendingAmount,
    pendingCount,
    count: filteredTransactions.length,
  };
};

export const computeGroupedTransactions = (
  visibleTransactions: Transaction[],
  language: AppLanguage,
  feedViewMode: FeedViewMode
): DayGroup[] => {
  const groups: DayGroup[] = [];
  const map = new Map<string, DayGroup>();

  for (const tx of visibleTransactions) {
    const dateKey = tx.date;
    let group = map.get(dateKey);
    if (!group) {
      group = {
        date: dateKey,
        label: getDayGroupLabel(dateKey, language, feedViewMode),
        transactions: [],
        dailyNet: 0,
      };
      map.set(dateKey, group);
      groups.push(group);
    }
    group.transactions.push(tx);
    if (tx.status !== 'unpaid') {
      if (tx.type === 'income') group.dailyNet += tx.amount;
      else group.dailyNet -= tx.amount;
    }
  }

  if (feedViewMode === 'timeline') {
    const { todayStr, yesterdayStr, tomorrowStr } = getTimelineDateKeys();
    groups.sort((groupA, groupB) => {
      const priorityA = getTimelinePriority(groupA.date, todayStr, yesterdayStr, tomorrowStr);
      const priorityB = getTimelinePriority(groupB.date, todayStr, yesterdayStr, tomorrowStr);
      if (priorityA !== priorityB) return priorityA - priorityB;
      const timeA = parseTxDate(groupA.date)?.getTime() ?? 0;
      const timeB = parseTxDate(groupB.date)?.getTime() ?? 0;
      return timeB - timeA;
    });
  }

  return groups;
};

export const computeFallbackStats = (
  transactions: Transaction[],
  selectedMonth: string
) => {
  let income = 0;
  let expense = 0;
  let pendingIncome = 0;
  let pendingExpense = 0;
  let allPaidIncome = 0;
  let allPaidExpense = 0;

  for (const tx of transactions) {
    if (tx.cardId) continue;

    if (tx.status === 'unpaid') {
      if (tx.date.startsWith(selectedMonth)) {
        if (tx.type === 'income') pendingIncome += tx.amount;
        else pendingExpense += tx.amount;
      }
      continue;
    }

    if (tx.type === 'income') allPaidIncome += tx.amount;
    else allPaidExpense += tx.amount;

    if (tx.date.startsWith(selectedMonth)) {
      if (tx.type === 'income') income += tx.amount;
      else expense += tx.amount;
    }
  }

  return {
    stats: { income, expense, pendingIncome, pendingExpense },
    balance: allPaidIncome - allPaidExpense,
  };
};
