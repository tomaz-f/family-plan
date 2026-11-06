import React, { useState, useEffect, useMemo, useRef } from 'react';
import { TransactionStatus, TransactionType } from '../../types';
import { getTodayDateStr } from '../../utils/format';
import { TRANSLATIONS } from '../../utils/i18n';
import {
  SeriesScope,
  isPartOfSeries,
  getSubsequentPendingSeriesTransactions,
} from '../SeriesConfirmModal';
import {
  RecurrenceMode,
  TransactionModalProps,
  buildTransactionSavePayload,
  computeCardAvailableLimits,
  computeCardCycleInfo,
  computeConcludingMonthLabel,
  computeInstallmentBreakdown,
  getCurrencySymbol,
  sanitizeAmountInput,
} from './transactionModalMath';

export const useTransactionModalState = ({
  isOpen,
  initialType,
  initialCardId = null,
  editingTransaction,
  allTransactions = [],
  categories,
  creditCards = [],
  currency,
  language,
  theme,
  onClose,
  onSave,
  newlyCreatedCategoryId,
}: TransactionModalProps) => {
  const t = TRANSLATIONS[language];
  const isOled =
    theme === 'oled' ||
    (!theme &&
      typeof document !== 'undefined' &&
      document.documentElement.getAttribute('data-theme') === 'oled');

  const [type, setType] = useState<TransactionType>(initialType);
  const [status, setStatus] = useState<TransactionStatus>('paid');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayDateStr());
  const [notes, setNotes] = useState<string>('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const [recurrenceMode, setRecurrenceMode] = useState<RecurrenceMode>('single');
  const [dueDay, setDueDay] = useState<string>('10');
  const [dueDayManuallyEdited, setDueDayManuallyEdited] = useState<boolean>(false);
  const [installmentCurrent, setInstallmentCurrent] = useState<string>('1');
  const [installmentTotal, setInstallmentTotal] = useState<string>('12');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showSeriesEditConfirm, setShowSeriesEditConfirm] = useState<boolean>(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState<boolean>(false);
  const [isMoreOptionsOpen, setIsMoreOptionsOpen] = useState<boolean>(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState<boolean>(false);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const prevNewCatIdRef = useRef<string | null>(null);
  const prevIsOpenRef = useRef<boolean>(false);
  const prevEditingIdRef = useRef<string | null | undefined>(undefined);
  const backdropMouseDownTargetRef = useRef<EventTarget | null>(null);
  const categoryMouseDownTargetRef = useRef<EventTarget | null>(null);

  useEffect(() => {
    if (newlyCreatedCategoryId && newlyCreatedCategoryId !== prevNewCatIdRef.current) {
      prevNewCatIdRef.current = newlyCreatedCategoryId;
      const cat = categories.find((c) => c.id === newlyCreatedCategoryId);
      if (cat) {
        if (cat.type !== type && !editingTransaction) {
          setType(cat.type);
        }
        setCategoryId(cat.id);
        setCategoryPickerOpen(false);
      }
    }
  }, [newlyCreatedCategoryId, categories, type, editingTransaction]);

  const filteredCategories = categories.filter((c) => c.type === type);
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) || filteredCategories[0] || null,
    [categories, categoryId, filteredCategories]
  );
  const effectiveCardId = type === 'expense' ? selectedCardId : null;
  const selectedCard = useMemo(
    () => creditCards.find((c) => c.id === effectiveCardId) || null,
    [creditCards, effectiveCardId]
  );

  const cardAvailableLimits = useMemo(
    () => computeCardAvailableLimits(creditCards, allTransactions),
    [creditCards, allTransactions]
  );

  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      setShowSeriesEditConfirm(false);
      return;
    }

    const currentEditingId = editingTransaction?.id || null;
    const isOpening = !prevIsOpenRef.current;
    const isTargetChanged = prevEditingIdRef.current !== currentEditingId;

    if (!isOpening && !isTargetChanged) return;

    prevIsOpenRef.current = true;
    prevEditingIdRef.current = currentEditingId;
    setShowSeriesEditConfirm(false);

    if (editingTransaction) {
      setType(editingTransaction.type);
      setStatus(editingTransaction.status === 'unpaid' ? 'unpaid' : 'paid');
      if (editingTransaction.installmentTotal && editingTransaction.installmentTotal > 1) {
        const totalVal =
          editingTransaction.totalPurchaseAmount && editingTransaction.totalPurchaseAmount > 0
            ? editingTransaction.totalPurchaseAmount
            : Number((editingTransaction.amount * editingTransaction.installmentTotal).toFixed(2));
        setAmount(String(totalVal));
      } else {
        setAmount(String(editingTransaction.amount));
      }
      setDescription(editingTransaction.description);
      setCategoryId(editingTransaction.categoryId);
      setDate(editingTransaction.purchaseDate || editingTransaction.date);
      setNotes(editingTransaction.notes || '');
      setSelectedCardId(editingTransaction.cardId || null);
      const defaultDay = editingTransaction.dueDay || Number(editingTransaction.date.split('-')[2]) || 10;
      setDueDay(String(defaultDay));
      setDueDayManuallyEdited(Boolean(editingTransaction.dueDay));
      if (editingTransaction.installmentTotal && editingTransaction.installmentTotal > 1) {
        setRecurrenceMode('installment');
        setInstallmentCurrent(String(editingTransaction.installmentCurrent || 1));
        setInstallmentTotal(String(editingTransaction.installmentTotal));
        setIsMoreOptionsOpen(true);
      } else if (editingTransaction.recurringId) {
        setRecurrenceMode('recurring');
        setInstallmentCurrent('1');
        setInstallmentTotal('12');
        setIsMoreOptionsOpen(true);
      } else {
        setRecurrenceMode('single');
        setInstallmentCurrent('1');
        setInstallmentTotal('12');
        setIsMoreOptionsOpen(Boolean(editingTransaction.notes));
      }
      setIsAccountDropdownOpen(false);
    } else {
      const today = getTodayDateStr();
      setType(initialType);
      const initCard = initialType === 'expense' ? initialCardId || null : null;
      setSelectedCardId(initCard);
      setStatus(initCard ? 'unpaid' : 'paid');
      setAmount('');
      setDescription('');
      const firstCat = categories.find((c) => c.type === initialType);
      setCategoryId(firstCat ? firstCat.id : '');
      setDate(today);
      setNotes('');
      setRecurrenceMode('single');
      setIsMoreOptionsOpen(false);
      setIsAccountDropdownOpen(false);
      const cardObj = initCard ? creditCards.find((c) => c.id === initCard) : null;
      setDueDay(String(cardObj ? cardObj.dueDay : Number(today.split('-')[2]) || 10));
      setDueDayManuallyEdited(false);
      setInstallmentCurrent('1');
      setInstallmentTotal('12');
    }
  }, [isOpen, initialType, initialCardId, editingTransaction?.id, categories, creditCards]);

  useEffect(() => {
    if (!categoryId || !filteredCategories.some((c) => c.id === categoryId)) {
      setCategoryId(filteredCategories[0]?.id || '');
    }
  }, [type]);

  const handleSelectCard = (cardId: string | null) => {
    setSelectedCardId(cardId);
    if (cardId) {
      const cardObj = creditCards.find((c) => c.id === cardId);
      if (cardObj) setDueDay(String(cardObj.dueDay));
      if (!editingTransaction) setStatus('unpaid');
    } else if (!editingTransaction) {
      setStatus('paid');
      const dayPart = Number((date || getTodayDateStr()).split('-')[2]);
      if (dayPart >= 1 && dayPart <= 31) setDueDay(String(dayPart));
    }
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    if (!selectedCard && !dueDayManuallyEdited && newDate) {
      const dayPart = Number(newDate.split('-')[2]);
      if (dayPart >= 1 && dayPart <= 31) setDueDay(String(dayPart));
    }
  };

  const parsedDueDay = selectedCard
    ? selectedCard.dueDay
    : Math.min(31, Math.max(1, Number(dueDay) || 1));
  const parsedInstCur = Math.max(1, Number(installmentCurrent) || 1);
  const parsedInstTot = Math.max(parsedInstCur, Number(installmentTotal) || 2);

  const installmentBreakdown = useMemo(
    () => computeInstallmentBreakdown(amount, recurrenceMode, parsedInstTot),
    [amount, recurrenceMode, parsedInstTot]
  );

  const cardCycleInfo = useMemo(
    () => computeCardCycleInfo(selectedCard, date, language),
    [selectedCard, date, language]
  );

  const concludingMonthLabel = useMemo(
    () => computeConcludingMonthLabel(cardCycleInfo, date, parsedInstCur, parsedInstTot, language),
    [cardCycleInfo, date, parsedInstCur, parsedInstTot, language]
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
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) return;

    setSubmitting(true);
    try {
      const { data, recurringPlan } = buildTransactionSavePayload({
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
      });

      await onSave(data, recurringPlan, scope);
      setShowSeriesEditConfirm(false);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleAmountChange = (raw: string) => setAmount(sanitizeAmountInput(raw));

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

  const currencySymbol = getCurrencySymbol(currency);

  return {
    t, isOled, type, setType, status, setStatus, amount, description, setDescription,
    categoryId, setCategoryId, date, notes, setNotes, selectedCardId, setSelectedCardId,
    recurrenceMode, setRecurrenceMode, dueDay, setDueDay, setDueDayManuallyEdited,
    installmentCurrent, setInstallmentCurrent, installmentTotal, setInstallmentTotal,
    submitting, showSeriesEditConfirm, setShowSeriesEditConfirm, categoryPickerOpen,
    setCategoryPickerOpen, isMoreOptionsOpen, setIsMoreOptionsOpen, isAccountDropdownOpen,
    setIsAccountDropdownOpen, amountInputRef, backdropMouseDownTargetRef,
    categoryMouseDownTargetRef, filteredCategories, selectedCategory, selectedCard,
    cardAvailableLimits, handleSelectCard, handleDateChange, parsedDueDay, parsedInstCur,
    parsedInstTot, installmentBreakdown, cardCycleInfo, concludingMonthLabel,
    subsequentSeriesCount, executeSave, handleAmountChange, handleSubmit, currencySymbol,
  };
};
