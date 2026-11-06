import {
  AppLanguage,
  AppTheme,
  Category,
  CreditCard,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../../types';
import { formatMonthLabel, getTodayDateStr, shiftMonth } from '../../utils/format';
import { SeriesScope } from '../SeriesConfirmModal';

export interface CreditCardExpenseModalProps {
  isOpen: boolean;
  initialCardId?: string | null;
  editingTransaction?: Transaction | null;
  allTransactions?: Transaction[];
  categories: Category[];
  creditCards: CreditCard[];
  currency: string;
  language: AppLanguage;
  theme: AppTheme;
  onClose: () => void;
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
  onDelete?: (tx: Transaction, scope?: SeriesScope) => void;
}

export function computeInstallmentBreakdown(
  amount: string,
  isInstallment: boolean,
  installmentCount: number,
  invoiceMonth: string | undefined,
  date: string,
  language: AppLanguage
) {
  const rawNum = parseFloat(amount.replace(',', '.'));
  const totalAmount = !Number.isNaN(rawNum) && rawNum > 0 ? rawNum : 0;
  const count = isInstallment ? Math.max(2, installmentCount) : 1;
  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents - baseCents * count;
  const firstInstallmentAmount = Number(((baseCents + remainderCents) / 100).toFixed(2));
  const regularInstallmentAmount = Number((baseCents / 100).toFixed(2));

  const baseMonth = invoiceMonth || (date || getTodayDateStr()).slice(0, 7);
  const endMonthStr = shiftMonth(baseMonth, count - 1);
  const formattedEndMonth = formatMonthLabel(endMonthStr, language);

  return {
    totalAmount,
    count,
    firstInstallmentAmount,
    regularInstallmentAmount,
    formattedEndMonth,
  };
}
