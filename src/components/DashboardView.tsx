import React, { useMemo } from 'react';
import {
  ArrowUpRight,
  ArrowDownRight,
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

  const isDark = theme === 'dark' || theme === 'tokyo-night';
  const gridStroke = theme === 'tokyo-night' ? '#292e42' : theme === 'dark' ? '#334155' : '#f1f5f9';
  const axisTickColor = theme === 'tokyo-night' ? '#787c99' : theme === 'dark' ? '#94a3b8' : '#64748b';
  const tooltipStyle = useMemo(
    () => ({
      borderRadius: '12px',
      border: `1px solid ${theme === 'tokyo-night' ? '#3b4261' : theme === 'dark' ? '#334155' : '#e2e8f0'}`,
      backgroundColor: theme === 'tokyo-night' ? '#1f2335' : theme === 'dark' ? '#0f172a' : '#ffffff',
      color: theme === 'tokyo-night' ? '#c0caf5' : theme === 'dark' ? '#f8fafc' : '#0f172a',
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

  return (
    <div className="space-y-6">
      {/* HERO BANK ACCOUNT BALANCE CARD */}
      <div className="hero-card relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6 sm:p-7 shadow-xl border border-slate-700/60">
        <div className="absolute -right-12 -top-12 w-56 h-56 rounded-full bg-emerald-500/10 blur-2xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 w-56 h-56 rounded-full bg-sky-500/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-center justify-between gap-5">
          {/* Spacer to counterbalance action buttons on desktop and keep balance dead-centered */}
          <div className="hidden md:block w-64 shrink-0" aria-hidden="true" />

          {/* Centered Balance Display */}
          <div className="text-center flex-1">
            <h1
              className={`text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight ${
                (currentBankBalance ?? 0) < 0 ? 'text-rose-400' : 'text-white'
              }`}
            >
              {formatCurrency(currentBankBalance ?? 0, currency)}
            </h1>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-center md:justify-end gap-3 w-full md:w-64 shrink-0">
            <button
              type="button"
              onClick={() => onOpenAddModal('income')}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-950/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus size={18} strokeWidth={2.75} />
              {t.addInputBtn}
            </button>
            <button
              type="button"
              onClick={() => onOpenAddModal('expense')}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-bold text-sm shadow-lg shadow-rose-950/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Minus size={18} strokeWidth={2.75} />
              {t.addExpenseBtn}
            </button>
          </div>
        </div>
      </div>

      {/* PRIMARY KPI CARDS: ENTRADAS & DESPESAS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Monthly Inputs */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t.inputsLabel}
            </span>
            <div className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <ArrowUpRight size={13} strokeWidth={2.5} />
            </div>
          </div>
          <div className="text-center my-auto py-0.5">
            <p className="text-2xl font-black text-emerald-500 tracking-tight">
              +{formatCurrency(monthStats.income, currency)}
            </p>
            <div className="mt-2.5 flex items-center justify-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <span className="opacity-75 font-medium">{t.pendingIncomeExpected}:</span>
                <span className="font-extrabold tracking-tight">
                  +{formatCurrency(monthStats.pendingIncome, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Monthly Expenses */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              {t.expensesLabel}
            </span>
            <div className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
              <ArrowDownRight size={13} strokeWidth={2.5} />
            </div>
          </div>
          <div className="text-center my-auto py-0.5">
            <p className="text-2xl font-black text-rose-500 tracking-tight">
              -{formatCurrency(monthStats.expense, currency)}
            </p>
            <div className="mt-2.5 flex items-center justify-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                <span className="opacity-75 font-medium">{t.pendingExpenseScheduled}:</span>
                <span className="font-extrabold tracking-tight">
                  -{formatCurrency(monthStats.pendingExpense, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CHARTS ROW 1: CATEGORY BREAKDOWN + 6-MONTH CASH FLOW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Breakdown */}
        <div className="lg:col-span-6 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <PieChartIcon size={18} className="text-indigo-500" />
                {t.expensesByCategory}
              </h2>
              <p className="text-xs text-slate-500">
                {t.breakdownForMonth(formatMonthLabel(selectedMonth, language))}
              </p>
            </div>
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
              {t.totalLabel}: {formatCurrency(monthStats.expense, currency)}
            </span>
          </div>

          {expenseCategoryBreakdown.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm font-semibold text-slate-600">
                {t.noExpensesYet(formatMonthLabel(selectedMonth, language))}
              </p>
              <p className="text-xs text-slate-400 mt-1 mb-4">{t.noExpensesDesc}</p>
              <button
                type="button"
                onClick={() => onOpenAddModal('expense')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700"
              >
                <Plus size={14} />
                {t.addFirstExpense}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div className="sm:col-span-5 h-56 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseCategoryBreakdown}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={2}
                    >
                      {expenseCategoryBreakdown.map((entry) => (
                        <Cell
                          key={entry.categoryId}
                          fill={entry.color}
                          stroke={isDark ? '#1e293b' : '#ffffff'}
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      formatter={(val: number) => formatCurrency(Number(val), currency)}
                      contentStyle={tooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="sm:col-span-7 space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {expenseCategoryBreakdown.map((item) => (
                  <div key={item.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <CategoryIcon icon={item.icon} color={item.color} size={14} badgeSize="sm" />
                        <span className="font-semibold text-slate-800 truncate">{item.name}</span>
                        <span className="text-[11px] text-slate-400">({item.count})</span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-bold text-slate-900">
                          {formatCurrency(item.amount, currency)}
                        </span>
                        <span className="text-slate-400 ml-1.5 text-[11px]">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(3, item.percentage)}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 6-Month Cash Flow Bar Chart */}
        <div className="lg:col-span-6 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 size={18} className="text-emerald-500" />
                {t.sixMonthTitle}
              </h2>
              <p className="text-xs text-slate-500">{t.sixMonthSub}</p>
            </div>
          </div>

          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sixMonthTrend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: axisTickColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: axisTickColor }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(Number(value), currency),
                    name === 'Inputs' ? t.chartInputs : t.chartExpenses,
                  ]}
                  contentStyle={tooltipStyle}
                />
                <Legend
                  formatter={(value) => (value === 'Inputs' ? t.chartInputs : t.chartExpenses)}
                  wrapperStyle={{ fontSize: '12px' }}
                />
                <Bar dataKey="Inputs" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
                <Bar dataKey="Expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SECONDARY KPI CARDS: PARCELAMENTOS & FATURAS EM ABERTO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Comprometimento com Parcelamentos */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Parcelamentos
            </span>
            <div className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
              <Layers size={13} strokeWidth={2.5} />
            </div>
          </div>
          <div className="text-center my-auto py-2">
            <p className="text-2xl font-black text-rose-500 tracking-tight">
              {installmentCommitment > 0
                ? `-${formatCurrency(installmentCommitment, currency)}`
                : formatCurrency(0, currency)}
            </p>
          </div>
        </div>

        {/* Total de Faturas em Aberto */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-center gap-1.5 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              FATURAS EM ABERTO
            </span>
            <div className="w-5 h-5 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <CreditCardIcon size={13} strokeWidth={2.5} />
            </div>
          </div>
          <div className="text-center my-auto py-2">
            <p className="text-2xl font-black text-amber-500 dark:text-amber-400 tracking-tight">
              {openInvoicesTotal > 0
                ? `-${formatCurrency(openInvoicesTotal, currency)}`
                : formatCurrency(0, currency)}
            </p>
          </div>
        </div>
      </div>

      {/* CHARTS ROW 2: DAILY SPENDING EVOLUTION + RECENT TRANSACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Spending Trend */}
        <div className="lg:col-span-6 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Activity size={18} className="text-rose-500" />
                {t.dailySpendingTitle}
              </h2>
              <p className="text-xs text-slate-500">
                {t.dailySpendingSub(formatMonthLabel(selectedMonth, language))}
              </p>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrendData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: axisTickColor }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: axisTickColor }} axisLine={false} tickLine={false} />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(Number(value), currency),
                    name === 'CumulativeExpense' ? t.cumulativeMonthSpend : t.dailySpend,
                  ]}
                  labelFormatter={(day) => t.dayLabel(day)}
                  contentStyle={tooltipStyle}
                />
                <Area
                  type="monotone"
                  dataKey="CumulativeExpense"
                  name="CumulativeExpense"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#cumGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="DailyExpense"
                  name="DailyExpense"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  fill="#f43f5e"
                  fillOpacity={0.12}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Transactions in Selected Month */}
        <div className="lg:col-span-6 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {t.recentActivity} ({formatShortMonthLabel(selectedMonth, language)})
                </h2>
                <p className="text-xs text-slate-500">{t.latestInputsAndExpenses}</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('transactions')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-500 hover:text-indigo-400"
              >
                {t.viewAllCount(monthTransactions.length)}
                <ChevronRight size={14} />
              </button>
            </div>

            {monthTransactions.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-slate-500">
                  {t.noEntriesInMonth(formatMonthLabel(selectedMonth, language))}
                </p>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <button
                    type="button"
                    onClick={() => onOpenAddModal('income')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 text-xs font-semibold hover:bg-emerald-500/20"
                  >
                    <Plus size={14} strokeWidth={2.5} />
                    {t.addInputShort}
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAddModal('expense')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 text-rose-500 text-xs font-semibold hover:bg-rose-500/20"
                  >
                    <Minus size={14} strokeWidth={2.5} />
                    {t.addExpenseShort}
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {monthTransactions.slice(0, 6).map((tx) => {
                  const cat = categoryMap.get(tx.categoryId);
                  const isUnpaid = tx.status === 'unpaid';
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-2.5 gap-3 group"
                    >
                      <div
                        className={`flex items-center gap-3 min-w-0 transition-opacity ${
                          isUnpaid ? 'opacity-65' : 'opacity-100'
                        }`}
                      >
                        <CategoryIcon
                          icon={cat?.icon || 'Tag'}
                          color={cat?.color || '#64748b'}
                          size={16}
                          badgeSize="md"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-semibold text-slate-900 truncate">
                              {tx.description}
                            </p>
                            {isUnpaid && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[9px] font-extrabold uppercase">
                                <Clock size={9} />
                                {t.pendingBadge}
                              </span>
                            )}
                            {tx.installmentTotal && tx.installmentTotal > 1 && (
                              <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/15 text-indigo-500 text-[10px] font-bold">
                                {tx.installmentCurrent || 1}/{tx.installmentTotal}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 truncate">
                            {getCategoryDisplayName(cat, language)} • {formatShortDate(tx.date, language)}
                            {tx.dueDay ? ` • ${t.dueDayBadge(tx.dueDay)}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-sm font-bold ${
                            isUnpaid
                              ? 'opacity-65 text-amber-500'
                              : tx.type === 'income'
                              ? 'text-emerald-500'
                              : 'text-rose-500'
                          }`}
                        >
                          {tx.type === 'income' ? '+' : '-'}
                          {formatCurrency(tx.amount, currency)}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onToggleTransactionStatus(tx)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isUnpaid
                                ? 'bg-amber-500/15 border-amber-500/30 text-amber-500 hover:text-emerald-500'
                                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500 hover:text-amber-500'
                            }`}
                            title={isUnpaid ? t.markAsPaidTooltip : t.markAsUnpaidTooltip}
                          >
                            {isUnpaid ? <ThumbsDown size={13} /> : <ThumbsUp size={13} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenEditModal(tx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title={t.editTooltip}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTransaction(tx.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10"
                            title={t.deleteTooltip}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
