import { useMemo } from 'react';
import {
  AppLanguage,
  Category,
  CreditCard,
  Transaction,
  TransactionType,
} from '../../types';
import { computeInvoiceDueDate } from '../../utils/format';
import { getCategoryDisplayName } from '../../utils/i18n';
import {
  CategorySliceItem,
  FALLBACK_SLICE_COLORS,
  INVOICE_SLICE_ID,
} from './reportsTypes';
import {
  computeDonutArcs,
  filterActiveCategoryTransactions,
  getTxInvoiceMonth,
  isInvoiceTransaction,
} from './reportsCalculations';

export function useReportsData(params: {
  transactions: Transaction[];
  categories: Category[];
  creditCards: CreditCard[];
  selectedMonth: string;
  selectedType: TransactionType;
  selectedCardFilter: string;
  activeCategoryId: string | null;
  activeCardCategoryId: string | null;
  language: AppLanguage;
}) {
  const {
    transactions,
    categories,
    creditCards,
    selectedMonth,
    selectedType,
    selectedCardFilter,
    activeCategoryId,
    activeCardCategoryId,
    language,
  } = params;

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // 1. PRIMARY CHART: Consolidated Cash Outflow Distribution
  const { categorySlices, totalAmount, totalCount } = useMemo(() => {
    const groups = new Map<string, { amount: number; count: number }>();
    let sumTotal = 0;
    let countTotal = 0;
    const handledInvoiceKeys = new Set<string>();

    for (const tx of transactions) {
      if (tx.type !== selectedType) continue;
      if (tx.cardId) continue;
      if (!tx.date.startsWith(selectedMonth)) continue;

      const amt = Number(tx.amount || 0);
      if (amt <= 0) continue;

      const isInvoice = isInvoiceTransaction(tx);

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
              .filter(
                (tx) =>
                  getTxInvoiceMonth(tx, card) === invMonth && (tx.status || 'paid') === 'unpaid'
              )
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
            color: '#6366F1',
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

  const activeCategoryTransactions = useMemo(
    () =>
      filterActiveCategoryTransactions(
        transactions,
        activeCategoryId,
        selectedType,
        selectedMonth
      ),
    [transactions, activeCategoryId, selectedType, selectedMonth]
  );

  const activeCardSlice = useMemo(
    () => cardCategorySlices.find((s) => s.id === activeCardCategoryId) || null,
    [cardCategorySlices, activeCardCategoryId]
  );

  const computedArcs = useMemo(
    () => computeDonutArcs(categorySlices, totalAmount),
    [categorySlices, totalAmount]
  );

  const computedCardArcs = useMemo(
    () => computeDonutArcs(cardCategorySlices, cardTotalAmount),
    [cardCategorySlices, cardTotalAmount]
  );

  return {
    categorySlices,
    totalAmount,
    totalCount,
    cardCategorySlices,
    cardTotalAmount,
    cardTotalCount,
    activeSlice,
    activeCategoryTransactions,
    activeCardSlice,
    computedArcs,
    computedCardArcs,
  };
}
