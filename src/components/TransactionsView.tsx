import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  SlidersHorizontal,
  X,
  Download,
  Pencil,
  Trash2,
  Clock,
  ThumbsUp,
  CreditCard as CreditCardIcon,
  Repeat,
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
  Eye,
  EyeOff,
} from 'lucide-react';
import { AppLanguage, Category, CreditCard, Transaction, TransactionType } from '../types';
import {
  exportTransactionsToCSV,
  formatCurrency,
  formatMonthLabel,
} from '../utils/format';
import { getCategoryDisplayName, TRANSLATIONS } from '../utils/i18n';
import { CategoryIcon } from './CategoryIcon';

export type FilterChipId = 'all' | 'pending-expense' | 'pending-income' | 'paid-expense' | 'paid-income';

const PAGE_SIZE = 30;
const SWIPE_REVEAL_WIDTH = 140;
const SWIPE_SNAP_THRESHOLD = 55;
const SWIPE_MAX_DRAG = 165;

const formatNumericDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(date.getTime())) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

interface SwipeableTransactionRowProps {
  tx: Transaction;
  cat?: Category;
  cardObj?: CreditCard | null;
  currency: string;
  language: AppLanguage;
  isOpen: boolean;
  anyRowOpen: boolean;
  onSetOpenRow: (id: string | null) => void;
  onOpenEditModal: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
  onToggleTransactionStatus: (tx: Transaction) => Promise<void>;
}

