import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Printer,
  FileBarChart2,
  Award,
  TrendingUp,
  TrendingDown,
  CalendarRange,
  PieChart as PieChartIcon,
  BarChart3,
  Activity,
  Layers,
  ChevronLeft,
  ChevronRight,
  Target,
  Clock,
  CheckCircle2,
  Compass,
  ArrowUp,
  ArrowDown,
  GripVertical,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ComposedChart,
  Area,
  Line,
  ReferenceLine,
  Legend,
} from 'recharts';
import { AppLanguage, AppTheme, Category, RecurringTemplate, Transaction } from '../types';
import {
  exportTransactionsToCSV,
  formatCurrency,
  formatMonthLabel,
  formatShortMonthLabel,
  shiftMonth,
} from '../utils/format';
import { exportFilteredHistoryToPDF } from '../utils/exportReport';
import { getCategoryDisplayName, TRANSLATIONS } from '../utils/i18n';
import { CategoryIcon } from './CategoryIcon';

export type ReportSectionId = 'charts' | 'installments' | 'projections' | 'summary' | 'tables';

const STORAGE_REPORTS_ORDER_KEY = 'familyplan_reports_section_order_v1';
const DEFAULT_SECTION_ORDER: ReportSectionId[] = [
  'charts',
  'installments',
  'projections',
  'summary',
  'tables',
];

function loadSavedSectionOrder(): ReportSectionId[] {
  try {
    const raw = localStorage.getItem(STORAGE_REPORTS_ORDER_KEY);
    if (!raw) return DEFAULT_SECTION_ORDER;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_SECTION_ORDER;
    const validSet = new Set<ReportSectionId>(DEFAULT_SECTION_ORDER);
    const filtered = parsed.filter((item): item is ReportSectionId => validSet.has(item));
    for (const sec of DEFAULT_SECTION_ORDER) {
      if (!filtered.includes(sec)) filtered.push(sec);
    }
    return filtered;
  } catch {
    return DEFAULT_SECTION_ORDER;
  }
}

