import React, { memo } from 'react';
import { AppLanguage, CreditCard, TransactionType } from '../../types';
import {
  BalanceCurveSummary,
  BudgetRigiditySummary,
  BurnRateSummary,
  CashflowEvolutionSummary,
  FuelEfficiencySummary,
  InstallmentProjectionSummary,
} from '../../utils/reportAggregators';
import { useReportsData } from './useReportsData';
import { ReportsCategorySection } from './ReportsCategorySection';
import { ReportsCardsSection } from './ReportsCardsSection';
import { CashflowEvolutionChart } from './CashflowEvolutionChart';
import { BalanceCurveChart } from './BalanceCurveChart';
import { InstallmentProjectionChart } from './InstallmentProjectionChart';
import { BurnRateChart } from './BurnRateChart';
import { BudgetRigidityChart } from './BudgetRigidityChart';
import { FuelEfficiencyChart } from './FuelEfficiencyChart';

export interface ReportsCardRendererProps {
  logicalIdx: number;
  monthTitle: string;
  currency: string;
  language: AppLanguage;
  isOled: boolean;
  selectedType: TransactionType;
  activeCategoryId: string | null;
  creditCards: CreditCard[];
  selectedCardFilter: string;
  activeCardCategoryId: string | null;
  data: ReturnType<typeof useReportsData>;
  cashflowSummary: CashflowEvolutionSummary;
  balanceCurveSummary: BalanceCurveSummary;
  installmentSummary: InstallmentProjectionSummary;
  burnRateSummary: BurnRateSummary;
  budgetRigiditySummary: BudgetRigiditySummary;
  fuelEfficiencySummary: FuelEfficiencySummary;
  onSelectType: (type: TransactionType) => void;
  onToggleCategory: (categoryId: string) => void;
  onResetCategory: () => void;
  onSelectCardFilter: (cardId: string) => void;
  onToggleCardCategory: (categoryId: string) => void;
  onResetCardCategory: () => void;
}

/**
 * Renders one of the 8 analytical report cards by logical index (0..7),
 * shared between the mobile circular carousel and desktop Bento grid.
 */
export const ReportsCardRenderer = memo<ReportsCardRendererProps>(({
  logicalIdx,
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
  onSelectType,
  onToggleCategory,
  onResetCategory,
  onSelectCardFilter,
  onToggleCardCategory,
  onResetCardCategory,
}) => {
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
          onSelectType={onSelectType}
          onToggleCategory={onToggleCategory}
          onResetCategory={onResetCategory}
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
          onSelectCardFilter={onSelectCardFilter}
          onToggleCardCategory={onToggleCardCategory}
          onResetCardCategory={onResetCardCategory}
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
});

ReportsCardRenderer.displayName = 'ReportsCardRenderer';
