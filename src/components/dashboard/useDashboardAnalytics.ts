import { useMemo } from 'react';
import { AppLanguage, AppTheme, Category, CreditCard, Transaction } from '../../types';
import { shiftMonth } from '../../utils/format';
import { getCategoryDisplayName } from '../../utils/i18n';
import {
  computeDailyTrendData,
  computeInstallmentCommitment,
  computeOpenInvoicesTotal,
  computeSixMonthTrend,
} from './dashboardCalculations';

export interface UseDashboardAnalyticsParams {
  selectedMonth: string;
  language: AppLanguage;
  theme: AppTheme;
  initialBalance?: number;
  categories: Category[];
  creditCards?: CreditCard[];
  transactions: Transaction[];
}

export function useDashboardAnalytics({
  selectedMonth,
  language,
  theme,
  initialBalance = 0,
  categories,
  creditCards = [],
  transactions,
}: UseDashboardAnalyticsParams) {
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const isDark = theme === 'oled';
  const gridStroke = theme === 'oled' ? '#21262D' : '#E2E8F0';
  const axisTickColor = theme === 'oled' ? '#94A3B8' : '#64748B';
  const tooltipStyle = useMemo(
    () => ({
      borderRadius: '12px',
      border: `1px solid ${theme === 'oled' ? '#21262D' : '#E2E8F0'}`,
      backgroundColor: theme === 'oled' ? '#0D1117' : '#FFFFFF',
      color: theme === 'oled' ? '#F8FAFC' : '#0F172A',
      fontSize: '12px',
    }),
    [theme]
  );

  // All-time live bank balance (ONLY 'paid' transactions affect current wallet/account balance)
  const { currentBankBalance, allTimeIncome, allTimeExpense } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const tx of transactions) {
      if (tx.status === 'unpaid' || tx.cardId) continue;
      if (tx.type === 'income') inc += Number(tx.amount) || 0;
      else exp += Number(tx.amount) || 0;
    }
    const safeBase =
      typeof initialBalance === 'number' && !Number.isNaN(initialBalance) ? initialBalance : 0;
    return {
      allTimeIncome: inc,
      allTimeExpense: exp,
      currentBankBalance: safeBase + inc - exp,
    };
  }, [transactions, initialBalance]);

  const prevMonth = useMemo(() => shiftMonth(selectedMonth, -1), [selectedMonth]);

  const monthTransactions = useMemo(
    () => transactions.filter((tx) => tx.date.startsWith(selectedMonth)),
    [transactions, selectedMonth]
  );

  const prevMonthTransactions = useMemo(
    () => transactions.filter((tx) => tx.date.startsWith(prevMonth)),
    [transactions, prevMonth]
  );

  const monthStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    let pendingIncome = 0;
    let pendingExpense = 0;

    for (const tx of monthTransactions) {
      // Strictly exclude individual credit card transactions from cash flow
      if (tx.cardId) continue;

      if (tx.status === 'unpaid') {
        if (tx.type === 'income') {
          pendingIncome += tx.amount;
        } else {
          pendingExpense += tx.amount;
        }
        continue;
      }

      if (tx.type === 'income') {
        income += tx.amount;
        incomeCount++;
      } else {
        expense += tx.amount;
        expenseCount++;
      }
    }

    let prevExpense = 0;
    for (const tx of prevMonthTransactions) {
      if (tx.status === 'unpaid' || tx.cardId) continue;
      if (tx.type === 'expense') prevExpense += tx.amount;
    }

    const net = income - expense;
    const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
    const expenseDiffPct =
      prevExpense > 0 ? ((expense - prevExpense) / prevExpense) * 100 : null;

    return {
      income,
      expense,
      pendingIncome,
      pendingExpense,
      incomeCount,
      expenseCount,
      net,
      savingsRate,
      prevExpense,
      expenseDiffPct,
    };
  }, [monthTransactions, prevMonthTransactions]);

  // Category Breakdown for Paid Expenses in selectedMonth
  const expenseCategoryBreakdown = useMemo(() => {
    const totals = new Map<string, { amount: number; count: number }>();
    for (const tx of monthTransactions) {
      if (tx.type !== 'expense' || tx.status === 'unpaid' || tx.cardId) continue;
      const prev = totals.get(tx.categoryId) || { amount: 0, count: 0 };
      totals.set(tx.categoryId, { amount: prev.amount + tx.amount, count: prev.count + 1 });
    }

    const list = Array.from(totals.entries()).map(([catId, data]) => {
      const cat = categoryMap.get(catId);
      const pct = monthStats.expense > 0 ? (data.amount / monthStats.expense) * 100 : 0;
      return {
        categoryId: catId,
        name: getCategoryDisplayName(cat, language),
        color: cat?.color || '#64748b',
        icon: cat?.icon || 'Tag',
        amount: data.amount,
        count: data.count,
        percentage: pct,
      };
    });

    list.sort((a, b) => b.amount - a.amount);
    return list;
  }, [monthTransactions, categoryMap, monthStats.expense, language]);

  const installmentCommitment = useMemo(
    () => computeInstallmentCommitment(transactions),
    [transactions]
  );

  const openInvoicesTotal = useMemo(
    () =>
      computeOpenInvoicesTotal(
        creditCards,
        transactions,
        monthTransactions,
        selectedMonth,
        categoryMap
      ),
    [creditCards, transactions, monthTransactions, selectedMonth, categoryMap]
  );

  const sixMonthTrend = useMemo(
    () => computeSixMonthTrend(transactions, selectedMonth, language),
    [transactions, selectedMonth, language]
  );

  const dailyTrendData = useMemo(
    () => computeDailyTrendData(selectedMonth, monthTransactions),
    [selectedMonth, monthTransactions]
  );

  return {
    isDark,
    gridStroke,
    axisTickColor,
    tooltipStyle,
    currentBankBalance,
    allTimeIncome,
    allTimeExpense,
    monthStats,
    expenseCategoryBreakdown,
    installmentCommitment,
    openInvoicesTotal,
    sixMonthTrend,
    dailyTrendData,
  };
}
