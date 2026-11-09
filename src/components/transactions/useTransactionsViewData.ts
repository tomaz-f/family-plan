import React, { useState, useMemo, useEffect, useRef } from 'react';
import { TRANSLATIONS } from '../../utils/i18n';
import {
  FeedViewMode,
  FilterChipId,
  PAGE_SIZE,
  SortByMode,
  TransactionsViewProps,
  computeFallbackStats,
  computeFilteredTransactions,
  computeGroupedTransactions,
  computeTransactionsSummary,
} from './transactionsViewMath';

export const useTransactionsViewData = ({
  selectedMonth,
  language,
  categories,
  transactions,
  currentBankBalance,
  monthStats,
}: TransactionsViewProps) => {
  const t = TRANSLATIONS[language];
  const [activeFilterChip, setActiveFilterChip] = useState<FilterChipId>('all');
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortByMode>('date-desc');
  const [feedViewMode, setFeedViewMode] = useState<FeedViewMode>(() => {
    try {
      const saved = localStorage.getItem('prumo_feed_view_mode');
      if (saved === 'timeline' || saved === 'date-desc' || saved === 'date-asc') return saved;
      const legacy = localStorage.getItem('prumo_feed_sort_order');
      if (legacy === 'asc') return 'date-asc';
      if (legacy === 'desc') return 'timeline';
    } catch {
      /* ignore storage errors */
    }
    return 'timeline';
  });

  const [isOrderMenuOpen, setIsOrderMenuOpen] = useState<boolean>(false);
  const orderMenuRef = useRef<HTMLDivElement | null>(null);

  const viewModeOptions: { id: FeedViewMode; label: string }[] = useMemo(
    () => [
      { id: 'timeline', label: language === 'pt-BR' ? 'Linha do Tempo (Hoje)' : 'Timeline (Today)' },
      { id: 'date-desc', label: language === 'pt-BR' ? 'Mais Recentes (Data ↓)' : 'Latest (Date ↓)' },
      { id: 'date-asc', label: language === 'pt-BR' ? 'Mais Antigos (Data ↑)' : 'Oldest (Date ↑)' },
    ],
    [language]
  );

  useEffect(() => {
    if (!isOrderMenuOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (orderMenuRef.current && !orderMenuRef.current.contains(target)) {
        setIsOrderMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOrderMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOrderMenuOpen]);

  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState<boolean>(false);
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
  const [openSwipeRowId, setOpenSwipeRowId] = useState<string | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const primaryFilterChips: { id: FilterChipId; label: string }[] = useMemo(
    () => [
      { id: 'all', label: language === 'pt-BR' ? 'Todos' : 'All' },
      { id: 'pending-expense', label: language === 'pt-BR' ? 'Despesas a pagar' : 'Pending expenses' },
    ],
    [language]
  );

  const dropdownFilters: { id: FilterChipId; label: string }[] = useMemo(
    () => [
      { id: 'pending-income', label: language === 'pt-BR' ? 'Entradas a receber' : 'Pending income' },
      { id: 'paid-expense', label: language === 'pt-BR' ? 'Pagas / Concluídas' : 'Paid / Completed' },
      { id: 'paid-income', label: language === 'pt-BR' ? 'Recebidas' : 'Received' },
      { id: 'fixed', label: language === 'pt-BR' ? 'Fixas' : 'Fixed / Recurring' },
      { id: 'installment', label: language === 'pt-BR' ? 'Parceladas' : 'Installments' },
    ],
    [language]
  );

  const allFilterOptions: { id: FilterChipId; label: string }[] = useMemo(
    () => [...primaryFilterChips, ...dropdownFilters],
    [primaryFilterChips, dropdownFilters]
  );

  const activeFilterOption = useMemo(
    () => allFilterOptions.find((f) => f.id === activeFilterChip) ?? allFilterOptions[0],
    [allFilterOptions, activeFilterChip]
  );

  const isDropdownFilterActive = useMemo(
    () => activeFilterChip !== 'all',
    [activeFilterChip]
  );

  const activeDropdownFilter = useMemo(
    () => dropdownFilters.find((f) => f.id === activeFilterChip),
    [dropdownFilters, activeFilterChip]
  );

  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [dropdownPos] = useState<{ top: number; left?: number; right?: number }>({ top: 0 });
  const dropdownContainerRef = useRef<HTMLDivElement | null>(null);
  const dropdownBtnRef = useRef<HTMLButtonElement | null>(null);
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isDropdownOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(target)) {
        setIsDropdownOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDropdownOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setOpenSwipeRowId(null);
    setIsDropdownOpen(false);
    setIsOrderMenuOpen(false);
  }, [selectedMonth, scope, activeFilterChip, typeFilter, statusFilter, categoryFilter, searchQuery, sortBy, feedViewMode]);

  useEffect(() => {
    if (!openSwipeRowId) return;
    const handleOutsidePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const rowEl = target.closest(`[data-swipe-row-id="${openSwipeRowId}"]`);
      if (!rowEl) setOpenSwipeRowId(null);
    };
    document.addEventListener('pointerdown', handleOutsidePointerDown, { passive: true });
    return () => document.removeEventListener('pointerdown', handleOutsidePointerDown);
  }, [openSwipeRowId]);

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
    setIsDropdownOpen(false);
    setScope('month');
    setTypeFilter('all');
    setStatusFilter('all');
    setCategoryFilter('all');
    setSortBy('date-desc');
  };

  const filteredTransactions = useMemo(
    () =>
      computeFilteredTransactions({
        transactions, scope, selectedMonth, activeFilterChip, typeFilter,
        statusFilter, categoryFilter, searchQuery, sortBy, feedViewMode,
        categoryMap, language,
      }),
    [transactions, scope, selectedMonth, activeFilterChip, typeFilter, statusFilter, categoryFilter, searchQuery, sortBy, feedViewMode, categoryMap, language]
  );

  const summary = useMemo(() => computeTransactionsSummary(filteredTransactions), [filteredTransactions]);
  const selectedCategoryObj = categoryFilter !== 'all' ? categoryMap.get(categoryFilter) : null;
  const visibleTransactions = useMemo(
    () => filteredTransactions.slice(0, visibleCount),
    [filteredTransactions, visibleCount]
  );

  const groupedTransactions = useMemo(
    () => computeGroupedTransactions(visibleTransactions, language, feedViewMode),
    [visibleTransactions, language, feedViewMode]
  );

  const hasMore = visibleCount < filteredTransactions.length;

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMore || typeof IntersectionObserver === 'undefined') return;

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
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  };

  const computedFallbackStats = useMemo(
    () => computeFallbackStats(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  const effectiveStats = monthStats ?? computedFallbackStats.stats;
  const effectiveBankBalance = currentBankBalance ?? computedFallbackStats.balance;

  void { summary, selectedCategoryObj };

  return {
    t, activeFilterChip, setActiveFilterChip, scope, setScope, typeFilter, setTypeFilter,
    statusFilter, setStatusFilter, categoryFilter, setCategoryFilter, searchQuery, setSearchQuery,
    sortBy, setSortBy, feedViewMode, setFeedViewMode, isOrderMenuOpen, setIsOrderMenuOpen,
    orderMenuRef, viewModeOptions, isFilterSheetOpen, setIsFilterSheetOpen, visibleCount,
    setVisibleCount, openSwipeRowId, setOpenSwipeRowId, loadMoreRef, primaryFilterChips,
    dropdownFilters, allFilterOptions, activeFilterOption, isDropdownFilterActive,
    activeDropdownFilter, isDropdownOpen, setIsDropdownOpen, dropdownPos,
    dropdownContainerRef, dropdownBtnRef, dropdownMenuRef, toggleDropdown,
    categoryMap, activeFilterCount, handleResetFilters, filteredTransactions,
    groupedTransactions, hasMore, isBalanceHidden, toggleBalancePrivacy, effectiveStats,
    effectiveBankBalance,
  };
};
