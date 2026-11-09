import React from 'react';
import { RotateCcw } from 'lucide-react';
import { AppLanguage, Category, CreditCard, Transaction } from '../../types';
import { TRANSLATIONS } from '../../utils/i18n';
import { DayGroup, PAGE_SIZE } from './transactionsViewMath';
import { SwipeableTransactionRow } from './TransactionFeedItem';

export interface TransactionDayGroupFeedProps {
  filteredTransactions: Transaction[];
  groupedTransactions: DayGroup[];
  categoryMap: Map<string, Category>;
  creditCards: CreditCard[];
  currency: string;
  language: AppLanguage;
  activeFilterCount: number;
  onResetFilters: () => void;
  openSwipeRowId: string | null;
  onSetOpenRow: (id: string | null) => void;
  onOpenEditModal: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
  onToggleTransactionStatus: (tx: Transaction) => Promise<void>;
  hasMore: boolean;
  loadMoreRef: React.RefObject<HTMLDivElement>;
  visibleCount: number;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
  t: (typeof TRANSLATIONS)[AppLanguage];
}

export const TransactionDayGroupFeed: React.FC<TransactionDayGroupFeedProps> = ({
  filteredTransactions,
  groupedTransactions,
  categoryMap,
  creditCards,
  currency,
  language,
  activeFilterCount,
  onResetFilters,
  openSwipeRowId,
  onSetOpenRow,
  onOpenEditModal,
  onDeleteTransaction,
  onToggleTransactionStatus,
  hasMore,
  loadMoreRef,
  visibleCount,
  setVisibleCount,
  t,
}) => {
  return (
    <div className="flex flex-col gap-3 w-full pb-20">
      {filteredTransactions.length === 0 ? (
        <div className="p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] shadow-sm transition-colors py-14 text-center space-y-2 px-4">
          <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
            {t.noMatchingEntries}
          </p>
          <p className="text-[11px] sm:text-xs text-slate-400 dark:text-slate-500">
            {t.noMatchingDesc}
          </p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onResetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#21262D] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#161B22] mt-2"
            >
              <RotateCcw size={12} />
              <span>{t.clearFiltersBtn}</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {groupedTransactions.map((group) => (
            <div
              key={group.date}
              className="p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] shadow-sm transition-colors"
            >
              <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100 dark:border-[#21262D]/60 select-none">
                <span className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200 capitalize">
                  {group.label}
                </span>
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                  {group.transactions.length}{' '}
                  {group.transactions.length === 1
                    ? language === 'pt-BR'
                      ? 'lançamento'
                      : 'entry'
                    : language === 'pt-BR'
                    ? 'lançamentos'
                    : 'entries'}
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-[#21262D]/40">
                {group.transactions.map((tx) => {
                  const cat = categoryMap.get(tx.categoryId);
                  const cardObj = tx.cardId
                    ? creditCards.find((c) => c.id === tx.cardId)
                    : tx.settledInvoiceKey
                    ? creditCards.find((c) => tx.settledInvoiceKey?.startsWith(c.id))
                    : creditCards.find((c) =>
                        tx.description.toLowerCase().includes(c.name.toLowerCase())
                      ) || null;

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
                      onSetOpenRow={onSetOpenRow}
                      onOpenEditModal={onOpenEditModal}
                      onDeleteTransaction={onDeleteTransaction}
                      onToggleTransactionStatus={onToggleTransactionStatus}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {hasMore && (
            <div
              ref={loadMoreRef}
              className="pt-1 flex items-center justify-center"
            >
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((prev) =>
                    Math.min(prev + PAGE_SIZE, filteredTransactions.length)
                  )
                }
                className="px-4 py-2 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-white hover:bg-slate-50 dark:bg-[#0D1117] dark:hover:bg-[#161B22] text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-sm transition-colors"
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
  );
};
