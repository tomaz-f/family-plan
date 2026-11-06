import {
  AppLanguage,
  AppTheme,
  Category,
  CreditCard,
  CreditCardBrand,
  Transaction,
} from '../../types';
import {
  computeCardFirstInvoiceMonth,
  shiftMonth,
} from '../../utils/format';

export interface CreditCardsViewProps {
  selectedMonth?: string;
  creditCards: CreditCard[];
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  language: AppLanguage;
  theme: AppTheme;
  onSaveCard: (
    card: Partial<CreditCard> & {
      name: string;
      totalLimit: number;
      closingDay: number;
      dueDay: number;
    }
  ) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onPayInvoice: (cardId: string, invoiceMonth: string) => Promise<void>;
  onOpenAddExpense: (cardId?: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
  onActiveCardChange?: (cardId: string | null) => void;
  onModalOpenChange?: (open: boolean) => void;
}

export interface CardMetric {
  card: CreditCard;
  usedLimit: number;
  availableLimit: number;
  usedPercentage: number;
  usedPercentFloat: number;
  currentInvoiceTotal: number;
  selectedCycleTotal: number;
  nextInvoiceTotal: number;
  settlementTx?: Transaction;
  isCurrentInvoiceSettled: boolean;
  isCurrentInvoicePending: boolean;
  isCycleSettled: boolean;
}

export interface ConsolidatedLimits {
  totalLimit: number;
  totalUsed: number;
  totalAvailable: number;
  combinedPercentage: number;
}

export interface StatementData {
  txs: Transaction[];
  total: number;
  isSettled: boolean;
  isPendingPayment: boolean;
}

export interface InvoiceCycleStatus {
  label: string;
  color: 'emerald' | 'amber' | 'sky';
}

export const BRAND_OPTIONS: { id: CreditCardBrand; name: string }[] = [
  { id: 'mastercard', name: 'Mastercard' },
  { id: 'visa', name: 'Visa' },
  { id: 'elo', name: 'Elo' },
  { id: 'amex', name: 'American Express' },
  { id: 'default', name: 'Outro / Genérico' },
];

export const PRESET_COLORS = [
  '#820ad1', // Nubank purple
  '#ff7a00', // Inter orange
  '#003399', // Itaú / Bradesco blue
  '#059669', // Emerald
  '#dc2626', // Santander red
  '#0284c7', // Sky blue
  '#4f46e5', // Indigo
  '#6E5440', // Prumo iron
  '#d97706', // Amber gold
  '#ec4899', // Pink
];

export const formatShortNumericDate = (dateStr?: string | null): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[0].slice(-2);
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

export const getTxInvoiceMonth = (tx: Transaction, card: CreditCard): string => {
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
};

export const computeCardsMetrics = (
  creditCards: CreditCard[],
  transactions: Transaction[],
  currentMonthStr: string,
  statementMonth: string
): CardMetric[] => {
  return creditCards.map((card) => {
    const cardTxs = transactions.filter((tx) => tx.cardId === card.id);
    const unpaidCardTxs = cardTxs.filter((tx) => tx.status !== 'paid');
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

    const availableLimit = Math.max(0, Number((card.totalLimit - usedLimit).toFixed(2)));
    const usedPercentage =
      card.totalLimit > 0 ? Math.min(100, Math.round((usedLimit / card.totalLimit) * 100)) : 0;
    const usedPercentFloat =
      card.totalLimit > 0 ? Math.min(100, (usedLimit / card.totalLimit) * 100) : 0;

    const currentInvoiceTotal = Math.max(
      0,
      Number(
        cardTxs
          .filter((tx) => getTxInvoiceMonth(tx, card) === currentMonthStr)
          .reduce((sum, tx) => {
            const amt = Number(tx.amount || 0);
            return sum + (tx.type === 'income' ? -amt : amt);
          }, 0)
          .toFixed(2)
      )
    );

    const nextMonthStr = shiftMonth(currentMonthStr, 1);
    const nextInvoiceTotal = Math.max(
      0,
      Number(
        cardTxs
          .filter((tx) => getTxInvoiceMonth(tx, card) === nextMonthStr)
          .reduce((sum, tx) => {
            const amt = Number(tx.amount || 0);
            return sum + (tx.type === 'income' ? -amt : amt);
          }, 0)
          .toFixed(2)
      )
    );

    const cycleSettledKey = `${card.id}__${statementMonth}`;
    const cycleSettlementTx = transactions.find((tx) => tx.settledInvoiceKey === cycleSettledKey);
    const isCycleSettled = Boolean(cycleSettlementTx && cycleSettlementTx.status === 'paid');

    const selectedCycleTotal = isCycleSettled
      ? Math.max(
          0,
          Number(
            cardTxs
              .filter(
                (tx) => getTxInvoiceMonth(tx, card) === statementMonth && tx.status !== 'paid'
              )
              .reduce((sum, tx) => {
                const amt = Number(tx.amount || 0);
                return sum + (tx.type === 'income' ? -amt : amt);
              }, 0)
              .toFixed(2)
          )
        )
      : Math.max(
          0,
          Number(
            cardTxs
              .filter((tx) => getTxInvoiceMonth(tx, card) === statementMonth)
              .reduce((sum, tx) => {
                const amt = Number(tx.amount || 0);
                return sum + (tx.type === 'income' ? -amt : amt);
              }, 0)
              .toFixed(2)
          )
        );

    const currentSettledKey = `${card.id}__${currentMonthStr}`;
    const settlementTx = transactions.find((tx) => tx.settledInvoiceKey === currentSettledKey);
    const isCurrentInvoiceSettled = Boolean(settlementTx && settlementTx.status === 'paid');
    const isCurrentInvoicePending = Boolean(settlementTx && settlementTx.status === 'unpaid');

    return {
      card,
      usedLimit,
      availableLimit,
      usedPercentage,
      usedPercentFloat,
      currentInvoiceTotal,
      selectedCycleTotal,
      nextInvoiceTotal,
      settlementTx,
      isCurrentInvoiceSettled,
      isCurrentInvoicePending,
      isCycleSettled,
    };
  });
};

export const computeConsolidatedLimits = (cardsMetrics: CardMetric[]): ConsolidatedLimits => {
  let totalLimit = 0;
  let totalUsed = 0;
  let totalAvailable = 0;

  cardsMetrics.forEach((m) => {
    totalLimit += m.card.totalLimit;
    totalUsed += m.usedLimit;
    totalAvailable += m.availableLimit;
  });

  totalLimit = Number(totalLimit.toFixed(2));
  totalUsed = Number(totalUsed.toFixed(2));
  totalAvailable = Number(totalAvailable.toFixed(2));
  const combinedPercentage =
    totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0;

  return { totalLimit, totalUsed, totalAvailable, combinedPercentage };
};

export const computeStatementData = (
  activeCard: CreditCard | null,
  transactions: Transaction[],
  statementMonth: string
): StatementData => {
  if (!activeCard) {
    return { txs: [], total: 0, isSettled: false, isPendingPayment: false };
  }

  const txs = transactions
    .filter(
      (tx) => tx.cardId === activeCard.id && getTxInvoiceMonth(tx, activeCard) === statementMonth
    )
    .sort((a, b) => (b.purchaseDate || b.date).localeCompare(a.purchaseDate || a.date));

  const total = Number(txs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0).toFixed(2));

  const settlementKey = `${activeCard.id}__${statementMonth}`;
  const settlementTx = transactions.find((tx) => tx.settledInvoiceKey === settlementKey) || null;
  const isSettled = Boolean(settlementTx && settlementTx.status === 'paid');
  const isPendingPayment = Boolean(settlementTx && settlementTx.status === 'unpaid');

  return { txs, total, isSettled, isPendingPayment };
};

export const computeInvoiceCycleStatus = (
  activeCard: CreditCard | null,
  isSettled: boolean,
  statementMonth: string
): InvoiceCycleStatus => {
  if (!activeCard) return { label: 'Aberta', color: 'sky' };
  if (isSettled) return { label: 'Fatura Paga', color: 'emerald' };

  const today = new Date();
  const todayYm = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const todayDay = today.getDate();

  if (statementMonth < todayYm) {
    return { label: 'Fatura Fechada', color: 'amber' };
  } else if (statementMonth > todayYm) {
    return { label: 'Fatura Futura', color: 'sky' };
  } else {
    if (todayDay >= activeCard.closingDay) {
      return { label: 'Fatura Fechada', color: 'amber' };
    }
    return { label: 'Fatura Aberta', color: 'sky' };
  }
};