const SwipeableTransactionRow: React.FC<SwipeableTransactionRowProps> = ({
  tx,
  cat,
  cardObj,
  currency,
  language,
  isOpen,
  anyRowOpen,
  onSetOpenRow,
  onOpenEditModal,
  onDeleteTransaction,
  onToggleTransactionStatus,
}) => {
  const t = TRANSLATIONS[language];
  const isUnpaid = tx.status === 'unpaid';

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

  const lastSwipeTimeRef = useRef<number>(0);

  const clampSwipeOffset = (rawOffset: number): number => {
    if (rawOffset > 0) return 0;
    if (rawOffset < -SWIPE_REVEAL_WIDTH) {
      const extra = rawOffset + SWIPE_REVEAL_WIDTH;
      return Math.max(-SWIPE_MAX_DRAG, -SWIPE_REVEAL_WIDTH + extra * 0.25);
    }
    return rawOffset;
  };

  const finishSwipeGesture = () => {
    const g = gestureRef.current;
    if (!g.active) return;
    g.active = false;

    if (g.lock === 'horizontal') {
      lastSwipeTimeRef.current = Date.now();
      const finalOffset = g.currentOffset;
      if (g.initialOffset === 0) {
        if (finalOffset <= -SWIPE_SNAP_THRESHOLD) {
          onSetOpenRow(tx.id);
        } else {
          onSetOpenRow(null);
        }
      } else {
        // Started open (-SWIPE_REVEAL_WIDTH): close if user dragged right by > 35px
        if (finalOffset > -SWIPE_REVEAL_WIDTH + 35) {
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
    const initial = isOpen ? -SWIPE_REVEAL_WIDTH : 0;
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
      const next = clampSwipeOffset(g.initialOffset + deltaX);
      g.currentOffset = next;
      setDragOffset(next);
    }
  };

  const handleTouchEnd = () => {
    finishSwipeGesture();
  };

  // Desktop mouse click-and-drag fallback
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (anyRowOpen && !isOpen) {
      onSetOpenRow(null);
    }
    const initial = isOpen ? -SWIPE_REVEAL_WIDTH : 0;
    gestureRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialOffset: initial,
      lock: 'none',
      currentOffset: initial,
      active: true,
    };

    const handleWindowMouseMove = (ev: MouseEvent) => {
      const g = gestureRef.current;
      if (!g.active) return;
      const deltaX = ev.clientX - g.startX;
      const deltaY = ev.clientY - g.startY;

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
        const next = clampSwipeOffset(g.initialOffset + deltaX);
        g.currentOffset = next;
        setDragOffset(next);
      }
    };

    const handleWindowMouseUp = () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      finishSwipeGesture();
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  const handleRowClick = () => {
    if (Date.now() - lastSwipeTimeRef.current < 260) return;
    if (isOpen || anyRowOpen) {
      onSetOpenRow(null);
      return;
    }
    onOpenEditModal(tx);
  };

  const translateX = dragOffset !== null ? dragOffset : isOpen ? -SWIPE_REVEAL_WIDTH : 0;

  return (
    <div
      data-swipe-row-id={tx.id}
      className="relative overflow-hidden select-none"
    >
      {/* Background Action Layer (Revealed beneath on left-swipe) */}
      <div
        className="swipe-actions-layer absolute inset-y-0 right-0 flex items-center justify-end gap-2 pr-3 pl-2 z-0"
        style={{ width: `${SWIPE_REVEAL_WIDTH}px` }}
        aria-hidden={!isOpen && dragOffset === null}
      >
        {/* 1. Status Toggle (Paid / Pending) */}
        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          onClick={(e) => {
            e.stopPropagation();
            onSetOpenRow(null);
            onToggleTransactionStatus(tx);
          }}
          className="swipe-action-btn w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0"
          title={isUnpaid ? t.markAsPaidTooltip : t.markAsUnpaidTooltip}
        >
          {isUnpaid ? (
            <Clock size={15} className="text-amber-500" />
          ) : (
            <ThumbsUp size={15} className="text-emerald-500" />
          )}
        </button>

        {/* 2. Edit Transaction */}
        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          onClick={(e) => {
            e.stopPropagation();
            onSetOpenRow(null);
            onOpenEditModal(tx);
          }}
          className="swipe-action-btn w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0"
          title={t.editTooltip}
        >
          <Pencil size={15} />
        </button>

        {/* 3. Delete Transaction */}
        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          onClick={(e) => {
            e.stopPropagation();
            onSetOpenRow(null);
            onDeleteTransaction(tx.id);
          }}
          className="swipe-action-btn-danger w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0"
          title={t.deleteTooltip}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Foreground Content Layer (Swipeable solid surface card) */}
      <div
        role="button"
        tabIndex={0}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => {
          e.preventDefault();
          onSetOpenRow(isOpen ? null : tx.id);
        }}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenEditModal(tx);
          } else if (e.key === 'ArrowLeft') {
            onSetOpenRow(tx.id);
          } else if (e.key === 'ArrowRight' || e.key === 'Escape') {
            onSetOpenRow(null);
          }
        }}
        style={{
          transform: `translate3d(${translateX}px, 0, 0)`,
          transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          willChange: isDragging || isOpen ? 'transform' : 'auto',
        }}
        className="swipe-foreground-layer relative z-10 flex items-center justify-between p-3 sm:p-3.5 transition-colors gap-2 sm:gap-3 select-none cursor-pointer"
      >
        {/* Left: Category Icon + Transaction Details */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <CategoryIcon
            icon={cat?.icon || 'Tag'}
            color={cat?.color || '#64748b'}
            size={16}
            badgeSize="md"
          />

          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate leading-snug">
              {tx.description}
            </p>

            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400 mt-1 leading-none">
              <span className="text-slate-500 font-medium truncate max-w-[120px] sm:max-w-none">
                {getCategoryDisplayName(cat, language)}
              </span>

              {cardObj && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                  <CreditCardIcon size={9} />
                  <span className="truncate max-w-[75px] sm:max-w-none">{cardObj.name}</span>
                </span>
              )}

              {tx.installmentTotal && tx.installmentTotal > 1 && (
                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                  {tx.installmentCurrent || 1}/{tx.installmentTotal}
                </span>
              )}

              {isUnpaid && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-semibold">
                  <Clock size={9} />
                  <span>{t.pendingBadge}</span>
                </span>
              )}

              {tx.recurringId && !tx.installmentTotal && (
                <span className="inline-flex items-center text-slate-400">
                  <Repeat size={10} />
                </span>
              )}

              {tx.notes && (
                <>
                  <span>•</span>
                  <span className="italic truncate max-w-[100px] sm:max-w-[180px]">{tx.notes}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Formatted Transaction Amount & Numeric Date Stack */}
        <div className="flex flex-col items-end justify-center text-right shrink-0 pl-2">
          <span
            className={`text-sm sm:text-base font-semibold whitespace-nowrap leading-tight ${
              tx.type === 'income' ? 'text-[#10B981]' : 'text-[#EF4444]'
            }`}
          >
            {tx.type === 'income' ? '+' : '-'}
            {formatCurrency(tx.amount, currency)}
          </span>
          <span className="text-xs text-slate-400 mt-0.5 whitespace-nowrap leading-none">
            {formatNumericDate(tx.date)}
          </span>
        </div>
      </div>
    </div>
  );
};

