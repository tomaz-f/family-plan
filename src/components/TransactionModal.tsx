import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  FileText,
  Repeat,
  Layers,
  Check,
  ThumbsUp,
  ThumbsDown,
  CreditCard as CreditCardIcon,
  Landmark,
  Sparkles,
  ChevronDown,
  Tag,
  Trash2,
} from 'lucide-react';
import {
  AppLanguage,
  AppTheme,
  Category,
  CreditCard,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../types';
import { CategoryIcon } from './CategoryIcon';
import { BankIcon, AppIcon, resolveBankInfo } from './icons';
import {
  computeCardFirstInvoiceMonth,
  formatCurrency,
  formatMonthLabel,
  getTodayDateStr,
  shiftMonth,
} from '../utils/format';
import { getCategoryDisplayName, TRANSLATIONS } from '../utils/i18n';
import {
  SeriesConfirmModal,
  SeriesScope,
  isPartOfSeries,
  getSubsequentPendingSeriesTransactions,
} from './SeriesConfirmModal';

export type RecurrenceMode = 'single' | 'recurring' | 'installment';

interface TransactionModalProps {
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

export const TransactionModal: React.FC<TransactionModalProps> = ({
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
  onDelete,
  onSave,
  onManageCategories,
  newlyCreatedCategoryId,
}) => {
  const t = TRANSLATIONS[language];
  const isOled =
    theme === 'oled' ||
    (!theme &&
      typeof document !== 'undefined' &&
      document.documentElement.getAttribute('data-theme') === 'oled');

  const getYesterdayDateStr = (): string => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [type, setType] = useState<TransactionType>(initialType);
  const [status, setStatus] = useState<TransactionStatus>('paid');
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayDateStr());
  const [notes, setNotes] = useState<string>('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  // Recurrence / Installment state
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

  // Compute real-time available limits for all credit cards
  const cardAvailableLimits = useMemo(() => {
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
  }, [creditCards, allTransactions]);

  // Track modal visibility transitions to prevent background polling from resetting user input
  const prevIsOpenRef = useRef<boolean>(false);
  const prevEditingIdRef = useRef<string | null | undefined>(undefined);
  const backdropMouseDownTargetRef = useRef<EventTarget | null>(null);
  const categoryMouseDownTargetRef = useRef<EventTarget | null>(null);

  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      setShowSeriesEditConfirm(false);
      return;
    }

    const currentEditingId = editingTransaction?.id || null;
    const isOpening = !prevIsOpenRef.current;
    const isTargetChanged = prevEditingIdRef.current !== currentEditingId;

    if (!isOpening && !isTargetChanged) {
      // Modal is already open and target hasn't changed; strictly preserve active user input
      return;
    }

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
    // Only initialize form state when the modal opens or target transaction changes
  }, [isOpen, initialType, initialCardId, editingTransaction?.id, categories, creditCards]);

  useEffect(() => {
    // Only adjust categoryId if it is completely empty or does not belong to the current type
    if (!categoryId || !filteredCategories.some((c) => c.id === categoryId)) {
      setCategoryId(filteredCategories[0]?.id || '');
    }
  }, [type]);

  const handleSelectCard = (cardId: string | null) => {
    setSelectedCardId(cardId);
    if (cardId) {
      const cardObj = creditCards.find((c) => c.id === cardId);
      if (cardObj) {
        setDueDay(String(cardObj.dueDay));
      }
      if (!editingTransaction) {
        setStatus('unpaid');
      }
    } else if (!editingTransaction) {
      setStatus('paid');
      const dayPart = Number((date || getTodayDateStr()).split('-')[2]);
      if (dayPart >= 1 && dayPart <= 31) {
        setDueDay(String(dayPart));
      }
    }
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    if (!selectedCard && !dueDayManuallyEdited && newDate) {
      const dayPart = Number(newDate.split('-')[2]);
      if (dayPart >= 1 && dayPart <= 31) {
        setDueDay(String(dayPart));
      }
    }
  };

  const parsedDueDay = selectedCard
    ? selectedCard.dueDay
    : Math.min(31, Math.max(1, Number(dueDay) || 1));
  const parsedInstCur = Math.max(1, Number(installmentCurrent) || 1);
  const parsedInstTot = Math.max(parsedInstCur, Number(installmentTotal) || 2);

  const installmentBreakdown = useMemo(() => {
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
  }, [amount, recurrenceMode, parsedInstTot]);

  const cardCycleInfo = useMemo(() => {
    if (!selectedCard) return null;
    const baseDate = date || getTodayDateStr();
    const cycle = computeCardFirstInvoiceMonth(baseDate, selectedCard.closingDay);
    return {
      ...cycle,
      formattedMonth: formatMonthLabel(cycle.invoiceMonth, language),
    };
  }, [selectedCard, date, language]);

  const concludingMonthLabel = useMemo(() => {
    const baseMonth = cardCycleInfo
      ? cardCycleInfo.invoiceMonth
      : (date || getTodayDateStr()).slice(0, 7);
    const remainingAfterThis = Math.max(0, parsedInstTot - parsedInstCur);
    const endMonthStr = shiftMonth(baseMonth, remainingAfterThis);
    return formatMonthLabel(endMonthStr, language);
  }, [cardCycleInfo, date, parsedInstCur, parsedInstTot, language]);

  if (!isOpen) return null;

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

    const isInstallmentMode = recurrenceMode === 'installment' && parsedInstTot > 1;
    const perInstallmentAmount = isInstallmentMode
      ? parsedInstCur === 1
        ? installmentBreakdown.firstInstallmentAmount
        : installmentBreakdown.regularInstallmentAmount
      : parsedAmount;
    const totalPurchaseAmount = isInstallmentMode ? parsedAmount : null;

    setSubmitting(true);
    try {
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

      await onSave(
        {
          id: editingTransaction?.id,
          type,
          status: selectedCard ? 'unpaid' : status,
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
        },
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
          : undefined,
        scope
      );
      setShowSeriesEditConfirm(false);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleAmountChange = (raw: string) => {
    let cleaned = raw.replace(/[^\d.,]/g, '');
    const commaCount = (cleaned.match(/,/g) || []).length;
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (commaCount + dotCount > 1) {
      const firstSepIdx = cleaned.search(/[,.]/);
      cleaned =
        cleaned.slice(0, firstSepIdx + 1) +
        cleaned.slice(firstSepIdx + 1).replace(/[,.]/g, '');
    }
    setAmount(cleaned);
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

  const currencySymbol =
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

  // Preserve unused icon imports for compatibility
  void { Calendar, FileText, ThumbsDown };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm bg-black/60 animate-fadeIn"
        onMouseDown={(e) => {
          backdropMouseDownTargetRef.current = e.target;
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && backdropMouseDownTargetRef.current === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className={`w-full max-w-md max-h-[88dvh] sm:max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl transition-all ${
            isOled
              ? 'bg-[#0D1117] border border-[#21262D] text-slate-100 shadow-black/90'
              : 'bg-white border border-slate-200 text-slate-900 shadow-xl'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Compact Header */}
          <div className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${
            isOled ? 'border-[#21262D]' : 'border-slate-100'
          }`}>
            <h2 className={`text-sm sm:text-base font-bold tracking-tight ${
              isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
            }`}>
              {editingTransaction
                ? type === 'income'
                  ? language === 'pt-BR'
                    ? 'Editar Entrada'
                    : 'Edit Income'
                  : language === 'pt-BR'
                  ? 'Editar Despesa'
                  : 'Edit Expense'
                : language === 'pt-BR'
                ? 'Novo Lançamento'
                : 'New Transaction'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-full transition-colors ${
                isOled
                  ? 'text-slate-400 hover:text-white hover:bg-[#161B22]'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              aria-label={t.cancelBtn}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar">
              {/* Type Switcher */}
              <div className={`grid grid-cols-2 gap-1 p-1 rounded-2xl border ${
                isOled ? 'bg-[#161B22] border-[#21262D]' : 'bg-slate-100 border-slate-200/80'
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    setType('expense');
                    if (!selectedCardId && initialCardId) {
                      setSelectedCardId(initialCardId);
                    }
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    type === 'expense'
                      ? 'bg-[#EF4444] text-white shadow-xs'
                      : isOled
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <ArrowDownRight size={14} strokeWidth={2.5} />
                  <span>{language === 'pt-BR' ? 'Despesa' : 'Expense'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType('income');
                    setSelectedCardId(null);
                    setIsAccountDropdownOpen(false);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    type === 'income'
                      ? 'bg-[#10B981] text-white shadow-xs'
                      : isOled
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <ArrowUpRight size={14} strokeWidth={2.5} />
                  <span>{language === 'pt-BR' ? 'Entrada' : 'Income'}</span>
                </button>
              </div>

              {/* Unified Contiguous Monetary Value Input */}
              <div
                className="relative flex flex-col items-center justify-center my-3 sm:my-4 cursor-text"
                onClick={() => amountInputRef.current?.focus()}
              >
                {/* Contiguous Visual Display */}
                <div className="flex items-baseline justify-center select-none pointer-events-none">
                  <span
                    className={`text-2xl sm:text-3xl font-bold opacity-60 mr-1.5 ${
                      isOled ? 'text-[#D0B595]' : 'text-[#6E5440]'
                    }`}
                  >
                    {currencySymbol}
                  </span>
                  <span
                    className={`text-4xl sm:text-5xl font-black tracking-tight ${
                      isOled ? 'text-slate-50' : 'text-slate-900'
                    }`}
                  >
                    {amount ? amount.replace('.', ',') : '0,00'}
                  </span>
                </div>

                {/* Invisible Overlay Input Capturing Focus & Mobile Numpad */}
                <input
                  ref={amountInputRef}
                  type="text"
                  inputMode="decimal"
                  autoFocus={!editingTransaction}
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-text w-full h-full text-center z-10"
                  aria-label={language === 'pt-BR' ? 'Valor' : 'Amount'}
                />

                {/* Dynamic Installments Subtitle */}
                {recurrenceMode === 'installment' && parsedInstTot > 1 && (
                  <div
                    className={`mt-2 px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 ${
                      isOled
                        ? 'bg-[#161B22] text-slate-300 border border-[#21262D]'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    <Layers size={12} className="text-[#D0B595] shrink-0" />
                    <span>
                      {language === 'pt-BR'
                        ? `Total ${formatCurrency(installmentBreakdown.totalAmount, currency)} em ${installmentBreakdown.count}x de ${formatCurrency(installmentBreakdown.regularInstallmentAmount, currency)}`
                        : `Total ${formatCurrency(installmentBreakdown.totalAmount, currency)} in ${installmentBreakdown.count}x of ${formatCurrency(installmentBreakdown.regularInstallmentAmount, currency)}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Unified Essential Fields Card */}
              <div className={`rounded-2xl border overflow-hidden ${
                isOled ? 'bg-[#161B22]/70 border-[#21262D]' : 'bg-slate-50 border-slate-200'
              }`}>
                {/* 1. Descrição */}
                <div className={`px-3.5 py-3 border-b ${
                  isOled ? 'border-[#21262D]/60' : 'border-slate-200/60'
                }`}>
                  <input
                    type="text"
                    required
                    placeholder={
                      language === 'pt-BR'
                        ? 'Descrição do lançamento'
                        : 'Transaction description'
                    }
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`w-full bg-transparent text-xs sm:text-sm font-medium focus:outline-none placeholder:text-slate-500 ${
                      isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                    }`}
                  />
                </div>

                {/* 2. Categoria */}
                <button
                  type="button"
                  onClick={() => setCategoryPickerOpen(true)}
                  className={`w-full px-3.5 py-2.5 flex items-center justify-between border-b transition-colors active:scale-[0.99] ${
                    isOled
                      ? 'border-[#21262D]/60 hover:bg-[#161B22]'
                      : 'border-slate-200/60 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CategoryIcon
                      icon={selectedCategory?.icon || 'Tag'}
                      color={selectedCategory?.color || '#94A3B8'}
                      size={16}
                      badgeSize="sm"
                    />
                    <span className={`text-xs sm:text-sm font-semibold truncate ${
                      isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                    }`}>
                      {getCategoryDisplayName(selectedCategory, language) ||
                        (language === 'pt-BR' ? 'Selecionar Categoria' : 'Select Category')}
                    </span>
                  </div>
                  <ChevronDown size={15} className="text-slate-400 shrink-0" />
                </button>

                {/* 3. Conta / Cartão (For Expenses) */}
                {type === 'expense' && (
                  <div className={`px-3.5 py-3 border-b space-y-2 ${
                    isOled ? 'border-[#21262D]/60' : 'border-slate-200/60'
                  }`}>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {language === 'pt-BR' ? 'Conta / Cartão' : 'Account / Card'}
                    </label>

                    {/* Trigger Row */}
                    <button
                      type="button"
                      onClick={() => setIsAccountDropdownOpen((prev) => !prev)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl border transition-colors cursor-pointer text-left ${
                        isOled
                          ? 'border-[#21262D] bg-[#161B22]/50 hover:bg-[#21262D]'
                          : 'border-slate-200/80 bg-slate-50/50 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {!selectedCard ? (
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#6E5440]/20 text-[#D0B595] border border-[#D0B595]/30">
                            <Landmark size={18} />
                          </div>
                        ) : (
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white shadow-xs"
                            style={{
                              backgroundColor:
                                selectedCard.color && selectedCard.color !== '#6E5440'
                                  ? selectedCard.color
                                  : resolveBankInfo(selectedCard).primaryColor || selectedCard.color || '#6E5440',
                            }}
                          >
                            <AppIcon name={resolveBankInfo(selectedCard).iconName} size={18} color="#FFFFFF" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <h4 className={`text-xs sm:text-sm font-semibold truncate ${isOled ? 'text-slate-100' : 'text-slate-800'}`}>
                            {!selectedCard
                              ? (language === 'pt-BR' ? 'Conta Principal / Pix' : 'Main Account / Cash')
                              : selectedCard.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            {!selectedCard ? (
                              <span className="text-[11px] text-slate-400">
                                {language === 'pt-BR' ? 'Saldo em conta corrente' : 'Checking account balance'}
                              </span>
                            ) : (
                              <>
                                <span className="text-[11px] font-mono text-slate-400">
                                  •••• {selectedCard.lastDigits || '••••'}
                                </span>
                                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                  {formatCurrency(cardAvailableLimits[selectedCard.id] ?? selectedCard.totalLimit, currency)} disp.
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <ChevronDown
                        size={16}
                        className={`text-slate-400 transition-transform duration-200 shrink-0 ml-2 ${
                          isAccountDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Dropdown Options List */}
                    {isAccountDropdownOpen && (
                      <div className={`mt-1.5 rounded-xl border overflow-hidden divide-y animate-fadeIn ${
                        isOled
                          ? 'bg-[#0D1117] border-[#21262D] divide-[#21262D]/60'
                          : 'bg-white border-slate-200 divide-slate-100'
                      }`}>
                        {/* Checking / Pix Option */}
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectCard(null);
                            setIsAccountDropdownOpen(false);
                          }}
                          className={`w-full min-h-[48px] p-3 flex items-center justify-between transition-colors text-left ${
                            !selectedCardId
                              ? isOled ? 'bg-[#161B22]/70' : 'bg-slate-50'
                              : isOled ? 'hover:bg-[#161B22]/40' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-[#6E5440]/20 text-[#D0B595] border border-[#D0B595]/30">
                              <Landmark size={18} />
                            </div>
                            <div className="min-w-0">
                              <h5 className={`text-xs sm:text-sm font-semibold truncate ${isOled ? 'text-slate-100' : 'text-slate-800'}`}>
                                {language === 'pt-BR' ? 'Conta Principal / Pix' : 'Main Account / Cash'}
                              </h5>
                              <span className="text-[11px] text-slate-400 block">
                                {language === 'pt-BR' ? 'Saldo em conta corrente' : 'Checking account balance'}
                              </span>
                            </div>
                          </div>
                          {!selectedCardId && <Check size={16} className="text-[#10B981] shrink-0 ml-2" />}
                        </button>

                        {/* Credit Card Options */}
                        {creditCards.map((card) => {
                          const isSelected = selectedCardId === card.id;
                          const bankInfo = resolveBankInfo(card);
                          const brandBgColor =
                            card.color && card.color !== '#6E5440'
                              ? card.color
                              : bankInfo.primaryColor || card.color || '#6E5440';
                          const cardAvail = cardAvailableLimits[card.id] ?? card.totalLimit;

                          return (
                            <button
                              key={card.id}
                              type="button"
                              onClick={() => {
                                handleSelectCard(card.id);
                                setIsAccountDropdownOpen(false);
                              }}
                              className={`w-full min-h-[48px] p-3 flex items-center justify-between transition-colors text-left ${
                                isSelected
                                  ? isOled ? 'bg-[#161B22]/70' : 'bg-slate-50'
                                  : isOled ? 'hover:bg-[#161B22]/40' : 'hover:bg-slate-50/70'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white shadow-xs"
                                  style={{ backgroundColor: brandBgColor }}
                                >
                                  <AppIcon name={bankInfo.iconName} size={18} color="#FFFFFF" />
                                </div>
                                <div className="min-w-0">
                                  <h5 className={`text-xs sm:text-sm font-semibold truncate ${isOled ? 'text-slate-100' : 'text-slate-800'}`}>
                                    {card.name}
                                  </h5>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-[11px] font-mono text-slate-400">
                                      •••• {card.lastDigits || '••••'}
                                    </span>
                                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                      {formatCurrency(cardAvail, currency)} disp.
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {isSelected && <Check size={16} className="text-[#10B981] shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Compact Smart Cycle Pill when Card is Selected */}
                    {selectedCard && cardCycleInfo && (
                      <div className={`px-2.5 py-1 rounded-lg border flex items-center justify-between gap-2 text-[10px] ${
                        isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-slate-100 border-slate-200'
                      }`}>
                        <span className="flex items-center gap-1 text-slate-400 font-medium truncate">
                          <Sparkles size={11} className="text-[#D0B595] shrink-0" />
                          <span>
                            {t.invoiceCycleLabel}: <strong className={isOled ? 'text-white' : 'text-slate-900'}>{cardCycleInfo.formattedMonth}</strong>
                          </span>
                        </span>
                        <span className="text-slate-400 font-semibold shrink-0">
                          {t.dueDayShort}: {selectedCard.dueDay}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Data & Status */}
                <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
                  {/* Date with quick chips */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleDateChange(getTodayDateStr())}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                        date === getTodayDateStr()
                          ? 'bg-[#6E5440] text-white shadow-2xs'
                          : isOled
                          ? 'bg-[#0D1117] text-slate-400 hover:text-white'
                          : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                      }`}
                    >
                      {language === 'pt-BR' ? 'Hoje' : 'Today'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDateChange(getYesterdayDateStr())}
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
                        date === getYesterdayDateStr()
                          ? 'bg-[#6E5440] text-white shadow-2xs'
                          : isOled
                          ? 'bg-[#0D1117] text-slate-400 hover:text-white'
                          : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                      }`}
                    >
                      {language === 'pt-BR' ? 'Ontem' : 'Yesterday'}
                    </button>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className={`text-[11px] font-medium bg-transparent focus:outline-none cursor-pointer ${
                        isOled ? 'text-slate-300' : 'text-slate-700'
                      }`}
                    />
                  </div>

                  {/* Status binary toggle */}
                  {!selectedCard && (
                    <div className={`flex items-center p-0.5 rounded-xl border ${
                      isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200'
                    }`}>
                      <button
                        type="button"
                        onClick={() => setStatus('paid')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                          status === 'paid'
                            ? 'bg-[#10B981] text-white shadow-2xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {language === 'pt-BR' ? 'Pago' : 'Paid'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatus('unpaid')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                          status === 'unpaid'
                            ? 'bg-[#F59E0B] text-slate-950 shadow-2xs'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {language === 'pt-BR' ? 'Pendente' : 'Pending'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Collapsible "Mais opções" Accordion */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setIsMoreOptionsOpen((prev) => !prev)}
                  className={`w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold transition-colors ${
                    isOled ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>{language === 'pt-BR' ? 'Mais opções' : 'More options'}</span>
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isMoreOptionsOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isMoreOptionsOpen && (
                  <div className={`mt-2 p-3 rounded-2xl border space-y-3 animate-fadeIn ${
                    isOled ? 'bg-[#161B22]/50 border-[#21262D]' : 'bg-slate-50 border-slate-200'
                  }`}>
                    {/* Frequency Control */}
                    <div>
                      <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        {language === 'pt-BR' ? 'Frequência' : 'Frequency'}
                      </span>
                      <div className={`grid grid-cols-3 gap-1 p-1 rounded-xl border ${
                        isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200'
                      }`}>
                        <button
                          type="button"
                          onClick={() => setRecurrenceMode('single')}
                          className={`flex items-center justify-center gap-1 h-7 px-2 rounded-lg text-xs font-semibold transition-all ${
                            recurrenceMode === 'single'
                              ? isOled ? 'bg-[#21262D] text-white shadow-2xs' : 'bg-slate-800 text-white shadow-2xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Check size={12} />
                          <span>{language === 'pt-BR' ? 'Única' : 'Single'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRecurrenceMode('recurring')}
                          className={`flex items-center justify-center gap-1 h-7 px-2 rounded-lg text-xs font-semibold transition-all ${
                            recurrenceMode === 'recurring'
                              ? isOled ? 'bg-[#21262D] text-white shadow-2xs' : 'bg-slate-800 text-white shadow-2xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Repeat size={12} />
                          <span>{language === 'pt-BR' ? 'Fixa' : 'Fixed'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setRecurrenceMode('installment')}
                          className={`flex items-center justify-center gap-1 h-7 px-2 rounded-lg text-xs font-semibold transition-all ${
                            recurrenceMode === 'installment'
                              ? isOled ? 'bg-[#21262D] text-white shadow-2xs' : 'bg-slate-800 text-white shadow-2xs'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Layers size={12} />
                          <span>{language === 'pt-BR' ? 'Parcelada' : 'Installments'}</span>
                        </button>
                      </div>

                      {recurrenceMode === 'recurring' && (
                        <div className={`flex items-center justify-between gap-2 mt-2 px-3 py-1.5 rounded-xl border ${
                          isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200'
                        }`}>
                          <label className="text-xs font-medium text-slate-400">
                            {type === 'income' ? t.expectedDayShortLabel : t.dueDayShortLabel}:
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="31"
                            value={dueDay}
                            onChange={(e) => {
                              setDueDay(e.target.value);
                              setDueDayManuallyEdited(true);
                            }}
                            className={`w-14 h-7 px-2 rounded-lg border text-center text-xs font-bold ${
                              isOled ? 'bg-[#161B22] border-[#21262D] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                            }`}
                          />
                        </div>
                      )}

                      {recurrenceMode === 'installment' && (
                        <div className={`space-y-2 mt-2 p-2.5 rounded-xl border ${
                          isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200'
                        }`}>
                          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                            {[2, 3, 4, 6, 10, 12, 18, 24].map((n) => {
                              const active = parsedInstTot === n;
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setInstallmentTotal(String(n))}
                                  className={`py-1 px-2.5 rounded-lg text-[11px] font-bold border shrink-0 transition-all ${
                                    active
                                      ? isOled
                                        ? 'bg-[#6E5440] text-white border-[#D0B595]/30'
                                        : 'bg-[#6E5440] text-white border-transparent'
                                      : isOled
                                      ? 'bg-[#161B22] text-slate-400 border-[#21262D]'
                                      : 'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {n}x
                                </button>
                              );
                            })}
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                                {t.currentInstLabel}
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="240"
                                value={installmentCurrent}
                                onChange={(e) => setInstallmentCurrent(e.target.value)}
                                className={`w-full h-8 px-2 rounded-lg border text-center text-xs font-bold ${
                                  isOled ? 'bg-[#161B22] border-[#21262D] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                                {t.totalInstLabel}
                              </label>
                              <input
                                type="number"
                                min="2"
                                max="240"
                                value={installmentTotal}
                                onChange={(e) => setInstallmentTotal(e.target.value)}
                                className={`w-full h-8 px-2 rounded-lg border text-center text-xs font-bold ${
                                  isOled ? 'bg-[#161B22] border-[#21262D] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                                {type === 'income' ? t.expectedDayShortLabel : t.dueDayShortLabel}
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="31"
                                disabled={Boolean(selectedCard)}
                                value={selectedCard ? selectedCard.dueDay : dueDay}
                                onChange={(e) => {
                                  setDueDay(e.target.value);
                                  setDueDayManuallyEdited(true);
                                }}
                                className={`w-full h-8 px-2 rounded-lg border text-center text-xs font-bold ${
                                  selectedCard
                                    ? isOled ? 'bg-[#161B22]/50 border-[#21262D] text-slate-500' : 'bg-slate-100 border-slate-200 text-slate-400'
                                    : isOled ? 'bg-[#161B22] border-[#21262D] text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                                }`}
                              />
                            </div>
                          </div>

                          <p className="text-[10px] text-slate-400 text-center">
                            {t.installmentHintSummary(parsedInstCur, parsedInstTot, concludingMonthLabel, parsedDueDay)}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Observações */}
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                        {language === 'pt-BR' ? 'Observações' : 'Notes'}
                      </label>
                      <input
                        type="text"
                        placeholder={t.notesPlaceholder}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className={`w-full h-9 px-3 rounded-xl border text-xs focus:outline-none transition-colors ${
                          isOled
                            ? 'bg-[#0D1117] border-[#21262D] text-white placeholder:text-slate-500'
                            : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                        }`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Pinned Action Footer */}
            <div className={`p-3.5 sm:p-4 border-t shrink-0 flex items-center gap-2 ${
              isOled ? 'border-[#21262D] bg-[#0D1117]' : 'border-slate-100 bg-white'
            }`}>
              {editingTransaction && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(editingTransaction);
                    onClose();
                  }}
                  disabled={submitting}
                  className="h-12 w-12 rounded-2xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 active:scale-95 flex items-center justify-center shrink-0 transition-all"
                  title={language === 'pt-BR' ? 'Excluir lançamento' : 'Delete transaction'}
                  aria-label={language === 'pt-BR' ? 'Excluir lançamento' : 'Delete transaction'}
                >
                  <Trash2 size={18} />
                </button>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={`w-full flex-1 h-12 rounded-2xl font-bold text-sm text-white shadow-md transition-all active:scale-[0.99] flex items-center justify-center ${
                  type === 'income'
                    ? 'bg-[#10B981] hover:bg-emerald-600'
                    : 'bg-[#EF4444] hover:bg-rose-600'
                }`}
              >
                {submitting
                  ? t.savingBtn
                  : type === 'income'
                  ? language === 'pt-BR'
                    ? 'Salvar Entrada'
                    : 'Save Income'
                  : language === 'pt-BR'
                  ? 'Salvar Despesa'
                  : 'Save Expense'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Category Picker Modal */}
      {categoryPickerOpen && (
        <div
          className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn"
          onMouseDown={(e) => {
            categoryMouseDownTargetRef.current = e.target;
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (e.target === e.currentTarget && categoryMouseDownTargetRef.current === e.currentTarget) {
              setCategoryPickerOpen(false);
            }
          }}
        >
          <div
            className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[80vh] ${
              isOled ? 'bg-[#0D1117] border-[#21262D] text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`sticky top-0 z-10 border-b shrink-0 flex items-center justify-between px-5 py-3.5 ${
              isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-100'
            }`}>
              <div>
                <h4 className="text-sm font-bold">
                  {language === 'pt-BR' ? 'Selecionar Categoria' : 'Select Category'}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {language === 'pt-BR' ? 'Toque para escolher' : 'Tap to select'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryPickerOpen(false);
                    onManageCategories?.();
                  }}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 min-h-[36px] ${
                    isOled ? 'bg-[#161B22] text-slate-200 hover:bg-[#21262D]' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Tag size={13} className="text-[#D0B595]" />
                  <span>{language === 'pt-BR' ? 'Gerenciar' : 'Manage'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryPickerOpen(false)}
                  className={`p-1.5 rounded-full transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
                    isOled ? 'text-slate-400 hover:text-white hover:bg-[#161B22]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {filteredCategories.map((cat) => {
                const selected = cat.id === categoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCategoryId(cat.id);
                      setCategoryPickerOpen(false);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 gap-2 ${
                      selected
                        ? isOled
                          ? 'bg-[#161B22] border-[#D0B595] text-white shadow-xs'
                          : 'bg-slate-900 border-slate-900 text-white shadow-xs'
                        : isOled
                        ? 'bg-[#161B22]/50 border-[#21262D] text-slate-300 hover:bg-[#161B22]'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <CategoryIcon
                      icon={cat.icon}
                      color={selected ? '#ffffff' : cat.color}
                      size={20}
                      badgeSize="md"
                    />
                    <span className="text-xs font-bold text-center truncate max-w-full">
                      {getCategoryDisplayName(cat, language)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

    <SeriesConfirmModal
      isOpen={showSeriesEditConfirm}
      mode="edit"
      transaction={
        editingTransaction
          ? {
              ...editingTransaction,
              type,
              amount:
                recurrenceMode === 'installment' && parsedInstTot > 1
                  ? parsedInstCur === 1
                    ? installmentBreakdown.firstInstallmentAmount
                    : installmentBreakdown.regularInstallmentAmount
                  : parseFloat(amount.replace(',', '.')) || editingTransaction.amount,
              description: description.trim() || editingTransaction.description,
              date,
            }
          : null
      }
      subsequentCount={subsequentSeriesCount}
      currency={currency}
      language={language}
      submitting={submitting}
      onSelectScope={(scope) => executeSave(scope)}
      onCancel={() => setShowSeriesEditConfirm(false)}
    />
  </>
);
};
