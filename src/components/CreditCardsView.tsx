import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  CreditCard as CreditCardIcon,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  X,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import {
  AppLanguage,
  AppTheme,
  Category,
  CreditCard,
  CreditCardBrand,
  Transaction,
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

interface CreditCardsViewProps {
  creditCards: CreditCard[];
  transactions: Transaction[];
  categories: Category[];
  currency: string;
  language: AppLanguage;
  theme: AppTheme;
  onSaveCard: (card: Partial<CreditCard> & { name: string; totalLimit: number; closingDay: number; dueDay: number }) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onPayInvoice: (cardId: string, invoiceMonth: string) => Promise<void>;
  onOpenAddExpense: (cardId?: string) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
  onActiveCardChange?: (cardId: string | null) => void;
}

const BRAND_OPTIONS: { id: CreditCardBrand; name: string }[] = [
  { id: 'mastercard', name: 'Mastercard' },
  { id: 'visa', name: 'Visa' },
  { id: 'elo', name: 'Elo' },
  { id: 'amex', name: 'American Express' },
  { id: 'default', name: 'Outro / Genérico' },
];

const PRESET_COLORS = [
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

const formatShortNumericDate = (dateStr?: string | null): string => {
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

// Visual brand badge component
export const CardBrandBadge: React.FC<{ brand?: CreditCardBrand; className?: string }> = ({
  brand = 'default',
  className = '',
}) => {
  if (brand === 'mastercard') {
    return (
      <div className={`flex items-center -space-x-1.5 ${className}`}>
        <div className="w-4 h-4 rounded-full bg-red-600/90 shadow-xs" />
        <div className="w-4 h-4 rounded-full bg-amber-500/90 shadow-xs" />
      </div>
    );
  }
  if (brand === 'visa') {
    return (
      <span className={`font-black italic tracking-wider text-xs ${className || 'text-blue-500 dark:text-blue-200'}`}>
        VISA
      </span>
    );
  }
  if (brand === 'elo') {
    return (
      <div className={`flex items-center gap-0.5 px-1 py-0.5 rounded bg-black/50 text-[9px] font-black tracking-tight ${className}`}>
        <span className="w-1 h-1 rounded-full bg-red-500 inline-block" />
        <span className="w-1 h-1 rounded-full bg-yellow-400 inline-block" />
        <span className="w-1 h-1 rounded-full bg-blue-500 inline-block" />
        <span className="ml-0.5 text-white">elo</span>
      </div>
    );
  }
  if (brand === 'amex') {
    return (
      <span className={`px-1 py-0.5 rounded bg-sky-900 text-sky-200 text-[9px] font-black tracking-widest ${className}`}>
        AMEX
      </span>
    );
  }
  return <CreditCardIcon size={16} className={className} />;
};

/* Swipe configuration for invoice statement items */
const INVOICE_SWIPE_WIDTH = 96;
const INVOICE_SWIPE_SNAP = 40;
const INVOICE_SWIPE_MAX = 120;

interface SwipeableInvoiceItemProps {
  tx: Transaction;
  cat?: Category;
  currency: string;
  language: AppLanguage;
  isOled?: boolean;
  isOpen: boolean;
  anyRowOpen: boolean;
  onSetOpenRow: (id: string | null) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
}

const SwipeableInvoiceItem: React.FC<SwipeableInvoiceItemProps> = ({
  tx,
  cat,
  currency,
  language,
  isOled = true,
  isOpen,
  anyRowOpen,
  onSetOpenRow,
  onEditTransaction,
  onDeleteTransaction,
}) => {
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const gestureRef = useRef<{
    startX: number;
    startY: number;
    initialOffset: number;
    lock: 'none' | 'horizontal' | 'vertical';
    currentOffset: number;
    active: boolean;
  }>({
    startX: 0,
    startY: 0,
    initialOffset: 0,
    lock: 'none',
    currentOffset: 0,
    active: false,
  });

  const clampSwipeOffset = (rawOffset: number): number => {
    if (rawOffset > 0) return 0;
    if (rawOffset < -INVOICE_SWIPE_WIDTH) {
      const extra = rawOffset + INVOICE_SWIPE_WIDTH;
      return Math.max(-INVOICE_SWIPE_MAX, -INVOICE_SWIPE_WIDTH + extra * 0.25);
    }
    return rawOffset;
  };

  const finishSwipeGesture = () => {
    const g = gestureRef.current;
    if (!g.active) return;
    g.active = false;

    if (g.lock === 'horizontal') {
      const finalOffset = g.currentOffset;
      if (g.initialOffset === 0) {
        if (finalOffset <= -INVOICE_SWIPE_SNAP) {
          onSetOpenRow(tx.id);
        } else {
          onSetOpenRow(null);
        }
      } else {
        if (finalOffset > -INVOICE_SWIPE_WIDTH + 25) {
          onSetOpenRow(null);
        } else {
          onSetOpenRow(tx.id);
        }
      }
    }

    g.lock = 'none';
    setIsDragging(false);
    setDragOffset(null);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (anyRowOpen && !isOpen) {
      onSetOpenRow(null);
    }
    const initial = isOpen ? -INVOICE_SWIPE_WIDTH : 0;
    gestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initialOffset: initial,
      lock: 'none',
      currentOffset: initial,
      active: true,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g.active || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - g.startX;
    const deltaY = touch.clientY - g.startY;

    if (g.lock === 'none') {
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        g.lock = 'vertical';
        g.active = false;
        return;
      }
      g.lock = 'horizontal';
      setIsDragging(true);
    }

    if (g.lock === 'horizontal') {
      if (e.cancelable) e.preventDefault();
      const clamped = clampSwipeOffset(g.initialOffset + deltaX);
      g.currentOffset = clamped;
      setDragOffset(clamped);
    }
  };

  const handleTouchEnd = () => finishSwipeGesture();

  const translateX = dragOffset !== null ? dragOffset : isOpen ? -INVOICE_SWIPE_WIDTH : 0;
  const hasInstallment = tx.installmentTotal && tx.installmentTotal > 1;

  return (
    <div className="relative overflow-hidden select-none rounded-xl">
      {/* Background action buttons (Revealed on left swipe) */}
      <div
        className="swipe-actions-layer absolute inset-y-0 right-0 flex items-center justify-end gap-1.5 pr-2.5 z-0"
        style={{ width: `${INVOICE_SWIPE_WIDTH}px` }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSetOpenRow(null);
            onEditTransaction(tx);
          }}
          className="swipe-action-btn w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0"
          title="Editar compra"
        >
          <Pencil size={13} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSetOpenRow(null);
            onDeleteTransaction(tx);
          }}
          className="swipe-action-btn-danger w-8 h-8 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0"
          title="Excluir compra"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Foreground Swipeable Item */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={() => {
          if (isOpen) {
            onSetOpenRow(null);
          } else {
            onEditTransaction(tx);
          }
        }}
        style={{
          transform: `translate3d(${translateX}px, 0, 0)`,
          transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          willChange: isDragging || isOpen ? 'transform' : 'auto',
        }}
        className={`swipe-foreground-layer relative z-10 flex items-center justify-between p-3 transition-colors gap-2.5 cursor-pointer border rounded-xl ${
          isOled
            ? 'bg-[#0D1117] border-[#21262D] hover:bg-[#161B22]/60'
            : 'bg-white border-slate-200 hover:bg-slate-50 shadow-xs'
        }`}
      >
        {/* Left: Category Icon & Purchase Info */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <CategoryIcon
            icon={cat?.icon || 'Tag'}
            color={cat?.color || '#94A3B8'}
            size={16}
            badgeSize="md"
          />

          <div className="min-w-0 flex-1">
            <p className={`text-xs sm:text-sm font-semibold truncate leading-snug ${
              isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
            }`}>
              {tx.description}
            </p>

            <div className={`flex items-center gap-1.5 flex-wrap text-[11px] mt-0.5 leading-none ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-500'
            }`}>
              <span className={`font-medium truncate max-w-[120px] ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-600'
              }`}>
                {getCategoryDisplayName(cat, language)}
              </span>

              {hasInstallment && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                  isOled
                    ? 'bg-[#161B22] border-[#21262D] text-[#D0B595]'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}>
                  {tx.installmentCurrent || 1}/{tx.installmentTotal}
                </span>
              )}

              {tx.notes && (
                <>
                  <span>•</span>
                  <span className={`italic truncate max-w-[120px] ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}>{tx.notes}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Amount & Short Numeric Date Stack */}
        <div className="flex flex-col items-end justify-center text-right shrink-0 pl-1">
          <span className="text-sm font-semibold text-[#EF4444] whitespace-nowrap leading-tight">
            -{formatCurrency(tx.amount, currency)}
          </span>
          <span className={`text-xs mt-0.5 whitespace-nowrap leading-none ${
            isOled ? 'text-[#94A3B8]' : 'text-slate-500'
          }`}>
            {formatShortNumericDate(tx.purchaseDate || tx.date)}
          </span>
        </div>
      </div>
    </div>
  );
};

export const CreditCardsView: React.FC<CreditCardsViewProps> = ({
  creditCards,
  transactions,
  categories,
  currency,
  language,
  theme,
  onSaveCard,
  onDeleteCard,
  onPayInvoice,
  onOpenAddExpense,
  onEditTransaction,
  onDeleteTransaction,
  onActiveCardChange,
}) => {
  const t = TRANSLATIONS[language];
  const isOled = theme === 'oled';
  const todayStr = getTodayDateStr();
  const currentMonthStr = todayStr.slice(0, 7);

  // Active Carousel Index
  const [activeIndex, setActiveIndex] = useState<number>(0);

  // Selected month for card statement view (defaults to current month)
  const [statementMonth, setStatementMonth] = useState<string>(currentMonthStr);

  // Active open swipe row id in invoice statement
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  // Card Add/Edit Modal state
  const [cardModalOpen, setCardModalOpen] = useState<boolean>(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [cardFormName, setCardFormName] = useState<string>('');
  const [cardFormLimit, setCardFormLimit] = useState<string>('');
  const [cardFormClosingDay, setCardFormClosingDay] = useState<string>('25');
  const [cardFormDueDay, setCardFormDueDay] = useState<string>('5');
  const [cardFormBrand, setCardFormBrand] = useState<CreditCardBrand>('mastercard');
  const [cardFormColor, setCardFormColor] = useState<string>(PRESET_COLORS[0]);
  const [cardFormLastDigits, setCardFormLastDigits] = useState<string>('');
  const [cardFormSubmitting, setCardFormSubmitting] = useState<boolean>(false);

  // Delete Card modal state
  const [deleteConfirmCardId, setDeleteConfirmCardId] = useState<string | null>(null);
  const [payingInvoiceCycle, setPayingInvoiceCycle] = useState<{ cardId: string; invoiceMonth: string } | null>(null);
  const [payingSubmitting, setPayingSubmitting] = useState<boolean>(false);

  // Keep activeIndex within bounds
  useEffect(() => {
    if (creditCards.length === 0) {
      setActiveIndex(0);
    } else if (activeIndex >= creditCards.length) {
      setActiveIndex(creditCards.length - 1);
    }
  }, [creditCards.length, activeIndex]);

  const activeCard = useMemo(() => {
    return creditCards[activeIndex] || creditCards[0] || null;
  }, [creditCards, activeIndex]);

  useEffect(() => {
    onActiveCardChange?.(activeCard?.id || null);
  }, [activeCard?.id, onActiveCardChange]);

  // Helper to determine the invoiceMonth of any card transaction
  const getTxInvoiceMonth = (tx: Transaction, card: CreditCard): string => {
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

  // Compute card metrics for all cards
  const cardsMetrics = useMemo(() => {
    return creditCards.map((card) => {
      const cardTxs = transactions.filter((tx) => tx.cardId === card.id);

      // Identify settled billing cycles
      const settledMonths = new Set<string>();
      transactions.forEach((tx) => {
        if (
          tx.settledInvoiceKey &&
          tx.status === 'paid' &&
          tx.settledInvoiceKey.startsWith(`${card.id}__`)
        ) {
          const monthPart = tx.settledInvoiceKey.split('__')[1];
          if (monthPart) settledMonths.add(monthPart);
        }
      });

      // Used limit: active unpaid purchases
      const usedLimit = Number(
        cardTxs
          .reduce((sum, tx) => {
            const invMonth = getTxInvoiceMonth(tx, card);
            const isPaid = tx.status === 'paid' || settledMonths.has(invMonth);
            if (!isPaid) {
              return sum + Number(tx.amount || 0);
            }
            return sum;
          }, 0)
          .toFixed(2)
      );

      const availableLimit = Math.max(0, Number((card.totalLimit - usedLimit).toFixed(2)));
      const usedPercentage =
        card.totalLimit > 0 ? Math.min(100, Math.round((usedLimit / card.totalLimit) * 100)) : 0;

      // Current month invoice total
      const currentInvoiceTotal = Number(
        cardTxs
          .reduce((sum, tx) => {
            const invMonth = getTxInvoiceMonth(tx, card);
            if (invMonth === currentMonthStr) {
              return sum + Number(tx.amount || 0);
            }
            return sum;
          }, 0)
          .toFixed(2)
      );

      // Next month invoice total
      const nextMonthStr = shiftMonth(currentMonthStr, 1);
      const nextInvoiceTotal = Number(
        cardTxs
          .reduce((sum, tx) => {
            const invMonth = getTxInvoiceMonth(tx, card);
            if (invMonth === nextMonthStr) {
              return sum + Number(tx.amount || 0);
            }
            return sum;
          }, 0)
          .toFixed(2)
      );

      // Check current invoice settlement
      const currentSettledKey = `${card.id}__${currentMonthStr}`;
      const settlementTx = transactions.find((tx) => tx.settledInvoiceKey === currentSettledKey);
      const isCurrentInvoiceSettled = Boolean(settlementTx && settlementTx.status === 'paid');
      const isCurrentInvoicePending = Boolean(settlementTx && settlementTx.status === 'unpaid');

      return {
        card,
        usedLimit,
        availableLimit,
        usedPercentage,
        currentInvoiceTotal,
        nextInvoiceTotal,
        settlementTx,
        isCurrentInvoiceSettled,
        isCurrentInvoicePending,
      };
    });
  }, [creditCards, transactions, currentMonthStr]);

  // Consolidated Global Limits Summary
  const consolidated = useMemo(() => {
    let totalLimit = 0;
    let totalUsed = 0;

    cardsMetrics.forEach((m) => {
      totalLimit += m.card.totalLimit;
      totalUsed += m.usedLimit;
    });

    totalLimit = Number(totalLimit.toFixed(2));
    totalUsed = Number(totalUsed.toFixed(2));
    const totalAvailable = Math.max(0, Number((totalLimit - totalUsed).toFixed(2)));
    const combinedPercentage =
      totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0;

    return {
      totalLimit,
      totalUsed,
      totalAvailable,
      combinedPercentage,
    };
  }, [cardsMetrics]);

  // Active Card Metrics
  const activeMetric = useMemo(() => {
    if (!activeCard) return null;
    return cardsMetrics.find((m) => m.card.id === activeCard.id) || null;
  }, [activeCard, cardsMetrics]);

  // Statement transactions for active card and selected statementMonth
  const statementData = useMemo(() => {
    if (!activeCard) {
      return {
        txs: [],
        total: 0,
        isSettled: false,
        isPendingPayment: false,
      };
    }

    const txs = transactions
      .filter((tx) => tx.cardId === activeCard.id && getTxInvoiceMonth(tx, activeCard) === statementMonth)
      .sort((a, b) => (b.purchaseDate || b.date).localeCompare(a.purchaseDate || a.date));

    const total = Number(txs.reduce((sum, tx) => sum + Number(tx.amount || 0), 0).toFixed(2));

    const settlementKey = `${activeCard.id}__${statementMonth}`;
    const settlementTx = transactions.find((tx) => tx.settledInvoiceKey === settlementKey) || null;
    const isSettled = Boolean(settlementTx && settlementTx.status === 'paid');
    const isPendingPayment = Boolean(settlementTx && settlementTx.status === 'unpaid');

    return {
      txs,
      total,
      isSettled,
      isPendingPayment,
    };
  }, [activeCard, transactions, statementMonth]);

  // Invoice cycle status badge helper
  const invoiceCycleStatus = useMemo(() => {
    if (!activeCard) return { label: 'Aberta', color: 'sky' };
    if (statementData.isSettled) return { label: 'Fatura Paga', color: 'emerald' };
    if (statementData.isPendingPayment) return { label: 'Pagamento Agendado', color: 'amber' };

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
  }, [activeCard, statementData.isSettled, statementData.isPendingPayment, statementMonth]);

  // Carousel Swipe Gesture Handling
  const [carouselDragOffset, setCarouselDragOffset] = useState<number>(0);
  const [isCarouselDragging, setIsCarouselDragging] = useState<boolean>(false);
  const carouselTouchStartRef = useRef<{ x: number; y: number; active: boolean; lock: 'none' | 'h' | 'v' }>({
    x: 0,
    y: 0,
    active: false,
    lock: 'none',
  });

  const handleCarouselTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1 || creditCards.length <= 1) return;
    const touch = e.touches[0];
    carouselTouchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      active: true,
      lock: 'none',
    };
  };

  const handleCarouselTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const s = carouselTouchStartRef.current;
    if (!s.active || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - s.x;
    const deltaY = touch.clientY - s.y;

    if (s.lock === 'none') {
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        s.lock = 'v';
        s.active = false;
        return;
      }
      s.lock = 'h';
      setIsCarouselDragging(true);
    }

    if (s.lock === 'h') {
      if (e.cancelable) e.preventDefault();
      // Apply rubber-band damping at carousel boundaries
      let damped = deltaX;
      if (activeIndex === 0 && deltaX > 0) {
        damped = deltaX * 0.25;
      } else if (activeIndex === creditCards.length - 1 && deltaX < 0) {
        damped = deltaX * 0.25;
      }
      setCarouselDragOffset(damped);
    }
  };

  const handleCarouselTouchEnd = () => {
    const s = carouselTouchStartRef.current;
    if (!s.active) return;
    s.active = false;

    if (s.lock === 'h') {
      const threshold = 45;
      if (carouselDragOffset < -threshold && activeIndex < creditCards.length - 1) {
        setActiveIndex((prev) => prev + 1);
      } else if (carouselDragOffset > threshold && activeIndex > 0) {
        setActiveIndex((prev) => prev - 1);
      }
    }

    s.lock = 'none';
    setIsCarouselDragging(false);
    setCarouselDragOffset(0);
  };

  // Handlers for Add/Edit Card Modal
  const openAddCardModal = () => {
    setEditingCard(null);
    setCardFormName('');
    setCardFormLimit('5000');
    setCardFormClosingDay('25');
    setCardFormDueDay('5');
    setCardFormBrand('mastercard');
    setCardFormColor(PRESET_COLORS[creditCards.length % PRESET_COLORS.length]);
    setCardFormLastDigits('');
    setCardModalOpen(true);
  };

  const openEditCardModal = (card: CreditCard, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCard(card);
    setCardFormName(card.name);
    setCardFormLimit(String(card.totalLimit));
    setCardFormClosingDay(String(card.closingDay));
    setCardFormDueDay(String(card.dueDay));
    setCardFormBrand(card.brand || 'mastercard');
    setCardFormColor(card.color || PRESET_COLORS[0]);
    setCardFormLastDigits(card.lastDigits || '');
    setCardModalOpen(true);
  };

  const handleSaveCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLimit = parseFloat(cardFormLimit.replace(',', '.'));
    const parsedClosing = Math.min(31, Math.max(1, parseInt(cardFormClosingDay, 10) || 1));
    const parsedDue = Math.min(31, Math.max(1, parseInt(cardFormDueDay, 10) || 1));

    if (!cardFormName.trim() || Number.isNaN(parsedLimit) || parsedLimit <= 0) return;

    setCardFormSubmitting(true);
    try {
      await onSaveCard({
        id: editingCard?.id,
        name: cardFormName.trim(),
        totalLimit: parsedLimit,
        closingDay: parsedClosing,
        dueDay: parsedDue,
        brand: cardFormBrand,
        color: cardFormColor,
        lastDigits: cardFormLastDigits.trim().slice(-4),
      });
      setCardModalOpen(false);
    } finally {
      setCardFormSubmitting(false);
    }
  };

  // Handlers for Pay Invoice
  const handleConfirmPayInvoice = async () => {
    if (!payingInvoiceCycle) return;
    setPayingSubmitting(true);
    try {
      await onPayInvoice(payingInvoiceCycle.cardId, payingInvoiceCycle.invoiceMonth);
      setPayingInvoiceCycle(null);
    } finally {
      setPayingSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-fadeIn max-w-lg mx-auto w-full">
      {/* 1. Compact Top Action Bar: Lean Global Limits + Novo Cartão */}
      <div className="flex items-center justify-between gap-2.5 px-0.5">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar min-w-0">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs shrink-0 ${
            isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <span className={`text-[11px] font-medium ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Limite:</span>
            <span className={`font-bold ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
              {formatCurrency(consolidated.totalLimit, currency)}
            </span>
          </div>

          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs shrink-0 ${
            isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200 shadow-xs'
          }`}>
            <span className={`text-[11px] font-medium ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>Disponível:</span>
            <span className="font-bold text-[#10B981]">
              {formatCurrency(consolidated.totalAvailable, currency)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={openAddCardModal}
          className="shrink-0 flex items-center gap-1.5 py-2 px-3.5 text-xs rounded-xl font-medium bg-[#6E5440] hover:bg-[#7E624B] text-[#FFFDF5] border border-[#8A6F57]/40 shadow-xs transition-all active:scale-95"
        >
          <Plus size={14} />
          <span>Adicionar Cartão</span>
        </button>
      </div>

      {/* 2. Interactive Single-Card Carousel or Empty State */}
      {creditCards.length === 0 ? (
        <div className={`p-8 rounded-2xl border border-dashed text-center space-y-3 ${
          isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-300 shadow-xs'
        }`}>
          <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${
            isOled ? 'bg-[#161B22] text-[#D0B595]' : 'bg-slate-100 text-[#6E5440]'
          }`}>
            <CreditCardIcon size={24} />
          </div>
          <p className={`text-sm font-semibold ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
            {t.noCardsRegisteredYet || 'Nenhum cartão cadastrado'}
          </p>
          <p className={`text-xs max-w-sm mx-auto ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
            {t.noCardsRegisteredDesc || 'Adicione seus cartões para acompanhar limites, faturas e parcelas.'}
          </p>
          <button
            type="button"
            onClick={openAddCardModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6E5440] hover:bg-[#7E624B] text-white text-xs font-bold transition-colors active:scale-95"
          >
            <Plus size={15} />
            <span>Adicionar Cartão</span>
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {/* Carousel Viewport Container */}
          <div className="relative w-full max-w-[400px] mx-auto px-3.5 sm:px-4">
            <div
              className="relative w-full overflow-hidden touch-pan-y rounded-2xl"
              onTouchStart={handleCarouselTouchStart}
              onTouchMove={handleCarouselTouchMove}
              onTouchEnd={handleCarouselTouchEnd}
              onTouchCancel={handleCarouselTouchEnd}
            >
              <div
                className="flex w-full"
                style={{
                  transform: `translate3d(calc(-${activeIndex * 100}% + ${carouselDragOffset}px), 0, 0)`,
                  transition: isCarouselDragging ? 'none' : 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)',
                  willChange: isCarouselDragging ? 'transform' : 'auto',
                }}
              >
                {creditCards.map((card) => {
                  const metric = cardsMetrics.find((m) => m.card.id === card.id) || {
                    usedLimit: 0,
                    availableLimit: card.totalLimit,
                    usedPercentage: 0,
                    currentInvoiceTotal: 0,
                  };

                  return (
                    <div key={card.id} className="w-full shrink-0">
                      <div className={`relative rounded-2xl p-5 sm:p-6 min-h-[215px] sm:min-h-[225px] border overflow-hidden flex flex-col justify-between transition-colors ${
                        isOled
                          ? 'bg-[#0D1117] border-[#21262D] shadow-xl text-[#F8FAFC]'
                          : 'bg-white border-slate-200 shadow-lg shadow-slate-300/50 text-slate-900'
                      }`}>
                        {/* Top ambient color edge accent */}
                        <div
                          className="absolute top-0 left-0 right-0 h-1.5 opacity-90"
                          style={{ backgroundColor: card.color || '#6E5440' }}
                        />

                        {/* Top Row: Nickname/Bank + Chip/Brand + Edit/Delete */}
                        <div className="flex items-center justify-between gap-3 pt-1">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0"
                              style={{ backgroundColor: card.color || '#6E5440' }}
                            >
                              <CardBrandBadge brand={card.brand} />
                            </div>
                            <div className="min-w-0">
                              <h3 className={`text-sm sm:text-base font-bold truncate ${
                                isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                              }`}>
                                {card.name}
                              </h3>
                              {card.lastDigits && (
                                <span className={`text-[11px] font-mono block mt-0.5 ${
                                  isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                                }`}>
                                  •••• {card.lastDigits}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => openEditCardModal(card, e)}
                              className={`p-2 rounded-xl border border-transparent transition-colors ${
                                isOled
                                  ? 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#161B22] hover:border-[#21262D]'
                                  : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100 hover:border-slate-200'
                              }`}
                              title={t.editCardBtn || 'Editar cartão'}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmCardId(card.id);
                              }}
                              className={`p-2 rounded-xl border border-transparent transition-colors ${
                                isOled
                                  ? 'text-[#94A3B8] hover:text-rose-400 hover:bg-[#161B22] hover:border-[#21262D]'
                                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200'
                              }`}
                              title={t.deleteCardBtn || 'Excluir cartão'}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Middle Row: Fatura Atual + Limit Progress Indicator */}
                        <div className="my-auto py-3 space-y-2.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className={`text-[11px] uppercase font-bold tracking-wider ${
                              isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                            }`}>
                              Fatura Atual
                            </span>
                            <span className={`text-xl sm:text-2xl font-black tracking-tight ${
                              isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                            }`}>
                              {formatCurrency(metric.currentInvoiceTotal, currency)}
                            </span>
                          </div>

                          {/* Available limit bar */}
                          <div className="space-y-1.5">
                            <div className={`h-2.5 w-full rounded-full overflow-hidden p-0.5 border ${
                              isOled ? 'bg-[#161B22] border-[#21262D]' : 'bg-slate-100 border-slate-200'
                            }`}>
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  metric.usedPercentage > 85
                                    ? 'bg-[#EF4444]'
                                    : metric.usedPercentage > 65
                                    ? 'bg-[#F59E0B]'
                                    : 'bg-[#10B981]'
                                }`}
                                style={{ width: `${Math.min(100, metric.usedPercentage)}%` }}
                              />
                            </div>

                            <div className={`flex items-center justify-between text-xs ${
                              isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                            }`}>
                              <span>
                                Disponível:{' '}
                                <strong className="text-[#10B981] font-semibold">
                                  {formatCurrency(metric.availableLimit, currency)}
                                </strong>
                              </span>
                              <span>{metric.usedPercentage}% usado</span>
                            </div>
                          </div>
                        </div>

                        {/* Bottom Row: Closing & Due Tags + Total Limit */}
                        <div className={`pt-3 border-t flex items-center justify-between text-xs ${
                          isOled ? 'border-[#21262D] text-[#94A3B8]' : 'border-slate-200 text-slate-500'
                        }`}>
                          <div className="flex items-center gap-1.5 text-[11px] font-medium">
                            <span className={`px-2.5 py-1 rounded-lg border ${
                              isOled ? 'bg-[#161B22] border-[#21262D] text-[#E2E8F0]' : 'bg-slate-100 border-slate-200 text-slate-700'
                            }`}>
                              Fecha dia <strong>{card.closingDay}</strong> • Vence dia <strong>{card.dueDay}</strong>
                            </span>
                          </div>

                          <span className={`text-xs font-semibold ${
                            isOled ? 'text-[#E2E8F0]' : 'text-slate-700'
                          }`}>
                            Limite: {formatCurrency(card.totalLimit, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Left/Right Chevron Tap Controls if multiple cards */}
            {creditCards.length > 1 && (
              <>
                {activeIndex > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
                    className={`absolute -left-1 sm:-left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center border transition-all active:scale-90 z-20 ${
                      isOled
                        ? 'bg-[#161B22]/90 backdrop-blur-xs text-[#94A3B8] hover:text-[#F8FAFC] border-[#21262D] shadow-md'
                        : 'bg-white/95 backdrop-blur-xs text-slate-600 hover:text-slate-900 border-slate-200 shadow-md'
                    }`}
                    aria-label="Cartão anterior"
                  >
                    <ChevronLeft size={16} />
                  </button>
                )}
                {activeIndex < creditCards.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setActiveIndex((i) => Math.min(creditCards.length - 1, i + 1))}
                    className={`absolute -right-1 sm:-right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center border transition-all active:scale-90 z-20 ${
                      isOled
                        ? 'bg-[#161B22]/90 backdrop-blur-xs text-[#94A3B8] hover:text-[#F8FAFC] border-[#21262D] shadow-md'
                        : 'bg-white/95 backdrop-blur-xs text-slate-600 hover:text-slate-900 border-slate-200 shadow-md'
                    }`}
                    aria-label="Próximo cartão"
                  >
                    <ChevronRight size={16} />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Centered Pagination Dots */}
          {creditCards.length > 1 && (
            <div className="flex justify-center items-center gap-1.5 py-2.5">
              {creditCards.map((card, idx) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  aria-label={`Ir para ${card.name}`}
                  className={`transition-all duration-300 ${
                    activeIndex === idx
                      ? 'w-4 h-1.5 rounded-full bg-[#6E5440]'
                      : isOled
                      ? 'w-1.5 h-1.5 rounded-full bg-[#21262D] hover:bg-[#475569]'
                      : 'w-1.5 h-1.5 rounded-full bg-slate-300 hover:bg-slate-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. Synchronized Invoice Statement (Extrato da Fatura) */}
      {activeCard && (
        <div className={`rounded-2xl p-4 border space-y-3.5 transition-colors ${
          isOled
            ? 'bg-[#0D1117] border-[#21262D] shadow-xl text-[#F8FAFC]'
            : 'bg-white border-slate-200 shadow-sm text-slate-900'
        }`}>
          {/* Invoice Header Bar */}
          <div className={`space-y-3 pb-3 border-b ${
            isOled ? 'border-[#21262D]' : 'border-slate-200'
          }`}>
            <div className="flex items-center justify-between gap-2">
              {/* Cycle Status Badge + Month Switcher */}
              <div className="flex items-center gap-2">
                <span
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                    invoiceCycleStatus.color === 'emerald'
                      ? isOled
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : invoiceCycleStatus.color === 'amber'
                      ? isOled
                        ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                        : 'bg-amber-50 border-amber-200 text-amber-700'
                      : isOled
                      ? 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                      : 'bg-sky-50 border-sky-200 text-sky-700'
                  }`}
                >
                  {statementData.isSettled ? (
                    <CheckCircle2 size={13} />
                  ) : statementData.isPendingPayment ? (
                    <Clock size={13} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
                  )}
                  <span>{invoiceCycleStatus.label}</span>
                </span>

                {/* Month Switcher Controls */}
                <div className={`flex items-center rounded-xl border p-0.5 ${
                  isOled ? 'bg-[#161B22] border-[#21262D]' : 'bg-slate-100 border-slate-200'
                }`}>
                  <button
                    type="button"
                    onClick={() => setStatementMonth((m) => shiftMonth(m, -1))}
                    className={`p-1 rounded-lg transition-colors ${
                      isOled ? 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#21262D]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                    title={t.prevMonthBtn || 'Mês anterior'}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <span className={`text-xs font-bold px-2 min-w-[110px] text-center capitalize ${
                    isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                  }`}>
                    {formatMonthLabel(statementMonth, language)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStatementMonth((m) => shiftMonth(m, 1))}
                    className={`p-1 rounded-lg transition-colors ${
                      isOled ? 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#21262D]' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                    title={t.nextMonthBtn || 'Próximo mês'}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Invoice Total Sum */}
              <div className="text-right">
                <p className={`text-base sm:text-lg font-black ${
                  isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                }`}>
                  {formatCurrency(statementData.total, currency)}
                </p>
                <span className={`text-[11px] block ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                }`}>
                  {statementData.txs.length} {statementData.txs.length === 1 ? 'compra' : 'compras'}
                </span>
              </div>
            </div>

            {/* Quick Actions Row */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenAddExpense(activeCard.id)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors active:scale-95 ${
                  isOled
                    ? 'bg-[#161B22] hover:bg-[#21262D] text-[#F8FAFC] border-[#21262D]'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200 shadow-xs'
                }`}
              >
                <Plus size={14} />
                <span>Lançar Despesa</span>
              </button>

              <button
                type="button"
                disabled={statementData.total <= 0 || statementData.isSettled}
                onClick={() =>
                  setPayingInvoiceCycle({
                    cardId: activeCard.id,
                    invoiceMonth: statementMonth,
                  })
                }
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                  statementData.isSettled
                    ? isOled
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 cursor-default'
                      : 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                    : statementData.isPendingPayment
                    ? isOled
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                    : statementData.total > 0
                    ? 'bg-[#10B981] hover:bg-[#059669] text-white shadow-xs active:scale-95'
                    : isOled
                    ? 'bg-[#161B22] text-[#94A3B8] opacity-60 border border-[#21262D] cursor-not-allowed'
                    : 'bg-slate-100 text-slate-400 opacity-60 border border-slate-200 cursor-not-allowed'
                }`}
              >
                {statementData.isSettled ? (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Fatura Paga</span>
                  </>
                ) : statementData.isPendingPayment ? (
                  <>
                    <Clock size={13} />
                    <span>Agendada</span>
                  </>
                ) : (
                  <>
                    <DollarSign size={13} />
                    <span>Pagar Fatura</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Statement Items List with Swipe-to-Reveal */}
          {statementData.txs.length === 0 ? (
            <div className={`p-7 rounded-xl border text-center space-y-2 ${
              isOled ? 'bg-[#161B22]/50 border-[#21262D]' : 'bg-slate-50 border-slate-200'
            }`}>
              <p className={`text-xs font-semibold ${isOled ? 'text-[#94A3B8]' : 'text-slate-600'}`}>
                Nenhuma compra lançada nesta fatura.
              </p>
              <button
                type="button"
                onClick={() => onOpenAddExpense(activeCard.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  isOled
                    ? 'bg-[#6E5440]/20 hover:bg-[#6E5440]/30 text-[#D0B595] border-[#6E5440]/40'
                    : 'bg-[#6E5440]/10 hover:bg-[#6E5440]/20 text-[#6E5440] border-[#6E5440]/30'
                }`}
              >
                <Plus size={13} />
                <span>Lançar Compra</span>
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {statementData.txs.map((tx) => {
                const cat = categories.find((c) => c.id === tx.categoryId);
                return (
                  <SwipeableInvoiceItem
                    key={tx.id}
                    tx={tx}
                    cat={cat}
                    currency={currency}
                    language={language}
                    isOled={isOled}
                    isOpen={openRowId === tx.id}
                    anyRowOpen={openRowId !== null}
                    onSetOpenRow={setOpenRowId}
                    onEditTransaction={onEditTransaction}
                    onDeleteTransaction={onDeleteTransaction}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: Register / Edit Credit Card */}
      {cardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn">
          <div className={`border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
            isOled ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className={`flex items-center justify-between px-5 py-4 border-b ${
              isOled ? 'border-[#21262D]' : 'border-slate-200'
            }`}>
              <h3 className={`text-base font-bold flex items-center gap-2 ${
                isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
              }`}>
                <CreditCardIcon size={18} className="text-[#D0B595]" />
                <span>{editingCard ? t.editCardModalTitle || 'Editar Cartão' : t.addCardModalTitle || 'Novo Cartão'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setCardModalOpen(false)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isOled ? 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#161B22]' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCardSubmit} className="p-5 space-y-4">
              {/* Card Name */}
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                }`}>
                  {t.cardNameLabel || 'Nome do Cartão'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Nubank Felipe, Inter Isabelle"
                  value={cardFormName}
                  onChange={(e) => setCardFormName(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                    isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
                  }`}
                />
              </div>

              {/* Total Limit */}
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                }`}>
                  {t.totalLimitLabel || 'Limite Total'} ({currency})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="5000.00"
                  value={cardFormLimit}
                  onChange={(e) => setCardFormLimit(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                    isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
                  }`}
                />
              </div>

              {/* Closing Day & Due Day */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                  }`}>
                    {t.closingDayLabel || 'Dia Fechamento'} (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={cardFormClosingDay}
                    onChange={(e) => setCardFormClosingDay(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                      isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
                    }`}
                  />
                  <span className={`text-[10px] mt-1 block ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}>
                    {t.closingDayHint || 'Compras a partir deste dia vão para o mês seguinte'}
                  </span>
                </div>

                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                  }`}>
                    {t.dueDayLabel || 'Dia Vencimento'} (1-31)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={cardFormDueDay}
                    onChange={(e) => setCardFormDueDay(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                      isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
                    }`}
                  />
                  <span className={`text-[10px] mt-1 block ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}>
                    {t.dueDayHint || 'Data limite para pagamento da fatura'}
                  </span>
                </div>
              </div>

              {/* Card Brand */}
              <div>
                <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                }`}>
                  {t.cardBrandLabel || 'Bandeira'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {BRAND_OPTIONS.map((brand) => (
                    <button
                      key={brand.id}
                      type="button"
                      onClick={() => setCardFormBrand(brand.id)}
                      className={`p-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                        cardFormBrand === brand.id
                          ? 'bg-[#6E5440] text-white border-[#8A6F57] shadow-xs'
                          : isOled
                          ? 'bg-[#161B22] border-[#21262D] text-[#E2E8F0] hover:bg-[#21262D]'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <CardBrandBadge brand={brand.id} />
                      <span className="truncate">{brand.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Color & Last 4 Digits */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                  }`}>
                    {t.cardColorLabel || 'Cor do Cartão'}
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRESET_COLORS.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setCardFormColor(col)}
                        className={`w-6 h-6 rounded-full transition-transform ${
                          cardFormColor === col
                            ? 'ring-2 ring-white scale-110 shadow-xs'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                  }`}>
                    {t.cardLastDigitsLabel || 'Últimos 4 Dígitos'}
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="1234"
                    value={cardFormLastDigits}
                    onChange={(e) => setCardFormLastDigits(e.target.value.replace(/\D/g, ''))}
                    className={`w-full px-3.5 py-2 rounded-xl border text-sm font-mono text-center focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
                      isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
                    }`}
                  />
                </div>
              </div>

              {/* Modal Actions */}
              <div className={`flex items-center gap-3 pt-3 border-t ${
                isOled ? 'border-[#21262D]' : 'border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={() => setCardModalOpen(false)}
                  className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold transition-colors ${
                    isOled ? 'border-[#21262D] text-[#94A3B8] hover:bg-[#161B22]' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t.cancelBtn || 'Cancelar'}
                </button>
                <button
                  type="submit"
                  disabled={cardFormSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#6E5440] hover:bg-[#7E624B] text-white text-xs font-bold shadow-xs transition-all active:scale-95"
                >
                  {cardFormSubmitting ? (t.savingBtn || 'Salvando...') : (t.saveCardBtn || 'Salvar Cartão')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Card Confirmation */}
      {deleteConfirmCardId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn">
          <div className={`border w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 ${
            isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className={`text-base font-bold ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
                  {t.deleteCardModalTitle || 'Excluir Cartão'}
                </h3>
                <p className={`text-xs mt-0.5 ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                  {t.deleteCardModalDesc || 'Tem certeza de que deseja remover este cartão?'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmCardId(null)}
                className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold transition-colors ${
                  isOled ? 'border-[#21262D] text-[#94A3B8] hover:bg-[#161B22]' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.cancelBtn || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteConfirmCardId;
                  setDeleteConfirmCardId(null);
                  await onDeleteCard(id);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
              >
                {t.confirmDeleteCardBtn || 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Pay Invoice Confirmation */}
      {payingInvoiceCycle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn">
          <div className={`border w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 ${
            isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#6E5440]/20 text-[#D0B595]">
                <DollarSign size={22} />
              </div>
              <div>
                <h3 className={`text-base font-bold ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
                  {t.payInvoiceConfirmTitle || 'Confirmar Pagamento de Fatura'}
                </h3>
                <p className={`text-xs mt-0.5 ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                  {t.payInvoiceConfirmDesc?.(
                    creditCards.find((c) => c.id === payingInvoiceCycle.cardId)?.name || '',
                    formatMonthLabel(payingInvoiceCycle.invoiceMonth, language)
                  ) || 'Gerar despesa no extrato bancário para esta fatura?'}
                </p>
              </div>
            </div>

            <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
              isOled ? 'bg-[#161B22] border-[#21262D] text-[#E2E8F0]' : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <p className={`font-semibold ${isOled ? 'text-[#D0B595]' : 'text-[#6E5440]'}`}>Como funciona:</p>
              <p className={`text-[11px] leading-relaxed ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
                {t.payInvoiceHowItWorksDesc ||
                  'Uma despesa consolidada será criada no extrato principal com a data de vencimento da fatura. Ao marcá-la como paga, seu saldo bancário será debitado e o limite do cartão será liberado.'}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPayingInvoiceCycle(null)}
                className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold transition-colors ${
                  isOled ? 'border-[#21262D] text-[#94A3B8] hover:bg-[#161B22]' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t.cancelBtn || 'Cancelar'}
              </button>
              <button
                type="button"
                disabled={payingSubmitting}
                onClick={handleConfirmPayInvoice}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold shadow-xs transition-all active:scale-95"
              >
                {payingSubmitting
                  ? (t.generatingInvoicePayment || 'Gerando...')
                  : (t.confirmPayInvoiceBtn || 'Confirmar Pagamento')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
