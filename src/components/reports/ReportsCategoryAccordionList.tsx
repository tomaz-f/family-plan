import React from 'react';
import { ChevronDown } from 'lucide-react';
import { AppLanguage, Transaction } from '../../types';
import { formatCurrency } from '../../utils/format';
import { CategoryIcon } from '../CategoryIcon';
import { CategorySliceItem, INVOICE_SLICE_ID } from './reportsTypes';
import { formatNumericDate, isInvoiceTransaction } from './reportsCalculations';

interface ReportsCategoryAccordionListProps {
  categorySlices: CategorySliceItem[];
  activeCategoryId: string | null;
  activeCategoryTransactions: Transaction[];
  currency: string;
  language: AppLanguage;
  isOled: boolean;
  onToggleCategory: (categoryId: string) => void;
}

export const ReportsCategoryAccordionList: React.FC<ReportsCategoryAccordionListProps> = ({
  categorySlices,
  activeCategoryId,
  activeCategoryTransactions,
  currency,
  language,
  isOled,
  onToggleCategory,
}) => {
  return (
    <div
      className={`mt-5 pt-4 border-t ${
        isOled ? 'border-[#21262D]/80' : 'border-slate-200'
      }`}
    >
      {categorySlices.map((item) => {
        const isSelected = activeCategoryId === item.id;
        return (
          <React.Fragment key={item.id}>
            <button
              type="button"
              onClick={() => onToggleCategory(item.id)}
              className={`w-full min-h-[48px] p-3 flex items-center justify-between gap-3 border text-left transition-all ${
                isSelected
                  ? isOled
                    ? 'bg-[#161B22] border-[#6E5440] rounded-t-xl rounded-b-none ring-1 ring-[#D0B595]/30 relative z-10'
                    : 'bg-slate-100 border-[#6E5440] rounded-t-xl rounded-b-none relative z-10'
                  : isOled
                  ? 'rounded-xl mb-2 last:mb-0 bg-[#161B22]/40 border-[#21262D] hover:bg-[#161B22]/70'
                  : 'rounded-xl mb-2 last:mb-0 bg-slate-50/70 border-slate-200/60 hover:bg-slate-100'
              } dark:bg-[#161B22]/40 dark:border-[#21262D]`}
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
                  className={`text-xs font-bold ${
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
                  className={`text-slate-400 transition-transform duration-200 ${
                    isSelected ? 'rotate-180 text-[#6E5440] dark:text-[#D0B595]' : 'rotate-0'
                  }`}
                />
              </div>
            </button>

            {/* Expandable Nested Transactions Accordion */}
            {isSelected && (
              <div
                className={`transition-all duration-200 ease-in-out rounded-b-xl border-x border-b -mt-2 pt-3 pb-2 px-3 mb-2 animate-in fade-in slide-in-from-top-1 ${
                  isOled
                    ? 'bg-[#0D1117] border-[#21262D]'
                    : 'bg-slate-50/80 border-slate-200'
                }`}
              >
                {activeCategoryTransactions.length === 0 ? (
                  <p className="py-3 text-center text-xs text-slate-400 dark:text-slate-500 font-medium">
                    {language === 'pt-BR'
                      ? 'Nenhum lançamento encontrado nesta categoria.'
                      : 'No transactions found in this category.'}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-200/50 dark:divide-[#21262D]/60">
                    {activeCategoryTransactions.map((tx) => {
                      const isTxInvoice = isInvoiceTransaction(tx);

                      return (
                        <div
                          key={tx.id}
                          className="py-2 cursor-default select-none first:pt-1 last:pb-1"
                        >
                          {/* Top Line: Description & Amount */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                              {tx.description}
                            </span>
                            <span
                              className={`text-xs font-bold shrink-0 ${
                                tx.type === 'expense' ? 'text-red-500' : 'text-emerald-500'
                              }`}
                            >
                              {tx.type === 'expense' ? '-' : '+'}
                              {formatCurrency(tx.amount, currency)}
                            </span>
                          </div>

                          {/* Bottom Line: Badges & Date */}
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Status Badge */}
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                                  tx.status === 'unpaid'
                                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                                }`}
                              >
                                {tx.status === 'unpaid'
                                  ? language === 'pt-BR'
                                    ? 'Pendente'
                                    : 'Pending'
                                  : language === 'pt-BR'
                                  ? 'Pago'
                                  : 'Paid'}
                              </span>

                              {/* Installments Badge */}
                              {Boolean(tx.installmentTotal && tx.installmentTotal > 1) && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-[#161B22] dark:text-slate-300 border border-slate-200/80 dark:border-[#21262D]">
                                  {tx.installmentCurrent || 1}/{tx.installmentTotal}
                                </span>
                              )}

                              {/* Card Invoice Badge */}
                              {Boolean(isTxInvoice || activeCategoryId === INVOICE_SLICE_ID) && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                  {language === 'pt-BR' ? 'Fatura Cartão' : 'Card Invoice'}
                                </span>
                              )}

                              {/* Recurring Badge */}
                              {Boolean(tx.recurringId || tx.isRecurring) && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-[#161B22] dark:text-slate-400 border border-slate-200/80 dark:border-[#21262D]">
                                  {language === 'pt-BR' ? 'Fixa' : 'Fixed'}
                                </span>
                              )}
                            </div>

                            <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 font-medium">
                              {formatNumericDate(tx.date)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
