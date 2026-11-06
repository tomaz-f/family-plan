import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  computeCardFirstInvoiceMonth,
  formatMonthLabel,
  getTodayDateStr,
} from '../../utils/format';
import { getCategoryDisplayName } from '../../utils/i18n';
import {
  SeriesScope,
  getSubsequentPendingSeriesTransactions,
  isPartOfSeries,
} from '../SeriesConfirmModal';
import {
  CreditCardExpenseModalProps,
  computeInstallmentBreakdown,
} from './cardExpenseHelpers';

export type { CreditCardExpenseModalProps };

export function useCardExpenseForm({
  isOpen,
  initialCardId = null,
  editingTransaction = null,
  allTransactions = [],
  categories,
  creditCards = [],
  language,
  onClose,
  onSave,
  onDelete,
  newlyCreatedCategoryId,
}: CreditCardExpenseModalProps) {
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayDateStr());
  const [notes, setNotes] = useState<string>('');
  const [selectedCardId, setSelectedCardId] = useState<string>('');

  const [isInstallment, setIsInstallment] = useState<boolean>(false);
  const [installmentCount, setInstallmentCount] = useState<number>(3);
  const [installmentCurrent, setInstallmentCurrent] = useState<number>(1);

  const [categoryPickerOpen, setCategoryPickerOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showSeriesEditConfirm, setShowSeriesEditConfirm] = useState<boolean>(false);
  const [showSeriesDeleteConfirm, setShowSeriesDeleteConfirm] = useState<boolean>(false);

  const prevNewCatIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (newlyCreatedCategoryId && newlyCreatedCategoryId !== prevNewCatIdRef.current) {
      prevNewCatIdRef.current = newlyCreatedCategoryId;
      const cat = categories.find((c) => c.id === newlyCreatedCategoryId);
      if (cat) {
        setCategoryId(cat.id);
        setCategoryPickerOpen(false);
      }
    }
  }, [newlyCreatedCategoryId, categories]);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  );

  const prevIsOpenRef = useRef<boolean>(false);
  const prevEditingIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      setCategoryPickerOpen(false);
      setShowSeriesEditConfirm(false);
      setShowSeriesDeleteConfirm(false);
      return;
    }

    const currentEditingId = editingTransaction?.id || null;
    const isOpening = !prevIsOpenRef.current;
    const isTargetChanged = prevEditingIdRef.current !== currentEditingId;

    if (!isOpening && !isTargetChanged) {
      return;
    }

    prevIsOpenRef.current = true;
    prevEditingIdRef.current = currentEditingId;

    if (editingTransaction) {
      const rawAmt =
        editingTransaction.totalPurchaseAmount && editingTransaction.totalPurchaseAmount > 0
          ? editingTransaction.totalPurchaseAmount
          : editingTransaction.installmentTotal && editingTransaction.installmentTotal > 1
          ? Number(((editingTransaction.amount || 0) * editingTransaction.installmentTotal).toFixed(2))
          : editingTransaction.amount || 0;

      setAmount(String(rawAmt).replace('.', ','));
      setDescription(editingTransaction.description || '');
      setCategoryId(editingTransaction.categoryId || expenseCategories[0]?.id || '');
      setDate(editingTransaction.purchaseDate || editingTransaction.date || getTodayDateStr());
      setNotes(editingTransaction.notes || '');

      const activeCard =
        creditCards.find((c) => c.id === editingTransaction.cardId) ||
        creditCards.find((c) => c.id === initialCardId) ||
        creditCards[0];
      setSelectedCardId(activeCard ? activeCard.id : '');

      if (editingTransaction.installmentTotal && editingTransaction.installmentTotal > 1) {
        setIsInstallment(true);
        setInstallmentCount(editingTransaction.installmentTotal);
        setInstallmentCurrent(editingTransaction.installmentCurrent || 1);
      } else {
        setIsInstallment(false);
        setInstallmentCount(3);
        setInstallmentCurrent(1);
      }
    } else {
      setAmount('');
      setDescription('');
      setCategoryId(expenseCategories[0]?.id || '');
      setDate(getTodayDateStr());
      setNotes('');
      setIsInstallment(false);
      setInstallmentCount(3);
      setInstallmentCurrent(1);

      const defaultCard =
        creditCards.find((c) => c.id === initialCardId) || creditCards[0];
      setSelectedCardId(defaultCard ? defaultCard.id : '');
    }
  }, [isOpen, editingTransaction, initialCardId, creditCards, expenseCategories]);

  const selectedCard = useMemo(
    () => creditCards.find((c) => c.id === selectedCardId) || creditCards[0] || null,
    [creditCards, selectedCardId]
  );

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) || expenseCategories[0] || null,
    [categories, categoryId, expenseCategories]
  );

  const cardCycleInfo = useMemo(() => {
    if (!selectedCard) return null;
    const baseDate = date || getTodayDateStr();
    const cycle = computeCardFirstInvoiceMonth(baseDate, selectedCard.closingDay);
    return {
      ...cycle,
      formattedMonth: formatMonthLabel(cycle.invoiceMonth, language),
    };
  }, [selectedCard, date, language]);

  const installmentBreakdown = useMemo(
    () =>
      computeInstallmentBreakdown(
        amount,
        isInstallment,
        installmentCount,
        cardCycleInfo?.invoiceMonth,
        date,
        language
      ),
    [amount, isInstallment, installmentCount, cardCycleInfo, date, language]
  );

  const isEditingSeries = Boolean(
    editingTransaction && isPartOfSeries(editingTransaction, allTransactions)
  );

  const subsequentSeriesCount =
    editingTransaction && isEditingSeries
      ? getSubsequentPendingSeriesTransactions(editingTransaction, allTransactions).length
      : 0;

  const executeSave = async (scope: SeriesScope = 'single') => {
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0 || !selectedCard) return;

    const finalDescription =
      description.trim() ||
      getCategoryDisplayName(selectedCategory, language) ||
      'Compra no Cartão';

    const txPurchaseDate = date || getTodayDateStr();
    const calculatedInvoiceMonth = cardCycleInfo
      ? cardCycleInfo.invoiceMonth
      : computeCardFirstInvoiceMonth(txPurchaseDate, selectedCard.closingDay).invoiceMonth;

    const perInstallmentAmount = isInstallment
      ? installmentCurrent === 1
        ? installmentBreakdown.firstInstallmentAmount
        : installmentBreakdown.regularInstallmentAmount
      : parsedAmount;

    setSubmitting(true);
    try {
      await onSave(
        {
          id: editingTransaction?.id,
          type: 'expense',
          status: 'unpaid',
          amount: perInstallmentAmount,
          totalPurchaseAmount: isInstallment ? parsedAmount : null,
          description: finalDescription,
          categoryId: selectedCategory?.id || 'exp-bills',
          date: editingTransaction && isInstallment ? editingTransaction.date : txPurchaseDate,
          notes: notes.trim(),
          dueDay: selectedCard.dueDay,
          installmentCurrent: isInstallment ? installmentCurrent : null,
          installmentTotal: isInstallment ? installmentCount : null,
          recurringId: editingTransaction?.recurringId || null,
          cardId: selectedCard.id,
          invoiceMonth: calculatedInvoiceMonth,
          purchaseDate: txPurchaseDate,
        },
        !editingTransaction && isInstallment
          ? {
              mode: 'installment',
              dayOfMonth: selectedCard.dueDay,
              totalInstallments: installmentCount,
              currentInstallment: installmentCurrent,
              startMonth: calculatedInvoiceMonth,
            }
          : undefined,
        scope
      );

      setShowSeriesEditConfirm(false);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) return;

    if (isEditingSeries) {
      setShowSeriesEditConfirm(true);
      return;
    }
    await executeSave('single');
  };

  const handleDelete = () => {
    if (!editingTransaction || !onDelete) return;
    if (isEditingSeries) {
      setShowSeriesDeleteConfirm(true);
      return;
    }
    onDelete(editingTransaction, 'single');
    onClose();
  };

  return {
    amount,
    setAmount,
    description,
    setDescription,
    setCategoryId,
    date,
    setDate,
    notes,
    setNotes,
    setSelectedCardId,
    isInstallment,
    setIsInstallment,
    installmentCount,
    setInstallmentCount,
    categoryPickerOpen,
    setCategoryPickerOpen,
    submitting,
    showSeriesEditConfirm,
    setShowSeriesEditConfirm,
    showSeriesDeleteConfirm,
    setShowSeriesDeleteConfirm,
    expenseCategories,
    selectedCard,
    selectedCategory,
    cardCycleInfo,
    installmentBreakdown,
    subsequentSeriesCount,
    executeSave,
    handleSubmit,
    handleDelete,
  };
}
