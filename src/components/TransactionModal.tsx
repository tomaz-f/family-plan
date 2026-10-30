import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import {
  AppLanguage,
  Category,
  CreditCard,
  Transaction,
  TransactionStatus,
  TransactionType,
} from '../types';
import { CategoryIcon } from './CategoryIcon';
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
  onClose: () => void;
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
  onClose,
  onSave,
}) => {
  const t = TRANSLATIONS[language];
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

  const filteredCategories = categories.filter((c) => c.type === type);
  const effectiveCardId = type === 'expense' ? selectedCardId : null;
  const selectedCard = useMemo(
    () => creditCards.find((c) => c.id === effectiveCardId) || null,
    [creditCards, effectiveCardId]
  );

  useEffect(() => {
    if (!isOpen) {
      setShowSeriesEditConfirm(false);
      return;
    }
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
      } else if (editingTransaction.recurringId) {
        setRecurrenceMode('recurring');
        setInstallmentCurrent('1');
        setInstallmentTotal('12');
      } else {
        setRecurrenceMode('single');
        setInstallmentCurrent('1');
        setInstallmentTotal('12');
      }
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
      const cardObj = initCard ? creditCards.find((c) => c.id === initCard) : null;
      setDueDay(String(cardObj ? cardObj.dueDay : Number(today.split('-')[2]) || 10));
      setDueDayManuallyEdited(false);
      setInstallmentCurrent('1');
      setInstallmentTotal('12');
    }
    // Only initialize form state when the modal opens or target transaction changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialType, initialCardId, editingTransaction?.id]);

  useEffect(() => {
    if (!filteredCategories.some((c) => c.id === categoryId)) {
      setCategoryId(filteredCategories[0]?.id || '');
    }
  }, [type, filteredCategories, categoryId]);

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="tx-compact-modal bg-white w-[92%] max-w-[420px] mx-auto rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            {editingTransaction
              ? type === 'income'
                ? language === 'pt-BR'
                  ? 'Editar Entrada'
                  : 'Edit Income'
                : language === 'pt-BR'
                ? 'Editar Despesa'
                : 'Edit Expense'
              : type === 'income'
              ? language === 'pt-BR'
                ? 'Nova Entrada'
                : 'New Income'
              : language === 'pt-BR'
              ? 'Nova Despesa'
              : 'New Expense'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label={t.cancelBtn}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto no-scrollbar">
          {/* Compact Segmented Type Toggle */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                type === 'expense'
                  ? 'bg-[#EF4444] text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ArrowDownRight size={14} strokeWidth={2.5} />
              <span>{language === 'pt-BR' ? 'Despesa' : 'Expense'}</span>
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                type === 'income'
                  ? 'bg-[#10B981] text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight size={14} strokeWidth={2.5} />
              <span>{language === 'pt-BR' ? 'Entrada' : 'Income'}</span>
            </button>
          </div>

          {/* Prominent Amount Input with R$ Prefix */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              {type === 'expense' && (recurrenceMode === 'installment' || selectedCard)
                ? language === 'pt-BR'
                  ? 'Valor Total da Compra'
                  : 'Total Purchase Amount'
                : language === 'pt-BR'
                ? 'Valor'
                : 'Amount'}
            </label>
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus-within:border-[#6E5440] transition-all">
              <span
                className={`text-lg sm:text-xl font-bold select-none shrink-0 ${
                  type === 'income' ? 'text-[#10B981]' : 'text-[#EF4444]'
                }`}
              >
                {currencySymbol}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                autoFocus
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`tx-amount-input w-full text-2xl sm:text-3xl font-bold focus:outline-none p-0 leading-none ${
                  type === 'income' ? 'tx-amount-input-income' : 'tx-amount-input-expense'
                }`}
              />
            </div>
            {recurrenceMode === 'installment' && (
              <div className="mt-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                <Layers size={12} className="text-[#D0B595] shrink-0" />
                <span className="truncate">
                  {language === 'pt-BR'
                    ? `Total ${formatCurrency(installmentBreakdown.totalAmount, currency)} em ${installmentBreakdown.count}x de ${formatCurrency(installmentBreakdown.regularInstallmentAmount, currency)}`
                    : `Total ${formatCurrency(installmentBreakdown.totalAmount, currency)} in ${installmentBreakdown.count}x of ${formatCurrency(installmentBreakdown.regularInstallmentAmount, currency)}`}
                  {installmentBreakdown.remainderCents > 0 && installmentBreakdown.count > 1
                    ? ` (1ª: ${formatCurrency(installmentBreakdown.firstInstallmentAmount, currency)})`
                    : ''}
                </span>
              </div>
            )}
          </div>

          {/* Side-by-Side Description & Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {language === 'pt-BR' ? 'Descrição' : 'Description'}
              </label>
              <input
                type="text"
                required
                placeholder={type === 'income' ? t.incomeDescPlaceholder : t.expenseDescPlaceholder}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-11 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {language === 'pt-BR' ? 'Data' : 'Date'}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => handleDateChange(e.target.value)}
                className="w-full h-11 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Compact Category Horizontal Pill Carousel */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              {language === 'pt-BR' ? 'Categoria' : 'Category'}
            </label>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 -mx-0.5 px-0.5">
              {filteredCategories.map((cat) => {
                const selected = cat.id === categoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                      selected
                        ? 'filter-chip-active font-semibold shadow-xs'
                        : 'filter-chip-inactive'
                    }`}
                  >
                    <CategoryIcon
                      icon={cat.icon}
                      color={selected ? '#ffffff' : cat.color}
                      size={13}
                      badgeSize="sm"
                      className={selected ? '!bg-white/20 !text-white !w-5 !h-5' : '!w-5 !h-5'}
                    />
                    <span>{getCategoryDisplayName(cat, language)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account / Card Compact Pill Selector (For Expenses) */}
          {type === 'expense' && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {language === 'pt-BR' ? 'Conta / Cartão' : 'Account / Card'}
              </label>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                <button
                  type="button"
                  onClick={() => handleSelectCard(null)}
                  className={`rounded-xl px-3 py-2 flex items-center gap-1.5 text-xs font-medium border whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                    !selectedCardId
                      ? 'filter-chip-active font-semibold shadow-xs'
                      : 'filter-chip-inactive'
                  }`}
                >
                  <Landmark size={13} className="shrink-0" />
                  <span>{language === 'pt-BR' ? 'Conta / Pix' : 'Bank / Cash'}</span>
                  {!selectedCardId && <Check size={12} className="shrink-0 ml-0.5" />}
                </button>

                {creditCards.map((card) => {
                  const isSelected = selectedCardId === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => handleSelectCard(card.id)}
                      className={`rounded-xl px-3 py-2 flex items-center gap-1.5 text-xs font-medium border whitespace-nowrap shrink-0 transition-all active:scale-95 ${
                        isSelected
                          ? 'filter-chip-active font-semibold shadow-xs'
                          : 'filter-chip-inactive'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: card.color || '#6366f1' }}
                      />
                      <CreditCardIcon size={13} className="shrink-0" />
                      <span>{card.name}</span>
                      {isSelected && <Check size={12} className="shrink-0 ml-0.5" />}
                    </button>
                  );
                })}
              </div>

              {/* Compact Smart Cycle Pill when Card is Selected */}
              {selectedCard && cardCycleInfo && (
                <div className="mt-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex items-center gap-1 text-slate-600 font-medium truncate">
                    <Sparkles size={12} className="text-[#D0B595] shrink-0" />
                    <span>
                      {t.invoiceCycleLabel}: <strong className="text-slate-900">{cardCycleInfo.formattedMonth}</strong>
                    </span>
                  </span>
                  <span className="text-slate-500 font-semibold shrink-0">
                    {t.dueDayShort}: {selectedCard.dueDay}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Compact Payment Status & Frequency Controls */}
          <div className="space-y-2.5">
            {!selectedCard && (
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  {language === 'pt-BR' ? 'Status' : 'Status'}
                </span>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setStatus('paid')}
                    className={`flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
                      status === 'paid'
                        ? 'bg-[#10B981] text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <ThumbsUp size={13} />
                    <span>{language === 'pt-BR' ? 'Pago' : 'Paid'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setStatus('unpaid')}
                    className={`flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold transition-all ${
                      status === 'unpaid'
                        ? 'bg-[#F59E0B] text-slate-950 shadow-xs'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <span>{language === 'pt-BR' ? 'Pendente' : 'Pending'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Frequency Segmented Control */}
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                {language === 'pt-BR' ? 'Frequência' : 'Frequency'}
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setRecurrenceMode('single')}
                  className={`flex items-center justify-center gap-1 h-8 px-2 rounded-lg text-xs font-semibold transition-all ${
                    recurrenceMode === 'single'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Check size={12} />
                  <span>{language === 'pt-BR' ? 'Única' : 'Single'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRecurrenceMode('recurring')}
                  className={`flex items-center justify-center gap-1 h-8 px-2 rounded-lg text-xs font-semibold transition-all ${
                    recurrenceMode === 'recurring'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Repeat size={12} />
                  <span>{language === 'pt-BR' ? 'Fixa' : 'Fixed'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRecurrenceMode('installment')}
                  className={`flex items-center justify-center gap-1 h-8 px-2 rounded-lg text-xs font-semibold transition-all ${
                    recurrenceMode === 'installment'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Layers size={12} />
                  <span>{language === 'pt-BR' ? 'Parcelada' : 'Installments'}</span>
                </button>
              </div>

              {/* Extra compact fields for Fixa or Parcelada */}
              {recurrenceMode === 'recurring' && (
                <div className="flex items-center justify-between gap-2 mt-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200">
                  <label className="text-xs font-medium text-slate-600">
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
                    className="w-14 h-7 px-2 rounded-lg border border-slate-200 text-center text-xs font-bold bg-white"
                  />
                </div>
              )}

              {recurrenceMode === 'installment' && (
                <div className="space-y-2 mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
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
                              ? 'filter-chip-active shadow-2xs'
                              : 'filter-chip-inactive'
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
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 text-center text-xs font-bold bg-white"
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
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 text-center text-xs font-bold bg-white"
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
                        className={`w-full h-8 px-2 rounded-lg border border-slate-200 text-center text-xs font-bold ${
                          selectedCard ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
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
          </div>

          {/* Streamlined Single-Line Notes Input */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              {language === 'pt-BR' ? 'Observações' : 'Notes'}
            </label>
            <input
              type="text"
              placeholder={t.notesPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-11 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Compact Action Footer */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors"
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 py-2.5 px-4 rounded-xl text-white text-xs font-semibold shadow-xs transition-all ${
                type === 'income'
                  ? 'bg-[#10B981] hover:bg-emerald-600'
                  : 'bg-[#EF4444] hover:bg-rose-600'
              }`}
            >
              {submitting
                ? t.savingBtn
                : editingTransaction
                ? t.saveChangesBtn
                : type === 'income'
                ? language === 'pt-BR'
                  ? 'Adicionar Entrada'
                  : 'Add Income'
                : language === 'pt-BR'
                ? 'Adicionar Despesa'
                : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>

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
    </div>
  );
};
