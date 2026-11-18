import React, { useState, useCallback } from 'react';
import { TransactionType } from '../types';
import { formatMonthLabel } from '../utils/format';
import {
  REPORT_SLIDES,
  ReportsViewProps,
  VIRTUAL_SLIDE_MAP,
} from './reports/reportsTypes';
import { useReportsCarousel } from './reports/useReportsCarousel';
import { useReportsData } from './reports/useReportsData';
import { ReportsCategorySection } from './reports/ReportsCategorySection';
import { ReportsCardsSection } from './reports/ReportsCardsSection';
import { FutureCommitmentsForecast } from './reports/ReportsCashFlowSection';
import { InstallmentExpenseTracker } from './reports/InstallmentExpenseTracker';

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
 * Reports View with two distinct Donut Charts, 6-Month Commitments Forecast,
 * and Account Installment Tracker integrated into a 100% gesture-driven
 * infinite circular carousel with spring physics transitions.
 */
export const ReportsView: React.FC<ReportsViewProps> = ({
  selectedMonth,
  currency,
  language,
  theme = 'oled',
  categories,
  creditCards = [],
  transactions,
  recurringTemplates = [],
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
          <FutureCommitmentsForecast
            selectedMonth={selectedMonth}
            currency={currency}
            language={language}
            theme={theme}
            creditCards={creditCards}
            transactions={transactions}
            recurringTemplates={recurringTemplates}
          />
        );

      case 3:
      default:
        return (
          <InstallmentExpenseTracker
            transactions={transactions}
            categories={categories}
            currency={currency}
            language={language}
            selectedMonth={selectedMonth}
            theme={theme}
          />
        );
    }
  };

  return (
    <div className="pb-6 animate-fadeIn max-w-lg mx-auto w-full">
      {/* Minimalist Pagination Dots Indicator (Positioned Above the Report Card) */}
      <div
        className="flex items-center justify-center gap-2 pt-1 pb-3"
        role="tablist"
        aria-label={language === 'pt-BR' ? 'Navegação de relatórios' : 'Reports navigation'}
      >
        {REPORT_SLIDES.map((slide) => {
          const isActive = carousel.activeSlideIndex === slide.index;
          return (
            <button
              key={slide.index}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={language === 'pt-BR' ? slide.labelPt : slide.labelEn}
              onClick={() => carousel.handleSelectSlide(slide.index)}
              className={`rounded-full transition-all duration-300 ease-out focus:outline-none ${
                isActive
                  ? 'w-2.5 h-2.5 bg-[#6E5440]'
                  : isOled
                  ? 'w-1.5 h-1.5 bg-[#21262D] hover:bg-slate-700'
                  : 'w-1.5 h-1.5 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          );
        })}
      </div>

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
