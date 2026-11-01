import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  PieChart as PieChartIcon,
  CreditCard as CreditCardIcon,
  TrendingUp,
  Repeat,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
  CalendarClock,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  AppLanguage,
  AppTheme,
  Category,
  CreditCard,
  RecurringTemplate,
  Transaction,
  TransactionType,
} from '../types';
import {
  computeCardFirstInvoiceMonth,
  computeInvoiceDueDate,
  formatCompactNumber,
  formatCurrency,
  formatMonthLabel,
  formatShortMonthLabel,
  getInstallmentNumberForMonth,
  shiftMonth,
} from '../utils/format';
import { getCategoryDisplayName, TRANSLATIONS } from '../utils/i18n';
import { CategoryIcon } from './CategoryIcon';

interface ReportsViewProps {
  selectedMonth: string;
  familyName: string;
  currency: string;
  language: AppLanguage;
  theme?: AppTheme;
  initialBalance: number;
  categories: Category[];
  creditCards?: CreditCard[];
  transactions: Transaction[];
  recurringTemplates?: RecurringTemplate[];
  onSelectMonth?: (month: string) => void;
}

export interface CategorySliceItem {
  id: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
  count: number;
  share: number;
}

const FALLBACK_SLICE_COLORS = [
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#14B8A6',
  '#F97316',
  '#D0B595',
  '#6366F1',
];

export interface NonCardInstallmentPlan {
  key: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  monthlyAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  remainingInstallments: number;
  currentInstallmentDisplay: number;
  totalAmount: number;
  totalPaidAmount: number;
  remainingDebtAmount: number;
  progressPct: number;
  paymentMethod: string;
  isDueInSelectedMonth: boolean;
  selectedMonthAmount: number;
  installmentSchedule: number[];
}

export interface AmortizationTimelinePoint {
  index: number;
  month: string;
  shortMonthLabel: string;
  yearLabel: string;
  fullMonthLabel: string;
  monthlyCommitment: number;
  remainingBalance: number;
  activeCount: number;
}

/**
 * Installment Expense Tracker hook strictly filtered for NON-credit-card installments.
 * Credit card installments are monitored in the dedicated Credit Cards screen.
 */
export function useInstallmentPlans(
  transactions: Transaction[],
  categories: Category[],
  language: AppLanguage,
  selectedMonth: string = new Date().toISOString().slice(0, 7)
) {
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const installmentPlans = useMemo(() => {
    // 1. Strict Filter: Non-Credit Card Installments Only
    // Query/filter transactions where cardId is NULL or empty
    const nonCardInstTxs = transactions.filter(
      (tx) =>
        tx.type === 'expense' &&
        !tx.cardId &&
        !tx.settledInvoiceKey &&
        Boolean(tx.installmentTotal && tx.installmentTotal > 1)
    );

    const groups = new Map<string, Transaction[]>();
    for (const tx of nonCardInstTxs) {
      const groupKey =
        tx.recurringId ||
        `${tx.description.trim().toLowerCase()}__${tx.categoryId}__${tx.installmentTotal}`;
      const list = groups.get(groupKey) || [];
      list.push(tx);
      groups.set(groupKey, list);
    }

    const plans: NonCardInstallmentPlan[] = [];

    for (const [key, txList] of groups.entries()) {
      // Sort transactions by installment current or date ascending
      txList.sort((a, b) => (a.installmentCurrent || 1) - (b.installmentCurrent || 1));
      const repTx = txList[0];
      const cat = categoryMap.get(repTx.categoryId);

      const totalInstallments = Math.max(
        ...txList.map((t) => t.installmentTotal || 0),
        2
      );

      const monthlyAmount =
        txList.find((t) => t.amount > 0)?.amount || repTx.amount;

      const paidTxs = txList.filter((t) => (t.status ?? 'paid') === 'paid');
      const unpaidTxs = txList.filter((t) => t.status === 'unpaid');

      let paidInstallments = 0;
      let remainingInstallments = 0;
      let currentInstallmentDisplay = 1;
      let remainingDebtAmount = 0;

      if (unpaidTxs.length > 0) {
        remainingInstallments = unpaidTxs.length;
        remainingDebtAmount = Number(
          unpaidTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0).toFixed(2)
        );
        const highestPaid =
          paidTxs.length > 0
            ? Math.max(...paidTxs.map((t) => t.installmentCurrent || 1))
            : 0;
        paidInstallments = Math.max(paidTxs.length, totalInstallments - remainingInstallments);

        // Check for specific entry due in selectedMonth
        const txInSelectedMonth = unpaidTxs.find((t) => t.date.slice(0, 7) === selectedMonth);
        if (txInSelectedMonth) {
          currentInstallmentDisplay = txInSelectedMonth.installmentCurrent || (highestPaid + 1);
        } else {
          currentInstallmentDisplay =
            unpaidTxs[0].installmentCurrent || Math.min(totalInstallments, highestPaid + 1);
        }
      } else {
        const highestCur = Math.max(...txList.map((t) => t.installmentCurrent || 1));
        if (repTx.status === 'unpaid') {
          paidInstallments = Math.max(0, highestCur - 1);
          remainingInstallments = Math.max(0, totalInstallments - paidInstallments);
          currentInstallmentDisplay = highestCur;
        } else {
          paidInstallments = Math.max(paidTxs.length, highestCur);
          remainingInstallments = Math.max(0, totalInstallments - paidInstallments);
          currentInstallmentDisplay = Math.min(totalInstallments, paidInstallments);
        }
        remainingDebtAmount = Number((remainingInstallments * monthlyAmount).toFixed(2));
      }

      // 2. Strict Filter: Exclude fully completed installments (current >= total when paid, or 0 remaining)
      if (remainingInstallments <= 0 || paidInstallments >= totalInstallments) {
        continue;
      }

      // Payment method metadata badge
      const combined = `${repTx.description} ${repTx.notes || ''}`.toLowerCase();
      let paymentMethod = language === 'pt-BR' ? 'Pix / Boleto' : 'Bank / Cash';
      if (combined.includes('boleto')) paymentMethod = 'Boleto';
      else if (combined.includes('pix')) paymentMethod = 'Pix';
      else if (combined.includes('debito') || combined.includes('débito')) paymentMethod = 'Débito';
      else if (combined.includes('dinheiro')) paymentMethod = 'Dinheiro';
      else if (combined.includes('transferência') || combined.includes('ted')) paymentMethod = 'TED / Pix';

      const totalAmount =
        repTx.totalPurchaseAmount && repTx.totalPurchaseAmount > 0
          ? repTx.totalPurchaseAmount
          : Number((monthlyAmount * totalInstallments).toFixed(2));
      const totalPaidAmount = Number(Math.max(0, totalAmount - remainingDebtAmount).toFixed(2));
      const progressPct =
        totalInstallments > 0 ? (currentInstallmentDisplay / totalInstallments) * 100 : 0;

      const txThisMonth = txList.find((t) => t.date.slice(0, 7) === selectedMonth);
      const isDueInSelectedMonth = Boolean(txThisMonth);
      const selectedMonthAmount = txThisMonth ? txThisMonth.amount : monthlyAmount;
      const installmentSchedule =
        unpaidTxs.length > 0
          ? unpaidTxs.map((t) => Number(Number(t.amount || 0).toFixed(2)))
          : Array.from({ length: remainingInstallments }, () => Number(monthlyAmount.toFixed(2)));

      plans.push({
        key,
        description: repTx.description,
        categoryId: repTx.categoryId,
        categoryName: cat ? getCategoryDisplayName(cat, language) : '',
        categoryColor: cat?.color || '#F97316',
        categoryIcon: cat?.icon || 'Layers',
        monthlyAmount,
        totalInstallments,
        paidInstallments,
        remainingInstallments,
        currentInstallmentDisplay,
        totalAmount,
        totalPaidAmount,
        remainingDebtAmount,
        progressPct,
        paymentMethod,
        isDueInSelectedMonth,
        selectedMonthAmount,
        installmentSchedule,
      });
    }

    return plans.sort((a, b) => b.remainingDebtAmount - a.remainingDebtAmount);
  }, [transactions, categoryMap, language, selectedMonth]);

  const installmentSummary = useMemo(() => {
    const activeCount = installmentPlans.length;
    // Comprometido no Mês: sum of monthly commitments for active plans
    const monthlyCommitment = installmentPlans.reduce((sum, p) => sum + p.selectedMonthAmount, 0);
    const totalRemainingDebt = installmentPlans.reduce((sum, p) => sum + p.remainingDebtAmount, 0);
    const totalPaid = installmentPlans.reduce((sum, p) => sum + p.totalPaidAmount, 0);

    return {
      activeCount,
      monthlyCommitment: Number(monthlyCommitment.toFixed(2)),
      totalRemainingDebt: Number(totalRemainingDebt.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
    };
  }, [installmentPlans]);

  return { installmentPlans, installmentSummary };
}

export interface InstallmentExpenseTrackerProps {
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  language: AppLanguage;
  selectedMonth?: string;
  theme?: AppTheme;
}

