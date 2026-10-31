import React, { useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Minus,
  Pencil,
  Trash2,
  ChevronRight,
  PieChart as PieChartIcon,
  BarChart3,
  Activity,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Layers,
  CreditCard as CreditCardIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import { AppLanguage, AppTheme, Category, CreditCard, Transaction, TransactionType } from '../types';
import {
  computeCardFirstInvoiceMonth,
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
  formatShortMonthLabel,
  shiftMonth,
} from '../utils/format';
import { getCategoryDisplayName, TRANSLATIONS } from '../utils/i18n';
import { CategoryIcon } from './CategoryIcon';
import { TransactionsView } from './TransactionsView';

interface DashboardViewProps {
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  theme: AppTheme;
  initialBalance?: number;
  categories: Category[];
  creditCards?: CreditCard[];
  transactions: Transaction[];
  onOpenAddModal: (type: TransactionType) => void;
  onOpenEditModal: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
  onToggleTransactionStatus: (tx: Transaction) => Promise<void>;
  onOpenBalanceModal?: () => void;
  onNavigateTab: (tab: 'dashboard' | 'transactions' | 'cards' | 'fuel' | 'reports') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  selectedMonth,
  currency,
  language,
  theme,
  initialBalance = 0,
  categories,
  creditCards = [],
  transactions,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteTransaction,
  onToggleTransactionStatus,
  onOpenBalanceModal,
  onNavigateTab,
}) => {
  const t = TRANSLATIONS[language];
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
    const safeBase = typeof initialBalance === 'number' && !Number.isNaN(initialBalance) ? initialBalance : 0;
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

  // Monthly Commitment with Installments (exact logic from ReportsView installment tracker)
  const installmentCommitment = useMemo(() => {
    const groups = new Map<
      string,
      {
        monthlyAmount: number;
        totalInstallments: number;
        paidCount: number;
        unpaidCount: number;
      }
    >();

    const instTransactions = transactions.filter(
      (tx) => tx.type === 'expense' && tx.installmentTotal && tx.installmentTotal > 1
    );

    for (const tx of instTransactions) {
      const groupKey =
        tx.recurringId ||
        `${tx.description.trim().toLowerCase()}__${tx.categoryId}__${tx.installmentTotal}`;
      const existing = groups.get(groupKey);
      const isPaid = (tx.status ?? 'paid') === 'paid';
      const totNum = tx.installmentTotal || 2;

      if (!existing) {
        groups.set(groupKey, {
          monthlyAmount: tx.amount,
          totalInstallments: totNum,
          paidCount: isPaid ? 1 : 0,
          unpaidCount: isPaid ? 0 : 1,
        });
      } else {
        if (isPaid) {
          existing.paidCount += 1;
        } else {
          existing.unpaidCount += 1;
        }
        if (totNum > existing.totalInstallments) {
          existing.totalInstallments = totNum;
        }
      }
    }

    let commitment = 0;
    for (const plan of groups.values()) {
      const remaining =
        plan.unpaidCount > 0
          ? plan.unpaidCount
          : Math.max(0, plan.totalInstallments - plan.paidCount);
      if (remaining > 0) {
        commitment += plan.monthlyAmount;
      }
    }

    return commitment;
  }, [transactions]);

  // Total Open/Pending Credit Card Invoices for selectedMonth
  const openInvoicesTotal = useMemo(() => {
    let total = 0;
    const handledTxIds = new Set<string>();

    if (creditCards && creditCards.length > 0) {
      for (const card of creditCards) {
        const currentSettledKey = `${card.id}__${selectedMonth}`;
        const settlementTx = transactions.find((tx) => tx.settledInvoiceKey === currentSettledKey);
        const isSettled = Boolean(settlementTx && settlementTx.status === 'paid');

        if (!isSettled) {
          if (settlementTx && settlementTx.status === 'unpaid') {
            total += settlementTx.amount;
            handledTxIds.add(settlementTx.id);
          } else {
            const cardTxs = transactions.filter((tx) => tx.cardId === card.id);
            for (const tx of cardTxs) {
              const invMonth =
                tx.invoiceMonth ||
                computeCardFirstInvoiceMonth(tx.purchaseDate || tx.date, card.closingDay).invoiceMonth;
              if (invMonth === selectedMonth) {
                total += tx.amount || 0;
                handledTxIds.add(tx.id);
              }
            }
          }
        }
      }
    }

    for (const tx of monthTransactions) {
      if (handledTxIds.has(tx.id)) continue;
      if (tx.status === 'unpaid' && tx.type === 'expense') {
        const cat = categoryMap.get(tx.categoryId);
        const isCardCat =
          cat &&
          (cat.icon === 'CreditCard' ||
            cat.name.toLowerCase().includes('fatura') ||
            cat.name.toLowerCase().includes('crédito') ||
            cat.name.toLowerCase().includes('credit'));
        const isCardDesc = tx.description.toLowerCase().includes('fatura');
        if (isCardCat || isCardDesc || tx.cardId) {
          total += tx.amount || 0;
        }
      }
    }

    return total;
  }, [creditCards, transactions, monthTransactions, selectedMonth, categoryMap]);

  // 6-Month Cash Flow Data ending at selectedMonth (Paid only)
  const sixMonthTrend = useMemo(() => {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      months.push(shiftMonth(selectedMonth, -i));
    }

    return months.map((m) => {
      let inc = 0;
      let exp = 0;
      for (const tx of transactions) {
        if (tx.status === 'unpaid' || tx.cardId) continue;
        if (tx.date.startsWith(m)) {
          if (tx.type === 'income') inc += tx.amount;
          else exp += tx.amount;
        }
      }
      return {
        month: m,
        label: formatShortMonthLabel(m, language),
        Inputs: Number(inc.toFixed(2)),
        Expenses: Number(exp.toFixed(2)),
        Net: Number((inc - exp).toFixed(2)),
      };
    });
  }, [transactions, selectedMonth, language]);

  // Daily Spending & Cumulative Expense Trend for selectedMonth (Paid only)
  const dailyTrendData = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const dailyMap = new Map<number, { expense: number; income: number }>();

    for (let d = 1; d <= daysInMonth; d++) {
      dailyMap.set(d, { expense: 0, income: 0 });
    }

    for (const tx of monthTransactions) {
      if (tx.status === 'unpaid' || tx.cardId) continue;
      const day = Number(tx.date.split('-')[2]);
      const entry = dailyMap.get(day);
      if (entry) {
        if (tx.type === 'expense') entry.expense += tx.amount;
        else entry.income += tx.amount;
      }
    }

    let cumulativeExpense = 0;
    const result = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const entry = dailyMap.get(d)!;
      cumulativeExpense += entry.expense;
      result.push({
        day: String(d).padStart(2, '0'),
        DailyExpense: Number(entry.expense.toFixed(2)),
        CumulativeExpense: Number(cumulativeExpense.toFixed(2)),
      });
    }
    return result;
  }, [selectedMonth, monthTransactions]);

  // Retain references to preserved analytics hooks & components for upcoming screens
  void {
    isDark,
    gridStroke,
    axisTickColor,
    tooltipStyle,
    allTimeIncome,
    allTimeExpense,
    expenseCategoryBreakdown,
    installmentCommitment,
    openInvoicesTotal,
    sixMonthTrend,
    dailyTrendData,
    onNavigateTab,
    TrendingUp,
    TrendingDown,
    Plus,
    Minus,
    Pencil,
    Trash2,
    ChevronRight,
    PieChartIcon,
    BarChart3,
    Activity,
    ThumbsUp,
    ThumbsDown,
    Clock,
    Layers,
    CreditCardIcon,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    RechartsTooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    AreaChart,
    Area,
    Legend,
    formatMonthLabel,
    formatShortDate,
    CategoryIcon,
  };

  return (
    <TransactionsView
      selectedMonth={selectedMonth}
      currency={currency}
      language={language}
      categories={categories}
      creditCards={creditCards}
      transactions={transactions}
      onOpenAddModal={onOpenAddModal}
      onOpenEditModal={onOpenEditModal}
      onDeleteTransaction={onDeleteTransaction}
      onToggleTransactionStatus={onToggleTransactionStatus}
      currentBankBalance={currentBankBalance}
      monthStats={monthStats}
      onOpenBalanceModal={onOpenBalanceModal}
    />
  );
};