interface ReportsViewProps {
  selectedMonth: string;
  familyName: string;
  currency: string;
  language: AppLanguage;
  theme?: AppTheme;
  initialBalance: number;
  categories: Category[];
  transactions: Transaction[];
  recurringTemplates?: RecurringTemplate[];
  onSelectMonth?: (month: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  selectedMonth,
  familyName,
  currency,
  language,
  theme = 'tokyo-night',
  initialBalance,
  categories,
  transactions,
  recurringTemplates = [],
  onSelectMonth,
}) => {
  const t = TRANSLATIONS[language];
  const [rangeType, setRangeType] = useState<'1m' | '3m' | '6m' | '12m' | 'all'>('1m');
  const [historyMonthsCount, setHistoryMonthsCount] = useState<6 | 12>(6);
  const [forecastMonthsCount, setForecastMonthsCount] = useState<3 | 6>(6);
  const [customTargetBudget, setCustomTargetBudget] = useState<string>('');
  const [sectionOrder, setSectionOrder] = useState<ReportSectionId[]>(() => loadSavedSectionOrder());
  const [showLayoutOrganizer, setShowLayoutOrganizer] = useState(false);
  const [draggedSection, setDraggedSection] = useState<ReportSectionId | null>(null);
  const [dragOverSection, setDragOverSection] = useState<ReportSectionId | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_REPORTS_ORDER_KEY, JSON.stringify(sectionOrder));
    } catch {
      // Ignore storage errors
    }
  }, [sectionOrder]);

  const isDefaultOrder = useMemo(
    () => sectionOrder.every((sec, idx) => sec === DEFAULT_SECTION_ORDER[idx]),
    [sectionOrder]
  );

  const moveSection = (id: ReportSectionId, direction: 'up' | 'down') => {
    setSectionOrder((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      next.splice(targetIdx, 0, removed);
      return next;
    });
  };

  const handleDropSection = (targetId: ReportSectionId) => {
    if (!draggedSection || draggedSection === targetId) {
      setDraggedSection(null);
      setDragOverSection(null);
      return;
    }
    setSectionOrder((prev) => {
      const fromIdx = prev.indexOf(draggedSection);
      const toIdx = prev.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const next = [...prev];
      const [removed] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, removed);
      return next;
    });
    setDraggedSection(null);
    setDragOverSection(null);
  };

  const resetSectionOrder = () => {
    setSectionOrder(DEFAULT_SECTION_ORDER);
  };

  const sectionLabels: Record<ReportSectionId, string> = {
    charts: t.secChartsTitle,
    installments: t.secInstallmentsTitle,
    projections: t.secProjectionsTitle,
    summary: t.secSummaryTitle,
    tables: t.secTablesTitle,
  };

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

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const selectedYear = selectedMonth.slice(0, 4);
  const selectedMonthNum = Number(selectedMonth.slice(5, 7));

  // Available years for quick switching
  const availableYears = useMemo(() => {
    const curY = String(new Date().getFullYear());
    const set = new Set<string>([curY, selectedYear]);
    for (const tx of transactions) {
      if (tx.date && tx.date.length >= 4) set.add(tx.date.slice(0, 4));
    }
    return Array.from(set).sort().reverse();
  }, [transactions, selectedYear]);

  // Period Transactions based on rangeType
  const { periodTransactions, periodLabel, numDays } = useMemo(() => {
    if (rangeType === 'all') {
      const dates = transactions.map((tx) => tx.date).sort();
      const firstDate = dates[0] || selectedMonth + '-01';
      const lastDate = dates[dates.length - 1] || selectedMonth + '-28';
      const diffMs = Math.max(1, new Date(lastDate).getTime() - new Date(firstDate).getTime());
      const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
      return {
        periodTransactions: transactions,
        periodLabel: t.allRecordedHistory,
        numDays: days,
      };
    }

    const monthsCount = rangeType === '1m' ? 1 : rangeType === '3m' ? 3 : rangeType === '6m' ? 6 : 12;
    const allowedMonths = new Set<string>();
    for (let i = 0; i < monthsCount; i++) {
      allowedMonths.add(shiftMonth(selectedMonth, -i));
    }

    const filtered = transactions.filter((tx) => allowedMonths.has(tx.date.slice(0, 7)));
    const startMonth = shiftMonth(selectedMonth, -(monthsCount - 1));
    const label =
      monthsCount === 1
        ? formatMonthLabel(selectedMonth, language)
        : `${formatMonthLabel(startMonth, language)} – ${formatMonthLabel(selectedMonth, language)}`;

    return {
      periodTransactions: filtered,
      periodLabel: label,
      numDays: monthsCount * 30,
    };
  }, [rangeType, selectedMonth, transactions, language, t]);

  // Live Bank Balance (only 'paid' transactions affect current wallet/account balance)
  const currentBankBalance = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const tx of transactions) {
      if (tx.status === 'unpaid' || tx.cardId) continue;
      if (tx.type === 'income') inc += tx.amount;
      else exp += tx.amount;
    }
    return initialBalance + inc - exp;
  }, [transactions, initialBalance]);

  // Period Realized Stats (Paid only)
  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    let largestExpense: Transaction | null = null;

    for (const tx of periodTransactions) {
      if (tx.status === 'unpaid') continue;
      if (tx.type === 'income') {
        income += tx.amount;
        incomeCount++;
      } else {
        expense += tx.amount;
        expenseCount++;
        if (!largestExpense || tx.amount > largestExpense.amount) {
          largestExpense = tx;
        }
      }
    }

    const net = income - expense;
    const savingsRate = income > 0 ? ((income - expense) / income) * 100 : 0;
    const avgDailyExpense = numDays > 0 ? expense / numDays : 0;

    return {
      income,
      expense,
      incomeCount,
      expenseCount,
      net,
      savingsRate,
      avgDailyExpense,
      largestExpense,
    };
  }, [periodTransactions, numDays]);

  // Historical Monthly Averages (from months that have paid transactions)
  const historicalMonthlyAverages = useMemo(() => {
    const monthTotals = new Map<string, { income: number; expense: number }>();
    for (const tx of transactions) {
      if (tx.status === 'unpaid') continue;
      const m = tx.date.slice(0, 7);
      const cur = monthTotals.get(m) || { income: 0, expense: 0 };
      if (tx.type === 'income') cur.income += tx.amount;
      else cur.expense += tx.amount;
      monthTotals.set(m, cur);
    }

    const monthsArr = Array.from(monthTotals.values());
    if (monthsArr.length === 0) {
      return { avgMonthlyIncome: 0, avgMonthlyExpense: 0 };
    }
    const sumInc = monthsArr.reduce((a, b) => a + b.income, 0);
    const sumExp = monthsArr.reduce((a, b) => a + b.expense, 0);
    return {
      avgMonthlyIncome: sumInc / monthsArr.length,
      avgMonthlyExpense: sumExp / monthsArr.length,
    };
  }, [transactions]);

  // =========================================================================
  // 1. YTD SUMMARY & YEAR-END EXPENSE FORECAST (THROUGH DEC 31)
  // =========================================================================
  const ytdAndYearEndForecast = useMemo(() => {
    let ytdIncome = 0;
    let ytdExpense = 0;
    const ytdPaidMonthsSet = new Set<string>();

    for (const tx of transactions) {
      if (!tx.date.startsWith(`${selectedYear}-`)) continue;
      if (tx.status === 'unpaid') continue;
      ytdPaidMonthsSet.add(tx.date.slice(0, 7));
      if (tx.type === 'income') ytdIncome += tx.amount;
      else ytdExpense += tx.amount;
    }

    const ytdNet = ytdIncome - ytdExpense;
    const ytdSavingsRate = ytdIncome > 0 ? ((ytdIncome - ytdExpense) / ytdIncome) * 100 : 0;

    const remainingMonthsCount = Math.max(0, 12 - selectedMonthNum);
    const baseAvgMonthlyExp =
      ytdPaidMonthsSet.size > 0
        ? ytdExpense / ytdPaidMonthsSet.size
        : historicalMonthlyAverages.avgMonthlyExpense;
    const baseAvgMonthlyInc =
      ytdPaidMonthsSet.size > 0
        ? ytdIncome / ytdPaidMonthsSet.size
        : historicalMonthlyAverages.avgMonthlyIncome;

    let projectedRemainingExpense = 0;
    let projectedRemainingIncome = 0;
    let scheduledRemainingUnpaidExpense = 0;

    for (const tx of transactions) {
      if (tx.date.startsWith(selectedMonth) && tx.status === 'unpaid') {
        if (tx.type === 'expense') {
          projectedRemainingExpense += tx.amount;
          scheduledRemainingUnpaidExpense += tx.amount;
        } else {
          projectedRemainingIncome += tx.amount;
        }
      }
    }

    for (let m = selectedMonthNum + 1; m <= 12; m++) {
      const mStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
      let unpaidExpInM = 0;
      let unpaidIncInM = 0;
      for (const tx of transactions) {
        if (tx.date.startsWith(mStr) && tx.status === 'unpaid') {
          if (tx.type === 'expense') unpaidExpInM += tx.amount;
          else unpaidIncInM += tx.amount;
        }
      }
      scheduledRemainingUnpaidExpense += unpaidExpInM;
      projectedRemainingExpense += Math.max(unpaidExpInM, baseAvgMonthlyExp);
      projectedRemainingIncome += Math.max(unpaidIncInM, baseAvgMonthlyInc);
    }

    const projectedYearEndSpend = ytdExpense + projectedRemainingExpense;
    const projectedYearEndIncome = ytdIncome + projectedRemainingIncome;
    const projectedYearEndBalance =
      currentBankBalance + projectedRemainingIncome - projectedRemainingExpense;

    return {
      ytdIncome,
      ytdExpense,
      ytdNet,
      ytdSavingsRate,
      remainingMonthsCount,
      scheduledRemainingUnpaidExpense,
      projectedYearEndSpend,
      projectedYearEndIncome,
      projectedYearEndBalance,
    };
  }, [
    transactions,
    selectedYear,
    selectedMonth,
    selectedMonthNum,
    historicalMonthlyAverages,
    currentBankBalance,
  ]);

  // =========================================================================
  // 2. SPENDING BY CATEGORY (DONUT CHART & TABLE)
  // =========================================================================
  const expenseReportRows = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    for (const tx of periodTransactions) {
      if (tx.type !== 'expense' || tx.status === 'unpaid') continue;
      const cur = map.get(tx.categoryId) || { amount: 0, count: 0 };
      map.set(tx.categoryId, { amount: cur.amount + tx.amount, count: cur.count + 1 });
    }

    return Array.from(map.entries())
      .map(([catId, data]) => {
        const cat = categoryMap.get(catId);
        return {
          id: catId,
          name: getCategoryDisplayName(cat, language),
          color: cat?.color || '#64748b',
          icon: cat?.icon || 'Tag',
          count: data.count,
          amount: Number(data.amount.toFixed(2)),
          avg: data.count > 0 ? data.amount / data.count : 0,
          share: stats.expense > 0 ? (data.amount / stats.expense) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [periodTransactions, categoryMap, stats.expense, language]);

  const incomeReportRows = useMemo(() => {
    const map = new Map<string, { amount: number; count: number }>();
    for (const tx of periodTransactions) {
      if (tx.type !== 'income' || tx.status === 'unpaid') continue;
      const cur = map.get(tx.categoryId) || { amount: 0, count: 0 };
      map.set(tx.categoryId, { amount: cur.amount + tx.amount, count: cur.count + 1 });
    }

    return Array.from(map.entries())
      .map(([catId, data]) => {
        const cat = categoryMap.get(catId);
        return {
          id: catId,
          name: getCategoryDisplayName(cat, language),
          color: cat?.color || '#00D09E',
          icon: cat?.icon || 'Landmark',
          count: data.count,
          amount: Number(data.amount.toFixed(2)),
          share: stats.income > 0 ? (data.amount / stats.income) * 100 : 0,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [periodTransactions, categoryMap, stats.income, language]);

  // =========================================================================
  // 3. CASH FLOW HISTORY & COMPARISON CHART (PAST 6 TO 12 MONTHS)
  // =========================================================================
  const cashFlowHistorySeries = useMemo(() => {
    const months: string[] = [];
    for (let i = historyMonthsCount - 1; i >= 0; i--) {
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
  }, [transactions, selectedMonth, historyMonthsCount, language]);

  // =========================================================================
  // 4. DAILY CUMULATIVE BURN RATE VS. TARGET BUDGET CHART
  // =========================================================================
  const defaultTargetBudget = useMemo(() => {
    if (historicalMonthlyAverages.avgMonthlyExpense > 0) {
      return Math.round(historicalMonthlyAverages.avgMonthlyExpense);
    }
    if (stats.income > 0) {
      return Math.round(stats.income * 0.8);
    }
    return 5000;
  }, [historicalMonthlyAverages.avgMonthlyExpense, stats.income]);

  const effectiveTargetBudget = useMemo(() => {
    const parsed = parseFloat(customTargetBudget);
    if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    return defaultTargetBudget;
  }, [customTargetBudget, defaultTargetBudget]);

  const dailyBurnRateSeries = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate() || 30;
    const dailyMap = new Map<number, number>();
    for (let d = 1; d <= daysInMonth; d++) dailyMap.set(d, 0);

    for (const tx of transactions) {
      if (tx.status === 'unpaid' || tx.type !== 'expense') continue;
      if (!tx.date.startsWith(selectedMonth)) continue;
      const day = Number(tx.date.split('-')[2]);
      if (day >= 1 && day <= daysInMonth) {
        dailyMap.set(day, (dailyMap.get(day) || 0) + tx.amount);
      }
    }

    let cumSpend = 0;
    const series = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dailyExp = dailyMap.get(d) || 0;
      cumSpend += dailyExp;
      const targetPace = (effectiveTargetBudget / daysInMonth) * d;
      series.push({
        day: String(d).padStart(2, '0'),
        DailySpend: Number(dailyExp.toFixed(2)),
        CumulativeSpend: Number(cumSpend.toFixed(2)),
        TargetPace: Number(targetPace.toFixed(2)),
      });
    }
    return series;
  }, [selectedMonth, transactions, effectiveTargetBudget]);

  // =========================================================================
  // 5. FUTURE MONTHS CASH FLOW FORECAST (NEXT 3 TO 6 MONTHS)
  // =========================================================================
  const futureForecastSeries = useMemo(() => {
    const avgTotalExp = historicalMonthlyAverages.avgMonthlyExpense;
    const avgTotalInc = historicalMonthlyAverages.avgMonthlyIncome;

    let runningProjectedBalance = currentBankBalance;
    const series = [];

    for (let step = 1; step <= forecastMonthsCount; step++) {
      const fMonth = shiftMonth(selectedMonth, step);
      let scheduledFixedExp = 0;
      let scheduledFixedInc = 0;

      const appliedRecIds = new Set<string>();
      for (const tx of transactions) {
        if (tx.date.startsWith(fMonth)) {
          if (tx.recurringId) appliedRecIds.add(tx.recurringId);
          if (tx.type === 'expense') scheduledFixedExp += tx.amount;
          else scheduledFixedInc += tx.amount;
        }
      }

      for (const tpl of recurringTemplates) {
        if (!tpl.active || appliedRecIds.has(tpl.id)) continue;
        if (tpl.isInstallment && tpl.totalInstallments && tpl.startMonth) {
          const [sy, sm] = tpl.startMonth.split('-').map(Number);
          const [ty, tm] = fMonth.split('-').map(Number);
          const instNum = (ty - sy) * 12 + (tm - sm) + 1;
          if (instNum < 1 || instNum > tpl.totalInstallments) continue;
        }
        if (tpl.type === 'expense') scheduledFixedExp += tpl.amount;
        else scheduledFixedInc += tpl.amount;
      }

      const estimatedVariableExp = Math.max(0, avgTotalExp - scheduledFixedExp) * 0.65;
      const projectedIncome = Math.max(scheduledFixedInc, avgTotalInc);
      const totalProjectedExp = scheduledFixedExp + estimatedVariableExp;
      runningProjectedBalance += projectedIncome - totalProjectedExp;

      series.push({
        month: fMonth,
        label: formatShortMonthLabel(fMonth, language),
        fullLabel: formatMonthLabel(fMonth, language),
        ProjectedIncome: Number(projectedIncome.toFixed(2)),
        ScheduledFixedBills: Number(scheduledFixedExp.toFixed(2)),
        EstVariableSpend: Number(estimatedVariableExp.toFixed(2)),
        TotalProjectedExpense: Number(totalProjectedExp.toFixed(2)),
        ProjectedBalance: Number(runningProjectedBalance.toFixed(2)),
      });
    }

    return series;
  }, [
    selectedMonth,
    forecastMonthsCount,
    transactions,
    recurringTemplates,
    historicalMonthlyAverages,
    currentBankBalance,
    language,
  ]);

  // =========================================================================
  // 6. INSTALLMENT TRACKER WIDGET (DESPESAS PARCELADAS)
  //    Strict Rule:
  //    - Total Paid: Strictly sum & count of installments where status === 'paid'
  //    - Remaining Debt: Strictly sum & count of installments where status === 'unpaid'
  //    - Progress bar & counter ('Installment X of Y'): actual paid count / total installments
  // =========================================================================
  const installmentPlans = useMemo(() => {
    const groups = new Map<
      string,
      {
        key: string;
        description: string;
        categoryId: string;
        monthlyAmount: number;
        totalInstallments: number;
        paidCount: number;
        unpaidCount: number;
        paidAmountSum: number;
        unpaidAmountSum: number;
        endMonth: string;
        dueDay: number | null;
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
      const curNum = tx.installmentCurrent || 1;
      const totNum = tx.installmentTotal || 2;
      const txMonth = tx.date.slice(0, 7);
      const impliedEndMonth = shiftMonth(txMonth, Math.max(0, totNum - curNum));

      if (!existing) {
        groups.set(groupKey, {
          key: groupKey,
          description: tx.description,
          categoryId: tx.categoryId,
          monthlyAmount: tx.amount,
          totalInstallments: totNum,
          paidCount: isPaid ? 1 : 0,
          unpaidCount: isPaid ? 0 : 1,
          paidAmountSum: isPaid ? tx.amount : 0,
          unpaidAmountSum: isPaid ? 0 : tx.amount,
          endMonth: impliedEndMonth,
          dueDay: tx.dueDay || null,
        });
      } else {
        if (isPaid) {
          existing.paidCount += 1;
          existing.paidAmountSum += tx.amount;
        } else {
          existing.unpaidCount += 1;
          existing.unpaidAmountSum += tx.amount;
        }
        if (totNum > existing.totalInstallments) {
          existing.totalInstallments = totNum;
        }
        if (txMonth > existing.endMonth) {
          existing.endMonth = txMonth;
        }
      }
    }

    return Array.from(groups.values())
      .map((plan) => {
        const cat = categoryMap.get(plan.categoryId);
        const totalInstallments = Math.max(
          plan.totalInstallments,
          plan.paidCount + plan.unpaidCount
        );
        const paidInstallments = plan.paidCount;
        const remainingInstallments =
          plan.unpaidCount > 0
            ? plan.unpaidCount
            : Math.max(0, totalInstallments - paidInstallments);

        const totalPaidAmount = Number(plan.paidAmountSum.toFixed(2));
        const remainingDebtAmount =
          plan.unpaidCount > 0
            ? Number(plan.unpaidAmountSum.toFixed(2))
            : Number((remainingInstallments * plan.monthlyAmount).toFixed(2));

        const totalAmount = Number((totalPaidAmount + remainingDebtAmount).toFixed(2));
        const progressPct =
          totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 0;

        return {
          ...plan,
          totalInstallments,
          categoryName: getCategoryDisplayName(cat, language),
          categoryColor: cat?.color || '#6366f1',
          categoryIcon: cat?.icon || 'ShoppingBag',
          paidInstallments,
          remainingInstallments,
          totalAmount,
          totalPaidAmount,
          remainingDebtAmount,
          progressPct,
          endMonthLabel: formatShortMonthLabel(plan.endMonth, language),
        };
      })
      .sort((a, b) => b.remainingDebtAmount - a.remainingDebtAmount);
  }, [transactions, categoryMap, language]);

  const installmentSummary = useMemo(() => {
    const activePlans = installmentPlans.filter((p) => p.remainingInstallments > 0);
    const monthlyCommitment = activePlans.reduce((sum, p) => sum + p.monthlyAmount, 0);
    const totalPaid = installmentPlans.reduce((sum, p) => sum + p.totalPaidAmount, 0);
    const totalRemainingDebt = activePlans.reduce((sum, p) => sum + p.remainingDebtAmount, 0);
    return {
      activeCount: activePlans.length,
      monthlyCommitment,
      totalPaid,
      totalRemainingDebt,
    };
  }, [installmentPlans]);

  // =========================================================================
  // 7. MONTH-BY-MONTH HISTORICAL TABLE
  // =========================================================================
  const monthlyComparisonRows = useMemo(() => {
    const allMonthsSet = new Set<string>();
    for (const tx of transactions) {
      allMonthsSet.add(tx.date.slice(0, 7));
    }
    allMonthsSet.add(selectedMonth);
    const sortedMonthsAsc = Array.from(allMonthsSet).sort();

    let runningBalance = initialBalance;
    const rows = sortedMonthsAsc.map((m) => {
      let inc = 0;
      let exp = 0;
      let count = 0;
      for (const tx of transactions) {
        if (tx.status === 'unpaid') continue;
        if (tx.date.startsWith(m)) {
          count++;
          if (tx.type === 'income') inc += tx.amount;
          else exp += tx.amount;
        }
      }
      const net = inc - exp;
      runningBalance += net;
      const rate = inc > 0 ? ((inc - exp) / inc) * 100 : 0;
      return {
        month: m,
        label: formatMonthLabel(m, language),
        income: inc,
        expense: exp,
        net,
        savingsRate: rate,
        closingBalance: runningBalance,
        count,
      };
    });

    return rows.reverse();
  }, [transactions, selectedMonth, initialBalance, language]);

  // Subtle dark-blended section header bar (no contrasting white/light background)
  const renderSectionControlHeader = (sectionId: ReportSectionId, index: number) => (
    <div
      style={{
        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(15, 23, 42, 0.03)',
        borderColor: isDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(15, 23, 42, 0.08)',
      }}
      className="print:hidden flex items-center justify-between px-3 py-1 rounded-xl border text-[11px] font-semibold tracking-wider uppercase text-slate-400"
    >
      <div className="flex items-center gap-1.5">
        <GripVertical size={13} className="text-slate-500 cursor-grab active:cursor-grabbing" />
        <span>{sectionLabels[sectionId]}</span>
      </div>
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => moveSection(sectionId, 'up')}
          title={t.moveSectionUp}
          className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-500/10 disabled:opacity-25 disabled:pointer-events-none transition-colors"
        >
          <ArrowUp size={12} />
        </button>
        <button
          type="button"
          disabled={index === sectionOrder.length - 1}
          onClick={() => moveSection(sectionId, 'down')}
          title={t.moveSectionDown}
          className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-500/10 disabled:opacity-25 disabled:pointer-events-none transition-colors"
        >
          <ArrowDown size={12} />
        </button>
      </div>
    </div>
  );

  // =========================================================================
  // RENDERERS FOR EACH REORDERABLE SECTION
  // =========================================================================
  const renderChartsSection = () => (
    <div className="space-y-5">
      {/* VISUAL ANALYTICS ROW 1: SPENDING BY CATEGORY (DONUT) + CASH FLOW HISTORY (6-12M) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Interactive Donut Chart: Spending by Category */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 truncate">
              <PieChartIcon size={17} className="text-indigo-500 shrink-0" />
              <span className="truncate">{t.expensesBreakdownByCat}</span>
            </h2>
            <span className="text-xs font-extrabold text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-lg shrink-0">
              {formatCurrency(stats.expense, currency)}
            </span>
          </div>

          {expenseReportRows.length === 0 ? (
            <div className="h-[310px] flex items-center justify-center text-xs text-slate-400">
              {t.noExpensesInPeriod}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center min-h-[310px]">
              <div className="sm:col-span-5 h-[280px] sm:h-[310px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseReportRows}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={94}
                      paddingAngle={2}
                    >
                      {expenseReportRows.map((entry) => (
                        <Cell
                          key={entry.id}
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
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-bold uppercase text-slate-400">
                    {t.expensesLabel}
                  </span>
                  <span className="text-xs font-extrabold text-slate-900">
                    {formatCurrency(stats.expense, currency)}
                  </span>
                </div>
              </div>

              <div className="sm:col-span-7 space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {expenseReportRows.map((item) => (
                  <div key={item.id} className="space-y-1">
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
                          {item.share.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(3, item.share)}%`,
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

        {/* Cash Flow History & Comparison (6 to 12 Months) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 truncate">
              <BarChart3 size={17} className="text-emerald-500 shrink-0" />
              <span className="truncate">{t.cashFlowHistoryChartTitle}</span>
            </h2>

            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setHistoryMonthsCount(6)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  historyMonthsCount === 6
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                6M
              </button>
              <button
                type="button"
                onClick={() => setHistoryMonthsCount(12)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  historyMonthsCount === 12
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                12M
              </button>
            </div>
          </div>

          <div className="h-[310px] w-full">
            <ResponsiveContainer width="100%" height={310}>
              <ComposedChart
                data={cashFlowHistorySeries}
                margin={{ top: 12, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: axisTickColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisTickColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(Number(value), currency),
                    name === 'Inputs'
                      ? t.chartInputs
                      : name === 'Expenses'
                      ? t.chartExpenses
                      : t.netCashFlow,
                  ]}
                  contentStyle={tooltipStyle}
                />
                <Legend
                  verticalAlign="bottom"
                  height={26}
                  formatter={(value) =>
                    value === 'Inputs'
                      ? t.chartInputs
                      : value === 'Expenses'
                      ? t.chartExpenses
                      : t.netCashFlow
                  }
                  wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                />
                <Bar dataKey="Inputs" fill="#00D09E" radius={[6, 6, 0, 0]} maxBarSize={30} />
                <Bar dataKey="Expenses" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={30} />
                <Line
                  type="monotone"
                  dataKey="Net"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#6366f1' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* VISUAL ANALYTICS ROW 2: DAILY CUMULATIVE BURN RATE + FUTURE MONTHS CASH FLOW FORECAST */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Daily Cumulative Burn Rate vs. Target Budget Line */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 truncate">
              <Activity size={17} className="text-rose-500 shrink-0" />
              <span className="truncate">{t.dailyBurnRateTitle}</span>
            </h2>

            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-xl text-xs shrink-0">
              <Target size={13} className="text-amber-500 shrink-0" />
              <span className="font-semibold text-slate-500 hidden sm:inline">
                {t.targetBudgetLabel}:
              </span>
              <input
                type="number"
                step="100"
                min="100"
                placeholder={String(defaultTargetBudget)}
                value={customTargetBudget}
                onChange={(e) => setCustomTargetBudget(e.target.value)}
                className="w-20 px-1.5 py-0.5 rounded bg-white border border-slate-200 text-xs font-bold text-slate-900 text-right"
              />
            </div>
          </div>

          <div className="h-[310px] w-full">
            <ResponsiveContainer width="100%" height={310}>
              <ComposedChart
                data={dailyBurnRateSeries}
                margin={{ top: 12, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="burnRateGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: axisTickColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisTickColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(Number(value), currency),
                    name === 'CumulativeSpend'
                      ? t.actualCumulativeLine
                      : name === 'TargetPace'
                      ? t.targetPaceLine
                      : t.dailySpend,
                  ]}
                  labelFormatter={(day) => t.dayLabel(day)}
                  contentStyle={tooltipStyle}
                />
                <Legend
                  verticalAlign="bottom"
                  height={26}
                  formatter={(value) =>
                    value === 'CumulativeSpend' ? t.actualCumulativeLine : t.targetPaceLine
                  }
                  wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                />
                <ReferenceLine
                  y={effectiveTargetBudget}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="CumulativeSpend"
                  stroke="#f43f5e"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#burnRateGrad)"
                />
                <Line
                  type="monotone"
                  dataKey="TargetPace"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Future Months Cash Flow Forecast (Next 3 to 6 Months) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 truncate">
              <TrendingUp size={17} className="text-sky-500 shrink-0" />
              <span className="truncate">{t.futureForecastTitle}</span>
            </h2>

            <div className="inline-flex bg-slate-100 p-0.5 rounded-xl text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setForecastMonthsCount(3)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  forecastMonthsCount === 3
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t.next3MonthsBtn}
              </button>
              <button
                type="button"
                onClick={() => setForecastMonthsCount(6)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  forecastMonthsCount === 6
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {t.next6MonthsBtn}
              </button>
            </div>
          </div>

          <div className="h-[310px] w-full">
            <ResponsiveContainer width="100%" height={310}>
              <ComposedChart
                data={futureForecastSeries}
                margin={{ top: 12, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: axisTickColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: axisTickColor }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(Number(value), currency),
                    name === 'ProjectedIncome'
                      ? t.projectedIncomeLabel
                      : name === 'ScheduledFixedBills'
                      ? t.scheduledFixedBillsLabel
                      : name === 'EstVariableSpend'
                      ? t.estVariableSpendLabel
                      : t.projectedBalanceLabel,
                  ]}
                  contentStyle={tooltipStyle}
                />
                <Legend
                  verticalAlign="bottom"
                  height={26}
                  formatter={(value) =>
                    value === 'ProjectedIncome'
                      ? t.projectedIncomeLabel
                      : value === 'ScheduledFixedBills'
                      ? t.scheduledFixedBillsLabel
                      : value === 'EstVariableSpend'
                      ? t.estVariableSpendLabel
                      : t.projectedBalanceLabel
                  }
                  wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                />
                <Bar
                  dataKey="ProjectedIncome"
                  fill="#00D09E"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="ScheduledFixedBills"
                  stackId="exp"
                  fill="#f59e0b"
                  radius={[0, 0, 0, 0]}
                  maxBarSize={28}
                />
                <Bar
                  dataKey="EstVariableSpend"
                  stackId="exp"
                  fill="#f43f5e"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={28}
                />
                <Line
                  type="monotone"
                  dataKey="ProjectedBalance"
                  stroke="#38bdf8"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#38bdf8' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );

  const renderInstallmentsSection = () => (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
        <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
          <Layers size={18} className="text-indigo-500 shrink-0" />
          <span>{t.installmentTrackerTitle}</span>
        </h2>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-500 font-bold">
            {t.activePlansBadge(installmentSummary.activeCount)}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
            {t.totalMonthlyCommitment}:{' '}
            <strong className="text-rose-500">
              {formatCurrency(installmentSummary.monthlyCommitment, currency)}/mês
            </strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
            {t.totalAlreadyPaid}:{' '}
            <strong className="text-emerald-500">
              {formatCurrency(installmentSummary.totalPaid, currency)}
            </strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold">
            {t.totalRemainingDebtAll}:{' '}
            <strong className="text-amber-500">
              {formatCurrency(installmentSummary.totalRemainingDebt, currency)}
            </strong>
          </span>
        </div>
      </div>

      {installmentPlans.length === 0 ? (
        <div className="py-8 text-center space-y-1.5">
          <Layers size={26} className="mx-auto text-slate-400" />
          <p className="text-sm font-bold text-slate-700">{t.noActiveInstallments}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {installmentPlans.map((plan) => {
            const isConcluded = plan.remainingInstallments === 0;
            return (
              <div
                key={plan.key}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <CategoryIcon
                      icon={plan.categoryIcon}
                      color={plan.categoryColor}
                      size={17}
                      badgeSize="md"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">
                        {plan.description}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {plan.categoryName} • {t.endsInBadge(plan.endMonthLabel)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">
                      {t.monthlyInstallmentValue}
                    </span>
                    <span className="text-sm font-extrabold text-rose-500">
                      {formatCurrency(plan.monthlyAmount, currency)}
                    </span>
                  </div>
                </div>

                {/* Progress Bar & Actual Paid Installments X of Y */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-1.5 font-bold text-indigo-500">
                      {isConcluded ? (
                        <CheckCircle2 size={13} className="text-emerald-500" />
                      ) : (
                        <Clock size={13} className="text-amber-500" />
                      )}
                      {t.installmentProgressLabel(plan.paidInstallments, plan.totalInstallments)}
                    </span>
                    <span className="font-bold text-slate-700">
                      {plan.progressPct.toFixed(0)}% •{' '}
                      {isConcluded
                        ? language === 'pt-BR'
                          ? 'Quitado'
                          : 'Paid off'
                        : t.remainingInstBadge(plan.remainingInstallments)}
                    </span>
                  </div>
                  <div
                    style={{
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                    }}
                    className="w-full h-2 rounded-full overflow-hidden"
                  >
                    <div
                      className={`h-full rounded-full transition-all ${
                        isConcluded ? 'bg-emerald-500' : 'bg-indigo-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, plan.progressPct))}%` }}
                    />
                  </div>
                </div>

                {/* Paid (strictly status === 'paid') vs Remaining Debt (strictly status === 'unpaid') */}
                <div className="grid grid-cols-2 gap-2 pt-0.5 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200/70">
                    <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                      {t.totalAlreadyPaid}
                    </span>
                    <span className="font-bold text-emerald-500">
                      {formatCurrency(plan.totalPaidAmount, currency)}
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-white border border-slate-200/70">
                    <span className="text-[10px] font-semibold uppercase text-slate-400 block">
                      {t.remainingDebtLabel}
                    </span>
                    <span className="font-bold text-amber-500">
                      {formatCurrency(plan.remainingDebtAmount, currency)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderProjectionsSection = () => (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Year-to-Date (YTD) Summary Card */}
      <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 truncate">
            <Award size={17} className="text-emerald-500 shrink-0" />
            <span className="truncate">{t.ytdSummaryTitle(selectedYear)}</span>
          </h2>
          <span
            className={`px-2.5 py-1 rounded-lg text-xs font-bold shrink-0 ${
              ytdAndYearEndForecast.ytdNet >= 0
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-rose-500/15 text-rose-500'
            }`}
          >
            {ytdAndYearEndForecast.ytdSavingsRate.toFixed(1)}% {t.savingsRate}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-500 block">
              {t.ytdEarnedLabel}
            </span>
            <span className="text-base sm:text-lg font-extrabold text-emerald-500 mt-1 block">
              +{formatCurrency(ytdAndYearEndForecast.ytdIncome, currency)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-500 block">
              {t.ytdSpentLabel}
            </span>
            <span className="text-base sm:text-lg font-extrabold text-rose-500 mt-1 block">
              -{formatCurrency(ytdAndYearEndForecast.ytdExpense, currency)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-500 block">
              {t.ytdNetLabel}
            </span>
            <span
              className={`text-base sm:text-lg font-extrabold mt-1 block ${
                ytdAndYearEndForecast.ytdNet >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {ytdAndYearEndForecast.ytdNet >= 0 ? '+' : ''}
              {formatCurrency(ytdAndYearEndForecast.ytdNet, currency)}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>
              {t.expensesLabel} vs. {t.inputsLabel} ({selectedYear})
            </span>
            <span className="font-bold text-slate-800">
              {ytdAndYearEndForecast.ytdIncome > 0
                ? `${Math.min(100, (ytdAndYearEndForecast.ytdExpense / ytdAndYearEndForecast.ytdIncome) * 100).toFixed(1)}%`
                : '0%'}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
            <div
              className="h-full bg-rose-500 transition-all"
              style={{
                width: `${
                  ytdAndYearEndForecast.ytdIncome > 0
                    ? Math.min(100, (ytdAndYearEndForecast.ytdExpense / ytdAndYearEndForecast.ytdIncome) * 100)
                    : 0
                }%`,
              }}
            />
            <div className="h-full flex-1 bg-emerald-500/35" />
          </div>
        </div>
      </div>

      {/* Year-End Expense Forecast Card (Through Dec 31st) */}
      <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col justify-between space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2 truncate">
            <Compass size={17} className="text-indigo-500 shrink-0" />
            <span className="truncate">{t.yearEndForecastTitle(selectedYear)}</span>
          </h2>
          <span className="px-2.5 py-1 rounded-lg bg-indigo-500/15 text-indigo-500 text-xs font-bold shrink-0">
            31 Dez • {ytdAndYearEndForecast.remainingMonthsCount}m
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-500 block">
              {t.yearEndProjectedSpend}
            </span>
            <span className="text-base sm:text-lg font-extrabold text-rose-500 mt-1 block">
              -{formatCurrency(ytdAndYearEndForecast.projectedYearEndSpend, currency)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-500 block">
              {t.scheduledFixedBillsLabel}
            </span>
            <span className="text-base sm:text-lg font-extrabold text-amber-500 mt-1 block">
              {formatCurrency(ytdAndYearEndForecast.scheduledRemainingUnpaidExpense, currency)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-500 block">
              {t.yearEndProjectedBalance}
            </span>
            <span
              className={`text-base sm:text-lg font-extrabold mt-1 block ${
                ytdAndYearEndForecast.projectedYearEndBalance >= 0
                  ? 'text-emerald-500'
                  : 'text-rose-500'
              }`}
            >
              {formatCurrency(ytdAndYearEndForecast.projectedYearEndBalance, currency)}
            </span>
          </div>
        </div>

        <div className="text-xs text-slate-400 truncate">
          {t.yearEndForecastSub(ytdAndYearEndForecast.remainingMonthsCount)}
        </div>
      </div>
    </div>
  );

  const renderSummarySection = () => (
    <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
        <div className="flex items-center gap-2">
          <CalendarRange size={18} className="text-emerald-500" />
          <h2 className="text-base font-extrabold text-slate-900">
            {familyName} — {periodLabel}
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">{t.currentBankBalance}:</span>
          <span className="text-base font-extrabold text-emerald-500">
            {formatCurrency(currentBankBalance, currency)}
          </span>
        </div>
      </div>

      {/* 4 Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
          <span className="text-[11px] font-semibold text-emerald-500 uppercase">
            {t.periodInputs}
          </span>
          <p className="text-lg font-extrabold text-emerald-500 mt-0.5">
            +{formatCurrency(stats.income, currency)}
          </p>
          <span className="text-[11px] text-slate-500">
            {t.entriesCount(stats.incomeCount)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
          <span className="text-[11px] font-semibold text-rose-500 uppercase">
            {t.periodExpenses}
          </span>
          <p className="text-lg font-extrabold text-rose-500 mt-0.5">
            -{formatCurrency(stats.expense, currency)}
          </p>
          <span className="text-[11px] text-slate-500">
            {t.entriesCount(stats.expenseCount)}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">
            {t.netCashFlow}
          </span>
          <p
            className={`text-lg font-extrabold mt-0.5 ${
              stats.net >= 0 ? 'text-emerald-500' : 'text-rose-500'
            }`}
          >
            {stats.net >= 0 ? '+' : ''}
            {formatCurrency(stats.net, currency)}
          </p>
          <span className="text-[11px] text-slate-500">
            {stats.savingsRate.toFixed(1)}% {t.savingsRate.toLowerCase()}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
          <span className="text-[11px] font-semibold text-slate-500 uppercase">
            {t.dailyAvgSpend}
          </span>
          <p className="text-lg font-extrabold text-slate-900 mt-0.5">
            {formatCurrency(stats.avgDailyExpense, currency)}
          </p>
          <span className="text-[11px] text-slate-500 truncate block">
            {t.largestExpense}:{' '}
            {stats.largestExpense
              ? `${stats.largestExpense.description} (${formatCurrency(stats.largestExpense.amount, currency)})`
              : t.noneLabel}
          </span>
        </div>
      </div>
    </div>
  );

  const renderTablesSection = () => (
    <div className="space-y-5">
      {/* DETAILED CATEGORY BREAKDOWN & INCOME SOURCE TABLES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Expenses Breakdown Table */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              {t.expensesBreakdownByCat}
            </h3>
            <Award size={17} className="text-amber-500" />
          </div>

          {expenseReportRows.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">{t.noExpensesInPeriod}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                    <th className="py-2 font-semibold">{t.colCategory}</th>
                    <th className="py-2 font-semibold text-right">{t.colCount}</th>
                    <th className="py-2 font-semibold text-right">{t.colAvgEntry}</th>
                    <th className="py-2 font-semibold text-right">{t.colTotalSpent}</th>
                    <th className="py-2 font-semibold text-right">{t.colShare}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenseReportRows.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <CategoryIcon icon={row.icon} color={row.color} size={14} badgeSize="sm" />
                          <span className="font-bold text-slate-800">{row.name}</span>
                          {idx === 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-500 text-[10px] font-bold">
                              {t.topCategoryBadge}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-slate-600">{row.count}</td>
                      <td className="py-2.5 text-right text-slate-600">
                        {formatCurrency(row.avg, currency)}
                      </td>
                      <td className="py-2.5 text-right font-bold text-slate-900">
                        {formatCurrency(row.amount, currency)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="inline-block w-12 font-semibold text-slate-700">
                          {row.share.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Income Breakdown by Source */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="mb-3">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">{t.inputsBySource}</h3>
          </div>

          {incomeReportRows.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">{t.noInputsInPeriod}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                    <th className="py-2 font-semibold">{t.colSource}</th>
                    <th className="py-2 font-semibold text-right">{t.colCount}</th>
                    <th className="py-2 font-semibold text-right">{t.colTotal}</th>
                    <th className="py-2 font-semibold text-right">{t.colShare}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {incomeReportRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <CategoryIcon icon={row.icon} color={row.color} size={14} badgeSize="sm" />
                          <span className="font-bold text-slate-800">{row.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-right text-slate-600">{row.count}</td>
                      <td className="py-2.5 text-right font-bold text-emerald-500">
                        +{formatCurrency(row.amount, currency)}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-slate-700">
                        {row.share.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MONTH-BY-MONTH CASH FLOW & CLOSING BANK BALANCE TABLE */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm sm:text-base font-bold text-slate-900">{t.monthByMonthTitle}</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                <th className="py-2 font-semibold">{t.colMonth}</th>
                <th className="py-2 font-semibold text-right">{t.colEntries}</th>
                <th className="py-2 font-semibold text-right">{t.colInputsIn}</th>
                <th className="py-2 font-semibold text-right">{t.colExpensesOut}</th>
                <th className="py-2 font-semibold text-right">{t.colMonthlyNet}</th>
                <th className="py-2 font-semibold text-right">{t.colSavedPct}</th>
                <th className="py-2 font-semibold text-right">{t.colClosingBalance}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {monthlyComparisonRows.map((m) => (
                <tr
                  key={m.month}
                  className={`hover:bg-slate-50/70 ${
                    m.month === selectedMonth ? 'bg-indigo-500/10' : ''
                  }`}
                >
                  <td className="py-2.5 font-bold text-slate-900">{m.label}</td>
                  <td className="py-2.5 text-right text-slate-600">{m.count}</td>
                  <td className="py-2.5 text-right font-semibold text-emerald-500">
                    +{formatCurrency(m.income, currency)}
                  </td>
                  <td className="py-2.5 text-right font-semibold text-rose-500">
                    -{formatCurrency(m.expense, currency)}
                  </td>
                  <td className="py-2.5 text-right">
                    <span
                      className={`inline-flex items-center gap-1 font-bold ${
                        m.net >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {m.net >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                      {m.net >= 0 ? '+' : ''}
                      {formatCurrency(m.net, currency)}
                    </span>
                  </td>
                  <td className="py-2.5 text-right font-semibold text-slate-600">
                    {m.income > 0 ? `${m.savingsRate.toFixed(1)}%` : '—'}
                  </td>
                  <td className="py-2.5 text-right font-extrabold text-slate-900">
                    {formatCurrency(m.closingBalance, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* =====================================================================
          COMPACT TOP TOOLBAR: PERIOD / MONTH / YEAR SELECTORS, LAYOUT & EXPORT
         ===================================================================== */}
      <div className="print:hidden bg-white px-4 py-3.5 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileBarChart2 size={19} className="text-emerald-500 shrink-0" />
            <h1 className="text-base font-bold text-slate-900">{t.reportsTitle}</h1>
            <span className="text-xs font-semibold text-slate-400 hidden sm:inline">
              • {periodLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Month / Year Switcher inside Reports */}
            {onSelectMonth && (
              <div className="inline-flex items-center bg-slate-100 rounded-xl p-0.5 gap-0.5">
                <button
                  type="button"
                  onClick={() => onSelectMonth(shiftMonth(selectedMonth, -1))}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
                  title={t.prevMonth}
                >
                  <ChevronLeft size={14} />
                </button>
                <select
                  value={selectedMonth.slice(5, 7)}
                  onChange={(e) => onSelectMonth(`${selectedYear}-${e.target.value}`)}
                  className="px-1.5 py-1 rounded-lg bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {Array.from({ length: 12 }, (_, idx) => {
                    const mNum = String(idx + 1).padStart(2, '0');
                    const d = new Date(Number(selectedYear), idx, 1);
                    const lbl = d.toLocaleDateString(language === 'pt-BR' ? 'pt-BR' : 'en-US', {
                      month: 'short',
                    });
                    return (
                      <option key={mNum} value={mNum}>
                        {lbl.charAt(0).toUpperCase() + lbl.slice(1)}
                      </option>
                    );
                  })}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => onSelectMonth(`${e.target.value}-${selectedMonth.slice(5, 7)}`)}
                  className="px-1.5 py-1 rounded-lg bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {availableYears.map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onSelectMonth(shiftMonth(selectedMonth, 1))}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white transition-colors"
                  title={t.nextMonth}
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}

            {/* Period Range Picker */}
            <div className="inline-flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
              {(
                [
                  { id: '1m', label: t.rangeSelectedMonth },
                  { id: '3m', label: t.range3Months },
                  { id: '6m', label: t.range6Months },
                  { id: '12m', label: t.range12Months },
                  { id: 'all', label: t.rangeAllTime },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setRangeType(opt.id)}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    rangeType === opt.id
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Customize Section Order Toggle Button */}
            <button
              type="button"
              onClick={() => setShowLayoutOrganizer((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                showLayoutOrganizer
                  ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              <SlidersHorizontal size={13} className="text-indigo-500" />
              {t.customizeLayoutBtn}
            </button>

            <button
              type="button"
              onClick={() =>
                exportTransactionsToCSV(
                  periodTransactions,
                  categories,
                  `familyplan-report-${rangeType}-${selectedMonth}.csv`,
                  language
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
            >
              <FileSpreadsheet size={14} className="text-emerald-500" />
              CSV
            </button>

            <button
              type="button"
              onClick={() =>
                exportFilteredHistoryToPDF({
                  periodMode:
                    rangeType === '1m' ? 'monthly' : rangeType === '12m' ? 'annual' : 'all',
                  year: selectedMonth.slice(0, 4),
                  month: selectedMonth.slice(5, 7),
                  typeFilter: 'all',
                  familyName,
                  currency,
                  language,
                  initialBalance,
                  categories,
                  transactions: periodTransactions,
                })
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm"
            >
              <Printer size={14} />
              PDF
            </button>
          </div>
        </div>

        {/* Collapsible Section Order Customizer Bar */}
        {showLayoutOrganizer && (
          <div className="pt-2.5 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500">{t.dragToReorder}</span>
              {!isDefaultOrder && (
                <button
                  type="button"
                  onClick={resetSectionOrder}
                  className="inline-flex items-center gap-1 text-xs font-bold text-indigo-500 hover:underline"
                >
                  <RotateCcw size={12} />
                  {t.resetLayoutBtn}
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {sectionOrder.map((secId, idx) => (
                <div
                  key={secId}
                  draggable
                  onDragStart={() => setDraggedSection(secId)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverSection(secId);
                  }}
                  onDrop={() => handleDropSection(secId)}
                  onDragEnd={() => {
                    setDraggedSection(null);
                    setDragOverSection(null);
                  }}
                  className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-xl border text-xs font-bold cursor-grab active:cursor-grabbing transition-all ${
                    dragOverSection === secId
                      ? 'border-indigo-500 bg-indigo-500/15 text-indigo-500'
                      : 'border-slate-200 bg-slate-50 text-slate-800'
                  }`}
                >
                  <GripVertical size={12} className="text-slate-400" />
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                    {idx + 1}
                  </span>
                  <span>{sectionLabels[secId]}</span>
                  <div className="inline-flex items-center gap-0.5 ml-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveSection(secId, 'up')}
                      className="p-0.5 rounded hover:bg-white disabled:opacity-30"
                      title={t.moveSectionUp}
                    >
                      <ArrowUp size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sectionOrder.length - 1}
                      onClick={() => moveSection(secId, 'down')}
                      className="p-0.5 rounded hover:bg-white disabled:opacity-30"
                      title={t.moveSectionDown}
                    >
                      <ArrowDown size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          DYNAMICALLY ORDERED REPORT SECTIONS (DEFAULT: CHARTS AT THE TOP)
         ===================================================================== */}
      {sectionOrder.map((sectionId, index) => (
        <div
          key={sectionId}
          draggable
          onDragStart={(e) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON') return;
            setDraggedSection(sectionId);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggedSection && draggedSection !== sectionId) {
              setDragOverSection(sectionId);
            }
          }}
          onDrop={() => handleDropSection(sectionId)}
          onDragEnd={() => {
            setDraggedSection(null);
            setDragOverSection(null);
          }}
          className={`space-y-1.5 transition-all rounded-2xl ${
            dragOverSection === sectionId ? 'ring-2 ring-indigo-500/60' : ''
          }`}
        >
          {renderSectionControlHeader(sectionId, index)}
          {sectionId === 'charts' && renderChartsSection()}
          {sectionId === 'installments' && renderInstallmentsSection()}
          {sectionId === 'projections' && renderProjectionsSection()}
          {sectionId === 'summary' && renderSummarySection()}
          {sectionId === 'tables' && renderTablesSection()}
        </div>
      ))}
    </div>
  );
};
