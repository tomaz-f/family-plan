import React, { useState, useMemo } from 'react';
import {
  PieChart as PieChartIcon,
  CreditCard as CreditCardIcon,
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
      className={`rounded-2xl border p-4 transition-colors ${
        isOled
          ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
          : 'bg-white border-slate-200 text-slate-900 shadow-xs'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
              isOled
                ? 'bg-[#161B22] border-[#21262D] text-[#D0B595]'
                : 'bg-slate-100 border-slate-200 text-[#6E5440]'
            }`}
          >
            <CalendarClock size={16} />
          </div>
          <h2 className={`text-sm font-bold truncate ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
            {language === 'pt-BR' ? 'Parcelamentos em Conta' : 'Account Installments'}
          </h2>
        </div>

        <span
          className={`px-2 py-0.5 rounded-full text-xs font-bold border shrink-0 ${
            isOled
              ? 'bg-[#161B22] border-[#21262D] text-[#D0B595]'
              : 'bg-slate-100 border-slate-200 text-slate-700'
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
          isOled ? 'bg-[#161B22]/70 border-[#21262D]' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div>
          <span className={`text-[10px] uppercase font-bold tracking-wider block truncate ${
            isOled ? 'text-[#94A3B8]' : 'text-slate-500'
          }`}>
            {language === 'pt-BR' ? 'Comprometido no Mês' : 'Committed This Month'}
          </span>
          <p className="text-base sm:text-lg font-black text-[#EF4444] mt-0.5 tracking-tight truncate">
            -{formatCurrency(installmentSummary.monthlyCommitment, currency)}
          </p>
        </div>

        <div>
          <span className={`text-[10px] uppercase font-bold tracking-wider block truncate ${
            isOled ? 'text-[#94A3B8]' : 'text-slate-500'
          }`}>
            {language === 'pt-BR' ? 'Total Restante' : 'Total Remaining'}
          </span>
          <p className={`text-base sm:text-lg font-black mt-0.5 tracking-tight truncate ${
            isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
          }`}>
            {formatCurrency(installmentSummary.totalRemainingDebt, currency)}
          </p>
        </div>
      </div>

      {/* Individual Installment Rows */}
      {installmentPlans.length === 0 ? (
        <div
          className={`py-6 px-4 rounded-xl border text-center space-y-1 ${
            isOled ? 'bg-[#161B22]/40 border-[#21262D]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <p className={`text-xs font-semibold ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
            {language === 'pt-BR'
              ? 'Nenhum parcelamento ativo em conta'
              : 'No active bank installment plans'}
          </p>
          <p className={`text-[11px] max-w-xs mx-auto ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
            {language === 'pt-BR'
              ? 'Despesas parceladas no Pix, Boleto ou Conta Corrente aparecerão aqui.'
              : 'Expenses split into installments paid via Bank, Pix or Cash will be tracked here.'}
          </p>
        </div>
      ) : (
        <div
          className={`divide-y border-t ${
            isOled ? 'divide-[#21262D] border-[#21262D]' : 'divide-slate-200 border-slate-200'
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
                    <h3 className={`font-semibold text-sm truncate ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
                      {plan.description}
                    </h3>
                  </div>

                  {/* Subtitle metadata */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5 pl-0.5">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
                        isOled
                          ? 'bg-[#161B22] border-[#21262D] text-[#D0B595]'
                          : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {plan.currentInstallmentDisplay}/{plan.totalInstallments}
                    </span>

                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                        isOled
                          ? 'bg-[#161B22] border-[#21262D] text-slate-300'
                          : 'bg-slate-100 border-slate-200 text-slate-600'
                      }`}
                    >
                      {plan.paymentMethod}
                    </span>

                    {plan.categoryName && (
                      <span className={`text-xs truncate max-w-[100px] ${
                        isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                      }`}>
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
                  <span className={`text-xs mt-0.5 whitespace-nowrap ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}>
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
                className={`h-1.5 w-full rounded-full overflow-hidden mt-1.5 ${
                  isOled ? 'bg-[#161B22]' : 'bg-slate-200'
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

/**
 * Reports View with two distinct Donut Charts:
 * 1. Consolidated Cash Outflow Chart ("Distribuição por Categoria - Fluxo de Caixa"):
 *    - Checking account & cash transactions by native category
 *    - All credit card invoices due in the selected month unified under "Fatura de Cartão"
 *    - Center total matches Home screen total obligations
 * 2. Dedicated Credit Card Breakdown Chart ("Categorias no Cartão"):
 *    - Original category breakdown of all purchases belonging to invoices due in selected month
 *    - Card selector filter ("Todos os Cartões" + individual cards)
 *    - Center total "TOTAL FATURAS"
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

  return (
    <div className="space-y-4 pb-6 animate-fadeIn max-w-lg mx-auto w-full">
      {/* 1. PRIMARY CARD: Distribuição por Categoria - Fluxo de Caixa */}
      <section
        className={`rounded-2xl border p-5 transition-colors ${
          isOled
            ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
            : 'bg-white border-slate-200 text-slate-900 shadow-xs'
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
              <h1 className={`text-base font-extrabold tracking-tight truncate ${
                isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
              }`}>
                {language === 'pt-BR'
                  ? 'Distribuição por Categoria - Fluxo de Caixa'
                  : 'Category Breakdown - Cash Flow'}
              </h1>
              <p className={`text-xs capitalize truncate ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-500'
              }`}>{monthTitle}</p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${
              isOled
                ? 'bg-[#161B22] border-[#21262D] text-[#94A3B8]'
                : 'bg-slate-100 border-slate-200 text-slate-600'
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
            isOled ? 'bg-[#161B22] border-[#21262D]' : 'bg-slate-100 border-slate-200'
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
                : 'text-slate-600 hover:text-slate-900'
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
                <span className={`text-xs font-bold ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
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
            <p className={`text-xs mt-1 max-w-xs ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
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
                  <span className={`text-[11px] font-bold uppercase tracking-wider truncate max-w-[130px] ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}>
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
                  <span className={`text-[11px] font-semibold mt-0.5 ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}>
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
            <div className={`mt-5 pt-4 border-t space-y-2 ${
              isOled ? 'border-[#21262D]/80' : 'border-slate-200'
            }`}>
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
                          : 'bg-slate-100 border-[#6E5440]'
                        : isOled
                        ? 'bg-[#161B22]/60 border-[#21262D] hover:bg-[#161B22]'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CategoryIcon icon={item.icon} color={item.color} badgeSize="sm" size={15} />
                      <span className={`text-xs font-bold truncate ${
                        isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                      }`}>{item.name}</span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={`text-xs font-extrabold ${
                        isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                      }`}>
                        {formatCurrency(item.amount, currency)}
                      </span>
                      <span
                        className={`min-w-[48px] text-right px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          isOled
                            ? 'bg-[#0D1117] text-[#94A3B8] border border-[#21262D]'
                            : 'bg-white text-slate-600 border border-slate-200'
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

      {/* 2. DEDICATED CREDIT CARD BREAKDOWN CARD: Categorias no Cartão */}
      <section
        className={`rounded-2xl border p-5 transition-colors ${
          isOled
            ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
            : 'bg-white border-slate-200 text-slate-900 shadow-xs'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                isOled
                  ? 'bg-[#6366F1]/10 border-[#6366F1]/25 text-[#818CF8]'
                  : 'bg-indigo-50 border-indigo-200 text-[#6366F1]'
              }`}
            >
              <CreditCardIcon size={18} />
            </div>
            <div className="min-w-0">
              <h2
                className={`text-base font-extrabold tracking-tight truncate ${
                  isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                }`}
              >
                {language === 'pt-BR' ? 'Categorias no Cartão' : 'Credit Card Breakdown'}
              </h2>
              <p
                className={`text-xs truncate ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                }`}
              >
                {language === 'pt-BR'
                  ? 'Compras das faturas com vencimento no mês'
                  : 'Purchases from invoices due in this month'}
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0 ${
              isOled
                ? 'bg-[#161B22] border-[#21262D] text-[#94A3B8]'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
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
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-5 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedCardFilter('all')}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border ${
                selectedCardFilter === 'all'
                  ? 'bg-[#6E5440] border-[#7E624B] text-white shadow-xs'
                  : isOled
                  ? 'bg-[#161B22] border-[#21262D] text-[#94A3B8] hover:text-[#F8FAFC]'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
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
                      ? 'bg-[#6E5440] border-[#7E624B] text-white shadow-xs'
                      : isOled
                      ? 'bg-[#161B22] border-[#21262D] text-[#94A3B8] hover:text-[#F8FAFC]'
                      : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
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
                <span className={`text-xs font-bold ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                  {formatCurrency(0, currency)}
                </span>
              </div>
            </div>
            <p className={`text-sm font-bold ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
              {language === 'pt-BR'
                ? 'Nenhuma compra no cartão com vencimento neste mês'
                : 'No credit card purchases due in this month'}
            </p>
            <p className={`text-xs mt-1 max-w-xs ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
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
              className={`mt-5 pt-4 border-t space-y-2 ${
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
                    className={`w-full min-h-[48px] flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? isOled
                          ? 'bg-[#161B22] border-[#6E5440] ring-1 ring-[#D0B595]/30'
                          : 'bg-slate-100 border-[#6E5440]'
                        : isOled
                        ? 'bg-[#161B22]/60 border-[#21262D] hover:bg-[#161B22]'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CategoryIcon icon={item.icon} color={item.color} badgeSize="sm" size={15} />
                      <span
                        className={`text-xs font-bold truncate ${
                          isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                        }`}
                      >
                        {item.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span
                        className={`text-xs font-extrabold ${
                          isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                        }`}
                      >
                        {formatCurrency(item.amount, currency)}
                      </span>
                      <span
                        className={`min-w-[48px] text-right px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          isOled
                            ? 'bg-[#0D1117] text-[#94A3B8] border border-[#21262D]'
                            : 'bg-white text-slate-600 border border-slate-200'
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

      {/* 2. Installment Expenses Tracker Card (Parcelamentos em Conta) */}
      <InstallmentExpenseTracker
        transactions={transactions}
        categories={categories}
        currency={currency}
        language={language}
        selectedMonth={selectedMonth}
        theme={theme}
      />
    </div>
  );
};
