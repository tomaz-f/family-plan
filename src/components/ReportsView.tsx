import React, { useState, useCallback, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import { TransactionType } from '../types';
import { useIsDesktop } from '../hooks/useIsDesktop';
import { formatMonthLabel } from '../utils/format';
import {
  aggregateBalanceCurve,
  aggregateBudgetRigidity,
  aggregateCashflowEvolution,
  aggregateFuelEfficiency,
  aggregateInstallmentProjections,
  aggregateMonthlyBurnRate,
} from '../utils/reportAggregators';
import { REPORT_SLIDES, ReportsViewProps, VIRTUAL_SLIDE_MAP } from './reports/reportsTypes';
import { useReportsCarousel } from './reports/useReportsCarousel';
import { useReportsData } from './reports/useReportsData';
import { ReportsQuickSelectorBar } from './reports/ReportsQuickSelectorBar';
import { ReportsCardRenderer } from './reports/ReportsCardRenderer';

export type { ReportsViewProps };

/**
 * Reports View hosting 8 financial reports inside a 2-column desktop Bento grid
 * (>= 1024px) or a 60fps gesture-driven infinite circular carousel on mobile.
 */
export const ReportsView: React.FC<ReportsViewProps> = ({
  selectedMonth,
  currency,
  language,
  theme = 'oled',
  initialBalance,
  categories,
  creditCards = [],
  transactions,
  recurringTemplates = [],
  fuelLogs = [],
}) => {
  const isDesktop = useIsDesktop();
  const [selectedType, setSelectedType] = useState<TransactionType>('expense');
  const [selectedCardFilter, setSelectedCardFilter] = useState<string>('all');

  const categoryScopeKey = `${selectedMonth}__${selectedType}`;
  const [categorySelection, setCategorySelection] = useState<{ scope: string; id: string | null }>({
    scope: categoryScopeKey,
    id: null,
  });
  const activeCategoryId =
    categorySelection.scope === categoryScopeKey ? categorySelection.id : null;

  const cardScopeKey = `${selectedMonth}__${selectedCardFilter}`;
  const [cardCategorySelection, setCardCategorySelection] = useState<{
    scope: string;
    id: string | null;
  }>({ scope: cardScopeKey, id: null });
  const [prevSelectedMonth, setPrevSelectedMonth] = useState(selectedMonth);
  if (prevSelectedMonth !== selectedMonth) {
    setPrevSelectedMonth(selectedMonth);
    setCardCategorySelection({ scope: cardScopeKey, id: null });
  }
  const activeCardCategoryId =
    cardCategorySelection.scope === cardScopeKey ? cardCategorySelection.id : null;

  const isOled = theme === 'oled';
  const carousel = useReportsCarousel();

  const handleToggleCategory = useCallback(
    (id: string) => {
      setCategorySelection((prev) => ({
        scope: categoryScopeKey,
        id: prev.scope === categoryScopeKey && prev.id === id ? null : id,
      }));
    },
    [categoryScopeKey]
  );

  const handleResetCategory = useCallback(() => {
    setCategorySelection({ scope: categoryScopeKey, id: null });
  }, [categoryScopeKey]);

  const handleSelectCardFilter = useCallback(
    (cardId: string) => {
      setSelectedCardFilter(cardId);
      setCardCategorySelection({ scope: `${selectedMonth}__${cardId}`, id: null });
    },
    [selectedMonth]
  );

  const handleToggleCardCategory = useCallback(
    (id: string) => {
      setCardCategorySelection((prev) => ({
        scope: cardScopeKey,
        id: prev.scope === cardScopeKey && prev.id === id ? null : id,
      }));
    },
    [cardScopeKey]
  );

  const handleResetCardCategory = useCallback(() => {
    setCardCategorySelection({ scope: cardScopeKey, id: null });
  }, [cardScopeKey]);

  const data = useReportsData({
    transactions, categories, creditCards, selectedMonth,
    selectedType, selectedCardFilter, activeCategoryId, activeCardCategoryId, language,
  });

  const cashflowSummary = useMemo(
    () => aggregateCashflowEvolution(transactions, creditCards, selectedMonth, language),
    [transactions, creditCards, selectedMonth, language]
  );
  const balanceCurveSummary = useMemo(
    () => aggregateBalanceCurve(transactions, creditCards, initialBalance, selectedMonth, language),
    [transactions, creditCards, initialBalance, selectedMonth, language]
  );
  const installmentSummary = useMemo(
    () => aggregateInstallmentProjections(transactions, creditCards, recurringTemplates, selectedMonth, language),
    [transactions, creditCards, recurringTemplates, selectedMonth, language]
  );
  const burnRateSummary = useMemo(
    () => aggregateMonthlyBurnRate(transactions, creditCards, selectedMonth),
    [transactions, creditCards, selectedMonth]
  );
  const budgetRigiditySummary = useMemo(
    () => aggregateBudgetRigidity(transactions, creditCards, recurringTemplates, selectedMonth),
    [transactions, creditCards, recurringTemplates, selectedMonth]
  );
  const fuelEfficiencySummary = useMemo(() => aggregateFuelEfficiency(fuelLogs), [fuelLogs]);

  const monthTitle = formatMonthLabel(selectedMonth, language);
  const isPt = language === 'pt-BR';

  const rendererProps = {
    monthTitle,
    currency,
    language,
    isOled,
    selectedType,
    activeCategoryId,
    creditCards,
    selectedCardFilter,
    activeCardCategoryId,
    data,
    cashflowSummary,
    balanceCurveSummary,
    installmentSummary,
    burnRateSummary,
    budgetRigiditySummary,
    fuelEfficiencySummary,
    onSelectType: setSelectedType,
    onToggleCategory: handleToggleCategory,
    onResetCategory: handleResetCategory,
    onSelectCardFilter: handleSelectCardFilter,
    onToggleCardCategory: handleToggleCardCategory,
    onResetCardCategory: handleResetCardCategory,
  };

  if (isDesktop) {
    return (
      <div className="pb-6 animate-fadeIn w-full space-y-4">
        <div
          className={`rounded-2xl border px-5 py-3.5 flex items-center justify-between gap-4 transition-colors ${
            isOled
              ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
              : 'bg-white border-[#E2E8F0] text-slate-900 shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                isOled ? 'bg-[#161B22] text-[#10B981]' : 'bg-[#F1F5F9] text-[#10B981]'
              }`}
            >
              <BarChart3 size={18} />
            </div>
            <div className="min-w-0">
              <h2
                className={`text-base font-bold tracking-tight truncate ${
                  isOled ? 'text-[#F8FAFC]' : 'text-[#0F172A]'
                }`}
              >
                {isPt ? 'Relatórios Analíticos' : 'Analytical Reports'}
              </h2>
              <p
                className={`text-xs capitalize truncate ${
                  isOled ? 'text-[#94A3B8]' : 'text-[#64748B]'
                }`}
              >
                {monthTitle}
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 tabular-nums ${
              isOled
                ? 'bg-[#161B22] text-[#94A3B8] border-[#21262D]'
                : 'bg-[#F1F5F9] text-[#64748B] border-[#E2E8F0]'
            }`}
          >
            {REPORT_SLIDES.length} {isPt ? 'gráficos' : 'charts'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 items-start">
          {REPORT_SLIDES.map((slide) => (
            <div key={`bento-report-${slide.index}`} className="min-w-0">
              <ReportsCardRenderer logicalIdx={slide.index} {...rendererProps} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-6 animate-fadeIn max-w-lg mx-auto w-full">
      {/* Top Navigation Bar: Pagination Dots + 1/8 Counter + Right-Aligned Quick Selector Dropdown */}
      <ReportsQuickSelectorBar
        activeSlideIndex={carousel.activeSlideIndex}
        language={language}
        isOled={isOled}
        onSelectSlide={carousel.handleSelectSlide}
      />

      {/* Gesture-Driven Infinite Circular Carousel with Spring Physics */}
      <div
        className="relative w-full overflow-hidden touch-pan-y select-none cursor-grab active:cursor-grabbing"
        onTouchStart={carousel.handleTouchStart}
        onTouchMove={carousel.handleTouchMove}
        onTouchEnd={carousel.handleTouchEnd}
        onTouchCancel={carousel.handleTouchEnd}
        onMouseDown={carousel.handleMouseDown}
        onMouseMove={carousel.handleMouseMove}
        onMouseUp={carousel.handleMouseUp}
        onMouseLeave={carousel.handleMouseUp}
        onClickCapture={carousel.handleClickCapture}
      >
        <div
          className="flex w-full items-start"
          onTransitionEnd={carousel.handleTrackTransitionEnd}
          style={{
            transform: `translate3d(calc(-${carousel.vIndex * 100}% + ${carousel.dragOffset}px), 0, 0)`,
            transition: carousel.isAnimating
              ? 'transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)'
              : 'none',
            willChange: carousel.isDragging || carousel.isAnimating ? 'transform' : 'auto',
          }}
        >
          {VIRTUAL_SLIDE_MAP.map((logicalIdx, slotIdx) => (
            <div key={`virtual-slide-${slotIdx}`} className="w-full shrink-0 px-0.5">
              <ReportsCardRenderer logicalIdx={logicalIdx} {...rendererProps} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