interface TransactionsViewProps {
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  categories: Category[];
  creditCards?: CreditCard[];
  transactions: Transaction[];
  onOpenAddModal: (type: TransactionType) => void;
  onOpenEditModal: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
  onToggleTransactionStatus: (tx: Transaction) => Promise<void>;
  balanceCard?: React.ReactNode;
  currentBankBalance?: number;
  monthStats?: {
    income: number;
    expense: number;
    pendingIncome: number;
    pendingExpense: number;
  };
  onOpenBalanceModal?: () => void;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  selectedMonth,
  currency,
  language,
  categories,
  creditCards = [],
  transactions,
  onOpenEditModal,
  onDeleteTransaction,
  onToggleTransactionStatus,
  balanceCard,
  currentBankBalance,
  monthStats,
  onOpenBalanceModal,
}) => {
  const t = TRANSLATIONS[language];
  const [activeFilterChip, setActiveFilterChip] = useState<FilterChipId>('all');
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [openSwipeRowId, setOpenSwipeRowId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const filterChips: { id: FilterChipId; label: string }[] = useMemo(
    () => [
      { id: 'all', label: language === 'pt-BR' ? 'Todos' : 'All' },
      { id: 'pending-expense', label: language === 'pt-BR' ? 'Despesas pendentes' : 'Pending expenses' },
      { id: 'pending-income', label: language === 'pt-BR' ? 'Entradas pendentes' : 'Pending income' },
      { id: 'paid-expense', label: language === 'pt-BR' ? 'Despesas pagas' : 'Paid expenses' },
      { id: 'paid-income', label: language === 'pt-BR' ? 'Entradas pagas' : 'Paid income' },
    ],
    [language]
  );

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Reset pagination & open swipe row when filters or month change
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setOpenSwipeRowId(null);
  }, [selectedMonth, scope, activeFilterChip, typeFilter, statusFilter, categoryFilter, searchQuery, sortBy]);

  // Close open swipe row when tapping outside of it
  useEffect(() => {
    if (!openSwipeRowId) return;
    const handleOutsidePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const rowEl = target.closest(`[data-swipe-row-id="${openSwipeRowId}"]`);
      if (!rowEl) {
        setOpenSwipeRowId(null);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown);
    };
  }, [openSwipeRowId]);

  // Count active non-default filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeFilterChip !== 'all') count++;
    if (scope === 'all') count++;
    if (typeFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    if (categoryFilter !== 'all') count++;
    if (sortBy !== 'date-desc') count++;
    return count;
  }, [activeFilterChip, scope, typeFilter, statusFilter, categoryFilter, sortBy]);

  const handleResetFilters = () => {
    setActiveFilterChip('all');
    setScope('month');
    setTypeFilter('all');
    setStatusFilter('all');
    setCategoryFilter('all');
    setSortBy('date-desc');
  };

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (scope === 'month' && !tx.date.startsWith(selectedMonth)) return false;

        const isUnpaid = tx.status === 'unpaid';
        if (activeFilterChip === 'pending-expense' && !(tx.type === 'expense' && isUnpaid)) return false;
        if (activeFilterChip === 'pending-income' && !(tx.type === 'income' && isUnpaid)) return false;
        if (activeFilterChip === 'paid-expense' && !(tx.type === 'expense' && !isUnpaid)) return false;
        if (activeFilterChip === 'paid-income' && !(tx.type === 'income' && !isUnpaid)) return false;

        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        const txStatus = tx.status === 'unpaid' ? 'unpaid' : 'paid';
        if (statusFilter !== 'all' && txStatus !== statusFilter) return false;
        if (categoryFilter !== 'all' && tx.categoryId !== categoryFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const cat = categoryMap.get(tx.categoryId);
          const catName = getCategoryDisplayName(cat, language).toLowerCase();
          const matchDesc = tx.description.toLowerCase().includes(q);
          const matchNotes = (tx.notes || '').toLowerCase().includes(q);
          const matchCat = catName.includes(q);
          if (!matchDesc && !matchNotes && !matchCat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
        if (sortBy === 'date-asc') return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
        if (sortBy === 'amount-desc') return b.amount - a.amount;
        return a.amount - b.amount;
      });
  }, [transactions, scope, selectedMonth, activeFilterChip, typeFilter, statusFilter, categoryFilter, searchQuery, sortBy, categoryMap, language]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let pendingAmount = 0;
    let pendingCount = 0;
    for (const tx of filteredTransactions) {
      if (tx.status === 'unpaid') {
        pendingCount++;
        pendingAmount += tx.amount;
        continue;
      }
      if (tx.type === 'income') income += tx.amount;
      else expense += tx.amount;
    }
    return {
      income,
      expense,
      net: income - expense,
      pendingAmount,
      pendingCount,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  const selectedCategoryObj = categoryFilter !== 'all' ? categoryMap.get(categoryFilter) : null;
  const visibleTransactions = useMemo(
    () => filteredTransactions.slice(0, visibleCount),
    [filteredTransactions, visibleCount]
  );
  const hasMore = visibleCount < filteredTransactions.length;

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMore) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredTransactions.length));
        }
      },
      { rootMargin: '220px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, filteredTransactions.length]);

  // Privacy state for balance and figures masking
  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(() => {
    try {
      return localStorage.getItem('prumo_hide_balance') === 'true';
    } catch {
      return false;
    }
  });

  const toggleBalancePrivacy = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBalanceHidden((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('prumo_hide_balance', String(next));
      } catch {}
      return next;
    });
  };

  const computedFallbackStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let pendingIncome = 0;
    let pendingExpense = 0;
    let allPaidIncome = 0;
    let allPaidExpense = 0;

    for (const tx of transactions) {
      if (tx.status === 'unpaid') {
        if (tx.date.startsWith(selectedMonth)) {
          if (tx.type === 'income') pendingIncome += tx.amount;
          else pendingExpense += tx.amount;
        }
        continue;
      }
      if (tx.cardId) continue;
      if (tx.type === 'income') allPaidIncome += tx.amount;
      else allPaidExpense += tx.amount;

      if (tx.date.startsWith(selectedMonth)) {
        if (tx.type === 'income') income += tx.amount;
        else expense += tx.amount;
      }
    }

    return {
      stats: { income, expense, pendingIncome, pendingExpense },
      balance: allPaidIncome - allPaidExpense,
    };
  }, [transactions, selectedMonth]);

  const effectiveStats = monthStats ?? computedFallbackStats.stats;
  const effectiveBankBalance = currentBankBalance ?? computedFallbackStats.balance;

  // Preserve summary reference so TypeScript keeps calculation logic active
  void summary;

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {/* 1. UNIFIED 2-COLUMN BALANCE, SEARCH & STATS CARD (PRUMO MOCKUP) */}
      <div className="oled-main-card rounded-2xl sm:rounded-3xl bg-[#0D1117] text-white p-4 sm:p-5 border border-[#21262D] shadow-xs">
        <div className="flex items-center justify-between gap-3.5 sm:gap-5">
          {/* Left Column: Balance, Search, Filter Chips */}
          <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2.5 sm:space-y-3">
            {/* Row 1: Balance Amount & Privacy Toggle */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <h1
                role={onOpenBalanceModal ? 'button' : undefined}
                tabIndex={onOpenBalanceModal ? 0 : undefined}
                onClick={onOpenBalanceModal}
                onKeyDown={(e) => {
                  if (onOpenBalanceModal && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onOpenBalanceModal();
                  }
                }}
                className={`text-[28px] min-[375px]:text-3xl min-[410px]:text-[34px] sm:text-4xl font-black tracking-tight leading-none truncate ${
                  onOpenBalanceModal ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
                } ${effectiveBankBalance < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-900 dark:text-[#F8FAFC]'}`}
                title={
                  onOpenBalanceModal
                    ? language === 'pt-BR'
                      ? 'Ajustar saldo inicial'
                      : 'Adjust initial balance'
                    : undefined
                }
              >
                {isBalanceHidden ? 'R$ ••••••' : formatCurrency(effectiveBankBalance, currency)}
              </h1>

              <button
                type="button"
                onClick={toggleBalancePrivacy}
                className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white active:scale-90 transition-all shrink-0 focus:outline-none flex items-center justify-center"
                title={
                  isBalanceHidden
                    ? language === 'pt-BR'
                      ? 'Mostrar saldo'
                      : 'Show balance'
                    : language === 'pt-BR'
                    ? 'Ocultar saldo'
                    : 'Hide balance'
                }
                aria-label={isBalanceHidden ? 'Show balance' : 'Hide balance'}
              >
                {isBalanceHidden ? (
                  <EyeOff size={22} className="stroke-[2.2]" />
                ) : (
                  <Eye size={22} className="stroke-[2.2]" />
                )}
              </button>
            </div>

            {/* Row 2: Integrated WhatsApp-style Search Input */}
            <div className="relative w-full">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 z-10 w-4 h-4"
              />
              <input
                type="text"
                placeholder={language === 'pt-BR' ? 'Pesquisar lançamentos...' : 'Search transactions...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="whatsapp-search-input w-full h-9 sm:h-9.5 pl-11 pr-10 rounded-full text-xs sm:text-sm text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 focus:outline-none transition-all shadow-inner-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors z-10"
                  title={language === 'pt-BR' ? 'Limpar busca' : 'Clear search'}
                >
                  <X size={14} className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Row 3: Horizontal Scrollable Filter Chips Carousel */}
            <div className="w-full flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 -my-0.5 min-w-0">
              {filterChips.map((chip) => {
                const isSelected = activeFilterChip === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setActiveFilterChip(chip.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap border shrink-0 transition-all active:scale-95 select-none ${
                      isSelected ? 'filter-chip-active font-semibold shadow-xs' : 'filter-chip-inactive'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Stacked Income & Expenses Summary (Anchored Right) */}
          <div className="shrink-0 text-right flex flex-col items-end justify-between space-y-3 sm:space-y-3.5 pl-2 sm:pl-3">
            {/* Top Group: ENTRADAS */}
            <div className="flex flex-col items-end text-right">
              <div className="flex items-center gap-1 text-[#10B981] mb-0.5 justify-end">
                <ArrowUpRight size={14} strokeWidth={2.5} className="shrink-0" />
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {language === 'pt-BR' ? 'ENTRADAS' : 'INCOME'}
                </span>
              </div>
              <p className="text-base sm:text-lg font-black text-[#10B981] tracking-tight leading-tight">
                {isBalanceHidden ? '+R$ ••••••' : `+${formatCurrency(effectiveStats.income, currency)}`}
              </p>
              <p
                className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-[#94A3B8] mt-0.5 whitespace-nowrap"
                title={`${language === 'pt-BR' ? 'A receber:' : 'To receive:'} ${formatCurrency(effectiveStats.pendingIncome, currency)}`}
              >
                {language === 'pt-BR' ? 'A receber:' : 'To receive:'}{' '}
                <span className="text-slate-900 dark:text-white font-bold ml-0.5">
                  {isBalanceHidden ? 'R$ ••••' : formatCurrency(effectiveStats.pendingIncome, currency)}
                </span>
              </p>
            </div>

            {/* Bottom Group: DESPESAS */}
            <div className="flex flex-col items-end text-right">
              <div className="flex items-center gap-1 text-[#EF4444] mb-0.5 justify-end">
                <ArrowDownRight size={14} strokeWidth={2.5} className="shrink-0" />
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {language === 'pt-BR' ? 'DESPESAS' : 'EXPENSES'}
                </span>
              </div>
              <p className="text-base sm:text-lg font-black text-[#EF4444] tracking-tight leading-tight">
                {isBalanceHidden ? '-R$ ••••••' : `-${formatCurrency(effectiveStats.expense, currency)}`}
              </p>
              <p
                className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-[#94A3B8] mt-0.5 whitespace-nowrap"
                title={`${language === 'pt-BR' ? 'A pagar:' : 'To pay:'} ${formatCurrency(effectiveStats.pendingExpense, currency)}`}
              >
                {language === 'pt-BR' ? 'A pagar:' : 'To pay:'}{' '}
                <span className="text-slate-900 dark:text-white font-bold ml-0.5">
                  {isBalanceHidden ? 'R$ ••••' : formatCurrency(effectiveStats.pendingExpense, currency)}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fallback legacy balance card if provided without monthStats */}
      {balanceCard && !monthStats && balanceCard}

      {/* 3. CLEAN TRANSACTIONS LIST: Visual Neutro e Elegante */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="py-14 text-center space-y-2 px-4">
            <p className="text-xs sm:text-sm font-semibold text-slate-600">{t.noMatchingEntries}</p>
            <p className="text-[11px] sm:text-xs text-slate-400">{t.noMatchingDesc}</p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 mt-2"
              >
                <RotateCcw size={12} />
                <span>{t.clearFiltersBtn}</span>
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100">
              {visibleTransactions.map((tx) => {
                const cat = categoryMap.get(tx.categoryId);
                const cardObj = tx.cardId ? creditCards.find((c) => c.id === tx.cardId) : null;

                return (
                  <SwipeableTransactionRow
                    key={tx.id}
                    tx={tx}
                    cat={cat}
                    cardObj={cardObj}
                    currency={currency}
                    language={language}
                    isOpen={openSwipeRowId === tx.id}
                    anyRowOpen={openSwipeRowId !== null}
                    onSetOpenRow={setOpenSwipeRowId}
                    onOpenEditModal={onOpenEditModal}
                    onDeleteTransaction={onDeleteTransaction}
                    onToggleTransactionStatus={onToggleTransactionStatus}
                  />
                );
              })}
            </div>

            {/* Infinite scroll sentinel & pagination footer */}
            {hasMore && (
              <div
                ref={loadMoreRef}
                className="p-3 border-t border-slate-100 flex items-center justify-center"
              >
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filteredTransactions.length))
                  }
                  className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold transition-colors"
                >
                  {language === 'pt-BR'
                    ? `Carregar mais (${visibleCount} de ${filteredTransactions.length})`
                    : `Load more (${visibleCount} of ${filteredTransactions.length})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 4. BOTTOM SHEET MODAL (Opções de Período, Categorias, Status e Ordenação) */}
      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          {/* Backdrop Click Dismiss */}
          <div
            className="fixed inset-0"
            onClick={() => setIsFilterSheetOpen(false)}
            aria-hidden="true"
          />

          {/* Bottom Sheet Card */}
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl p-4 sm:p-5 space-y-4 max-h-[85vh] overflow-y-auto z-10 animate-in slide-in-from-bottom duration-200">
            {/* Sheet pull bar (mobile only) */}
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto sm:hidden -mt-1 mb-2" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">{t.filterSheetTitle}</h3>
              </div>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    {t.clearFiltersBtn}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFilterSheetOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter Section: Período */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {language === 'pt-BR' ? 'Período' : 'Period'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('month')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    scope === 'month'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {formatMonthLabel(selectedMonth, language)}
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    scope === 'all'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t.allTime}
                </button>
              </div>
            </div>

            {/* Filter Section: Tipo */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {language === 'pt-BR' ? 'Tipo de Lançamento' : 'Type'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['all', 'income', 'expense'] as const).map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setTypeFilter(tp)}
                    className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                      typeFilter === tp
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {tp === 'all'
                      ? t.filterAllEntries
                      : tp === 'income'
                      ? t.filterInputsOnly
                      : t.filterExpensesOnly}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Section: Status */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {language === 'pt-BR' ? 'Status de Pagamento' : 'Payment Status'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['all', 'paid', 'unpaid'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                      statusFilter === st
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {st === 'all'
                      ? t.filterAllEntries
                      : st === 'paid'
                      ? t.filterPaidOnly
                      : t.filterPendingOnly}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Section: Categoria */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {language === 'pt-BR' ? 'Categoria' : 'Category'}
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
              >
                <option value="all">{t.allCategories}</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.type === 'income' ? t.inputPrefix : t.expensePrefix}
                    {getCategoryDisplayName(cat, language)}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Section: Ordenação */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {language === 'pt-BR' ? 'Ordenar por' : 'Sort by'}
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
              >
                <option value="date-desc">{t.sortNewest}</option>
                <option value="date-asc">{t.sortOldest}</option>
                <option value="amount-desc">{t.sortHighest}</option>
                <option value="amount-asc">{t.sortLowest}</option>
              </select>
            </div>

            {/* Exportar CSV (utilitário discreto) */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() =>
                  exportTransactionsToCSV(
                    filteredTransactions,
                    categories,
                    `familyplan-${scope === 'month' ? selectedMonth : 'all-time'}.csv`,
                    language
                  )
                }
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Download size={13} />
                <span>
                  {t.exportCsv} ({filteredTransactions.length})
                </span>
              </button>
            </div>

            {/* Primary Dismiss Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-bold hover:bg-slate-800 transition-colors shadow-xs"
              >
                {t.viewFilteredCount(filteredTransactions.length)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
