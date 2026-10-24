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
      setAmount(String(editingTransaction.amount));
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
        calculatedInvoiceMonth = cardCycleInfo
          ? cardCycleInfo.invoiceMonth
          : computeCardFirstInvoiceMonth(txPurchaseDate, selectedCard.closingDay).invoiceMonth;
      }

      await onSave(
        {
          id: editingTransaction?.id,
          type,
          status: selectedCard ? 'unpaid' : status,
          amount: parsedAmount,
          description: finalDescription,
          categoryId,
          date,
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

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">
            {editingTransaction
              ? t.editEntryTitle
              : type === 'income'
              ? t.addInputModalTitle
              : t.addExpenseModalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          {/* Type Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                type === 'expense'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownRight size={17} />
              {t.expenseOutTab}
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight size={17} />
              {t.inputInTab}
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              {t.amountLabel}
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              autoFocus
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full text-2xl font-bold px-4 py-3 rounded-xl border bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 transition-all ${
                type === 'income'
                  ? 'border-emerald-200 text-emerald-500 focus:ring-emerald-500'
                  : 'border-rose-200 text-rose-500 focus:ring-rose-500'
              }`}
            />
          </div>

          {/* Description & Payment/Receipt Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                {t.descriptionLabel}
              </label>
              <div className="relative">
                <FileText size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder={type === 'income' ? t.incomeDescPlaceholder : t.expenseDescPlaceholder}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                {t.dateLabel}
              </label>
              <div className="relative">
                <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Category Picker */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              {t.categoryLabel}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-1">
              {filteredCategories.map((cat) => {
                const selected = cat.id === categoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex items-center gap-2.5 p-2 rounded-xl border text-left transition-all ${
                      selected
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <CategoryIcon
                      icon={cat.icon}
                      color={selected ? '#ffffff' : cat.color}
                      size={16}
                      badgeSize="sm"
                      className={selected ? '!bg-white/20 !text-white' : ''}
                    />
                    <span className="text-xs font-medium leading-tight line-clamp-2">
                      {getCategoryDisplayName(cat, language)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional Notes */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
              {t.notesOptionalLabel}
            </label>
            <input
              type="text"
              placeholder={t.notesPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Payment Method / Account (Bank vs Credit Card) */}
          {type === 'expense' && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t.paymentMethodLabel}
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectCard(null)}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                    !selectedCardId
                      ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-500/20 font-semibold'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg ${
                      !selectedCardId ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Landmark size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold leading-tight">{t.bankAccountCash}</p>
                    <p className="text-[10px] text-slate-500 truncate">{t.instantBalanceDeduction}</p>
                  </div>
                  {!selectedCardId && <Check size={16} className="text-indigo-600 shrink-0" />}
                </button>

                {creditCards.map((card) => {
                  const isSelected = selectedCardId === card.id;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => handleSelectCard(card.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 text-indigo-900 ring-2 ring-indigo-500/20 font-semibold'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div
                        className="p-2 rounded-lg text-white shrink-0"
                        style={{ backgroundColor: card.color || '#6366f1' }}
                      >
                        <CreditCardIcon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold leading-tight truncate">{card.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">
                          {t.closingDayShort}: {card.closingDay} | {t.dueDayShort}: {card.dueDay}
                        </p>
                      </div>
                      {isSelected && <Check size={16} className="text-indigo-600 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* Smart Cycle Assignment Box */}
              {selectedCard && cardCycleInfo && (
                <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200/80 space-y-2 mt-2">
                  <div className="flex items-center gap-1.5 text-indigo-700 font-bold text-xs uppercase tracking-wider">
                    <Sparkles size={14} />
                    <span>{t.smartCycleTitle}</span>
                  </div>
                  <p className="text-xs text-slate-700">
                    {cardCycleInfo.rolledToNext
                      ? t.cardClosingAfterHint(selectedCard.closingDay)
                      : t.cardClosingBeforeHint(selectedCard.closingDay)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs font-semibold">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white shadow-xs">
                      {t.invoiceCycleLabel}: <strong>{cardCycleInfo.formattedMonth}</strong>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-white border border-indigo-200 text-indigo-800">
                      {t.invoiceDueDayBadge(selectedCard.dueDay)}
                    </span>
                  </div>
                  <p className="text-[11px] text-indigo-800 font-medium leading-relaxed pt-1 border-t border-indigo-100">
                    {t.cardBalanceRuleHint}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Payment Status Selector: Paid vs Unpaid / Pending (Only for Bank Account / Cash) */}
          {!selectedCard ? (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t.paymentStatusLabel}
              </span>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setStatus('paid')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    status === 'paid'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ThumbsUp size={14} />
                  <span>{type === 'income' ? t.statusPaidIncome : t.statusPaidExpense}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStatus('unpaid')}
                  className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    status === 'unpaid'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ThumbsDown size={14} />
                  <span>{type === 'income' ? t.statusUnpaidIncome : t.statusUnpaidExpense}</span>
                </button>
              </div>
              {status === 'unpaid' && (
                <p className="text-[11px] font-medium text-amber-600 px-1">{t.unpaidBalanceHint}</p>
              )}
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200/60 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-semibold">{t.paymentStatusLabel}</span>
              <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 font-bold border border-amber-500/30 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {t.cardStatusAccumulated}
              </span>
            </div>
          )}

          {/* Concise Frequency / Recurrence / Installment Selector */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                {t.frequencyLabel}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setRecurrenceMode('single')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                  recurrenceMode === 'single'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Check size={13} />
                <span>{t.freqOneTime}</span>
              </button>

              <button
                type="button"
                onClick={() => setRecurrenceMode('recurring')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                  recurrenceMode === 'recurring'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Repeat size={13} />
                <span>{t.freqRecurring}</span>
              </button>

              <button
                type="button"
                onClick={() => setRecurrenceMode('installment')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                  recurrenceMode === 'installment'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers size={13} />
                <span>{t.freqInstallment}</span>
              </button>
            </div>

            {/* Extra fields when Fixa Mensal or Parcelada is selected */}
            {recurrenceMode === 'recurring' && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-slate-600 shrink-0">
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
                    className="w-16 px-2.5 py-1.5 rounded-lg border border-slate-200 text-center text-xs font-bold bg-white"
                  />
                </div>
                <span className="text-[11px] font-medium text-indigo-500">
                  {t.recurringHintSummary(parsedDueDay)}
                </span>
              </div>
            )}

            {recurrenceMode === 'installment' && (
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {t.currentInstLabel}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="240"
                      value={installmentCurrent}
                      onChange={(e) => setInstallmentCurrent(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-center text-xs font-bold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      {t.totalInstLabel}
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="240"
                      value={installmentTotal}
                      onChange={(e) => setInstallmentTotal(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-center text-xs font-bold bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
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
                      className={`w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-center text-xs font-bold ${
                        selectedCard ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white'
                      }`}
                    />
                  </div>
                </div>

                <div className="px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-500 text-[11px] font-semibold text-center">
                  {t.installmentHintSummary(parsedInstCur, parsedInstTot, concludingMonthLabel, parsedDueDay)}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 py-2.5 px-4 rounded-xl text-white text-sm font-semibold shadow-sm transition-all ${
                type === 'income'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {submitting
                ? t.savingBtn
                : editingTransaction
                ? t.saveChangesBtn
                : type === 'income'
                ? t.addInputSubmitBtn
                : t.addExpenseSubmitBtn}
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
                amount: parseFloat(amount.replace(',', '.')) || editingTransaction.amount,
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
