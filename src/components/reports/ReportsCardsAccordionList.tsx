import React, { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { AppLanguage, CreditCard, Transaction } from '../../types';
import { formatCurrency } from '../../utils/format';
import { CategoryIcon } from '../CategoryIcon';
import { CategorySliceItem } from './reportsTypes';
import { formatNumericDate } from './reportsCalculations';

export interface ReportsCardsAccordionListProps {
  cardCategorySlices: CategorySliceItem[];
  activeCardCategoryId: string | null;
  activeCardCategoryTransactions: Transaction[];
  creditCards: CreditCard[];
  selectedCardFilter: string;
  currency: string;
  language: AppLanguage;
  isOled: boolean;
  onToggleCardCategory: (categoryId: string) => void;
}

/**
 * Interactive category accordion list for the Credit Card Spending report,
 * matching "Categorias Gerais" with a header-only brand border when expanded.
 */
export const ReportsCardsAccordionList: React.FC<ReportsCardsAccordionListProps> = ({
  cardCategorySlices,
  activeCardCategoryId,
  activeCardCategoryTransactions,
  creditCards,
  selectedCardFilter,
  currency,
  language,
  isOled,
  onToggleCardCategory,
}) => {
  const cardMap = useMemo(
    () => new Map(creditCards.map((card) => [card.id, card])),
    [creditCards]
  );

  return (
    <div
      className={`mt-5 pt-4 border-t ${
        isOled ? 'border-[#21262D]/80' : 'border-slate-200'
      }`}
    >
      {cardCategorySlices.map((item) => {
        const isExpanded = activeCardCategoryId === item.id;

        return (
          <div key={item.id} className="mb-2 last:mb-0">
            <button
              type="button"
              onClick={() => onToggleCardCategory(item.id)}
              aria-expanded={isExpanded}
              className={`w-full min-h-[48px] p-3 flex items-center justify-between gap-2.5 border text-left cursor-pointer transition-all ${
                isExpanded
                  ? 'border-[#6E5440] dark:border-[#D0B595] rounded-t-2xl rounded-b-none bg-[#6E5440]/[0.03] dark:bg-[#D0B595]/[0.06] relative z-10'
                  : isOled
                  ? 'rounded-2xl bg-[#161B22]/40 border-[#21262D] hover:bg-[#161B22]/70'
                  : 'rounded-2xl bg-slate-50/70 border-slate-200/80 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <CategoryIcon
                  icon={item.icon}
                  color={item.color}
                  badgeSize="sm"
                  size={15}
                />
                <span
                  className={`text-xs font-bold truncate ${
                    isOled ? 'text-white' : 'text-slate-900'
                  } dark:text-white`}
                >
                  {item.name}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`text-xs font-bold whitespace-nowrap ${
                    isOled ? 'text-white' : 'text-slate-900'
                  } dark:text-white`}
                >
                  {formatCurrency(item.amount, currency)}
                </span>
                <span
                  className={`min-w-[48px] text-right px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                    isOled
                      ? 'bg-[#0D1117] text-slate-300 border-[#21262D]'
                      : 'bg-white text-slate-700 border-slate-200/80'
                  } dark:bg-[#0D1117] dark:text-slate-300 dark:border-[#21262D]`}
                >
                  {item.share.toFixed(1)}%
                </span>
                <ChevronDown
                  size={14}
                  className={`shrink-0 transition-transform duration-200 ${
                    isExpanded
                      ? 'rotate-180 text-[#6E5440] dark:text-[#D0B595]'
                      : 'rotate-0 text-slate-400'
                  }`}
                />
              </div>
            </button>

            {isExpanded && (
              <div
                className={`rounded-b-2xl border-x border-b overflow-hidden px-3 py-1 divide-y divide-slate-100 dark:divide-[#21262D] animate-in fade-in slide-in-from-top-1 ${
                  isOled
                    ? 'bg-[#0D1117] border-[#21262D]'
                    : 'bg-white border-slate-200/80'
                }`}
              >
                {activeCardCategoryTransactions.length === 0 ? (
                  <p className="py-3 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                    {language === 'pt-BR'
                      ? 'Nenhuma compra encontrada nesta categoria.'
                      : 'No purchases found in this category.'}
                  </p>
                ) : (
                  activeCardCategoryTransactions.map((tx) => {
                    const hasInstallments = Boolean(
                      tx.installmentTotal && tx.installmentTotal > 1
                    );
                    const cardObj = tx.cardId ? cardMap.get(tx.cardId) : undefined;
                    const showCardBadge = selectedCardFilter === 'all' && Boolean(cardObj);

                    return (
                      <div
                        key={tx.id}
                        className="py-2.5 flex items-center justify-between gap-3 cursor-default select-none first:pt-1.5 last:pb-1.5"
                      >
                        {/* Left Column: Purchase Description + Installment/Card Badges */}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {tx.description}
                          </p>

                          {(hasInstallments || showCardBadge) && (
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              {hasInstallments && (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                    isOled
                                      ? 'bg-[#161B22] text-slate-300 border-[#21262D]'
                                      : 'bg-slate-100 text-slate-600 border-slate-200/80'
                                  }`}
                                >
                                  {tx.installmentCurrent || 1}/{tx.installmentTotal}
                                </span>
                              )}

                              {showCardBadge && cardObj && (
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border max-w-[140px] ${
                                    isOled
                                      ? 'bg-[#161B22] text-slate-300 border-[#21262D]'
                                      : 'bg-slate-100 text-slate-600 border-slate-200/80'
                                  }`}
                                >
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: cardObj.color || '#6366F1' }}
                                  />
                                  <span className="truncate">{cardObj.name}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Right Column: Negative Amount + Purchase/Invoice Date */}
                        <div className="flex flex-col items-end shrink-0 text-right">
                          <span className="text-xs sm:text-sm font-bold text-[#EF4444] whitespace-nowrap">
                            -{formatCurrency(tx.amount, currency)}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium whitespace-nowrap">
                            {formatNumericDate(tx.purchaseDate || tx.date)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
