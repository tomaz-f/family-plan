import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CreditCard as CreditCardIcon,
  X,
  Calendar,
  ChevronDown,
  Layers,
  Tag,
  Trash2,
  Plus,
  Minus,
  Check,
  AlertCircle,
  Clock,
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
import { CardBrandBadge } from './CreditCardsView';
import { BankIcon, AppIcon } from './icons';
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

interface CreditCardExpenseModalProps {
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

const QUICK_INSTALLMENT_OPTIONS = [2, 3, 4, 5, 6, 10, 12, 18, 24];

export const CreditCardExpenseModal: React.FC<CreditCardExpenseModalProps> = ({
  isOpen,
  initialCardId = null,
  editingTransaction = null,
  allTransactions = [],
  categories,
  creditCards = [],
  currency,
  language,
  theme,
  onClose,
  onSave,
  onDelete,
  onManageCategories,
  newlyCreatedCategoryId,
}) => {
  const t = TRANSLATIONS[language];
  const isOled = theme === 'oled';

  // Form states
  const [amount, setAmount] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
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
  const [date, setDate] = useState<string>(getTodayDateStr());
  const [notes, setNotes] = useState<string>('');
  const [selectedCardId, setSelectedCardId] = useState<string>('');

  // Installment states
  const [isInstallment, setIsInstallment] = useState<boolean>(false);
  const [installmentCount, setInstallmentCount] = useState<number>(3);
  const [installmentCurrent, setInstallmentCurrent] = useState<number>(1);

  // UI state
  const [categoryPickerOpen, setCategoryPickerOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [showSeriesEditConfirm, setShowSeriesEditConfirm] = useState<boolean>(false);
  const [showSeriesDeleteConfirm, setShowSeriesDeleteConfirm] = useState<boolean>(false);

  // Filter only expense categories
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'expense'),
    [categories]
  );

  // Track modal visibility transitions to prevent background polling from resetting user input
  const prevIsOpenRef = useRef<boolean>(false);
  const prevEditingIdRef = useRef<string | null | undefined>(undefined);
  const backdropMouseDownTargetRef = useRef<EventTarget | null>(null);
  const categoryMouseDownTargetRef = useRef<EventTarget | null>(null);

