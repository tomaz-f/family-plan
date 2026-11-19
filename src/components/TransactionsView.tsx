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
import { TransactionsSearchFilterBar } from './transactions/TransactionsSearchFilterBar';
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
    desktopSidePanel,
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
    allFilterOptions,
    activeFilterOption,
    isDropdownOpen,
    setIsDropdownOpen,
    dropdownContainerRef,
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

  const feedContent = (
    <>
      <TransactionsSearchFilterBar
        language={language}
        isBalanceHidden={isBalanceHidden}
        onToggleBalancePrivacy={toggleBalancePrivacy}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        primaryFilterChips={primaryFilterChips}
        dropdownFilters={dropdownFilters}
        allFilterOptions={allFilterOptions}
        activeFilterOption={activeFilterOption}
        activeFilterChip={activeFilterChip}
        onSelectFilterChip={(id) => {
          setActiveFilterChip(id);
          setIsDropdownOpen(false);
        }}
        isDropdownOpen={isDropdownOpen}
        onToggleDropdown={toggleDropdown}
        dropdownContainerRef={dropdownContainerRef}
        dropdownBtnRef={dropdownBtnRef}
        dropdownMenuRef={dropdownMenuRef}
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
    </>
  );

  return (
    <div className="space-y-3.5 sm:space-y-4">
      <TransactionsHeroSummary
        language={language}
        currency={currency}
        effectiveBankBalance={effectiveBankBalance}
        effectiveStats={effectiveStats}
        isBalanceHidden={isBalanceHidden}
        onOpenBalanceModal={onOpenBalanceModal}
        balanceCard={balanceCard}
        hasMonthStats={Boolean(monthStats)}
      />

      {desktopSidePanel ? (
        <div className="space-y-3.5 sm:space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
          <div className="space-y-3.5 sm:space-y-4 lg:col-span-7 xl:col-span-8 min-w-0">
            {feedContent}
          </div>
          <aside className="hidden lg:block lg:col-span-5 xl:col-span-4 lg:sticky lg:top-6 min-w-0">
            {desktopSidePanel}
          </aside>
        </div>
      ) : (
        feedContent
      )}

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
