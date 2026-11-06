import React from 'react';
import { RotateCcw } from 'lucide-react';
import { AppLanguage, Category, CreditCard, Transaction } from '../../types';
import { formatCurrency } from '../../utils/format';
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
    <div className="bg-white dark:bg-[#0D1117] rounded-2xl border border-slate-200/80 dark:border-[#21262D] shadow-2xs overflow-hidden">
      {filteredTransactions.length === 0 ? (
        <div className="py-14 text-center space-y-2 px-4">
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
          <div>
            {groupedTransactions.map((group, groupIdx) => (
              <div key={group.date} className="day-group-block">
                <div
                  className={`flex items-center justify-between py-2 px-3.5 text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-[#161B22]/60 select-none ${
                    groupIdx > 0 ? 'border-t border-slate-100 dark:border-[#21262D]/60' : ''
                  } border-b border-slate-100 dark:border-[#21262D]/60`}
                >
                  <span className="capitalize">{group.label}</span>
                  <div className="flex items-center gap-2 text-[11px] font-normal">
                    <span className="text-slate-400 dark:text-slate-500">
                      {group.transactions.length}{' '}
                      {group.transactions.length === 1
                        ? language === 'pt-BR'
                          ? 'lançamento'
                          : 'entry'
                        : language === 'pt-BR'
                        ? 'lançamentos'
                        : 'entries'}
                    </span>
                    {group.dailyNet !== 0 && (
                      <span
                        className={`font-semibold ${
                          group.dailyNet > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {group.dailyNet > 0 ? '+' : '-'}
                        {formatCurrency(Math.abs(group.dailyNet), currency)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-[#21262D]">
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
          </div>

          {hasMore && (
            <div
              ref={loadMoreRef}
              className="p-3 border-t border-slate-100 dark:border-[#21262D] flex items-center justify-center"
            >
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((prev) =>
                    Math.min(prev + PAGE_SIZE, filteredTransactions.length)
                  )
                }
                className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-[#161B22] dark:hover:bg-[#21262D] text-slate-600 dark:text-slate-300 text-xs font-semibold transition-colors"
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
