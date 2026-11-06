import {
  AppLanguage,
  AppTheme,
  Category,
  CreditCard,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../types';
import {
  computeCardFirstInvoiceMonth,
  formatMonthLabel,
  getTodayDateStr,
  shiftMonth,
} from '../../utils/format';
import { getCategoryDisplayName } from '../../utils/i18n';
import { SeriesScope } from '../SeriesConfirmModal';

export type RecurrenceMode = 'single' | 'recurring' | 'installment';

export interface TransactionModalProps {
  isOpen: boolean;
  initialType: TransactionType;
  initialCardId?: string | null;
  editingTransaction?: Transaction | null;
  allTransactions?: Transaction[];
  categories: Category[];
  creditCards?: CreditCard[];
  currency: string;
  language: AppLanguage;
  theme?: AppTheme;
  onClose: () => void;
  onDelete?: (tx: Transaction) => void;
  onManageCategories?: () => void;
  newlyCreatedCategoryId?: string | null;
  onSave: (
    data: {
      id?: string;
      type: TransactionType;
      status: TransactionStatus;
      amount: number;
      description: string;
      categoryId: string;
      date: string;
      notes: string;
      dueDay?: number | null;
      installmentCurrent?: number | null;
      installmentTotal?: number | null;
      totalPurchaseAmount?: number | null;
      recurringId?: string | null;
      cardId?: string | null;
      invoiceMonth?: string | null;
      purchaseDate?: string | null;
    },
    recurringPlan?: {
      mode: 'recurring' | 'installment';
      dayOfMonth: number;
      totalInstallments?: number;
      currentInstallment?: number;
      startMonth?: string;
    },
    scope?: SeriesScope
  ) => Promise<void>;
}

export interface InstallmentBreakdown {
  totalAmount: number;
  count: number;
  firstInstallmentAmount: number;
  regularInstallmentAmount: number;
  remainderCents: number;
}

export interface CardCycleInfo {
  invoiceMonth: string;
  rolledToNext: boolean;
  formattedMonth: string;
}

export const getYesterdayDateStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const computeCardAvailableLimits = (
  creditCards: CreditCard[],
  allTransactions: Transaction[]
): Record<string, number> => {
  const limits: Record<string, number> = {};
  creditCards.forEach((card) => {
    const unpaidCardTxs = allTransactions.filter(
      (tx) => tx.cardId === card.id && tx.status !== 'paid'
    );
    const usedLimit = Math.max(
      0,
      Number(
        unpaidCardTxs
          .reduce((sum, tx) => {
            const amt = Number(tx.amount || 0);
            return sum + (tx.type === 'income' ? -amt : amt);
          }, 0)
          .toFixed(2)
      )
    );
    limits[card.id] = Math.max(0, Number((card.totalLimit - usedLimit).toFixed(2)));
  });
  return limits;
};

export const computeInstallmentBreakdown = (
  amount: string,
  recurrenceMode: RecurrenceMode,
  parsedInstTot: number
): InstallmentBreakdown => {
  const rawNum = parseFloat(amount.replace(',', '.'));
  const totalAmount = !Number.isNaN(rawNum) && rawNum > 0 ? rawNum : 0;
  const count = recurrenceMode === 'installment' ? Math.max(1, parsedInstTot) : 1;
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;
  const firstInstallmentAmount = Number(((baseCents + remainderCents) / 100).toFixed(2));
  const regularInstallmentAmount = Number((baseCents / 100).toFixed(2));
  return {
    totalAmount,
    count,
    firstInstallmentAmount,
    regularInstallmentAmount,
    remainderCents,
  };
};

export const computeCardCycleInfo = (
  selectedCard: CreditCard | null,
  date: string,
  language: AppLanguage
): CardCycleInfo | null => {
  if (!selectedCard) return null;
  const baseDate = date || getTodayDateStr();
  const cycle = computeCardFirstInvoiceMonth(baseDate, selectedCard.closingDay);
  return {
    ...cycle,
    formattedMonth: formatMonthLabel(cycle.invoiceMonth, language),
  };
};

export const computeConcludingMonthLabel = (
  cardCycleInfo: CardCycleInfo | null,
  date: string,
  parsedInstCur: number,
  parsedInstTot: number,
  language: AppLanguage
): string => {
  const baseMonth = cardCycleInfo
    ? cardCycleInfo.invoiceMonth
    : (date || getTodayDateStr()).slice(0, 7);
  const remainingAfterThis = Math.max(0, parsedInstTot - parsedInstCur);
  const endMonthStr = shiftMonth(baseMonth, remainingAfterThis);
  return formatMonthLabel(endMonthStr, language);
};

export const sanitizeAmountInput = (raw: string): string => {
  let cleaned = raw.replace(/[^\d.,]/g, '');
  const commaCount = (cleaned.match(/,/g) || []).length;
  const dotCount = (cleaned.match(/\./g) || []).length;
  if (commaCount + dotCount > 1) {
    const firstSepIdx = cleaned.search(/[,.]/);
    cleaned =
      cleaned.slice(0, firstSepIdx + 1) +
      cleaned.slice(firstSepIdx + 1).replace(/[,.]/g, '');
  }
  return cleaned;
};

export const getCurrencySymbol = (currency: string): string =>
  ({
    BRL: 'R$',
    USD: '$',
    EUR: '€',
    GBP: '£',
    CAD: 'CA$',
    AUD: 'A$',
    MXN: 'MX$',
    JPY: '¥',
  } as Record<string, string>)[currency] || currency;

export const buildTransactionSavePayload = (params: {
  parsedAmount: number;
  recurrenceMode: RecurrenceMode;
  parsedInstCur: number;
  parsedInstTot: number;
  installmentBreakdown: InstallmentBreakdown;
  categories: Category[];
  categoryId: string;
  description: string;
  language: AppLanguage;
  type: TransactionType;
  date: string;
  selectedCard: CreditCard | null;
  cardCycleInfo: CardCycleInfo | null;
  editingTransaction?: Transaction | null;
  status: TransactionStatus;
  notes: string;
  dueDayManuallyEdited: boolean;
  parsedDueDay: number;
}) => {
  const {
    parsedAmount,
    recurrenceMode,
    parsedInstCur,
    parsedInstTot,
    installmentBreakdown,
    categories,
    categoryId,
    description,
    language,
    type,
    date,
    selectedCard,
    cardCycleInfo,
    editingTransaction,
    status,
    notes,
    dueDayManuallyEdited,
    parsedDueDay,
  } = params;

  const isInstallmentMode = recurrenceMode === 'installment' && parsedInstTot > 1;
  const perInstallmentAmount = isInstallmentMode
    ? parsedInstCur === 1
      ? installmentBreakdown.firstInstallmentAmount
      : installmentBreakdown.regularInstallmentAmount
    : parsedAmount;
  const totalPurchaseAmount = isInstallmentMode ? parsedAmount : null;

  const selectedCat = categories.find((c) => c.id === categoryId);
  const finalDescription =
    description.trim() ||
    getCategoryDisplayName(selectedCat, language) ||
    (type === 'income' ? 'Entrada' : 'Despesa');

  const txPurchaseDate = date || getTodayDateStr();
  const txMonth = txPurchaseDate.slice(0, 7);
  const startMonth = shiftMonth(txMonth, -(parsedInstCur - 1));

  let calculatedInvoiceMonth: string | null = null;
  if (selectedCard) {
    const firstCycleMonth = cardCycleInfo
      ? cardCycleInfo.invoiceMonth
      : computeCardFirstInvoiceMonth(txPurchaseDate, selectedCard.closingDay).invoiceMonth;
    calculatedInvoiceMonth =
      isInstallmentMode && editingTransaction && parsedInstCur > 1
        ? shiftMonth(firstCycleMonth, parsedInstCur - 1)
        : firstCycleMonth;
  }

  const data = {
    id: editingTransaction?.id,
    type,
    status: selectedCard ? ('unpaid' as const) : status,
    amount: perInstallmentAmount,
    totalPurchaseAmount,
    description: finalDescription,
    categoryId,
    date: editingTransaction && isInstallmentMode ? editingTransaction.date : date,
    notes: notes.trim(),
    dueDay: selectedCard
      ? selectedCard.dueDay
      : recurrenceMode !== 'single' || dueDayManuallyEdited
      ? parsedDueDay
      : null,
    installmentCurrent: recurrenceMode === 'installment' ? parsedInstCur : null,
    installmentTotal: recurrenceMode === 'installment' ? parsedInstTot : null,
    recurringId: editingTransaction?.recurringId || null,
    cardId: selectedCard ? selectedCard.id : null,
    invoiceMonth: calculatedInvoiceMonth,
    purchaseDate: txPurchaseDate,
  };

  const recurringPlan =
    !editingTransaction && recurrenceMode !== 'single'
      ? {
          mode: recurrenceMode,
          dayOfMonth: selectedCard ? selectedCard.dueDay : parsedDueDay,
          totalInstallments: recurrenceMode === 'installment' ? parsedInstTot : undefined,
          currentInstallment: recurrenceMode === 'installment' ? parsedInstCur : undefined,
          startMonth:
            recurrenceMode === 'installment' && selectedCard && calculatedInvoiceMonth
              ? shiftMonth(calculatedInvoiceMonth, -(parsedInstCur - 1))
              : startMonth,
        }
      : undefined;

  return { data, recurringPlan };
};
