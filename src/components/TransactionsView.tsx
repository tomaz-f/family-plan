import React from 'react';
import {
  DayGroup,
  FeedViewMode,
  FilterChipId,
  SortByMode,
  TransactionsViewProps,
} from './transactions/transactionsViewMath';
import { useTransactionsViewData } from './transactions/useTransactionsViewData';
import { TransactionsHeroSummary } from './transactions/TransactionsHeroSummary';
import {
  TransactionsFeedHeaderBar,
  TransactionsFilterSheetModal,
} from './transactions/TransactionsFilterBar';
import { TransactionDayGroupFeed } from './transactions/TransactionDayGroupFeed';
import { SwipeableTransactionRow } from './transactions/TransactionFeedItem';

export { SwipeableTransactionRow };
export type {
  DayGroup,
  FeedViewMode,
  FilterChipId,
  SortByMode,
  TransactionsViewProps,
};

export const TransactionsView: React.FC<TransactionsViewProps> = (props) => {
  const {
    selectedMonth,
    currency,
    language,
    categories,
    creditCards = [],
    onOpenEditModal,
    onDeleteTransaction,
    onToggleTransactionStatus,
    balanceCard,
    monthStats,
    onOpenBalanceModal,
  } = props;

  const {
    t,
    activeFilterChip,
    setActiveFilterChip,
    scope,
    setScope,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    feedViewMode,
    setFeedViewMode,
    isOrderMenuOpen,
    setIsOrderMenuOpen,
    orderMenuRef,
    viewModeOptions,
    isFilterSheetOpen,
    setIsFilterSheetOpen,
    visibleCount,
    setVisibleCount,
    openSwipeRowId,
    setOpenSwipeRowId,
    loadMoreRef,
    primaryFilterChips,
    dropdownFilters,
    isDropdownFilterActive,
    activeDropdownFilter,
    isDropdownOpen,
    setIsDropdownOpen,
    dropdownPos,
    dropdownBtnRef,
    dropdownMenuRef,
    toggleDropdown,
    categoryMap,
    activeFilterCount,
    handleResetFilters,
    filteredTransactions,
    groupedTransactions,
    hasMore,
    isBalanceHidden,
    toggleBalancePrivacy,
    effectiveStats,
    effectiveBankBalance,
  } = useTransactionsViewData(props);

  return (
    <div className="space-y-3.5 sm:space-y-4">
      <TransactionsHeroSummary
        language={language}
        currency={currency}
        effectiveBankBalance={effectiveBankBalance}
        effectiveStats={effectiveStats}
        isBalanceHidden={isBalanceHidden}
        onToggleBalancePrivacy={toggleBalancePrivacy}
        onOpenBalanceModal={onOpenBalanceModal}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        primaryFilterChips={primaryFilterChips}
        dropdownFilters={dropdownFilters}
        activeFilterChip={activeFilterChip}
        onSelectFilterChip={(id) => {
          setActiveFilterChip(id);
          setIsDropdownOpen(false);
        }}
        isDropdownFilterActive={isDropdownFilterActive}
        activeDropdownFilter={activeDropdownFilter}
        isDropdownOpen={isDropdownOpen}
        onToggleDropdown={toggleDropdown}
        dropdownPos={dropdownPos}
        dropdownBtnRef={dropdownBtnRef}
        dropdownMenuRef={dropdownMenuRef}
        balanceCard={balanceCard}
        hasMonthStats={Boolean(monthStats)}
      />

      <TransactionsFeedHeaderBar
        language={language}
        filteredCount={filteredTransactions.length}
        isOrderMenuOpen={isOrderMenuOpen}
        setIsOrderMenuOpen={setIsOrderMenuOpen}
        orderMenuRef={orderMenuRef}
        viewModeOptions={viewModeOptions}
        feedViewMode={feedViewMode}
        onSelectViewMode={(mode) => {
          setFeedViewMode(mode);
          try {
            localStorage.setItem('prumo_feed_view_mode', mode);
          } catch {
            /* ignore storage errors */
          }
          setIsOrderMenuOpen(false);
        }}
      />

      <TransactionDayGroupFeed
        filteredTransactions={filteredTransactions}
        groupedTransactions={groupedTransactions}
        categoryMap={categoryMap}
        creditCards={creditCards}
        currency={currency}
        language={language}
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
        openSwipeRowId={openSwipeRowId}
        onSetOpenRow={setOpenSwipeRowId}
        onOpenEditModal={onOpenEditModal}
        onDeleteTransaction={onDeleteTransaction}
        onToggleTransactionStatus={onToggleTransactionStatus}
        hasMore={hasMore}
        loadMoreRef={loadMoreRef}
        visibleCount={visibleCount}
        setVisibleCount={setVisibleCount}
        t={t}
      />

      <TransactionsFilterSheetModal
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        language={language}
        selectedMonth={selectedMonth}
        categories={categories}
        filteredTransactions={filteredTransactions}
        activeFilterCount={activeFilterCount}
        onResetFilters={handleResetFilters}
        scope={scope}
        setScope={setScope}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
        t={t}
      />
    </div>
  );
};
