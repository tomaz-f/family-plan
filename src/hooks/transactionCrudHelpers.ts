import {
  CreditCard,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../types';
import {
  computeCardFirstInvoiceMonth,
  getTodayDateStr,
  shiftMonth,
} from '../utils/format';
import {
  SeriesScope,
  getSubsequentPendingSeriesTransactions,
} from '../components/SeriesConfirmModal';
import { splitInstallmentAmounts } from './useAppStorageState';

export interface TransactionSaveInput {
  id?: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  totalPurchaseAmount?: number | null;
  description: string;
  categoryId: string;
  date: string;
  notes: string;
  dueDay?: number | null;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  recurringId?: string | null;
  cardId?: string | null;
  invoiceMonth?: string | null;
  purchaseDate?: string | null;
}

export interface RecurringPlanInput {
  mode: 'recurring' | 'installment';
  dayOfMonth: number;
  totalInstallments?: number;
  currentInstallment?: number;
  startMonth?: string;
}

export function buildTransactionSaveEntries(
  txData: TransactionSaveInput,
  recurringPlan: RecurringPlanInput | undefined,
  scope: SeriesScope,
  existingTransactions: Transaction[]
): {
  fullTx: Transaction;
  generatedRecId: string | null;
  futureEntries: Transaction[];
  updatedSeriesEntries: Transaction[];
} {
  const txId = txData.id || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const generatedRecId =
    !txData.id && recurringPlan
      ? `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      : txData.recurringId || null;

  const isInstallmentSeries = Boolean(txData.installmentTotal && txData.installmentTotal > 1);
  const seriesTotalPurchaseAmount = isInstallmentSeries
    ? txData.totalPurchaseAmount && txData.totalPurchaseAmount > 0
      ? txData.totalPurchaseAmount
      : Number((txData.amount * (txData.installmentTotal || 1)).toFixed(2))
    : null;

  const installmentSplit =
    isInstallmentSeries && seriesTotalPurchaseAmount
      ? splitInstallmentAmounts(seriesTotalPurchaseAmount, txData.installmentTotal || 1)
      : null;

  const initialInstallmentAmount = installmentSplit
    ? (txData.installmentCurrent || 1) === 1
      ? installmentSplit.firstAmount
      : installmentSplit.regularAmount
    : txData.amount;

  const fullTx: Transaction = {
    id: txId,
    type: txData.type,
    status: txData.status,
    amount: initialInstallmentAmount,
    totalPurchaseAmount: seriesTotalPurchaseAmount,
    description: txData.description,
    categoryId: txData.categoryId,
    date: txData.date,
    notes: txData.notes,
    dueDay: txData.dueDay || null,
    installmentCurrent: txData.installmentCurrent || null,
    installmentTotal: txData.installmentTotal || null,
    recurringId: generatedRecId,
    cardId: txData.cardId || null,
    invoiceMonth: txData.invoiceMonth || null,
    purchaseDate: txData.purchaseDate || txData.date,
    createdAt: new Date().toISOString(),
  };

  // Build future 'unpaid' entries automatically for new installment or recurring entries
  const futureEntries: Transaction[] = [];
  if (!txData.id && recurringPlan && generatedRecId) {
    const baseMonth = txData.date.slice(0, 7);
    const dayOfMonth = Math.min(31, Math.max(1, recurringPlan.dayOfMonth || 10));

    const formatMonthDay = (monthStr: string, day: number) => {
      const [y, m] = monthStr.split('-').map(Number);
      const maxDay = new Date(y, m, 0).getDate() || 28;
      const clamped = Math.min(day, maxDay);
      return `${monthStr}-${String(clamped).padStart(2, '0')}`;
    };

    if (recurringPlan.mode === 'installment' && recurringPlan.totalInstallments) {
      const startCur = recurringPlan.currentInstallment || 1;
      const total = recurringPlan.totalInstallments;
      const baseInvMonth = txData.invoiceMonth || baseMonth;
      const split =
        installmentSplit ||
        splitInstallmentAmounts(
          seriesTotalPurchaseAmount || txData.amount * total,
          total
        );
      for (let step = 1; startCur + step <= total; step++) {
        const instNum = startCur + step;
        const fInvoiceMonth = shiftMonth(baseInvMonth, step);
        futureEntries.push({
          id: `tx-${Date.now()}-${step}-${Math.random().toString(36).slice(2, 7)}`,
          type: txData.type,
          status: 'unpaid',
          amount: instNum === 1 ? split.firstAmount : split.regularAmount,
          totalPurchaseAmount: seriesTotalPurchaseAmount,
          description: txData.description,
          categoryId: txData.categoryId,
          date: formatMonthDay(fInvoiceMonth, dayOfMonth),
          notes: txData.notes,
          dueDay: dayOfMonth,
          installmentCurrent: instNum,
          installmentTotal: total,
          recurringId: generatedRecId,
          cardId: txData.cardId || null,
          invoiceMonth: txData.cardId ? fInvoiceMonth : null,
          purchaseDate: txData.purchaseDate || txData.date,
          createdAt: new Date().toISOString(),
        });
      }
    } else if (recurringPlan.mode === 'recurring') {
      for (let step = 1; step <= 11; step++) {
        const fMonth = shiftMonth(baseMonth, step);
        futureEntries.push({
          id: `tx-${Date.now()}-${step}-${Math.random().toString(36).slice(2, 7)}`,
          type: txData.type,
          status: 'unpaid',
          amount: txData.amount,
          description: txData.description,
          categoryId: txData.categoryId,
          date: formatMonthDay(fMonth, dayOfMonth),
          notes: txData.notes,
          dueDay: dayOfMonth,
          installmentCurrent: null,
          installmentTotal: null,
          recurringId: generatedRecId,
          cardId: txData.cardId || null,
          invoiceMonth: txData.cardId ? shiftMonth(txData.invoiceMonth || baseMonth, step) : null,
          purchaseDate: txData.purchaseDate || txData.date,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }

  // Compute updated series entries on the client when editing a series (scope === 'future')
  const updatedSeriesEntries: Transaction[] = [];
  if (txData.id && scope === 'future') {
    const originalTx = existingTransactions.find((tx) => tx.id === txData.id);
    if (originalTx) {
      const relatedTxs = getSubsequentPendingSeriesTransactions(originalTx, existingTransactions);
      for (const relTx of relatedTxs) {
        let nextRowDate = relTx.date;
        if (fullTx.dueDay && relTx.date && relTx.date.length >= 7) {
          const monthPrefix = relTx.date.slice(0, 7);
          const [ry, rm] = monthPrefix.split('-').map(Number);
          const maxDay = new Date(ry, rm, 0).getDate() || 28;
          const clampedDay = Math.min(fullTx.dueDay, maxDay);
          nextRowDate = `${monthPrefix}-${String(clampedDay).padStart(2, '0')}`;
        }
        const relInstCur = relTx.installmentCurrent || 1;
        const relAmount = installmentSplit
          ? relInstCur === 1
            ? installmentSplit.firstAmount
            : installmentSplit.regularAmount
          : fullTx.amount;
        updatedSeriesEntries.push({
          ...relTx,
          type: fullTx.type,
          amount: relAmount,
          totalPurchaseAmount: seriesTotalPurchaseAmount,
          description: fullTx.description,
          categoryId: fullTx.categoryId,
          date: nextRowDate,
          notes: fullTx.notes,
          dueDay: fullTx.dueDay ?? relTx.dueDay,
          installmentTotal: fullTx.installmentTotal ?? relTx.installmentTotal,
          cardId: fullTx.cardId !== undefined ? fullTx.cardId : relTx.cardId,
          purchaseDate: fullTx.purchaseDate || relTx.purchaseDate,
        });
      }
    }
  }

  return {
    fullTx,
    generatedRecId,
    futureEntries,
    updatedSeriesEntries,
  };
}

export function buildToggledTransactionUpdate(
  tx: Transaction,
  transactions: Transaction[],
  creditCards: CreditCard[]
): {
  nextStatus: TransactionStatus;
  updatedTx: Transaction;
  nextTransactions: Transaction[];
  cycleTxsToSync: Transaction[];
} {
  const nextStatus: TransactionStatus = tx.status === 'unpaid' ? 'paid' : 'unpaid';
  const updatedTx: Transaction = {
    ...tx,
    status: nextStatus,
    ...(tx.settledInvoiceKey && nextStatus === 'paid'
      ? {
          date: getTodayDateStr(),
          description: tx.description.startsWith('Pagamento de Fatura')
            ? tx.description
            : tx.description.replace(/^Fatura\s+/, 'Pagamento de Fatura - '),
        }
      : {}),
  };

  let nextTransactions = transactions.map((item) => (item.id === tx.id ? updatedTx : item));
  const cycleTxsToSync: Transaction[] = [];

  if (tx.settledInvoiceKey) {
    const [cardId, invoiceMonth] = tx.settledInvoiceKey.split('__');
    const card = (creditCards || []).find((c) => c.id === cardId);
    if (card) {
      nextTransactions = nextTransactions.map((item) => {
        if (item.cardId === cardId) {
          const firstMonth = computeCardFirstInvoiceMonth(
            item.purchaseDate || item.date,
            card.closingDay
          ).invoiceMonth;
          const m =
            item.invoiceMonth ||
            (item.installmentTotal &&
            item.installmentTotal > 1 &&
            item.installmentCurrent &&
            item.installmentCurrent > 1
              ? shiftMonth(firstMonth, item.installmentCurrent - 1)
              : firstMonth);
          if (m === invoiceMonth) {
            cycleTxsToSync.push({ ...item, status: nextStatus });
            return { ...item, status: nextStatus };
          }
        }
        return item;
      });
    }
  }

  return {
    nextStatus,
    updatedTx,
    nextTransactions,
    cycleTxsToSync,
  };
}
