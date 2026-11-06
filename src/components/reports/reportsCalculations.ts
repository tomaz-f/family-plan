import {
  CreditCard,
  Transaction,
  TransactionType,
} from '../../types';
import {
  computeCardFirstInvoiceMonth,
  shiftMonth,
} from '../../utils/format';
import {
  CategorySliceItem,
  ComputedDonutArc,
  DONUT_ANIM_TOTAL,
  DONUT_CIRCUMFERENCE,
  INVOICE_SLICE_ID,
} from './reportsTypes';

export const formatNumericDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

/**
 * Helper to determine billing cycle invoice month for a card transaction
 */
export function getTxInvoiceMonth(tx: Transaction, card: CreditCard): string {
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

export function isInvoiceTransaction(tx: Transaction): boolean {
  return (
    Boolean(tx.settledInvoiceKey) ||
    tx.categoryId === 'cat-fatura' ||
    Boolean(
      tx.description &&
        (tx.description.toLowerCase().startsWith('fatura ') ||
          tx.description.toLowerCase().startsWith('fatura:') ||
          tx.description.toLowerCase() === 'fatura' ||
          tx.description.toLowerCase().startsWith('pagamento de fatura'))
    )
  );
}

export function computeDonutArcs(
  slices: CategorySliceItem[],
  totalAmount: number
): ComputedDonutArc[] {
  if (slices.length === 0 || totalAmount <= 0) return [];
  const gapPx = slices.length > 1 ? 3.5 : 0;
  let accumulatedFraction = 0;

  return slices.map((slice) => {
    const fraction = slice.amount / totalAmount;
    const rawLength = fraction * DONUT_CIRCUMFERENCE;
    const visibleLength = Math.max(2, rawLength - gapPx);
    const dashOffset = DONUT_CIRCUMFERENCE * (1 - accumulatedFraction);
    const startOffset = dashOffset + visibleLength;
    const animDelay = Math.round(accumulatedFraction * DONUT_ANIM_TOTAL);
    const animDuration = Math.max(120, Math.round(fraction * DONUT_ANIM_TOTAL));
    accumulatedFraction += fraction;

    return {
      ...slice,
      strokeDasharray: `${visibleLength} ${Math.max(0, DONUT_CIRCUMFERENCE - visibleLength)}`,
      strokeDashoffset: dashOffset,
      dashOffset,
      startOffset,
      animDelay,
      animDuration,
    };
  });
}

export function filterActiveCategoryTransactions(
  transactions: Transaction[],
  activeCategoryId: string | null,
  selectedType: TransactionType,
  selectedMonth: string
): Transaction[] {
  if (!activeCategoryId) return [];

  const isInvoiceCategory = activeCategoryId === INVOICE_SLICE_ID;

  return transactions
    .filter((tx) => {
      if (tx.type !== selectedType) return false;
      if (tx.cardId) return false;
      if (!tx.date.startsWith(selectedMonth)) return false;

      const amt = Number(tx.amount || 0);
      if (amt <= 0) return false;

      const isInvoice = isInvoiceTransaction(tx);

      if (isInvoiceCategory) {
        return isInvoice && selectedType === 'expense';
      }

      if (isInvoice && selectedType === 'expense') return false;

      if (activeCategoryId === 'uncategorized') {
        return !tx.categoryId;
      }

      return tx.categoryId === activeCategoryId;
    })
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || '')
    );
}
