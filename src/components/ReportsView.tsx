import React, { useState, useMemo } from 'react';
import {
  PieChart as PieChartIcon,
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
  formatCurrency,
  formatMonthLabel,
  formatShortMonthLabel,
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
        totalInstallments > 0 ? (paidInstallments / totalInstallments) * 100 : 0;

      const txThisMonth = txList.find((t) => t.date.slice(0, 7) === selectedMonth);
      const isDueInSelectedMonth = Boolean(txThisMonth);
      const selectedMonthAmount = txThisMonth ? txThisMonth.amount : monthlyAmount;

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

  return (
    <section
      className={`rounded-2xl border p-4 mb-4 transition-colors ${
        isOled
          ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
          : 'bg-white border-[#E2E8F0] text-[#0F172A] shadow-xs'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
              isOled
                ? 'bg-[#161B22] border-[#21262D] text-[#D0B595]'
                : 'bg-[#F1F5F9] border-[#E2E8F0] text-[#6E5440]'
            }`}
          >
            <CalendarClock size={16} />
          </div>
          <h2 className="text-sm font-bold truncate">
            {language === 'pt-BR' ? 'Parcelamentos em Conta' : 'Account Installments'}
          </h2>
        </div>

        <span
          className={`px-2 py-0.5 rounded-full text-xs font-bold border shrink-0 ${
            isOled
              ? 'bg-[#161B22] border-[#21262D] text-[#D0B595]'
              : 'bg-[#F1F5F9] border-[#E2E8F0] text-[#6E5440]'
          }`}
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

      {/* Top Metric Row (compact 2-column micro-grid) */}
      <div
        className={`grid grid-cols-2 gap-2 p-3 rounded-xl border mb-3.5 ${
          isOled ? 'bg-[#161B22]/70 border-[#21262D]' : 'bg-[#F8FAFC] border-[#E2E8F0]'
        }`}
      >
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8] block truncate">
            {language === 'pt-BR' ? 'Comprometido no Mês' : 'Committed This Month'}
          </span>
          <p className="text-base sm:text-lg font-black text-[#EF4444] mt-0.5 tracking-tight truncate">
            -{formatCurrency(installmentSummary.monthlyCommitment, currency)}
          </p>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8] block truncate">
            {language === 'pt-BR' ? 'Total Restante' : 'Total Remaining'}
          </span>
          <p className="text-base sm:text-lg font-black text-[#F8FAFC] mt-0.5 tracking-tight truncate">
            {formatCurrency(installmentSummary.totalRemainingDebt, currency)}
          </p>
        </div>
      </div>

      {/* Individual Installment Rows */}
      {installmentPlans.length === 0 ? (
        <div
          className={`py-6 px-4 rounded-xl border text-center space-y-1 ${
            isOled ? 'bg-[#161B22]/40 border-[#21262D]' : 'bg-[#F8FAFC] border-[#E2E8F0]'
          }`}
        >
          <p className="text-xs font-semibold text-[#F8FAFC]">
            {language === 'pt-BR'
              ? 'Nenhum parcelamento ativo em conta'
              : 'No active bank installment plans'}
          </p>
          <p className="text-[11px] text-[#94A3B8] max-w-xs mx-auto">
            {language === 'pt-BR'
              ? 'Despesas parceladas no Pix, Boleto ou Conta Corrente aparecerão aqui.'
              : 'Expenses split into installments paid via Bank, Pix or Cash will be tracked here.'}
          </p>
        </div>
      ) : (
        <div
          className={`divide-y border-t ${
            isOled ? 'divide-[#21262D] border-[#21262D]' : 'divide-[#E2E8F0] border-[#E2E8F0]'
          }`}
        >
          {installmentPlans.map((plan) => (
            <div key={plan.key} className="py-3 first:pt-3.5 last:pb-1 flex flex-col gap-1.5">
              {/* Main info row */}
              <div className="flex items-start justify-between gap-2.5">
                {/* Left Stack */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <CategoryIcon
                      icon={plan.categoryIcon}
                      color={plan.categoryColor}
                      size={14}
                      badgeSize="sm"
                    />
                    <h3 className="font-medium text-sm text-[#F8FAFC] truncate">
                      {plan.description}
                    </h3>
                  </div>

                  {/* Subtitle metadata */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5 pl-0.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                        isOled
                          ? 'bg-[#161B22] border-[#21262D] text-[#D0B595]'
                          : 'bg-[#F1F5F9] border-[#E2E8F0] text-[#6E5440]'
                      }`}
                    >
                      {plan.currentInstallmentDisplay}/{plan.totalInstallments}
                    </span>

                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                        isOled
                          ? 'bg-[#161B22] border-[#21262D] text-slate-300'
                          : 'bg-[#F1F5F9] border-[#E2E8F0] text-slate-600'
                      }`}
                    >
                      {plan.paymentMethod}
                    </span>

                    {plan.categoryName && (
                      <span className="text-xs text-[#94A3B8] truncate max-w-[100px]">
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
                  <span className="text-xs text-[#94A3B8] mt-0.5 whitespace-nowrap">
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

              {/* Slim subtle progress bar */}
              <div
                className={`h-1 w-full rounded-full overflow-hidden mt-1.5 ${
                  isOled ? 'bg-[#161B22]' : 'bg-[#E2E8F0]'
                }`}
              >
                <div
                  className="h-full rounded-full transition-all duration-300 bg-[#10B981]"
                  style={{ width: `${Math.min(100, Math.max(4, plan.progressPct))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

/**
 * Brand-new Reports View focused on a single minimalist Category Distribution card
 * with a custom SVG Donut Chart built completely from scratch.
 */
export const ReportsView: React.FC<ReportsViewProps> = ({
  selectedMonth,
  currency,
  language,
  theme = 'oled',
  categories,
  creditCards = [],
  transactions,
}) => {
  const [selectedType, setSelectedType] = useState<TransactionType>('expense');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  const isOled = theme === 'oled';
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const cardMap = useMemo(() => new Map(creditCards.map((c) => [c.id, c])), [creditCards]);

  // Reset active category slice highlight when switching month or transaction type
  React.useEffect(() => {
    setActiveCategoryId(null);
  }, [selectedMonth, selectedType]);

  // Group all transactions in the selected month by category for the chosen type
  const { categorySlices, totalAmount, totalCount } = useMemo(() => {
    const groups = new Map<string, { amount: number; count: number }>();
    let sumTotal = 0;
    let countTotal = 0;

    for (const tx of transactions) {
      if (tx.type !== selectedType) continue;
      // Exclude consolidated credit-card bill settlement entries to avoid double-counting card purchases
      if (tx.settledInvoiceKey) continue;

      let effectiveMonth = tx.date.slice(0, 7);
      if (tx.cardId) {
        if (tx.invoiceMonth) {
          effectiveMonth = tx.invoiceMonth;
        } else {
          const card = cardMap.get(tx.cardId);
          if (card) {
            const firstMonth = computeCardFirstInvoiceMonth(
              tx.purchaseDate || tx.date,
              card.closingDay
            ).invoiceMonth;
            effectiveMonth =
              tx.installmentTotal &&
              tx.installmentTotal > 1 &&
              tx.installmentCurrent &&
              tx.installmentCurrent > 1
                ? shiftMonth(firstMonth, tx.installmentCurrent - 1)
                : firstMonth;
          }
        }
      }

      if (effectiveMonth !== selectedMonth) continue;

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
      categorySlices: slices,
      totalAmount: totalRounded,
      totalCount: countTotal,
    };
  }, [transactions, selectedType, selectedMonth, categoryMap, cardMap, language]);

  const activeSlice = useMemo(
    () => categorySlices.find((s) => s.id === activeCategoryId) || null,
    [categorySlices, activeCategoryId]
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

  const monthTitle = formatMonthLabel(selectedMonth, language);

  return (
    <div className="space-y-4 pb-6 animate-fadeIn max-w-lg mx-auto w-full">
      {/* 1. Installment Expenses Tracker Card (Parcelamentos em Conta) */}
      <InstallmentExpenseTracker
        transactions={transactions}
        categories={categories}
        currency={currency}
        language={language}
        selectedMonth={selectedMonth}
        theme={theme}
      />

      {/* 2. SINGLE MINIMALIST CARD: Distribuição por Categoria */}
      <section
        className={`rounded-2xl border p-5 transition-colors ${
          isOled
            ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
            : 'bg-white border-[#E2E8F0] text-[#0F172A] shadow-xs'
        }`}
      >
        {/* Card Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                selectedType === 'expense'
                  ? 'bg-[#EF4444]/10 border-[#EF4444]/25 text-[#EF4444]'
                  : 'bg-[#10B981]/10 border-[#10B981]/25 text-[#10B981]'
              }`}
            >
              <PieChartIcon size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold tracking-tight truncate">
                {language === 'pt-BR' ? 'Distribuição por Categoria' : 'Category Breakdown'}
              </h1>
              <p className="text-xs text-[#94A3B8] capitalize truncate">{monthTitle}</p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${
              isOled
                ? 'bg-[#161B22] border-[#21262D] text-[#94A3B8]'
                : 'bg-[#F1F5F9] border-[#E2E8F0] text-[#64748B]'
            }`}
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
            isOled ? 'bg-[#161B22] border-[#21262D]' : 'bg-[#F1F5F9] border-[#E2E8F0]'
          }`}
        >
          <button
            type="button"
            onClick={() => setSelectedType('expense')}
            className={`min-h-[44px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-extrabold transition-all ${
              selectedType === 'expense'
                ? 'bg-[#EF4444] text-white shadow-sm'
                : isOled
                ? 'text-[#94A3B8] hover:text-[#F8FAFC]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <ArrowDownRight size={16} strokeWidth={2.5} />
            <span>{language === 'pt-BR' ? 'Despesas' : 'Expenses'}</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedType('income')}
            className={`min-h-[44px] flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-extrabold transition-all ${
              selectedType === 'income'
                ? 'bg-[#10B981] text-white shadow-sm'
                : isOled
                ? 'text-[#94A3B8] hover:text-[#F8FAFC]'
                : 'text-[#64748B] hover:text-[#0F172A]'
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
                  stroke={isOled ? '#161B22' : '#F1F5F9'}
                  strokeWidth={strokeWidth}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
                <PieChartIcon size={24} className="text-[#94A3B8] opacity-50 mb-1" />
                <span className="text-xs font-bold text-[#94A3B8]">
                  {formatCurrency(0, currency)}
                </span>
              </div>
            </div>
            <p className="text-sm font-bold">
              {language === 'pt-BR'
                ? selectedType === 'expense'
                  ? 'Nenhuma despesa neste mês'
                  : 'Nenhuma entrada neste mês'
                : selectedType === 'expense'
                ? 'No expenses in this month'
                : 'No income in this month'}
            </p>
            <p className="text-xs text-[#94A3B8] mt-1 max-w-xs">
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
                    language === 'pt-BR' ? 'Gráfico de Distribuição por Categoria' : 'Category Breakdown Chart'
                  }
                >
                  {/* Base track ring */}
                  <circle
                    cx={center}
                    cy={center}
                    r={radius}
                    fill="none"
                    stroke={isOled ? '#161B22' : '#F1F5F9'}
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
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] truncate max-w-[130px]">
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
                  <span className="text-[11px] font-semibold text-[#94A3B8] mt-0.5">
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
            <div className="mt-5 pt-4 border-t border-[#21262D]/80 space-y-2">
              {categorySlices.map((item) => {
                const isSelected = activeCategoryId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      setActiveCategoryId((prev) => (prev === item.id ? null : item.id))
                    }
                    className={`w-full min-h-[48px] flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? isOled
                          ? 'bg-[#161B22] border-[#6E5440] ring-1 ring-[#D0B595]/30'
                          : 'bg-[#F1F5F9] border-[#6E5440]'
                        : isOled
                        ? 'bg-[#161B22]/60 border-[#21262D] hover:bg-[#161B22]'
                        : 'bg-[#F8FAFC] border-[#E2E8F0] hover:bg-[#F1F5F9]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs font-bold truncate">{item.name}</span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="text-xs font-extrabold">
                        {formatCurrency(item.amount, currency)}
                      </span>
                      <span
                        className={`min-w-[48px] text-right px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          isOled
                            ? 'bg-[#0D1117] text-[#94A3B8] border border-[#21262D]'
                            : 'bg-white text-[#64748B] border border-[#E2E8F0]'
                        }`}
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
    </div>
  );
};
