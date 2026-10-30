import React, { useState, useMemo } from 'react';
import {
  PieChart as PieChartIcon,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
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

/**
 * Preserved Installment Expense Tracker hook & component for upcoming reuse/repositioning.
 */
export function useInstallmentPlans(
  transactions: Transaction[],
  categories: Category[],
  language: AppLanguage
) {
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

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
      const txMonth = (tx.invoiceMonth || tx.date).slice(0, 7);
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

  return { installmentPlans, installmentSummary };
}

export const InstallmentExpenseTracker: React.FC<{
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  language: AppLanguage;
}> = ({ transactions, categories, currency, language }) => {
  const t = TRANSLATIONS[language];
  const { installmentPlans, installmentSummary } = useInstallmentPlans(
    transactions,
    categories,
    language
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers size={18} className="text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-900">{t.installmentTrackerTitle}</h3>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold">
          {t.activePlansBadge(installmentSummary.activeCount)}
        </span>
      </div>
      {installmentPlans.length === 0 ? (
        <p className="text-xs text-slate-500">{t.noActiveInstallments}</p>
      ) : (
        <div className="space-y-2.5">
          {installmentPlans.map((plan) => (
            <div
              key={plan.key}
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryIcon icon={plan.categoryIcon} color={plan.categoryColor} size={15} badgeSize="sm" />
                  <span className="text-xs font-bold text-slate-900 truncate">{plan.description}</span>
                </div>
                <span className="text-xs font-extrabold text-rose-500 shrink-0">
                  {formatCurrency(plan.monthlyAmount, currency)}/mês
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  {plan.remainingInstallments === 0 ? (
                    <CheckCircle2 size={12} className="text-emerald-500" />
                  ) : (
                    <Clock size={12} className="text-amber-500" />
                  )}
                  {t.installmentProgressLabel(plan.paidInstallments, plan.totalInstallments)}
                </span>
                <span>
                  {t.remainingDebtLabel}: <strong>{formatCurrency(plan.remainingDebtAmount, currency)}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
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
    <div className="space-y-4 pb-6 animate-fadeIn">
      {/* SINGLE MINIMALIST CARD: Distribuição por Categoria */}
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
