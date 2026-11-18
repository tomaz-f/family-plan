import React, { useState, useCallback, useMemo } from 'react';
import { TransactionType } from '../types';
import { formatMonthLabel } from '../utils/format';
import {
  aggregateBalanceCurve,
  aggregateBudgetRigidity,
  aggregateCashflowEvolution,
  aggregateFuelEfficiency,
  aggregateInstallmentProjections,
  aggregateMonthlyBurnRate,
} from '../utils/reportAggregators';
import {
  ReportsViewProps,
  VIRTUAL_SLIDE_MAP,
} from './reports/reportsTypes';
import { useReportsCarousel } from './reports/useReportsCarousel';
import { useReportsData } from './reports/useReportsData';
import { ReportsQuickSelectorBar } from './reports/ReportsQuickSelectorBar';
import { ReportsCategorySection } from './reports/ReportsCategorySection';
import { ReportsCardsSection } from './reports/ReportsCardsSection';
import { CashflowEvolutionChart } from './reports/CashflowEvolutionChart';
import { BalanceCurveChart } from './reports/BalanceCurveChart';
import { InstallmentProjectionChart } from './reports/InstallmentProjectionChart';
import { BurnRateChart } from './reports/BurnRateChart';
import { BudgetRigidityChart } from './reports/BudgetRigidityChart';
import { FuelEfficiencyChart } from './reports/FuelEfficiencyChart';

export type {
  ReportsViewProps,
  CategorySliceItem,
  NonCardInstallmentPlan,
  AmortizationTimelinePoint,
  InstallmentExpenseTrackerProps,
  MonthCommitmentProjection,
  FutureCommitmentsForecastProps,
} from './reports/reportsTypes';
export { useInstallmentPlans } from './reports/useInstallmentPlans';
export { InstallmentExpenseTracker } from './reports/InstallmentExpenseTracker';
export { FutureCommitmentsForecast } from './reports/ReportsCashFlowSection';

/**
 * Reports View hosting 8 financial reports inside a 60fps gesture-driven
 * infinite circular carousel synchronized with a right-aligned Quick Selector Dropdown.
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
      setCardCategorySelection({
        scope: `${selectedMonth}__${cardId}`,
        id: null,
      });
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
    transactions,
    categories,
    creditCards,
    selectedMonth,
    selectedType,
    selectedCardFilter,
    activeCategoryId,
    activeCardCategoryId,
    language,
  });

  const cashflowSummary = useMemo(
    () => aggregateCashflowEvolution(transactions, creditCards, selectedMonth, language),
    [transactions, creditCards, selectedMonth, language]
  );

  const balanceCurveSummary = useMemo(
    () =>
      aggregateBalanceCurve(
        transactions,
        creditCards,
        initialBalance,
        selectedMonth,
        language
      ),
    [transactions, creditCards, initialBalance, selectedMonth, language]
  );

  const installmentSummary = useMemo(
    () =>
      aggregateInstallmentProjections(
        transactions,
        creditCards,
        recurringTemplates,
        selectedMonth,
        language
      ),
    [transactions, creditCards, recurringTemplates, selectedMonth, language]
  );

  const burnRateSummary = useMemo(
    () => aggregateMonthlyBurnRate(transactions, creditCards, selectedMonth),
    [transactions, creditCards, selectedMonth]
  );

  const budgetRigiditySummary = useMemo(
    () =>
      aggregateBudgetRigidity(
        transactions,
        creditCards,
        recurringTemplates,
        selectedMonth
      ),
    [transactions, creditCards, recurringTemplates, selectedMonth]
  );

  const fuelEfficiencySummary = useMemo(
    () => aggregateFuelEfficiency(fuelLogs),
    [fuelLogs]
  );

  const monthTitle = formatMonthLabel(selectedMonth, language);

  const renderReportCard = (logicalIdx: number) => {
    switch (logicalIdx) {
      case 0:
        return (
          <ReportsCategorySection
            monthTitle={monthTitle}
            totalCount={data.totalCount}
            totalAmount={data.totalAmount}
            selectedType={selectedType}
            categorySlices={data.categorySlices}
            activeCategoryId={activeCategoryId}
            activeSlice={data.activeSlice}
            activeCategoryTransactions={data.activeCategoryTransactions}
            currency={currency}
            language={language}
            isOled={isOled}
            onSelectType={setSelectedType}
            onToggleCategory={handleToggleCategory}
            onResetCategory={handleResetCategory}
          />
        );

      case 1:
        return (
          <ReportsCardsSection
            creditCards={creditCards}
            selectedCardFilter={selectedCardFilter}
            cardCategorySlices={data.cardCategorySlices}
            cardTotalAmount={data.cardTotalAmount}
            cardTotalCount={data.cardTotalCount}
            activeCardCategoryId={activeCardCategoryId}
            activeCardSlice={data.activeCardSlice}
            activeCardCategoryTransactions={data.activeCardCategoryTransactions}
            currency={currency}
            language={language}
            isOled={isOled}
            onSelectCardFilter={handleSelectCardFilter}
            onToggleCardCategory={handleToggleCardCategory}
            onResetCardCategory={handleResetCardCategory}
          />
        );

      case 2:
        return (
          <CashflowEvolutionChart
            summary={cashflowSummary}
            currency={currency}
            language={language}
            isOled={isOled}
          />
        );

      case 3:
        return (
          <BalanceCurveChart
            summary={balanceCurveSummary}
            currency={currency}
            language={language}
            isOled={isOled}
          />
        );

      case 4:
        return (
          <InstallmentProjectionChart
            summary={installmentSummary}
            currency={currency}
            language={language}
            isOled={isOled}
          />
        );

      case 5:
        return (
          <BurnRateChart
            summary={burnRateSummary}
            currency={currency}
            language={language}
            isOled={isOled}
          />
        );

      case 6:
        return (
          <BudgetRigidityChart
            summary={budgetRigiditySummary}
            currency={currency}
            language={language}
            isOled={isOled}
          />
        );

      case 7:
      default:
        return (
          <FuelEfficiencyChart
            summary={fuelEfficiencySummary}
            currency={currency}
            language={language}
            isOled={isOled}
          />
        );
    }
  };

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
              {renderReportCard(logicalIdx)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
