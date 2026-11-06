import React from 'react';
import { AppLanguage, CreditCard } from '../../types';
import { formatCurrency } from '../../utils/format';
import { CategoryIcon } from '../CategoryIcon';
import { AppIcon } from '../icons';
import {
  CategorySliceItem,
  ComputedDonutArc,
  DONUT_CENTER,
  DONUT_RADIUS,
  DONUT_STROKE_WIDTH,
  DONUT_SVG_SIZE,
} from './reportsTypes';
import { ReportsDonutChart } from './ReportsDonutChart';

interface ReportsCardsSectionProps {
  creditCards: CreditCard[];
  selectedCardFilter: string;
  cardCategorySlices: CategorySliceItem[];
  computedCardArcs: ComputedDonutArc[];
  cardTotalAmount: number;
  cardTotalCount: number;
  activeCardCategoryId: string | null;
  activeCardSlice: CategorySliceItem | null;
  donutAnimPhase: 'init' | 'drawing' | 'done';
  currency: string;
  language: AppLanguage;
  isOled: boolean;
  onSelectCardFilter: (cardId: string) => void;
  onToggleCardCategory: (categoryId: string) => void;
  onResetCardCategory: () => void;
}

export const ReportsCardsSection: React.FC<ReportsCardsSectionProps> = ({
  creditCards,
  selectedCardFilter,
  cardCategorySlices,
  computedCardArcs,
  cardTotalAmount,
  cardTotalCount,
  activeCardCategoryId,
  activeCardSlice,
  donutAnimPhase,
  currency,
  language,
  isOled,
  onSelectCardFilter,
  onToggleCardCategory,
  onResetCardCategory,
}) => {
  const centerLabel = activeCardSlice
    ? activeCardSlice.name
    : language === 'pt-BR'
    ? 'Total Faturas'
    : 'Total Invoices';

  return (
    <section
      className={`rounded-2xl border p-5 transition-colors ${
        isOled
          ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
          : 'bg-white border-[#E2E8F0] text-slate-900 shadow-xs'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isOled
                ? 'bg-[#161B22] text-slate-300'
                : 'bg-slate-100 text-slate-700'
            } dark:bg-[#161B22] dark:text-slate-300`}
          >
            <AppIcon name="cartao" size={18} />
          </div>
          <div className="min-w-0">
            <h2
              className={`text-base font-bold tracking-tight truncate ${
                isOled ? 'text-white' : 'text-slate-900'
              } dark:text-white`}
            >
              {language === 'pt-BR' ? 'Gastos no Cartão' : 'Card Spending'}
            </h2>
            <p
              className={`text-xs mt-0.5 truncate ${
                isOled ? 'text-slate-400' : 'text-slate-500'
              } dark:text-slate-400`}
            >
              {language === 'pt-BR'
                ? 'Compras das faturas com vencimento no mês'
                : 'Purchases from invoices due in this month'}
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${
            isOled
              ? 'bg-[#161B22] text-slate-400 border-[#21262D]'
              : 'bg-slate-100 text-slate-600 border-slate-200/60'
          } dark:bg-[#161B22] dark:text-slate-400 dark:border-[#21262D]`}
        >
          {cardTotalCount}{' '}
          {language === 'pt-BR'
            ? cardTotalCount === 1
              ? 'compra'
              : 'compras'
            : cardTotalCount === 1
            ? 'purchase'
            : 'purchases'}
        </span>
      </div>

      {/* Card Filter Selector (Todos os Cartões + individual cards) */}
      {creditCards && creditCards.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-5 no-scrollbar overscroll-x-contain">
          <button
            type="button"
            onClick={() => onSelectCardFilter('all')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border ${
              selectedCardFilter === 'all'
                ? 'bg-[#6E5440] border-[#6E5440] text-white shadow-xs'
                : isOled
                ? 'bg-[#161B22] border-[#21262D] text-slate-400 hover:text-white'
                : 'bg-slate-100 border-slate-200/60 text-slate-600 hover:text-slate-900'
            } dark:border-[#21262D]`}
          >
            {language === 'pt-BR' ? 'Todos os Cartões' : 'All Cards'}
          </button>

          {creditCards.map((card) => {
            const isSelected = selectedCardFilter === card.id;
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onSelectCardFilter(card.id)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-all border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#6E5440] border-[#6E5440] text-white shadow-xs'
                    : isOled
                    ? 'bg-[#161B22] border-[#21262D] text-slate-400 hover:text-white'
                    : 'bg-slate-100 border-slate-200/60 text-slate-600 hover:text-slate-900'
                } dark:border-[#21262D]`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: card.color || '#6366F1' }}
                />
                <span>{card.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Donut Chart or Empty State */}
      {cardCategorySlices.length === 0 ? (
        <div className="py-8 flex flex-col items-center justify-center text-center">
          <div className="relative w-40 h-40 flex items-center justify-center mb-3">
            <svg
              viewBox={`0 0 ${DONUT_SVG_SIZE} ${DONUT_SVG_SIZE}`}
              className="w-full h-full -rotate-90"
            >
              <circle
                cx={DONUT_CENTER}
                cy={DONUT_CENTER}
                r={DONUT_RADIUS}
                fill="none"
                stroke={isOled ? '#161B22' : '#E2E8F0'}
                strokeWidth={DONUT_STROKE_WIDTH}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center px-4">
              <AppIcon name="cartao" size={22} className="text-[#94A3B8] opacity-40 mb-1" />
              <span
                className={`text-xs font-bold ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}
              >
                {formatCurrency(0, currency)}
              </span>
            </div>
          </div>
          <p className={`text-sm font-bold ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
            {language === 'pt-BR'
              ? 'Nenhuma compra no cartão com vencimento neste mês'
              : 'No credit card purchases due in this month'}
          </p>
          <p
            className={`text-xs mt-1 max-w-xs ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-500'
            }`}
          >
            {language === 'pt-BR'
              ? 'As compras realizadas nos cartões vinculadas a faturas com vencimento neste período aparecerão aqui.'
              : 'Card purchases belonging to billing cycles due in this period will appear grouped here.'}
          </p>
        </div>
      ) : (
        <>
          <ReportsDonutChart
            ariaLabel={
              language === 'pt-BR'
                ? 'Gráfico de Despesas no Cartão de Crédito'
                : 'Credit Card Spending Chart'
            }
            centerLabel={centerLabel}
            amountColorClass="text-[#6366F1]"
            totalAmount={cardTotalAmount}
            sliceCount={cardCategorySlices.length}
            computedArcs={computedCardArcs}
            activeSliceId={activeCardCategoryId}
            activeSlice={activeCardSlice}
            donutAnimPhase={donutAnimPhase}
            currency={currency}
            language={language}
            isOled={isOled}
            onToggleSlice={onToggleCardCategory}
            onResetSlice={onResetCardCategory}
          />

          {/* Category Breakdown Legend Below the Chart */}
          <div
            className={`mt-5 pt-4 border-t ${
              isOled ? 'border-[#21262D]/80' : 'border-slate-200'
            }`}
          >
            {cardCategorySlices.map((item) => {
              const isSelected = activeCardCategoryId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onToggleCardCategory(item.id)}
                  className={`w-full min-h-[48px] rounded-xl p-3 mb-2 last:mb-0 flex items-center justify-between gap-3 border text-left transition-all ${
                    isSelected
                      ? isOled
                        ? 'bg-[#161B22] border-[#6E5440] ring-1 ring-[#D0B595]/30'
                        : 'bg-slate-100 border-[#6E5440]'
                      : isOled
                      ? 'bg-[#161B22]/40 border-[#21262D] hover:bg-[#161B22]/70'
                      : 'bg-slate-50/70 border-slate-200/60 hover:bg-slate-100'
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

                  <div className="flex items-center gap-2.5 shrink-0">
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
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
};
