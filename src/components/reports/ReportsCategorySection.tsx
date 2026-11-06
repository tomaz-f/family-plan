import React from 'react';
import {
  PieChart as PieChartIcon,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { AppLanguage, Transaction, TransactionType } from '../../types';
import { formatCurrency } from '../../utils/format';
import {
  CategorySliceItem,
  ComputedDonutArc,
  DONUT_CENTER,
  DONUT_RADIUS,
  DONUT_STROKE_WIDTH,
  DONUT_SVG_SIZE,
} from './reportsTypes';
import { ReportsDonutChart } from './ReportsDonutChart';
import { ReportsCategoryAccordionList } from './ReportsCategoryAccordionList';

interface ReportsCategorySectionProps {
  monthTitle: string;
  totalCount: number;
  totalAmount: number;
  selectedType: TransactionType;
  categorySlices: CategorySliceItem[];
  computedArcs: ComputedDonutArc[];
  activeCategoryId: string | null;
  activeSlice: CategorySliceItem | null;
  activeCategoryTransactions: Transaction[];
  donutAnimPhase: 'init' | 'drawing' | 'done';
  currency: string;
  language: AppLanguage;
  isOled: boolean;
  onSelectType: (type: TransactionType) => void;
  onToggleCategory: (categoryId: string) => void;
  onResetCategory: () => void;
}

export const ReportsCategorySection: React.FC<ReportsCategorySectionProps> = ({
  monthTitle,
  totalCount,
  totalAmount,
  selectedType,
  categorySlices,
  computedArcs,
  activeCategoryId,
  activeSlice,
  activeCategoryTransactions,
  donutAnimPhase,
  currency,
  language,
  isOled,
  onSelectType,
  onToggleCategory,
  onResetCategory,
}) => {
  const centerLabel = activeSlice
    ? activeSlice.name
    : selectedType === 'expense'
    ? language === 'pt-BR'
      ? 'Total Despesas'
      : 'Total Expenses'
    : language === 'pt-BR'
    ? 'Total Entradas'
    : 'Total Income';

  return (
    <section
      className={`rounded-2xl border p-5 transition-colors ${
        isOled
          ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
          : 'bg-white border-[#E2E8F0] text-slate-900 shadow-xs'
      }`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isOled
                ? 'bg-[#161B22] text-slate-300'
                : 'bg-slate-100 text-slate-700'
            } dark:bg-[#161B22] dark:text-slate-300`}
          >
            <PieChartIcon size={18} />
          </div>
          <div className="min-w-0">
            <h1
              className={`text-base font-bold tracking-tight truncate ${
                isOled ? 'text-white' : 'text-slate-900'
              } dark:text-white`}
            >
              {language === 'pt-BR' ? 'Categorias Gerais' : 'General Categories'}
            </h1>
            <p
              className={`text-xs mt-0.5 capitalize truncate ${
                isOled ? 'text-slate-400' : 'text-slate-500'
              } dark:text-slate-400`}
            >
              {monthTitle}
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
          {totalCount}{' '}
          {language === 'pt-BR'
            ? totalCount === 1
              ? 'lançamento'
              : 'lançamentos'
            : totalCount === 1
            ? 'entry'
            : 'entries'}
        </span>
      </div>

      {/* Type Selector: Centered & Separated Toggle Button Pills */}
      <div className="flex items-center justify-center gap-3 mb-5 w-full">
        <button
          type="button"
          onClick={() => onSelectType('expense')}
          className={`h-8 px-4 min-w-[124px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all select-none border ${
            selectedType === 'expense'
              ? 'bg-[#EF4444] border-[#EF4444] text-white shadow-xs shadow-red-500/25 active:scale-95'
              : isOled
              ? 'bg-[#161B22] text-slate-400 border-[#21262D] hover:text-white active:scale-95'
              : 'bg-slate-100 text-slate-600 border-slate-200/60 hover:text-slate-900 active:scale-95'
          }`}
        >
          <ArrowDownRight size={14} strokeWidth={2.5} />
          <span>{language === 'pt-BR' ? 'Despesas' : 'Expenses'}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectType('income')}
          className={`h-8 px-4 min-w-[124px] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all select-none border ${
            selectedType === 'income'
              ? 'bg-[#10B981] border-[#10B981] text-white shadow-xs shadow-emerald-500/25 active:scale-95'
              : isOled
              ? 'bg-[#161B22] text-slate-400 border-[#21262D] hover:text-white active:scale-95'
              : 'bg-slate-100 text-slate-600 border-slate-200/60 hover:text-slate-900 active:scale-95'
          }`}
        >
          <ArrowUpRight size={14} strokeWidth={2.5} />
          <span>{language === 'pt-BR' ? 'Entradas' : 'Income'}</span>
        </button>
      </div>

      {/* Custom Donut Chart Built From Scratch */}
      {categorySlices.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center text-center">
          <div className="relative w-44 h-44 flex items-center justify-center mb-3">
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
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
              <PieChartIcon size={24} className="text-[#94A3B8] opacity-50 mb-1" />
              <span
                className={`text-xs font-bold ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}
              >
                {formatCurrency(0, currency)}
              </span>
            </div>
          </div>
          <p className={`text-sm font-bold ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
            {language === 'pt-BR'
              ? selectedType === 'expense'
                ? 'Nenhuma despesa neste mês'
                : 'Nenhuma entrada neste mês'
              : selectedType === 'expense'
              ? 'No expenses in this month'
              : 'No income in this month'}
          </p>
          <p
            className={`text-xs mt-1 max-w-xs ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-500'
            }`}
          >
            {language === 'pt-BR'
              ? 'Os lançamentos registrados neste período aparecerão distribuídos por categoria aqui.'
              : 'Transactions recorded in this period will appear grouped by category here.'}
          </p>
        </div>
      ) : (
        <>
          <ReportsDonutChart
            ariaLabel={
              language === 'pt-BR'
                ? 'Gráfico de Distribuição por Categoria'
                : 'Category Breakdown Chart'
            }
            centerLabel={centerLabel}
            amountColorClass={selectedType === 'expense' ? 'text-[#EF4444]' : 'text-[#10B981]'}
            totalAmount={totalAmount}
            sliceCount={categorySlices.length}
            computedArcs={computedArcs}
            activeSliceId={activeCategoryId}
            activeSlice={activeSlice}
            donutAnimPhase={donutAnimPhase}
            currency={currency}
            language={language}
            isOled={isOled}
            onToggleSlice={onToggleCategory}
            onResetSlice={onResetCategory}
          />

          <ReportsCategoryAccordionList
            categorySlices={categorySlices}
            activeCategoryId={activeCategoryId}
            activeCategoryTransactions={activeCategoryTransactions}
            currency={currency}
            language={language}
            isOled={isOled}
            onToggleCategory={onToggleCategory}
          />
        </>
      )}
    </section>
  );
};
