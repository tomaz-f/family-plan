import React from 'react';
import {
  AppLanguage,
  AppTheme,
  Category,
  CreditCard,
  RecurringTemplate,
  Transaction,
  TransactionType,
} from '../types';
import { TransactionsView } from './TransactionsView';
import { DashboardDesktopSidePanel } from './dashboard/DashboardDesktopSidePanel';
import { useDashboardAnalytics } from './dashboard/useDashboardAnalytics';

export type { UseDashboardAnalyticsParams } from './dashboard/useDashboardAnalytics';

export interface DashboardViewProps {
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  theme: AppTheme;
  initialBalance?: number;
  categories: Category[];
  creditCards?: CreditCard[];
  transactions: Transaction[];
  recurringTemplates?: RecurringTemplate[];
  onOpenAddModal: (type: TransactionType) => void;
  onOpenEditModal: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
  onToggleTransactionStatus: (tx: Transaction) => Promise<void>;
  onOpenBalanceModal?: () => void;
  onNavigateTab: (tab: 'dashboard' | 'transactions' | 'cards' | 'fuel' | 'reports') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  selectedMonth,
  currency,
  language,
  theme,
  initialBalance = 0,
  categories,
  creditCards = [],
  transactions,
  recurringTemplates = [],
  onOpenAddModal,
  onOpenEditModal,
  onDeleteTransaction,
  onToggleTransactionStatus,
  onOpenBalanceModal,
  onNavigateTab,
}) => {
  const analytics = useDashboardAnalytics({
    selectedMonth,
    language,
    theme,
    initialBalance,
    categories,
    creditCards,
    transactions,
  });

  return (
    <TransactionsView
      selectedMonth={selectedMonth}
      currency={currency}
      language={language}
      categories={categories}
      creditCards={creditCards}
      transactions={transactions}
      onOpenAddModal={onOpenAddModal}
      onOpenEditModal={onOpenEditModal}
      onDeleteTransaction={onDeleteTransaction}
      onToggleTransactionStatus={onToggleTransactionStatus}
      currentBankBalance={analytics.currentBankBalance}
      monthStats={analytics.monthStats}
      onOpenBalanceModal={onOpenBalanceModal}
      desktopSidePanel={
        <DashboardDesktopSidePanel
          selectedMonth={selectedMonth}
          currency={currency}
          language={language}
          theme={theme}
          creditCards={creditCards}
          transactions={transactions}
          recurringTemplates={recurringTemplates}
          onNavigateTab={onNavigateTab}
        />
      }
    />
  );
};