  // Initialize form values ONLY when modal opens or target editing transaction changes
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
      // Modal is already open and target hasn't changed; strictly preserve active user input
      return;
    }

    prevIsOpenRef.current = true;
    prevEditingIdRef.current = currentEditingId;

    if (editingTransaction) {
      // Editing existing credit card transaction
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
      // New credit card purchase
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

  // Active selected card
  const selectedCard = useMemo(
    () => creditCards.find((c) => c.id === selectedCardId) || creditCards[0] || null,
    [creditCards, selectedCardId]
  );

  // Active selected category
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) || expenseCategories[0] || null,
    [categories, categoryId, expenseCategories]
  );

  // Invoice cycle calculation
  const cardCycleInfo = useMemo(() => {
    if (!selectedCard) return null;
    const baseDate = date || getTodayDateStr();
    const cycle = computeCardFirstInvoiceMonth(baseDate, selectedCard.closingDay);
    return {
      ...cycle,
      formattedMonth: formatMonthLabel(cycle.invoiceMonth, language),
    };
  }, [selectedCard, date, language]);

  // Installment split calculations
  const installmentBreakdown = useMemo(() => {
    const rawNum = parseFloat(amount.replace(',', '.'));
    const totalAmount = !Number.isNaN(rawNum) && rawNum > 0 ? rawNum : 0;
    const count = isInstallment ? Math.max(2, installmentCount) : 1;
    const totalCents = Math.round(totalAmount * 100);
    const baseCents = Math.floor(totalCents / count);
    const remainderCents = totalCents - baseCents * count;
    const firstInstallmentAmount = Number(((baseCents + remainderCents) / 100).toFixed(2));
    const regularInstallmentAmount = Number((baseCents / 100).toFixed(2));

    const baseMonth = cardCycleInfo
      ? cardCycleInfo.invoiceMonth
      : (date || getTodayDateStr()).slice(0, 7);
    const endMonthStr = shiftMonth(baseMonth, count - 1);
    const formattedEndMonth = formatMonthLabel(endMonthStr, language);

    return {
      totalAmount,
      count,
      firstInstallmentAmount,
      regularInstallmentAmount,
      formattedEndMonth,
    };
  }, [amount, isInstallment, installmentCount, cardCycleInfo, date, language]);

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
    if (!selectedCard) return;

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

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn"
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
          className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
            isOled
              ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
              : 'bg-white border-slate-200 text-slate-900 shadow-xl'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${
              isOled ? 'border-[#21262D]' : 'border-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  isOled
                    ? 'bg-[#161B22] border-[#21262D] text-[#D0B595]'
                    : 'bg-amber-500/10 border-amber-500/20 text-[#6E5440]'
                }`}
              >
                <BankIcon card={selectedCard} size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold leading-tight">
                  {editingTransaction ? 'Editar Compra no Cartão' : 'Lançar no Cartão'}
                </h3>
                <p
                  className={`text-[11px] ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}
                >
                  Registrado exclusivamente na fatura do cartão
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className={`p-1.5 rounded-full transition-colors ${
                isOled
                  ? 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#161B22]'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            {/* 1. Credit Card Selector */}
            <div>
              <label
                className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                }`}
              >
                Cartão
              </label>

              {creditCards.length === 0 ? (
                <div
                  className={`p-3 rounded-xl border flex items-center gap-2 text-xs ${
                    isOled
                      ? 'bg-[#161B22] border-[#21262D] text-amber-400'
                      : 'bg-amber-50 border-amber-200 text-amber-700'
                  }`}
                >
                  <AlertCircle size={15} />
                  <span>Nenhum cartão cadastrado. Cadastre um cartão na aba Cartões.</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Cards Pill Row */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                    {creditCards.map((card) => {
                      const isSelected = card.id === selectedCard?.id;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => setSelectedCardId(card.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border shrink-0 transition-all active:scale-95 ${
                            isSelected
                              ? isOled
                                ? 'bg-[#161B22] border-[#6E5440] text-[#F8FAFC] ring-1 ring-[#6E5440]'
                                : 'bg-[#6E5440]/10 border-[#6E5440] text-[#6E5440] ring-1 ring-[#6E5440]'
                              : isOled
                              ? 'bg-[#0D1117] border-[#21262D] text-[#94A3B8] hover:border-[#30363D]'
                              : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <BankIcon card={card} size={15} />
                          <span className="truncate max-w-[120px]">{card.name}</span>
                          {card.lastDigits && (
                            <span
                              className={`text-[10px] font-mono px-1 py-0.5 rounded ${
                                isOled ? 'bg-[#0D1117] text-[#94A3B8]' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              •••• {card.lastDigits}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Calculated Invoice Cycle Info Badge */}
                  {selectedCard && cardCycleInfo && (
                    <div
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs ${
                        isOled
                          ? 'bg-[#161B22]/70 border-[#21262D] text-[#D0B595]'
                          : 'bg-amber-500/10 border-amber-500/20 text-[#6E5440]'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 truncate">
                        <Clock size={13} className="shrink-0" />
                        <span className="truncate">
                          Fatura: <strong>{cardCycleInfo.formattedMonth}</strong> • Vence dia{' '}
                          <strong>{selectedCard.dueDay}</strong>
                        </span>
                      </div>
                      {cardCycleInfo.rolledToNext && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 border ${
                            isOled
                              ? 'bg-[#0D1117] border-[#21262D] text-amber-300'
                              : 'bg-white border-amber-200 text-amber-700'
                          }`}
                        >
                          Após Fechamento
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Valor Total da Compra */}
            <div>
              <label
                className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                }`}
              >
                {isInstallment ? 'Valor Total da Compra' : 'Valor da Compra'}
              </label>

              <div
                className={`flex items-center px-4 py-2.5 rounded-2xl border transition-all ${
                  isOled
                    ? 'bg-[#161B22] border-[#21262D] focus-within:border-[#6E5440]'
                    : 'bg-[#F1F5F9] border-slate-200 focus-within:border-[#6E5440]'
                }`}
              >
                <span className="text-xl font-black text-[#EF4444] shrink-0 mr-2 select-none">
                  {currency}
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  required
                  autoFocus={!editingTransaction}
                  placeholder="0,00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`w-full bg-transparent text-2xl sm:text-3xl font-black focus:outline-none tracking-tight ${
                    isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                  }`}
                />
              </div>
            </div>

            {/* 3. Category Picker (BottomSheet / Compact Popover Picker) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                  }`}
                >
                  {language === 'pt-BR' ? 'Categoria' : 'Category'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryPickerOpen(false);
                    onManageCategories?.();
                  }}
                  className="text-xs font-semibold text-[#6E5440] hover:text-[#7E624B] active:scale-95 transition-colors py-1 px-1.5 min-h-[36px] flex items-center gap-1"
                >
                  <Tag size={13} />
                  <span>{language === 'pt-BR' ? 'Gerenciar' : 'Manage'}</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setCategoryPickerOpen(true)}
                className={`w-full h-11 px-3.5 rounded-xl border flex items-center justify-between transition-colors active:scale-[0.99] ${
                  isOled
                    ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC] hover:bg-[#21262D]/50'
                    : 'bg-[#F1F5F9] border-slate-200 text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <CategoryIcon
                    icon={selectedCategory?.icon || 'Tag'}
                    color={selectedCategory?.color || '#94A3B8'}
                    size={18}
                    badgeSize="sm"
                  />
                  <span className="text-sm font-semibold truncate">
                    {getCategoryDisplayName(selectedCategory, language) || 'Selecione uma categoria'}
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className={`shrink-0 ${isOled ? 'text-[#94A3B8]' : 'text-slate-400'}`}
                />
              </button>
            </div>

            {/* 4. Descrição & Data (Balanced Side-by-Side Inputs) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                  }`}
                >
                  Descrição
                </label>
                <input
                  type="text"
                  placeholder="Ex: Mercado, Uber, Restaurante..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={`w-full h-11 px-3.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                    isOled
                      ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]'
                      : 'bg-[#F1F5F9] border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div>
                <label
                  className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                  }`}
                >
                  Data da Compra
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={`w-full h-11 px-3 rounded-xl border text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                      isOled
                        ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]'
                        : 'bg-[#F1F5F9] border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* 5. Frequência / Parcelamento */}
            <div className="space-y-2.5">
              <label
                className={`block text-xs font-semibold uppercase tracking-wider ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                }`}
              >
                Parcelamento
              </label>

              {/* Segmented Control: À Vista vs Parcelada */}
              <div
                className={`p-1 rounded-xl border flex gap-1 ${
                  isOled ? 'bg-[#161B22] border-[#21262D]' : 'bg-[#F1F5F9] border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setIsInstallment(false)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                    !isInstallment
                      ? isOled
                        ? 'bg-[#0D1117] text-[#F8FAFC] shadow-xs'
                        : 'bg-white text-slate-900 shadow-xs'
                      : isOled
                      ? 'text-[#94A3B8] hover:text-[#F8FAFC]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  À Vista (1x)
                </button>
                <button
                  type="button"
                  onClick={() => setIsInstallment(true)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
                    isInstallment
                      ? isOled
                        ? 'bg-[#6E5440] text-[#F8FAFC] shadow-xs'
                        : 'bg-[#6E5440] text-white shadow-xs'
                      : isOled
                      ? 'text-[#94A3B8] hover:text-[#F8FAFC]'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Layers size={13} />
                  <span>Parcelada</span>
                </button>
              </div>

              {/* Installment Controls */}
              {isInstallment && (
                <div
                  className={`p-3.5 rounded-2xl border space-y-3 ${
                    isOled ? 'bg-[#161B22]/50 border-[#21262D]' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  {/* Stepper Control */}
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`text-xs font-semibold ${
                        isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                      }`}
                    >
                      Número de parcelas:
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInstallmentCount((n) => Math.max(2, n - 1))}
                        disabled={installmentCount <= 2}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all active:scale-90 disabled:opacity-40 ${
                          isOled
                            ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]'
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <Minus size={14} />
                      </button>

                      <span
                        className={`w-12 text-center text-sm font-black ${
                          isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                        }`}
                      >
                        {installmentCount}x
                      </span>

                      <button
                        type="button"
                        onClick={() => setInstallmentCount((n) => Math.min(24, n + 1))}
                        disabled={installmentCount >= 24}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all active:scale-90 disabled:opacity-40 ${
                          isOled
                            ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]'
                            : 'bg-white border-slate-200 text-slate-800'
                        }`}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Quick Select Chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {QUICK_INSTALLMENT_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setInstallmentCount(opt)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
                          installmentCount === opt
                            ? isOled
                              ? 'bg-[#6E5440] border-[#6E5440] text-white shadow-2xs'
                              : 'bg-[#6E5440] border-[#6E5440] text-white shadow-2xs'
                            : isOled
                            ? 'bg-[#161B22] border-[#21262D] text-[#94A3B8] hover:border-[#30363D]'
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {opt}x
                      </button>
                    ))}
                  </div>

                  {/* Live Calculation Preview Banner */}
                  <div
                    className={`p-2.5 rounded-xl border flex flex-col gap-0.5 text-xs ${
                      isOled
                        ? 'bg-[#0D1117] border-[#21262D] text-[#D0B595]'
                        : 'bg-white border-slate-200 text-[#6E5440]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>
                        {installmentCount}x de{' '}
                        {formatCurrency(installmentBreakdown.regularInstallmentAmount, currency)}
                      </span>
                      <span>Total: {formatCurrency(installmentBreakdown.totalAmount, currency)}</span>
                    </div>
                    <span
                      className={`text-[10px] ${
                        isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                      }`}
                    >
                      Última parcela na fatura de {installmentBreakdown.formattedEndMonth}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 6. Observações */}
            <div>
              <label
                className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                }`}
              >
                Observações
              </label>
              <input
                type="text"
                placeholder="Observações opcionais..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={`w-full h-11 px-3.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                  isOled
                    ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]'
                    : 'bg-[#F1F5F9] border-slate-200 text-slate-900'
                }`}
              />
            </div>
          </form>

          {/* Action Bar (Footer) */}
          <div
            className={`p-4 border-t flex items-center justify-between gap-3 shrink-0 ${
              isOled ? 'border-[#21262D] bg-[#0D1117]' : 'border-slate-100 bg-white'
            }`}
          >
            {editingTransaction ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="h-11 px-3.5 rounded-xl border border-rose-500/40 text-rose-500 hover:bg-rose-500/10 active:scale-95 flex items-center justify-center gap-1.5 font-bold text-xs transition-colors shrink-0"
                title="Excluir esta compra"
              >
                <Trash2 size={15} />
                <span>Excluir</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className={`h-11 px-4 rounded-xl border text-xs font-bold transition-colors ${
                  isOled
                    ? 'border-[#21262D] bg-[#161B22] text-[#94A3B8] hover:text-[#F8FAFC]'
                    : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !amount.trim()}
                className="h-11 px-5 rounded-xl bg-[#6E5440] hover:bg-[#7E624B] text-[#F8FAFC] font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check size={16} />
                <span>{editingTransaction ? 'Salvar Alterações' : 'Lançar Compra'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CATEGORY PICKER BOTTOMSHEET / POPOVER MODAL */}
      {categoryPickerOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn"
          onMouseDown={(e) => {
            categoryMouseDownTargetRef.current = e.target;
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && categoryMouseDownTargetRef.current === e.currentTarget) {
              setCategoryPickerOpen(false);
            }
          }}
        >
          <div
            className={`w-full max-w-md rounded-t-3xl sm:rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[80vh] ${
              isOled
                ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
                : 'bg-white border-slate-200 text-slate-900'
            }`}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sheet Header */}
            <div
              className={`sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${
                isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-100'
              }`}
            >
              <div>
                <h4 className="text-sm font-bold">
                  {language === 'pt-BR' ? 'Selecionar Categoria' : 'Select Category'}
                </h4>
                <p className={`text-[11px] ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                  {language === 'pt-BR'
                    ? 'Toque para escolher a categoria'
                    : 'Tap to choose category'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryPickerOpen(false);
                    onManageCategories?.();
                  }}
                  className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 min-h-[36px] active:scale-95 ${
                    isOled
                      ? 'bg-[#161B22] border border-[#21262D] text-slate-300 hover:bg-[#21262D] hover:text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Tag size={14} className="text-[#6E5440]" />
                  <span>{language === 'pt-BR' ? 'Gerenciar' : 'Manage'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCategoryPickerOpen(false)}
                  className={`p-1.5 rounded-full transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
                    isOled
                      ? 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#161B22]'
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Dense Category Grid (No horizontal scroll!) */}
            <div className="p-4 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {expenseCategories.map((cat) => {
                const isSelected = cat.id === selectedCategory?.id;
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
                      isSelected
                        ? isOled
                          ? 'bg-[#161B22] border-[#6E5440] ring-2 ring-[#6E5440]/50 shadow-xs'
                          : 'bg-[#6E5440]/10 border-[#6E5440] ring-2 ring-[#6E5440]/40 shadow-xs'
                        : isOled
                        ? 'bg-[#161B22]/40 border-[#21262D] hover:bg-[#161B22] hover:border-[#30363D]'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <CategoryIcon
                      icon={cat.icon || 'Tag'}
                      color={cat.color || '#94A3B8'}
                      size={22}
                      badgeSize="md"
                    />
                    <span
                      className={`text-xs font-bold text-center truncate max-w-full ${
                        isSelected
                          ? isOled
                            ? 'text-[#F8FAFC]'
                            : 'text-[#6E5440]'
                          : isOled
                          ? 'text-[#94A3B8]'
                          : 'text-slate-700'
                      }`}
                    >
                      {getCategoryDisplayName(cat, language)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SERIES EDIT CONFIRMATION MODAL */}
      {showSeriesEditConfirm && editingTransaction && (
        <SeriesConfirmModal
          isOpen={showSeriesEditConfirm}
          mode="edit"
          transaction={editingTransaction}
          subsequentCount={subsequentSeriesCount}
          currency={currency}
          language={language}
          theme={theme}
          onSelectScope={async (scope) => {
            setShowSeriesEditConfirm(false);
            await executeSave(scope);
          }}
          onCancel={() => setShowSeriesEditConfirm(false)}
        />
      )}

      {/* SERIES DELETE CONFIRMATION MODAL */}
      {showSeriesDeleteConfirm && editingTransaction && (
        <SeriesConfirmModal
          isOpen={showSeriesDeleteConfirm}
          mode="delete"
          transaction={editingTransaction}
          subsequentCount={subsequentSeriesCount}
          currency={currency}
          language={language}
          theme={theme}
          onSelectScope={(scope) => {
            setShowSeriesDeleteConfirm(false);
            if (onDelete) {
              onDelete(editingTransaction, scope);
            }
            onClose();
          }}
          onCancel={() => setShowSeriesDeleteConfirm(false)}
        />
      )}
    </>
  );
};