export const InstallmentExpenseTracker: React.FC<InstallmentExpenseTrackerProps> = ({
  transactions,
  categories,
  currency,
  language,
  selectedMonth = new Date().toISOString().slice(0, 7),
  theme = 'oled',
}) => {
  const isOled = theme === 'oled';
  const { installmentPlans, installmentSummary } = useInstallmentPlans(
    transactions,
    categories,
    language,
    selectedMonth
  );

  // Build dynamic amortization timeline from selectedMonth through the final installment completion month
  const amortizationTimeline: AmortizationTimelinePoint[] = useMemo(() => {
    if (installmentPlans.length === 0) return [];

    const maxMonths = Math.max(
      ...installmentPlans.map((p) => p.installmentSchedule.length),
      1
    );

    let runningRemaining = installmentSummary.totalRemainingDebt;
    const points: AmortizationTimelinePoint[] = [];

    for (let k = 0; k < maxMonths; k++) {
      const month = shiftMonth(selectedMonth, k);
      let monthlyCommitment = 0;
      let activeCount = 0;

      for (const plan of installmentPlans) {
        const amt = plan.installmentSchedule[k] ?? 0;
        if (amt > 0) {
          monthlyCommitment += amt;
          activeCount += 1;
        }
      }

      monthlyCommitment = Number(monthlyCommitment.toFixed(2));
      runningRemaining =
        k === maxMonths - 1
          ? 0
          : Number(Math.max(0, runningRemaining - monthlyCommitment).toFixed(2));

      const shortRaw = formatShortMonthLabel(month, language).replace('.', '');
      const shortMonthLabel = shortRaw.charAt(0).toUpperCase() + shortRaw.slice(1);
      const yearLabel = `'${month.slice(2, 4)}`;
      const fullMonthRaw = formatMonthLabel(month, language);
      const fullMonthLabel =
        fullMonthRaw.charAt(0).toUpperCase() + fullMonthRaw.slice(1);

      points.push({
        index: k,
        month,
        shortMonthLabel,
        yearLabel,
        fullMonthLabel,
        monthlyCommitment,
        remainingBalance: runningRemaining,
        activeCount,
      });
    }

    return points;
  }, [installmentPlans, installmentSummary.totalRemainingDebt, selectedMonth, language]);

  const [selectedTimelineIndex, setSelectedTimelineIndex] = useState<number>(0);

  useEffect(() => {
    setSelectedTimelineIndex(0);
  }, [selectedMonth]);

  const safeSelectedIdx =
    amortizationTimeline.length > 0
      ? Math.min(selectedTimelineIndex, amortizationTimeline.length - 1)
      : 0;
  const activePoint = amortizationTimeline[safeSelectedIdx];

  const maxCommitment = useMemo(
    () => Math.max(...amortizationTimeline.map((p) => p.monthlyCommitment), 1),
    [amortizationTimeline]
  );

  const maxRemainingNode = useMemo(
    () => Math.max(...amortizationTimeline.map((p) => p.remainingBalance), 1),
    [amortizationTimeline]
  );

  const nodeCoords = useMemo(() => {
    const n = amortizationTimeline.length;
    if (n === 0) return [];
    const hasPositiveBalance = amortizationTimeline.some((p) => p.remainingBalance > 0);
    return amortizationTimeline.map((pt, idx) => {
      const xPct = ((idx + 0.5) / n) * 100;
      const ratio = hasPositiveBalance ? pt.remainingBalance / maxRemainingNode : 0;
      // Map ratio [1 -> 0] into vertical range [16% -> 86%] inside the plot area
      const yPct = 16 + (1 - ratio) * 70;
      return { xPct, yPct, pt };
    });
  }, [amortizationTimeline, maxRemainingNode]);

  const polylinePoints = useMemo(
    () => nodeCoords.map((c) => `${(c.xPct * 10).toFixed(2)},${c.yPct.toFixed(2)}`).join(' '),
    [nodeCoords]
  );

  return (
    <section
      className={`rounded-2xl border p-5 transition-colors ${
        isOled
          ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
          : 'bg-white border-[#E2E8F0] text-slate-900 shadow-xs'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isOled
                ? 'bg-[#161B22] text-slate-300'
                : 'bg-slate-100 text-slate-700'
            } dark:bg-[#161B22] dark:text-slate-300`}
          >
            <CalendarClock size={18} />
          </div>
          <div className="min-w-0">
            <h2
              className={`text-base font-bold tracking-tight truncate ${
                isOled ? 'text-white' : 'text-slate-900'
              } dark:text-white`}
            >
              {language === 'pt-BR' ? 'Parcelamentos em Conta' : 'Account Installments'}
            </h2>
            <p
              className={`text-xs mt-0.5 truncate ${
                isOled ? 'text-slate-400' : 'text-slate-500'
              } dark:text-slate-400`}
            >
              {language === 'pt-BR'
                ? 'Boletos, carnês e parcelamentos sem cartão'
                : 'Bills, payment books and non-card installments'}
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${
            isOled
              ? 'bg-[#161B22] text-slate-400 border-[#21262D]'
              : 'bg-slate-100 text-slate-600 border-slate-200/60'
          } dark:bg-[#161B22] dark:text-slate-400 dark:border-[#21262D]`}
        >
          {installmentSummary.activeCount}{' '}
          {language === 'pt-BR'
            ? installmentSummary.activeCount === 1
              ? 'ativa'
              : 'ativas'
            : installmentSummary.activeCount === 1
            ? 'active'
            : 'active'}
        </span>
      </div>

      {/* Top Metric Row (KPI Container) */}
      <div
        className={`grid grid-cols-2 gap-3 rounded-xl p-3.5 mb-4 border ${
          isOled
            ? 'bg-[#161B22]/60 border-[#21262D]'
            : 'bg-slate-50 border-slate-200/80'
        } dark:bg-[#161B22]/60 dark:border-[#21262D]`}
      >
        <div>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider block truncate ${
              isOled ? 'text-slate-500' : 'text-slate-400'
            } dark:text-slate-500`}
          >
            {language === 'pt-BR' ? 'Comprometido no Mês' : 'Committed This Month'}
          </span>
          <p className="text-sm font-bold text-[#EF4444] mt-0.5 tracking-tight truncate">
            -{formatCurrency(installmentSummary.monthlyCommitment, currency)}
          </p>
        </div>

        <div>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider block truncate ${
              isOled ? 'text-slate-500' : 'text-slate-400'
            } dark:text-slate-500`}
          >
            {language === 'pt-BR' ? 'Total Restante' : 'Total Remaining'}
          </span>
          <p
            className={`text-sm font-bold mt-0.5 tracking-tight truncate ${
              isOled ? 'text-white' : 'text-slate-900'
            } dark:text-white`}
          >
            {formatCurrency(installmentSummary.totalRemainingDebt, currency)}
          </p>
        </div>
      </div>

      {/* X/Y Amortization Chart & Tap-to-Inspect Interactive Breakdown */}
      {amortizationTimeline.length > 0 && activePoint && (
        <div
          className={`rounded-xl border p-3.5 mb-4 transition-colors ${
            isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200/80'
          }`}
        >
          {/* Chart Legend Header */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span
              className={`text-[10px] uppercase font-extrabold tracking-wider truncate ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-500'
              }`}
            >
              {language === 'pt-BR' ? 'Amortização das Parcelas' : 'Installment Amortization'}
            </span>
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-t-xs bg-[#6E5440] inline-block" />
                <span
                  className={`text-[10px] font-semibold ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}
                >
                  {language === 'pt-BR' ? 'Parcela' : 'Monthly'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span
                  className={`w-2 h-2 rounded-full border-2 inline-block ${
                    isOled ? 'bg-slate-400 border-[#21262D]' : 'bg-slate-600 border-white shadow-2xs'
                  }`}
                />
                <span
                  className={`text-[10px] font-semibold ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}
                >
                  {language === 'pt-BR' ? 'Saldo' : 'Balance'}
                </span>
              </div>
            </div>
          </div>

          {/* Plot Canvas: Bars + Contrasting Line + Interactive Clickable Nodes */}
          <div className="relative h-28 w-full mt-1">
            {/* Subtle horizontal reference grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between py-3 pointer-events-none opacity-45">
              <div
                className={`border-b border-dashed ${
                  isOled ? 'border-[#21262D]' : 'border-slate-200'
                }`}
              />
              <div
                className={`border-b border-dashed ${
                  isOled ? 'border-[#21262D]' : 'border-slate-200'
                }`}
              />
              <div
                className={`border-b border-dashed ${
                  isOled ? 'border-[#21262D]' : 'border-slate-200'
                }`}
              />
            </div>

            {/* Monthly Commitment Vertical Bars (#6E5440) */}
            <div
              className="absolute inset-0 grid items-end z-10"
              style={{
                gridTemplateColumns: `repeat(${amortizationTimeline.length}, minmax(0, 1fr))`,
              }}
            >
              {amortizationTimeline.map((pt) => {
                const isSelected = pt.index === safeSelectedIdx;
                const barHeightPct =
                  maxCommitment > 0 && pt.monthlyCommitment > 0
                    ? Math.max(12, Math.round((pt.monthlyCommitment / maxCommitment) * 68))
                    : 0;

                return (
                  <button
                    key={pt.month}
                    type="button"
                    onClick={() => setSelectedTimelineIndex(pt.index)}
                    aria-label={`${pt.fullMonthLabel}: ${formatCurrency(pt.monthlyCommitment, currency)}`}
                    className="h-full w-full flex flex-col items-center justify-end px-1 focus:outline-none group"
                  >
                    <div
                      style={{ height: `${barHeightPct}%` }}
                      className={`w-full max-w-[26px] rounded-t-sm transition-all duration-200 ${
                        isSelected
                          ? 'bg-[#6E5440] opacity-100 ring-1 ring-[#D0B595]/50'
                          : 'bg-[#6E5440]/65 group-hover:bg-[#6E5440]/85'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Remaining Balance Line Trajectory (SVG) */}
            {nodeCoords.length > 1 && (
              <svg
                viewBox="0 0 1000 100"
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full pointer-events-none z-15 overflow-visible"
              >
                <polyline
                  fill="none"
                  stroke={isOled ? '#94A3B8' : '#475569'}
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  points={polylinePoints}
                />
              </svg>
            )}

            {/* Clickable Nodes on the Remaining Balance Line (36x36px Invisible Touch Hit Area) */}
            {nodeCoords.map(({ xPct, yPct, pt }) => {
              const isSelected = pt.index === safeSelectedIdx;
              return (
                <button
                  key={`node-${pt.month}`}
                  type="button"
                  onClick={() => setSelectedTimelineIndex(pt.index)}
                  style={{ left: `${xPct}%`, top: `${yPct}%` }}
                  aria-label={`${pt.fullMonthLabel} - ${
                    language === 'pt-BR' ? 'Saldo restante' : 'Remaining balance'
                  }: ${formatCurrency(pt.remainingBalance, currency)}`}
                  aria-pressed={isSelected}
                  className="absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full z-20 focus:outline-none group"
                >
                  <span
                    className={`rounded-full border-2 transition-all duration-200 ${
                      isSelected
                        ? `w-3 h-3 bg-[#6E5440] scale-110 ${
                            isOled
                              ? 'border-[#F8FAFC] ring-4 ring-[#6E5440]/40'
                              : 'border-white ring-4 ring-[#6E5440]/30 shadow-xs'
                          }`
                        : `w-2.5 h-2.5 group-hover:scale-110 ${
                            isOled
                              ? 'bg-slate-400 border-[#21262D]'
                              : 'bg-slate-600 border-white shadow-2xs'
                          }`
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* X-Axis Month Labels */}
          <div
            className="grid mt-1.5 pt-1.5 border-t border-dashed"
            style={{
              gridTemplateColumns: `repeat(${amortizationTimeline.length}, minmax(0, 1fr))`,
              borderColor: isOled ? '#21262D' : '#E2E8F0',
            }}
          >
            {amortizationTimeline.map((pt) => {
              const isSelected = pt.index === safeSelectedIdx;
              return (
                <button
                  key={`lbl-${pt.month}`}
                  type="button"
                  onClick={() => setSelectedTimelineIndex(pt.index)}
                  className="text-center focus:outline-none py-0.5"
                >
                  <span
                    className={`block text-[10px] font-bold uppercase tracking-tight truncate ${
                      isSelected
                        ? isOled
                          ? 'text-[#F8FAFC]'
                          : 'text-slate-900'
                        : isOled
                        ? 'text-[#94A3B8]'
                        : 'text-slate-500'
                    }`}
                  >
                    {pt.shortMonthLabel}
                  </span>
                  {amortizationTimeline.length <= 8 && (
                    <span
                      className={`block text-[9px] font-medium ${
                        isSelected
                          ? isOled
                            ? 'text-[#D0B595]'
                            : 'text-[#6E5440]'
                          : isOled
                          ? 'text-[#94A3B8]/60'
                          : 'text-slate-400'
                      }`}
                    >
                      {pt.yearLabel}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Tap-to-Inspect Interactive Mini-Summary Breakdown */}
          <div
            className={`mt-3 rounded-xl p-3.5 border transition-all ${
              isOled
                ? 'bg-[#161B22]/60 border-[#21262D]'
                : 'bg-slate-50 border-slate-200/80'
            } dark:bg-[#161B22]/60 dark:border-[#21262D]`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span
                className={`text-xs font-bold ${
                  isOled ? 'text-white' : 'text-slate-900'
                } dark:text-white`}
              >
                {activePoint.fullMonthLabel}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border shrink-0 ${
                  isOled
                    ? 'bg-[#0D1117] text-slate-300 border-[#21262D]'
                    : 'bg-white text-slate-700 border-slate-200/80'
                } dark:bg-[#0D1117] dark:text-slate-300 dark:border-[#21262D]`}
              >
                {activePoint.activeCount}{' '}
                {language === 'pt-BR'
                  ? activePoint.activeCount === 1
                    ? 'parcelamento ativo'
                    : 'parcelamentos ativos'
                  : activePoint.activeCount === 1
                  ? 'active installment'
                  : 'active installments'}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-t-xs bg-[#6E5440] shrink-0" />
                <span className={isOled ? 'text-slate-400' : 'text-slate-500'}>
                  {language === 'pt-BR' ? 'Parcela do mês:' : 'Monthly installment:'}
                </span>
                <span className={`font-bold ${isOled ? 'text-white' : 'text-slate-900'} dark:text-white`}>
                  {formatCurrency(activePoint.monthlyCommitment, currency)}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full border shrink-0 ${
                    isOled ? 'bg-slate-400 border-[#21262D]' : 'bg-slate-600 border-white'
                  }`}
                />
                <span className={isOled ? 'text-slate-400' : 'text-slate-500'}>
                  {language === 'pt-BR' ? 'Saldo devedor restante:' : 'Remaining balance:'}
                </span>
                <span className={`font-bold ${isOled ? 'text-white' : 'text-slate-900'} dark:text-white`}>
                  {formatCurrency(activePoint.remainingBalance, currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Individual Installment Rows */}
      {installmentPlans.length === 0 ? (
        <div
          className={`py-6 px-4 rounded-xl border text-center space-y-1 ${
            isOled ? 'bg-[#161B22]/40 border-[#21262D]' : 'bg-slate-50 border-slate-200/80'
          } dark:bg-[#161B22]/40 dark:border-[#21262D]`}
        >
          <p className={`text-xs font-semibold ${isOled ? 'text-white' : 'text-slate-900'} dark:text-white`}>
            {language === 'pt-BR'
              ? 'Nenhum parcelamento ativo em conta'
              : 'No active bank installment plans'}
          </p>
          <p className={`text-[11px] max-w-xs mx-auto ${isOled ? 'text-slate-400' : 'text-slate-500'} dark:text-slate-400`}>
            {language === 'pt-BR'
              ? 'Despesas parceladas no Pix, Boleto ou Conta Corrente aparecerão aqui.'
              : 'Expenses split into installments paid via Bank, Pix or Cash will be tracked here.'}
          </p>
        </div>
      ) : (
        <div>
          {installmentPlans.map((plan) => {
            const fillPct =
              plan.totalInstallments > 0
                ? Math.min(100, Math.max(0, (plan.currentInstallmentDisplay / plan.totalInstallments) * 100))
                : 0;

            return (
              <div
                key={plan.key}
                className={`rounded-xl p-3 mb-2 last:mb-0 border transition-colors ${
                  isOled
                    ? 'bg-[#161B22]/40 border-[#21262D]'
                    : 'bg-slate-50/70 border-slate-200/60'
                } dark:bg-[#161B22]/40 dark:border-[#21262D]`}
              >
                {/* Main info row */}
                <div className="flex items-center justify-between gap-2.5">
                  {/* Left Stack */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <CategoryIcon
                        icon={plan.categoryIcon}
                        color={plan.categoryColor}
                        size={14}
                        badgeSize="sm"
                      />
                      <h3
                        className={`font-semibold text-sm truncate ${
                          isOled ? 'text-white' : 'text-slate-900'
                        } dark:text-white`}
                      >
                        {plan.description}
                      </h3>
                    </div>

                    {/* Subtitle metadata */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5 pl-0.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                          isOled
                            ? 'bg-[#0D1117] text-slate-300 border-[#21262D]'
                            : 'bg-white text-slate-700 border-slate-200/80'
                        } dark:bg-[#0D1117] dark:text-slate-300 dark:border-[#21262D]`}
                      >
                        {plan.currentInstallmentDisplay}/{plan.totalInstallments}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                          isOled
                            ? 'bg-[#0D1117] text-slate-300 border-[#21262D]'
                            : 'bg-white text-slate-700 border-slate-200/80'
                        } dark:bg-[#0D1117] dark:text-slate-300 dark:border-[#21262D]`}
                      >
                        {plan.paymentMethod}
                      </span>

                      {plan.categoryName && (
                        <span
                          className={`text-xs truncate max-w-[100px] ${
                            isOled ? 'text-slate-400' : 'text-slate-500'
                          } dark:text-slate-400`}
                        >
                          {plan.categoryName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Stack (Right-aligned) */}
                  <div className="flex flex-col items-end text-right shrink-0">
                    <span className="font-bold text-sm text-[#EF4444] whitespace-nowrap">
                      -{formatCurrency(plan.monthlyAmount, currency)}/mês
                    </span>
                    <span
                      className={`text-xs mt-0.5 whitespace-nowrap ${
                        isOled ? 'text-slate-400' : 'text-slate-500'
                      } dark:text-slate-400`}
                    >
                      {formatCurrency(plan.remainingDebtAmount, currency)} rest. •{' '}
                      {plan.remainingInstallments}{' '}
                      {language === 'pt-BR'
                        ? plan.remainingInstallments === 1
                          ? 'mês'
                          : 'meses'
                        : plan.remainingInstallments === 1
                        ? 'mo'
                        : 'mos'}
                    </span>
                  </div>
                </div>

                {/* Emerald Green (#10B981) Installment Progress Bar */}
                <div
                  className={`h-1 w-full rounded-full overflow-hidden mt-2.5 ${
                    isOled ? 'bg-[#21262D]' : 'bg-slate-200'
                  } dark:bg-[#21262D]`}
                >
                  <div
                    className="h-full rounded-full bg-[#10B981] transition-all duration-300 ease-out"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

/**
 * Helper to determine billing cycle invoice month for a card transaction
 */
function getTxInvoiceMonth(tx: Transaction, card: CreditCard): string {
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
}

export interface MonthCommitmentProjection {
  month: string;
  shortMonthLabel: string;
  yearLabel: string;
  invoicesAmount: number;
  installmentsAmount: number;
  recurringAmount: number;
  totalCommitment: number;
  invoicesCount: number;
  installmentsCount: number;
  recurringCount: number;
}

export interface FutureCommitmentsForecastProps {
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  theme?: AppTheme;
  creditCards?: CreditCard[];
  transactions: Transaction[];
  recurringTemplates?: RecurringTemplate[];
}

/**
 * Previsão de Compromissos Futuros (Future Commitments Forecast)
 * Projects strictly contracted financial obligations across the next 6 rolling months
 * (Credit Card Invoices + Non-Card Account Installments + Fixed Recurring Expenses).
 */
export const FutureCommitmentsForecast: React.FC<FutureCommitmentsForecastProps> = ({
  selectedMonth,
  currency,
  language,
  theme = 'oled',
  creditCards = [],
  transactions,
  recurringTemplates = [],
}) => {
  const isOled = theme === 'oled';
  const [activeMonth, setActiveMonth] = useState<string>(selectedMonth);

  // Keep active month in sync when selectedMonth changes
  React.useEffect(() => {
    setActiveMonth(selectedMonth);
  }, [selectedMonth]);

  // Generate 6 rolling projection months starting from selectedMonth
  const projectionMonths = useMemo(() => {
    return [0, 1, 2, 3, 4, 5].map((delta) => shiftMonth(selectedMonth, delta));
  }, [selectedMonth]);

  // Aggregate pre-committed cash outflows for each month in the projection window
  const projections: MonthCommitmentProjection[] = useMemo(() => {
    return projectionMonths.map((targetMonth) => {
      // 1. Credit Card Invoices due in targetMonth
      let invoicesAmount = 0;
      let invoicesCount = 0;
      const processedCycles = new Set<string>();

      if (creditCards && creditCards.length > 0) {
        for (const card of creditCards) {
          const cardTxs = transactions.filter((tx) => tx.cardId === card.id && tx.type === 'expense');
          const cycles = new Set<string>();
          for (const tx of cardTxs) {
            cycles.add(getTxInvoiceMonth(tx, card));
          }
          for (const sTx of transactions) {
            if (sTx.settledInvoiceKey && sTx.settledInvoiceKey.startsWith(`${card.id}__`)) {
              const invMonth = sTx.settledInvoiceKey.split('__')[1];
              if (invMonth) cycles.add(invMonth);
            }
          }

          for (const invMonth of cycles) {
            const cycleKey = `${card.id}__${invMonth}`;
            if (processedCycles.has(cycleKey)) continue;

            const settlementTx = transactions.find((t) => t.settledInvoiceKey === cycleKey);
            const dueDate = settlementTx?.date || computeInvoiceDueDate(invMonth, card.closingDay, card.dueDay);
            const dueMonth = dueDate.slice(0, 7);

            if (dueMonth === targetMonth) {
              processedCycles.add(cycleKey);
              let cycleTotal = 0;
              if (settlementTx && settlementTx.amount > 0) {
                cycleTotal = Number(settlementTx.amount || 0);
              } else {
                const cycleTxs = cardTxs.filter((tx) => getTxInvoiceMonth(tx, card) === invMonth);
                cycleTotal = cycleTxs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
              }

              if (cycleTotal > 0) {
                invoicesAmount += cycleTotal;
                invoicesCount += 1;
              }
            }
          }
        }
      }

      // 2. Non-Card Account Installments due in targetMonth ("credit_card_id IS NULL")
      let installmentsAmount = 0;
      let installmentsCount = 0;

      const nonCardInstTxs = transactions.filter(
        (tx) =>
          tx.type === 'expense' &&
          !tx.cardId &&
          !tx.settledInvoiceKey &&
          Boolean(tx.installmentTotal && tx.installmentTotal > 1)
      );

      const groups = new Map<string, Transaction[]>();
      for (const tx of nonCardInstTxs) {
        const groupKey =
          tx.recurringId ||
          `${tx.description.trim().toLowerCase()}__${tx.categoryId}__${tx.installmentTotal}`;
        const list = groups.get(groupKey) || [];
        list.push(tx);
        groups.set(groupKey, list);
      }

      for (const [, txList] of groups.entries()) {
        txList.sort((a, b) => (a.installmentCurrent || 1) - (b.installmentCurrent || 1));
        const repTx = txList[0];
        const totalInstallments = Math.max(...txList.map((t) => t.installmentTotal || 0), 2);
        const monthlyAmount = txList.find((t) => t.amount > 0)?.amount || repTx.amount;

        const txInMonth = txList.find((t) => t.date.slice(0, 7) === targetMonth);
        if (txInMonth) {
          if (Number(txInMonth.amount || 0) > 0) {
            installmentsAmount += Number(txInMonth.amount || 0);
            installmentsCount += 1;
          }
        } else {
          const repMonth = repTx.date.slice(0, 7);
          const repCur = repTx.installmentCurrent || 1;
          const seriesStartMonth = shiftMonth(repMonth, -(repCur - 1));
          const instNumForTarget = getInstallmentNumberForMonth(seriesStartMonth, targetMonth);

          if (
            instNumForTarget !== null &&
            instNumForTarget >= 1 &&
            instNumForTarget <= totalInstallments
          ) {
            const existingPaid = txList.find(
              (t) =>
                (t.installmentCurrent === instNumForTarget || t.date.slice(0, 7) === targetMonth) &&
                (t.status || 'paid') === 'paid'
            );
            if (!existingPaid && monthlyAmount > 0) {
              installmentsAmount += monthlyAmount;
              installmentsCount += 1;
            }
          }
        }
      }

      // 3. Fixed Recurring Expenses scheduled for targetMonth
      let recurringAmount = 0;
      let recurringCount = 0;

      if (recurringTemplates && recurringTemplates.length > 0) {
        for (const tpl of recurringTemplates) {
          if (!tpl.active || tpl.type !== 'expense') continue;

          if (tpl.isInstallment && tpl.totalInstallments && tpl.startMonth) {
            const instNum = getInstallmentNumberForMonth(tpl.startMonth, targetMonth);
            if (instNum !== null && instNum >= 1 && instNum <= tpl.totalInstallments) {
              const hasTxInMonth = transactions.some(
                (tx) => tx.recurringId === tpl.id && tx.date.startsWith(targetMonth)
              );
              if (!hasTxInMonth && tpl.amount > 0) {
                recurringAmount += Number(tpl.amount || 0);
                recurringCount += 1;
              }
            }
          } else if (!tpl.isInstallment) {
            const txInMonth = transactions.find(
              (tx) => tx.recurringId === tpl.id && tx.date.startsWith(targetMonth)
            );
            if (txInMonth) {
              if (Number(txInMonth.amount || 0) > 0) {
                recurringAmount += Number(txInMonth.amount || 0);
                recurringCount += 1;
              }
            } else {
              if (Number(tpl.amount || 0) > 0) {
                recurringAmount += Number(tpl.amount || 0);
                recurringCount += 1;
              }
            }
          }
        }
      }

      const invRounded = Number(invoicesAmount.toFixed(2));
      const instRounded = Number(installmentsAmount.toFixed(2));
      const recRounded = Number(recurringAmount.toFixed(2));
      const totalCommitment = Number((invRounded + instRounded + recRounded).toFixed(2));

      const [y] = targetMonth.split('-');
      const shortMonthLabel = formatShortMonthLabel(targetMonth, language).slice(0, 3);
      const yearLabel = `'${y.slice(2)}`;

      return {
        month: targetMonth,
        shortMonthLabel,
        yearLabel,
        invoicesAmount: invRounded,
        installmentsAmount: instRounded,
        recurringAmount: recRounded,
        totalCommitment,
        invoicesCount,
        installmentsCount,
        recurringCount,
      };
    });
  }, [projectionMonths, creditCards, transactions, recurringTemplates, language]);

  // Overall 6-month summary metrics
  const { maxVal, avgMonthly } = useMemo(() => {
    const total = projections.reduce((s, p) => s + p.totalCommitment, 0);
    const max = Math.max(...projections.map((p) => p.totalCommitment), 1);
    const avg = total / 6;
    return {
      maxVal: max,
      avgMonthly: Number(avg.toFixed(2)),
    };
  }, [projections]);

  const activeData = useMemo(() => {
    return (
      projections.find((p) => p.month === activeMonth) ||
      projections[0] || {
        month: selectedMonth,
        shortMonthLabel: '',
        yearLabel: '',
        invoicesAmount: 0,
        installmentsAmount: 0,
        recurringAmount: 0,
        totalCommitment: 0,
        invoicesCount: 0,
        installmentsCount: 0,
        recurringCount: 0,
      }
    );
  }, [projections, activeMonth, selectedMonth]);

  return (
    <section
      className={`rounded-2xl border p-5 transition-colors ${
        isOled
          ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
          : 'bg-white border-[#E2E8F0] text-slate-900 shadow-xs'
      }`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isOled
                ? 'bg-[#161B22] text-slate-300'
                : 'bg-slate-100 text-slate-700'
            } dark:bg-[#161B22] dark:text-slate-300`}
          >
            <TrendingUp size={18} />
          </div>
          <div className="min-w-0">
            <h2
              className={`text-base font-bold tracking-tight truncate ${
                isOled ? 'text-white' : 'text-slate-900'
              } dark:text-white`}
            >
              {language === 'pt-BR' ? 'Compromissos Futuros' : 'Future Commitments'}
            </h2>
            <p
              className={`text-xs mt-0.5 truncate ${
                isOled ? 'text-slate-400' : 'text-slate-500'
              } dark:text-slate-400`}
            >
              {language === 'pt-BR'
                ? 'Próximos 6 meses contratados'
                : 'Next 6 contracted months'}
            </p>
          </div>
        </div>

        {/* Right metric pill: Monthly Average */}
        <div
          className={`px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${
            isOled
              ? 'bg-[#161B22] text-slate-400 border-[#21262D]'
              : 'bg-slate-100 text-slate-600 border-slate-200/60'
          } dark:bg-[#161B22] dark:text-slate-400 dark:border-[#21262D]`}
        >
          {language === 'pt-BR'
            ? `Média: ${formatCurrency(avgMonthly, currency)}/mês`
            : `Avg: ${formatCurrency(avgMonthly, currency)}/mo`}
        </div>
      </div>

      {/* Vertical Stacked Bar Chart */}
      <div className="relative pt-6 pb-2">
        {/* Subtle reference grid lines */}
        <div className="absolute inset-x-0 top-6 bottom-10 flex flex-col justify-between pointer-events-none opacity-40">
          <div
            className={`border-b border-dashed ${
              isOled ? 'border-[#21262D]' : 'border-slate-200'
            }`}
          />
          <div
            className={`border-b border-dashed ${
              isOled ? 'border-[#21262D]' : 'border-slate-200'
            }`}
          />
          <div
            className={`border-b border-dashed ${
              isOled ? 'border-[#21262D]' : 'border-slate-200'
            }`}
          />
        </div>

        {/* Bar Columns Container */}
        <div className="grid grid-cols-6 gap-1.5 sm:gap-2.5 items-end relative z-10">
          {projections.map((p) => {
            const isSelected = p.month === activeMonth;
            const barHeightPct =
              maxVal > 0 && p.totalCommitment > 0
                ? Math.max(10, Math.round((p.totalCommitment / maxVal) * 100))
                : 0;

            const invPct =
              p.totalCommitment > 0 ? (p.invoicesAmount / p.totalCommitment) * 100 : 0;
            const instPct =
              p.totalCommitment > 0 ? (p.installmentsAmount / p.totalCommitment) * 100 : 0;
            const recPct =
              p.totalCommitment > 0 ? (p.recurringAmount / p.totalCommitment) * 100 : 0;

            return (
              <button
                key={p.month}
                type="button"
                onClick={() => setActiveMonth(p.month)}
                className={`group flex flex-col items-center justify-end w-full focus:outline-none transition-all ${
                  isSelected ? 'scale-[1.02]' : 'hover:opacity-90'
                }`}
              >
                {/* Abbreviated value above bar */}
                <span
                  className={`text-[10px] sm:text-[11px] font-extrabold mb-1.5 transition-colors truncate max-w-full ${
                    isSelected
                      ? isOled
                        ? 'text-[#F8FAFC]'
                        : 'text-slate-900'
                      : isOled
                      ? 'text-[#94A3B8]'
                      : 'text-slate-500'
                  }`}
                >
                  {formatCompactNumber(p.totalCommitment)}
                </span>

                {/* Track Column */}
                <div
                  className={`w-full max-w-[42px] h-28 rounded-xl flex flex-col justify-end p-1 transition-all ${
                    isOled ? 'bg-[#161B22]' : 'bg-slate-100'
                  } ${
                    isSelected
                      ? isOled
                        ? 'ring-2 ring-[#6E5440] shadow-sm'
                        : 'ring-2 ring-[#6E5440] shadow-sm'
                      : ''
                  }`}
                >
                  {/* Filled Stacked Bar */}
                  {p.totalCommitment > 0 ? (
                    <div
                      style={{ height: `${barHeightPct}%` }}
                      className="w-full rounded-lg overflow-hidden flex flex-col justify-end transition-all duration-300"
                    >
                      {/* Top segment: Credit Card Invoices */}
                      {p.invoicesAmount > 0 && (
                        <div
                          style={{ height: `${invPct}%` }}
                          className="w-full bg-[#6366F1] transition-all"
                          title={`Faturas: ${formatCurrency(p.invoicesAmount, currency)}`}
                        />
                      )}
                      {/* Middle segment: Non-card Account Installments */}
                      {p.installmentsAmount > 0 && (
                        <div
                          style={{ height: `${instPct}%` }}
                          className="w-full bg-[#F59E0B] transition-all"
                          title={`Parcelas em Conta: ${formatCurrency(p.installmentsAmount, currency)}`}
                        />
                      )}
                      {/* Bottom segment: Fixed Recurring Expenses */}
                      {p.recurringAmount > 0 && (
                        <div
                          style={{ height: `${recPct}%` }}
                          className="w-full bg-[#6E5440] transition-all"
                          title={`Recorrências: ${formatCurrency(p.recurringAmount, currency)}`}
                        />
                      )}
                    </div>
                  ) : (
                    <div
                      className={`w-full h-1.5 rounded-full ${
                        isOled ? 'bg-[#21262D]' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>

                {/* Month & Year Label Below Bar */}
                <div className="mt-2 text-center">
                  <span
                    className={`block text-[11px] font-bold uppercase tracking-tight transition-colors ${
                      isSelected
                        ? isOled
                          ? 'text-[#F8FAFC]'
                          : 'text-slate-900'
                        : isOled
                        ? 'text-[#94A3B8]'
                        : 'text-slate-500'
                    }`}
                  >
                    {p.shortMonthLabel}
                  </span>
                  <span
                    className={`block text-[9px] font-medium transition-colors ${
                      isSelected
                        ? isOled
                          ? 'text-[#D0B595]'
                          : 'text-[#6E5440]'
                        : isOled
                        ? 'text-[#94A3B8]/60'
                        : 'text-slate-400'
                    }`}
                  >
                    {p.yearLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Touch Interaction: Compact Breakdown Mini-Summary on Tap */}
      <div
        className={`mt-4 rounded-xl p-3.5 border transition-all ${
          isOled
            ? 'bg-[#161B22]/60 border-[#21262D]'
            : 'bg-slate-50 border-slate-200/80'
        } dark:bg-[#161B22]/60 dark:border-[#21262D]`}
      >
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span
            className={`text-xs font-bold capitalize ${
              isOled ? 'text-white' : 'text-slate-900'
            } dark:text-white`}
          >
            {formatMonthLabel(activeData.month, language)}
          </span>

          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                isOled ? 'text-slate-500' : 'text-slate-400'
              } dark:text-slate-500`}
            >
              {language === 'pt-BR' ? 'Total Contratado:' : 'Total Committed:'}
            </span>
            <span
              className={`text-sm font-bold ${
                isOled ? 'text-white' : 'text-slate-900'
              } dark:text-white`}
            >
              {formatCurrency(activeData.totalCommitment, currency)}
            </span>
          </div>
        </div>

        {/* Mini Itemized Breakdown Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Faturas */}
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
              isOled
                ? 'bg-[#0D1117] text-slate-300 border-[#21262D]'
                : 'bg-white text-slate-700 border-slate-200/80'
            } dark:bg-[#0D1117] dark:text-slate-300 dark:border-[#21262D]`}
          >
            <span className="w-2 h-2 rounded-full bg-[#6366F1] shrink-0" />
            <span
              className={`text-[11px] font-normal ${
                isOled ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {language === 'pt-BR' ? 'Faturas:' : 'Invoices:'}
            </span>
            <span className={`font-semibold text-[11px] ${isOled ? 'text-white' : 'text-slate-900'}`}>
              {formatCurrency(activeData.invoicesAmount, currency)}
            </span>
          </div>

          {/* Parcelas em Conta */}
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
              isOled
                ? 'bg-[#0D1117] text-slate-300 border-[#21262D]'
                : 'bg-white text-slate-700 border-slate-200/80'
            } dark:bg-[#0D1117] dark:text-slate-300 dark:border-[#21262D]`}
          >
            <span className="w-2 h-2 rounded-full bg-[#F59E0B] shrink-0" />
            <span
              className={`text-[11px] font-normal ${
                isOled ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              {language === 'pt-BR' ? 'Parcelas:' : 'Installments:'}
            </span>
            <span className={`font-semibold text-[11px] ${isOled ? 'text-white' : 'text-slate-900'}`}>
              {formatCurrency(activeData.installmentsAmount, currency)}
            </span>
          </div>

          {/* Despesas Fixas / Recorrências */}
          {activeData.recurringAmount > 0 && (
            <div
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                isOled
                  ? 'bg-[#0D1117] text-slate-300 border-[#21262D]'
                  : 'bg-white text-slate-700 border-slate-200/80'
              } dark:bg-[#0D1117] dark:text-slate-300 dark:border-[#21262D]`}
            >
              <span className="w-2 h-2 rounded-full bg-[#6E5440] shrink-0" />
              <span
                className={`text-[11px] font-normal ${
                  isOled ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                {language === 'pt-BR' ? 'Recorrências:' : 'Recurring:'}
              </span>
              <span className={`font-semibold text-[11px] ${isOled ? 'text-white' : 'text-slate-900'}`}>
                {formatCurrency(activeData.recurringAmount, currency)}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

// 4 logical cards wrapped with adjacent virtual buffers [Card 3, Card 0, Card 1, Card 2, Card 3, Card 0]
// for seamless infinite circular wrap-around in both directions
const VIRTUAL_SLIDE_MAP = [3, 0, 1, 2, 3, 0] as const;

const REPORT_SLIDES = [
  { index: 0, labelPt: 'Fluxo Geral', labelEn: 'Cash Flow' },
  { index: 1, labelPt: 'Cartões', labelEn: 'Cards' },
  { index: 2, labelPt: 'Futuro', labelEn: 'Future' },
  { index: 3, labelPt: 'Parcelas', labelEn: 'Installments' },
] as const;

/**
 * Reports View with two distinct Donut Charts, 6-Month Commitments Forecast,
 * and Account Installment Tracker integrated into a 100% gesture-driven
 * infinite circular carousel with spring physics transitions.
 */
export const ReportsView: React.FC<ReportsViewProps> = ({
  selectedMonth,
  currency,
  language,
  theme = 'oled',
  categories,
  creditCards = [],
  transactions,
  recurringTemplates = [],
}) => {
  const [selectedType, setSelectedType] = useState<TransactionType>('expense');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // Infinite Circular Carousel & 1:1 Spring Drag Physics State
  // vIndex starts at 1 (logical Card 0: "Distribuição por Categoria - Fluxo de Caixa")
  const [vIndex, setVIndex] = useState<number>(1);
  const vIndexRef = useRef<number>(1);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const wasDraggedRef = useRef<boolean>(false);

  const gestureRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    vx: number;
    lock: 'none' | 'h' | 'v';
  }>({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    vx: 0,
    lock: 'none',
  });

  const startGesture = useCallback((clientX: number, clientY: number) => {
    // If a new drag starts while on a virtual wrap-around clone (0 or 5),
    // immediately normalize to its canonical inner slot (4 or 1) without transition.
    let curV = vIndexRef.current;
    if (curV === 0) {
      curV = 4;
      vIndexRef.current = 4;
      setVIndex(4);
    } else if (curV === 5) {
      curV = 1;
      vIndexRef.current = 1;
      setVIndex(1);
    }

    setIsAnimating(false);
    const now = performance.now();
    gestureRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      lastX: clientX,
      lastTime: now,
      vx: 0,
      lock: 'none',
    };
    wasDraggedRef.current = false;
  }, []);

  const moveGesture = useCallback(
    (clientX: number, clientY: number, preventDefault?: () => void) => {
      const g = gestureRef.current;
      if (!g.active) return;

      const deltaX = clientX - g.startX;
      const deltaY = clientY - g.startY;

      if (g.lock === 'none') {
        if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;

        // Strict vertical scroll isolation: preserve native vertical scrolling when |deltaY| >= |deltaX|
        if (Math.abs(deltaY) >= Math.abs(deltaX)) {
          g.lock = 'v';
          g.active = false;
          setIsDragging(false);
          setDragOffset(0);
          return;
        }

        // Lock horizontal drag when |deltaX| > |deltaY|
        g.lock = 'h';
        wasDraggedRef.current = true;
        setIsAnimating(false);
        setIsDragging(true);
      }

      if (g.lock === 'h') {
        if (preventDefault) preventDefault();

        const now = performance.now();
        const dt = now - g.lastTime;
        if (dt > 0) {
          const instantVx = (clientX - g.lastX) / dt; // px/ms
          g.vx = g.vx * 0.3 + instantVx * 0.7;
        }
        g.lastX = clientX;
        g.lastTime = now;

        setDragOffset(deltaX);
      }
    },
    []
  );

  const endGesture = useCallback(() => {
    const g = gestureRef.current;
    if (!g.active) return;
    g.active = false;

    if (g.lock === 'h') {
      const deltaX = g.lastX - g.startX;
      const now = performance.now();
      const effectiveVx = now - g.lastTime > 120 ? 0 : g.vx;

      const swipeThresholdPx = 50;
      const flickVelocityThreshold = 0.35; // px/ms

      let nextV = vIndexRef.current;
      if (deltaX < -swipeThresholdPx || (effectiveVx < -flickVelocityThreshold && deltaX < -15)) {
        nextV = Math.min(VIRTUAL_SLIDE_MAP.length - 1, vIndexRef.current + 1);
      } else if (
        deltaX > swipeThresholdPx ||
        (effectiveVx > flickVelocityThreshold && deltaX > 15)
      ) {
        nextV = Math.max(0, vIndexRef.current - 1);
      }

      vIndexRef.current = nextV;
      setIsDragging(false);
      setIsAnimating(true);
      setVIndex(nextV);
      setDragOffset(0);
    }

    g.lock = 'none';
  }, []);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    startGesture(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    moveGesture(e.touches[0].clientX, e.touches[0].clientY, () => {
      if (e.cancelable) e.preventDefault();
    });
  };

  const handleTouchEnd = () => {
    endGesture();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    startGesture(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gestureRef.current.active) return;
    moveGesture(e.clientX, e.clientY, () => {
      if (e.cancelable) e.preventDefault();
    });
  };

  const handleMouseUp = () => {
    endGesture();
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (wasDraggedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      wasDraggedRef.current = false;
    }
  };

  // Silent wrap-around re-centering once the spring transition completes
  const handleTrackTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;

    if (vIndexRef.current === 5) {
      vIndexRef.current = 1;
      setIsAnimating(false);
      setVIndex(1);
    } else if (vIndexRef.current === 0) {
      vIndexRef.current = 4;
      setIsAnimating(false);
      setVIndex(4);
    } else {
      setIsAnimating(false);
    }
  };

  useEffect(() => {
    if (!isAnimating) return;
    const timer = setTimeout(() => {
      if (vIndexRef.current === 5) {
        vIndexRef.current = 1;
        setIsAnimating(false);
        setVIndex(1);
      } else if (vIndexRef.current === 0) {
        vIndexRef.current = 4;
        setIsAnimating(false);
        setVIndex(4);
      } else {
        setIsAnimating(false);
      }
    }, 365);
    return () => clearTimeout(timer);
  }, [isAnimating, vIndex]);

  const activeSlideIndex = VIRTUAL_SLIDE_MAP[vIndex] ?? 0;

  const handleSelectSlide = useCallback((targetLogicalIdx: number) => {
    const targetV = targetLogicalIdx + 1;
    if (vIndexRef.current === targetV) return;
    if (VIRTUAL_SLIDE_MAP[vIndexRef.current] === targetLogicalIdx) return;

    vIndexRef.current = targetV;
    setIsDragging(false);
    setIsAnimating(true);
    setVIndex(targetV);
    setDragOffset(0);
  }, []);

  // Card filter state for the dedicated credit card breakdown chart
  const [selectedCardFilter, setSelectedCardFilter] = useState<string>('all');
  const [activeCardCategoryId, setActiveCardCategoryId] = useState<string | null>(null);

  const isOled = theme === 'oled';
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Reset active category slice highlights on month/type/card filter change
  React.useEffect(() => {
    setActiveCategoryId(null);
  }, [selectedMonth, selectedType]);

  React.useEffect(() => {
    setActiveCardCategoryId(null);
  }, [selectedMonth, selectedCardFilter]);

  const INVOICE_SLICE_ID = 'credit-card-invoices';

  // 1. PRIMARY CHART: Consolidated Cash Outflow Distribution
  // Reflects total cash obligations due in selectedMonth (matching Home screen sum: Realized + "A pagar")
  const { categorySlices, totalAmount, totalCount } = useMemo(() => {
    const groups = new Map<string, { amount: number; count: number }>();
    let sumTotal = 0;
    let countTotal = 0;
    const handledInvoiceKeys = new Set<string>();

    for (const tx of transactions) {
      if (tx.type !== selectedType) continue;
      // Strictly exclude individual credit card transactions from cash flow
      if (tx.cardId) continue;

      // Only transactions falling into selectedMonth
      if (!tx.date.startsWith(selectedMonth)) continue;

      const amt = Number(tx.amount || 0);
      if (amt <= 0) continue;

      const isInvoice =
        Boolean(tx.settledInvoiceKey) ||
        tx.categoryId === 'cat-fatura' ||
        Boolean(
          tx.description &&
            (tx.description.toLowerCase().startsWith('fatura ') ||
              tx.description.toLowerCase().startsWith('fatura:') ||
              tx.description.toLowerCase() === 'fatura' ||
              tx.description.toLowerCase().startsWith('pagamento de fatura'))
        );

      if (isInvoice && selectedType === 'expense') {
        if (tx.settledInvoiceKey) {
          handledInvoiceKeys.add(tx.settledInvoiceKey);
        }
        const existing = groups.get(INVOICE_SLICE_ID) || { amount: 0, count: 0 };
        groups.set(INVOICE_SLICE_ID, {
          amount: existing.amount + amt,
          count: existing.count + 1,
        });
        sumTotal += amt;
        countTotal += 1;
      } else {
        const catKey = tx.categoryId || 'uncategorized';
        const existing = groups.get(catKey) || { amount: 0, count: 0 };
        groups.set(catKey, {
          amount: existing.amount + amt,
          count: existing.count + 1,
        });
        sumTotal += amt;
        countTotal += 1;
      }
    }

    // Safety fallback: ensure any open/closed card invoice due in selectedMonth is captured
    // even if the automatic background settlement sync has not yet committed a transaction
    if (selectedType === 'expense' && creditCards && creditCards.length > 0) {
      for (const card of creditCards) {
        const cardTxs = transactions.filter((tx) => tx.cardId === card.id && tx.type === 'expense');
        if (cardTxs.length === 0) continue;

        const cycles = new Set<string>();
        for (const tx of cardTxs) {
          cycles.add(getTxInvoiceMonth(tx, card));
        }

        for (const invMonth of cycles) {
          const settlementKey = `${card.id}__${invMonth}`;
          if (handledInvoiceKeys.has(settlementKey)) continue;

          const hasSettlement = transactions.some((tx) => tx.settledInvoiceKey === settlementKey);
          if (hasSettlement) continue;

          const dueDate = computeInvoiceDueDate(invMonth, card.closingDay, card.dueDay);
          if (dueDate.startsWith(selectedMonth)) {
            const cycleTotal = cardTxs
              .filter((tx) => getTxInvoiceMonth(tx, card) === invMonth && (tx.status || 'paid') === 'unpaid')
              .reduce((s, tx) => s + Number(tx.amount || 0), 0);

            if (cycleTotal > 0) {
              handledInvoiceKeys.add(settlementKey);
              const existing = groups.get(INVOICE_SLICE_ID) || { amount: 0, count: 0 };
              groups.set(INVOICE_SLICE_ID, {
                amount: existing.amount + cycleTotal,
                count: existing.count + 1,
              });
              sumTotal += cycleTotal;
              countTotal += 1;
            }
          }
        }
      }
    }

    const totalRounded = Number(sumTotal.toFixed(2));
    const slices: CategorySliceItem[] = Array.from(groups.entries())
      .map(([catId, data], index) => {
        if (catId === INVOICE_SLICE_ID) {
          const amountRounded = Number(data.amount.toFixed(2));
          const share = totalRounded > 0 ? (data.amount / totalRounded) * 100 : 0;
          return {
            id: INVOICE_SLICE_ID,
            name: language === 'pt-BR' ? 'Faturas de Cartão' : 'Credit Card Invoices',
            color: '#6366F1', // Indigo token for credit card invoices
            icon: 'CreditCard',
            amount: amountRounded,
            count: data.count,
            share,
          };
        }

        const cat = categoryMap.get(catId);
        const amountRounded = Number(data.amount.toFixed(2));
        const share = totalRounded > 0 ? (data.amount / totalRounded) * 100 : 0;
        return {
          id: catId,
          name: cat
            ? getCategoryDisplayName(cat, language)
            : language === 'pt-BR'
            ? 'Outros'
            : 'Other',
          color: cat?.color || FALLBACK_SLICE_COLORS[index % FALLBACK_SLICE_COLORS.length],
          icon: cat?.icon || 'Tag',
          amount: amountRounded,
          count: data.count,
          share,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return {
      categorySlices: slices,
      totalAmount: totalRounded,
      totalCount: countTotal,
    };
  }, [transactions, selectedType, selectedMonth, categoryMap, creditCards, language]);

  // 2. SECOND CHART: Dedicated Credit Card Category Breakdown
  // Aggregates all individual purchases belonging to invoices due in selectedMonth
  const { cardCategorySlices, cardTotalAmount, cardTotalCount } = useMemo(() => {
    const groups = new Map<string, { amount: number; count: number }>();
    let sumTotal = 0;
    let countTotal = 0;

    if (!creditCards || creditCards.length === 0) {
      return {
        cardCategorySlices: [],
        cardTotalAmount: 0,
        cardTotalCount: 0,
      };
    }

    for (const card of creditCards) {
      if (selectedCardFilter !== 'all' && selectedCardFilter !== card.id) {
        continue;
      }

      const cardTxs = transactions.filter((tx) => tx.cardId === card.id && tx.type === 'expense');
      if (cardTxs.length === 0) continue;

      const cycles = new Set<string>();
      for (const tx of cardTxs) {
        cycles.add(getTxInvoiceMonth(tx, card));
      }

      for (const invMonth of cycles) {
        const settlementKey = `${card.id}__${invMonth}`;
        const settlementTx = transactions.find((tx) => tx.settledInvoiceKey === settlementKey);
        const dueDate = computeInvoiceDueDate(invMonth, card.closingDay, card.dueDay);
        const dueMonth = settlementTx?.date ? settlementTx.date.slice(0, 7) : dueDate.slice(0, 7);

        // Does this invoice cycle mature/due in selectedMonth?
        if (dueMonth === selectedMonth) {
          const cycleTxs = cardTxs.filter((tx) => getTxInvoiceMonth(tx, card) === invMonth);
          for (const tx of cycleTxs) {
            const amt = Number(tx.amount || 0);
            if (amt <= 0) continue;

            const catKey = tx.categoryId || 'uncategorized';
            const existing = groups.get(catKey) || { amount: 0, count: 0 };
            groups.set(catKey, {
              amount: existing.amount + amt,
              count: existing.count + 1,
            });
            sumTotal += amt;
            countTotal += 1;
          }
        }
      }
    }

    const totalRounded = Number(sumTotal.toFixed(2));
    const slices: CategorySliceItem[] = Array.from(groups.entries())
      .map(([catId, data], index) => {
        const cat = categoryMap.get(catId);
        const amountRounded = Number(data.amount.toFixed(2));
        const share = totalRounded > 0 ? (data.amount / totalRounded) * 100 : 0;
        return {
          id: catId,
          name: cat
            ? getCategoryDisplayName(cat, language)
            : language === 'pt-BR'
            ? 'Outros'
            : 'Other',
          color: cat?.color || FALLBACK_SLICE_COLORS[index % FALLBACK_SLICE_COLORS.length],
          icon: cat?.icon || 'Tag',
          amount: amountRounded,
          count: data.count,
          share,
        };
      })
      .sort((a, b) => b.amount - a.amount);

    return {
      cardCategorySlices: slices,
      cardTotalAmount: totalRounded,
      cardTotalCount: countTotal,
    };
  }, [creditCards, transactions, selectedMonth, selectedCardFilter, categoryMap, language]);

  const activeSlice = useMemo(
    () => categorySlices.find((s) => s.id === activeCategoryId) || null,
    [categorySlices, activeCategoryId]
  );

  const activeCardSlice = useMemo(
    () => cardCategorySlices.find((s) => s.id === activeCardCategoryId) || null,
    [cardCategorySlices, activeCardCategoryId]
  );

  // Pure SVG Donut Chart geometry built from scratch
  const svgSize = 240;
  const center = svgSize / 2;
  const radius = 84;
  const strokeWidth = 28;
  const circumference = 2 * Math.PI * radius;

  const computedArcs = useMemo(() => {
    if (categorySlices.length === 0 || totalAmount <= 0) return [];
    const gapPx = categorySlices.length > 1 ? 3.5 : 0;
    let accumulatedFraction = 0;

    return categorySlices.map((slice) => {
      const fraction = slice.amount / totalAmount;
      const rawLength = fraction * circumference;
      const visibleLength = Math.max(2, rawLength - gapPx);
      const dashOffset = circumference * (1 - accumulatedFraction);
      accumulatedFraction += fraction;

      return {
        ...slice,
        strokeDasharray: `${visibleLength} ${Math.max(0, circumference - visibleLength)}`,
        strokeDashoffset: dashOffset,
      };
    });
  }, [categorySlices, totalAmount, circumference]);

  const computedCardArcs = useMemo(() => {
    if (cardCategorySlices.length === 0 || cardTotalAmount <= 0) return [];
    const gapPx = cardCategorySlices.length > 1 ? 3.5 : 0;
    let accumulatedFraction = 0;

    return cardCategorySlices.map((slice) => {
      const fraction = slice.amount / cardTotalAmount;
      const rawLength = fraction * circumference;
      const visibleLength = Math.max(2, rawLength - gapPx);
      const dashOffset = circumference * (1 - accumulatedFraction);
      accumulatedFraction += fraction;

      return {
        ...slice,
        strokeDasharray: `${visibleLength} ${Math.max(0, circumference - visibleLength)}`,
        strokeDashoffset: dashOffset,
      };
    });
  }, [cardCategorySlices, cardTotalAmount, circumference]);

  const monthTitle = formatMonthLabel(selectedMonth, language);

  const renderReportCard = (logicalIdx: number) => {
    switch (logicalIdx) {
      case 0:
        return (
          /* 1. PRIMARY CARD: Distribuição por Categoria - Fluxo de Caixa */
          <section
            className={`rounded-2xl border p-5 transition-colors ${
              isOled
                ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
                : 'bg-white border-[#E2E8F0] text-slate-900 shadow-xs'
            }`}
          >
            {/* Card Header */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isOled
                      ? 'bg-[#161B22] text-slate-300'
                      : 'bg-slate-100 text-slate-700'
                  } dark:bg-[#161B22] dark:text-slate-300`}
                >
                  <PieChartIcon size={18} />
                </div>
                <div className="min-w-0">
                  <h1
                    className={`text-base font-bold tracking-tight truncate ${
                      isOled ? 'text-white' : 'text-slate-900'
                    } dark:text-white`}
                  >
                    {language === 'pt-BR'
                      ? 'Distribuição por Categoria - Fluxo de Caixa'
                      : 'Category Breakdown - Cash Flow'}
                  </h1>
                  <p
                    className={`text-xs mt-0.5 capitalize truncate ${
                      isOled ? 'text-slate-400' : 'text-slate-500'
                    } dark:text-slate-400`}
                  >
                    {monthTitle}
                  </p>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${
                  isOled
                    ? 'bg-[#161B22] text-slate-400 border-[#21262D]'
                    : 'bg-slate-100 text-slate-600 border-slate-200/60'
                } dark:bg-[#161B22] dark:text-slate-400 dark:border-[#21262D]`}
              >
                {totalCount}{' '}
                {language === 'pt-BR'
                  ? totalCount === 1
                    ? 'lançamento'
                    : 'lançamentos'
                  : totalCount === 1
                  ? 'entry'
                  : 'entries'}
              </span>
            </div>

            {/* Type Selector: Segmented Control Toggle ("Despesas" default vs "Entradas") */}
            <div
              className={`grid grid-cols-2 gap-1.5 p-1 rounded-xl border mb-6 ${
                isOled ? 'bg-[#161B22] border-[#21262D]' : 'bg-slate-100 border-slate-200/80'
              } dark:bg-[#161B22] dark:border-[#21262D]`}
            >
              <button
                type="button"
                onClick={() => setSelectedType('expense')}
                className={`min-h-[44px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  selectedType === 'expense'
                    ? 'bg-[#6E5440] text-white shadow-sm'
                    : isOled
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownRight size={16} strokeWidth={2.5} />
                <span>{language === 'pt-BR' ? 'Despesas' : 'Expenses'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedType('income')}
                className={`min-h-[44px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  selectedType === 'income'
                    ? 'bg-[#6E5440] text-white shadow-sm'
                    : isOled
                    ? 'text-slate-400 hover:text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight size={16} strokeWidth={2.5} />
                <span>{language === 'pt-BR' ? 'Entradas' : 'Income'}</span>
              </button>
            </div>

            {/* Custom Donut Chart Built From Scratch */}
            {categorySlices.length === 0 ? (
              <div className="py-10 flex flex-col items-center justify-center text-center">
                <div className="relative w-44 h-44 flex items-center justify-center mb-3">
                  <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="w-full h-full -rotate-90">
                    <circle
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="none"
                      stroke={isOled ? '#161B22' : '#E2E8F0'}
                      strokeWidth={strokeWidth}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
                    <PieChartIcon size={24} className="text-[#94A3B8] opacity-50 mb-1" />
                    <span
                      className={`text-xs font-bold ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}
                    >
                      {formatCurrency(0, currency)}
                    </span>
                  </div>
                </div>
                <p className={`text-sm font-bold ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
                  {language === 'pt-BR'
                    ? selectedType === 'expense'
                      ? 'Nenhuma despesa neste mês'
                      : 'Nenhuma entrada neste mês'
                    : selectedType === 'expense'
                    ? 'No expenses in this month'
                    : 'No income in this month'}
                </p>
                <p
                  className={`text-xs mt-1 max-w-xs ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}
                >
                  {language === 'pt-BR'
                    ? 'Os lançamentos registrados neste período aparecerão distribuídos por categoria aqui.'
                    : 'Transactions recorded in this period will appear grouped by category here.'}
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center justify-center my-2">
                  <div className="relative w-60 h-60 flex items-center justify-center">
                    <svg
                      viewBox={`0 0 ${svgSize} ${svgSize}`}
                      className="w-full h-full -rotate-90 overflow-visible"
                      role="img"
                      aria-label={
                        language === 'pt-BR'
                          ? 'Gráfico de Distribuição por Categoria'
                          : 'Category Breakdown Chart'
                      }
                    >
                      {/* Base track ring */}
                      <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="none"
                        stroke={isOled ? '#161B22' : '#E2E8F0'}
                        strokeWidth={strokeWidth}
                      />

                      {/* Proportional Category Slices */}
                      {computedArcs.map((arc) => {
                        const isSelected = activeCategoryId === arc.id;
                        const isDimmed = activeCategoryId !== null && !isSelected;

                        return (
                          <circle
                            key={arc.id}
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke={arc.color}
                            strokeWidth={isSelected ? strokeWidth + 6 : strokeWidth}
                            strokeDasharray={arc.strokeDasharray}
                            strokeDashoffset={arc.strokeDashoffset}
                            strokeLinecap="butt"
                            onClick={() =>
                              setActiveCategoryId((prev) => (prev === arc.id ? null : arc.id))
                            }
                            className="cursor-pointer transition-all duration-300 ease-out"
                            style={{
                              opacity: isDimmed ? 0.3 : 1,
                            }}
                          />
                        );
                      })}
                    </svg>

                    {/* Center Donut Readout */}
                    <button
                      type="button"
                      onClick={() => setActiveCategoryId(null)}
                      className="absolute inset-12 rounded-full flex flex-col items-center justify-center text-center px-2 focus:outline-none"
                    >
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider truncate max-w-[130px] ${
                          isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                        }`}
                      >
                        {activeSlice
                          ? activeSlice.name
                          : selectedType === 'expense'
                          ? language === 'pt-BR'
                            ? 'Total Despesas'
                            : 'Total Expenses'
                          : language === 'pt-BR'
                          ? 'Total Entradas'
                          : 'Total Income'}
                      </span>
                      <span
                        className={`text-lg font-black tracking-tight mt-0.5 ${
                          selectedType === 'expense' ? 'text-[#EF4444]' : 'text-[#10B981]'
                        }`}
                      >
                        {formatCurrency(activeSlice ? activeSlice.amount : totalAmount, currency)}
                      </span>
                      <span
                        className={`text-[11px] font-semibold mt-0.5 ${
                          isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                        }`}
                      >
                        {activeSlice
                          ? `${activeSlice.share.toFixed(1)}%`
                          : `100% • ${categorySlices.length} ${
                              language === 'pt-BR'
                                ? categorySlices.length === 1
                                  ? 'categoria'
                                  : 'categorias'
                                : categorySlices.length === 1
                                ? 'category'
                                : 'categories'
                            }`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Category Breakdown Legend Below the Chart */}
                <div
                  className={`mt-5 pt-4 border-t ${
                    isOled ? 'border-[#21262D]/80' : 'border-slate-200'
                  }`}
                >
                  {categorySlices.map((item) => {
                    const isSelected = activeCategoryId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setActiveCategoryId((prev) => (prev === item.id ? null : item.id))
                        }
                        className={`w-full min-h-[48px] rounded-xl p-3 mb-2 last:mb-0 flex items-center justify-between gap-3 border text-left transition-all ${
                          isSelected
                            ? isOled
                              ? 'bg-[#161B22] border-[#6E5440] ring-1 ring-[#D0B595]/30'
                              : 'bg-slate-100 border-[#6E5440]'
                            : isOled
                            ? 'bg-[#161B22]/40 border-[#21262D] hover:bg-[#161B22]/70'
                            : 'bg-slate-50/70 border-slate-200/60 hover:bg-slate-100'
                        } dark:bg-[#161B22]/40 dark:border-[#21262D]`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <CategoryIcon
                            icon={item.icon}
                            color={item.color}
                            badgeSize="sm"
                            size={15}
                          />
                          <span
                            className={`text-xs font-bold truncate ${
                              isOled ? 'text-white' : 'text-slate-900'
                            } dark:text-white`}
                          >
                            {item.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span
                            className={`text-xs font-bold ${
                              isOled ? 'text-white' : 'text-slate-900'
                            } dark:text-white`}
                          >
                            {formatCurrency(item.amount, currency)}
                          </span>
                          <span
                            className={`min-w-[48px] text-right px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                              isOled
                                ? 'bg-[#0D1117] text-slate-300 border-[#21262D]'
                                : 'bg-white text-slate-700 border-slate-200/80'
                            } dark:bg-[#0D1117] dark:text-slate-300 dark:border-[#21262D]`}
                          >
                            {item.share.toFixed(1)}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        );

      case 1:
        return (
          /* 2. DEDICATED CREDIT CARD BREAKDOWN CARD: Categorias no Cartão */
          <section
            className={`rounded-2xl border p-5 transition-colors ${
              isOled
                ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
                : 'bg-white border-[#E2E8F0] text-slate-900 shadow-xs'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    isOled
                      ? 'bg-[#161B22] text-slate-300'
                      : 'bg-slate-100 text-slate-700'
                  } dark:bg-[#161B22] dark:text-slate-300`}
                >
                  <CreditCardIcon size={18} />
                </div>
                <div className="min-w-0">
                  <h2
                    className={`text-base font-bold tracking-tight truncate ${
                      isOled ? 'text-white' : 'text-slate-900'
                    } dark:text-white`}
                  >
                    {language === 'pt-BR' ? 'Categorias no Cartão' : 'Credit Card Breakdown'}
                  </h2>
                  <p
                    className={`text-xs mt-0.5 truncate ${
                      isOled ? 'text-slate-400' : 'text-slate-500'
                    } dark:text-slate-400`}
                  >
                    {language === 'pt-BR'
                      ? 'Compras das faturas com vencimento no mês'
                      : 'Purchases from invoices due in this month'}
                  </p>
                </div>
              </div>

              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${
                  isOled
                    ? 'bg-[#161B22] text-slate-400 border-[#21262D]'
                    : 'bg-slate-100 text-slate-600 border-slate-200/60'
                } dark:bg-[#161B22] dark:text-slate-400 dark:border-[#21262D]`}
              >
                {cardTotalCount}{' '}
                {language === 'pt-BR'
                  ? cardTotalCount === 1
                    ? 'compra'
                    : 'compras'
                  : cardTotalCount === 1
                  ? 'purchase'
                  : 'purchases'}
              </span>
            </div>

            {/* Card Filter Selector (Todos os Cartões + individual cards) */}
            {creditCards && creditCards.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-5 no-scrollbar overscroll-x-contain">
                <button
                  type="button"
                  onClick={() => setSelectedCardFilter('all')}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border ${
                    selectedCardFilter === 'all'
                      ? 'bg-[#6E5440] border-[#6E5440] text-white shadow-xs'
                      : isOled
                      ? 'bg-[#161B22] border-[#21262D] text-slate-400 hover:text-white'
                      : 'bg-slate-100 border-slate-200/60 text-slate-600 hover:text-slate-900'
                  } dark:border-[#21262D]`}
                >
                  {language === 'pt-BR' ? 'Todos os Cartões' : 'All Cards'}
                </button>

                {creditCards.map((card) => {
                  const isSelected = selectedCardFilter === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => setSelectedCardFilter(card.id)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#6E5440] border-[#6E5440] text-white shadow-xs'
                          : isOled
                          ? 'bg-[#161B22] border-[#21262D] text-slate-400 hover:text-white'
                          : 'bg-slate-100 border-slate-200/60 text-slate-600 hover:text-slate-900'
                      } dark:border-[#21262D]`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: card.color || '#6366F1' }}
                      />
                      <span>{card.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Donut Chart or Empty State */}
            {cardCategorySlices.length === 0 ? (
              <div className="py-8 flex flex-col items-center justify-center text-center">
                <div className="relative w-40 h-40 flex items-center justify-center mb-3">
                  <svg viewBox={`0 0 ${svgSize} ${svgSize}`} className="w-full h-full -rotate-90">
                    <circle
                      cx={center}
                      cy={center}
                      r={radius}
                      fill="none"
                      stroke={isOled ? '#161B22' : '#E2E8F0'}
                      strokeWidth={strokeWidth}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
                    <CreditCardIcon size={22} className="text-[#94A3B8] opacity-40 mb-1" />
                    <span
                      className={`text-xs font-bold ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}
                    >
                      {formatCurrency(0, currency)}
                    </span>
                  </div>
                </div>
                <p className={`text-sm font-bold ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
                  {language === 'pt-BR'
                    ? 'Nenhuma compra no cartão com vencimento neste mês'
                    : 'No credit card purchases due in this month'}
                </p>
                <p
                  className={`text-xs mt-1 max-w-xs ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}
                >
                  {language === 'pt-BR'
                    ? 'As compras realizadas nos cartões vinculadas a faturas com vencimento neste período aparecerão aqui.'
                    : 'Card purchases belonging to billing cycles due in this period will appear grouped here.'}
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center justify-center my-2">
                  <div className="relative w-60 h-60 flex items-center justify-center">
                    <svg
                      viewBox={`0 0 ${svgSize} ${svgSize}`}
                      className="w-full h-full -rotate-90 overflow-visible"
                      role="img"
                      aria-label={
                        language === 'pt-BR'
                          ? 'Gráfico de Despesas no Cartão de Crédito'
                          : 'Credit Card Spending Chart'
                      }
                    >
                      {/* Base track ring */}
                      <circle
                        cx={center}
                        cy={center}
                        r={radius}
                        fill="none"
                        stroke={isOled ? '#161B22' : '#E2E8F0'}
                        strokeWidth={strokeWidth}
                      />

                      {/* Proportional Category Slices */}
                      {computedCardArcs.map((arc) => {
                        const isSelected = activeCardCategoryId === arc.id;
                        const isDimmed = activeCardCategoryId !== null && !isSelected;

                        return (
                          <circle
                            key={arc.id}
                            cx={center}
                            cy={center}
                            r={radius}
                            fill="none"
                            stroke={arc.color}
                            strokeWidth={isSelected ? strokeWidth + 6 : strokeWidth}
                            strokeDasharray={arc.strokeDasharray}
                            strokeDashoffset={arc.strokeDashoffset}
                            strokeLinecap="butt"
                            onClick={() =>
                              setActiveCardCategoryId((prev) => (prev === arc.id ? null : arc.id))
                            }
                            className="cursor-pointer transition-all duration-300 ease-out"
                            style={{
                              opacity: isDimmed ? 0.3 : 1,
                            }}
                          />
                        );
                      })}
                    </svg>

                    {/* Center Donut Readout */}
                    <button
                      type="button"
                      onClick={() => setActiveCardCategoryId(null)}
                      className="absolute inset-12 rounded-full flex flex-col items-center justify-center text-center px-2 focus:outline-none"
                    >
                      <span
                        className={`text-[11px] font-bold uppercase tracking-wider truncate max-w-[130px] ${
                          isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                        }`}
                      >
                        {activeCardSlice
                          ? activeCardSlice.name
                          : language === 'pt-BR'
                          ? 'Total Faturas'
                          : 'Total Invoices'}
                      </span>
                      <span className="text-lg font-black tracking-tight mt-0.5 text-[#6366F1]">
                        {formatCurrency(
                          activeCardSlice ? activeCardSlice.amount : cardTotalAmount,
                          currency
                        )}
                      </span>
                      <span
                        className={`text-[11px] font-semibold mt-0.5 ${
                          isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                        }`}
                      >
                        {activeCardSlice
                          ? `${activeCardSlice.share.toFixed(1)}%`
                          : `100% • ${cardCategorySlices.length} ${
                              language === 'pt-BR'
                                ? cardCategorySlices.length === 1
                                  ? 'categoria'
                                  : 'categorias'
                                : cardCategorySlices.length === 1
                                ? 'category'
                                : 'categories'
                            }`}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Category Breakdown Legend Below the Chart */}
                <div
                  className={`mt-5 pt-4 border-t ${
                    isOled ? 'border-[#21262D]/80' : 'border-slate-200'
                  }`}
                >
                  {cardCategorySlices.map((item) => {
                    const isSelected = activeCardCategoryId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          setActiveCardCategoryId((prev) => (prev === item.id ? null : item.id))
                        }
                        className={`w-full min-h-[48px] rounded-xl p-3 mb-2 last:mb-0 flex items-center justify-between gap-3 border text-left transition-all ${
                          isSelected
                            ? isOled
                              ? 'bg-[#161B22] border-[#6E5440] ring-1 ring-[#D0B595]/30'
                              : 'bg-slate-100 border-[#6E5440]'
                            : isOled
                            ? 'bg-[#161B22]/40 border-[#21262D] hover:bg-[#161B22]/70'
                            : 'bg-slate-50/70 border-slate-200/60 hover:bg-slate-100'
                        } dark:bg-[#161B22]/40 dark:border-[#21262D]`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <CategoryIcon
                            icon={item.icon}
                            color={item.color}
                            badgeSize="sm"
                            size={15}
                          />
                          <span
                            className={`text-xs font-bold truncate ${
                              isOled ? 'text-white' : 'text-slate-900'
                            } dark:text-white`}
                          >
                            {item.name}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span
                            className={`text-xs font-bold ${
                              isOled ? 'text-white' : 'text-slate-900'
                            } dark:text-white`}
                          >
                            {formatCurrency(item.amount, currency)}
                          </span>
                          <span
                            className={`min-w-[48px] text-right px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                              isOled
                                ? 'bg-[#0D1117] text-slate-300 border-[#21262D]'
                                : 'bg-white text-slate-700 border-slate-200/80'
                            } dark:bg-[#0D1117] dark:text-slate-300 dark:border-[#21262D]`}
                          >
                            {item.share.toFixed(1)}%
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        );

      case 2:
        return (
          /* 3. Previsão de Compromissos Futuros (Future Commitments Forecast) */
          <FutureCommitmentsForecast
            selectedMonth={selectedMonth}
            currency={currency}
            language={language}
            theme={theme}
            creditCards={creditCards}
            transactions={transactions}
            recurringTemplates={recurringTemplates}
          />
        );

      case 3:
      default:
        return (
          /* 4. Installment Expenses Tracker Card (Parcelamentos em Conta) */
          <InstallmentExpenseTracker
            transactions={transactions}
            categories={categories}
            currency={currency}
            language={language}
            selectedMonth={selectedMonth}
            theme={theme}
          />
        );
    }
  };

  return (
    <div className="pb-6 animate-fadeIn max-w-lg mx-auto w-full">
      {/* Minimalist Pagination Dots Indicator (Positioned Above the Report Card) */}
      <div
        className="flex items-center justify-center gap-2 pt-1 pb-3"
        role="tablist"
        aria-label={language === 'pt-BR' ? 'Navegação de relatórios' : 'Reports navigation'}
      >
        {REPORT_SLIDES.map((slide) => {
          const isActive = activeSlideIndex === slide.index;
          return (
            <button
              key={slide.index}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={language === 'pt-BR' ? slide.labelPt : slide.labelEn}
              onClick={() => handleSelectSlide(slide.index)}
              className={`rounded-full transition-all duration-300 ease-out focus:outline-none ${
                isActive
                  ? 'w-2.5 h-2.5 bg-[#6E5440]'
                  : isOled
                  ? 'w-1.5 h-1.5 bg-[#21262D] hover:bg-slate-700'
                  : 'w-1.5 h-1.5 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          );
        })}
      </div>

      {/* Gesture-Driven Infinite Circular Carousel with Spring Physics */}
      <div
        className="relative w-full overflow-hidden touch-pan-y select-none cursor-grab active:cursor-grabbing"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClickCapture={handleClickCapture}
      >
        <div
          className="flex w-full items-start"
          onTransitionEnd={handleTrackTransitionEnd}
          style={{
            transform: `translate3d(calc(-${vIndex * 100}% + ${dragOffset}px), 0, 0)`,
            transition: isAnimating
              ? 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)'
              : 'none',
            willChange: isDragging || isAnimating ? 'transform' : 'auto',
          }}
        >
          {VIRTUAL_SLIDE_MAP.map((logicalIdx, slotIdx) => (
            <div key={`virtual-slide-${slotIdx}`} className="w-full shrink-0 px-0.5">
              {renderReportCard(logicalIdx)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
