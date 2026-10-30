import React, { useState, useMemo } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  EyeOff,
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
      if (tx.status === 'unpaid') {
        if (tx.type === 'income') {
          pendingIncome += tx.amount;
        } else {
          pendingExpense += tx.amount;
        }
        continue;
      }

      if (tx.cardId) continue;

      if (tx.type === 'income') {
        income += tx.amount;
        incomeCount++;
      } else {
        expense += tx.amount;
        expenseCount++;
      }
    }

    // Also include any pending card transactions assigned to this invoice cycle that might have a date outside selectedMonth
    for (const tx of transactions) {
      if (tx.status === 'unpaid' && tx.type === 'expense' && tx.cardId) {
        if (tx.invoiceMonth === selectedMonth && !tx.date.startsWith(selectedMonth)) {
          pendingExpense += tx.amount;
        }
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
  }, [monthTransactions, prevMonthTransactions, transactions, selectedMonth]);

  // Category Breakdown for Paid Expenses in selectedMonth
  const expenseCategoryBreakdown = useMemo(() => {
    const totals = new Map<string, { amount: number; count: number }>();
    for (const tx of monthTransactions) {
      if (tx.type !== 'expense' || tx.status === 'unpaid') continue;
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
        if (tx.status === 'unpaid') continue;
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
      if (tx.status === 'unpaid') continue;
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

  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('prumo_hide_balance') === 'true';
    } catch {
      return false;
    }
  });

  const toggleBalancePrivacy = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBalanceHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('prumo_hide_balance', String(next));
      } catch {}
      return next;
    });
  };

  // Main Balance Card Element (Rendered between Search and Transactions List)
  const balanceCardElement = (
    <div className="oled-main-card rounded-2xl bg-[#0D1117] text-white px-4 py-4 sm:px-6 sm:py-5 border border-[#21262D]">
      {/* Centered Main Balance with Proportional Privacy Toggle */}
      <div className="flex items-center justify-center gap-2.5 py-0.5">
        <h1
          role={onOpenBalanceModal ? 'button' : undefined}
          tabIndex={onOpenBalanceModal ? 0 : undefined}
          onClick={onOpenBalanceModal}
          onKeyDown={(e) => {
            if (onOpenBalanceModal && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault();
              onOpenBalanceModal();
            }
          }}
          className={`text-[32px] sm:text-[38px] font-black tracking-tight leading-none text-center truncate ${
            onOpenBalanceModal ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
          } ${(currentBankBalance ?? 0) < 0 ? 'text-rose-400' : 'text-white'}`}
          title={
            onOpenBalanceModal
              ? language === 'pt-BR'
                ? 'Ajustar saldo inicial'
                : 'Adjust initial balance'
              : undefined
          }
        >
          {isBalanceHidden ? '••••••' : formatCurrency(currentBankBalance ?? 0, currency)}
        </h1>

        <button
          type="button"
          onClick={toggleBalancePrivacy}
          className="p-1 rounded-lg text-zinc-400 hover:text-white active:scale-90 transition-all shrink-0 focus:outline-none"
          title={
            isBalanceHidden
              ? language === 'pt-BR'
                ? 'Mostrar saldo'
                : 'Show balance'
              : language === 'pt-BR'
              ? 'Ocultar saldo'
              : 'Hide balance'
          }
          aria-label={isBalanceHidden ? 'Show balance' : 'Hide balance'}
        >
          {isBalanceHidden ? (
            <EyeOff size={22} className="stroke-[2.2]" />
          ) : (
            <Eye size={22} className="stroke-[2.2]" />
          )}
        </button>
      </div>

      {/* Monthly Summary Section (Two Centered Columns with Enhanced Typography) */}
      <div className="mt-3.5 pt-3 border-t border-[#21262D] flex justify-center gap-10 sm:gap-16">
        {/* Column 1 (ENTRADAS) */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4.5 h-4.5 rounded-full bg-emerald-500/15 text-[#10B981] flex items-center justify-center shrink-0">
              <ArrowUpRight size={12} strokeWidth={2.5} />
            </div>
            <span className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-zinc-400 truncate">
              {language === 'pt-BR' ? 'ENTRADAS' : 'INCOME'}
            </span>
          </div>
          <p className="text-lg sm:text-xl font-black text-[#10B981] tracking-tight truncate">
            {isBalanceHidden ? '+••••••' : `+${formatCurrency(monthStats.income, currency)}`}
          </p>
          <p
            className="text-xs sm:text-sm font-medium text-[#94A3B8] truncate mt-0.5"
            title={`${language === 'pt-BR' ? 'A receber:' : 'To receive:'} ${formatCurrency(monthStats.pendingIncome, currency)}`}
          >
            {language === 'pt-BR' ? 'A receber:' : 'To receive:'}{' '}
            <span className="text-zinc-200 font-bold ml-0.5">
              {isBalanceHidden ? '••••' : formatCurrency(monthStats.pendingIncome, currency)}
            </span>
          </p>
        </div>

        {/* Column 2 (DESPESAS) */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-4.5 h-4.5 rounded-full bg-rose-500/15 text-[#EF4444] flex items-center justify-center shrink-0">
              <ArrowDownRight size={12} strokeWidth={2.5} />
            </div>
            <span className="text-xs sm:text-[13px] font-bold uppercase tracking-wider text-zinc-400 truncate">
              {language === 'pt-BR' ? 'DESPESAS' : 'EXPENSES'}
            </span>
          </div>
          <p className="text-lg sm:text-xl font-black text-[#EF4444] tracking-tight truncate">
            {isBalanceHidden ? '-••••••' : `-${formatCurrency(monthStats.expense, currency)}`}
          </p>
          <p
            className="text-xs sm:text-sm font-medium text-[#94A3B8] truncate mt-0.5"
            title={`${language === 'pt-BR' ? 'A pagar:' : 'To pay:'} ${formatCurrency(monthStats.pendingExpense, currency)}`}
          >
            {language === 'pt-BR' ? 'A pagar:' : 'To pay:'}{' '}
            <span className="text-zinc-200 font-bold ml-0.5">
              {isBalanceHidden ? '••••' : formatCurrency(monthStats.pendingExpense, currency)}
            </span>
          </p>
        </div>
      </div>
    </div>
  );

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
      balanceCard={balanceCardElement}
    />
  );
};
