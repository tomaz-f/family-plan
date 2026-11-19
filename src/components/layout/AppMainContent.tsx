import React from 'react';
import {
  AppLanguage,
  AppState,
  AppTheme,
  CreditCard,
  FuelType,
  Transaction,
  TransactionType,
} from '../../types';
import { DashboardView } from '../DashboardView';
import { TransactionsView } from '../TransactionsView';
import { CreditCardsView } from '../CreditCardsView';
import { FuelView } from '../FuelView';
import { ReportsView } from '../ReportsView';
import { ErrorBoundary } from '../ErrorBoundary';
import { DataExportSection } from '../settings/DataExportSection';
import { SettingsView } from '../settings/SettingsView';
import { MobileSyncModalProps } from '../settings/settingsTypes';
import { AppActiveTab } from './AppHeaderBar';

interface AppMainContentProps {
  activeTab: AppActiveTab;
  selectedMonth: string;
  state: AppState;
  language: AppLanguage;
  theme: AppTheme;
  openRefuelTrigger: number;
  isOnlineWithServer: boolean;
  pendingOfflineCount: number;
  currentBankBalance: number;
  familyId: string | null;
  masterKey: string | null;
  setActiveTab: React.Dispatch<React.SetStateAction<AppActiveTab>>;
  setSelectedMonth: React.Dispatch<React.SetStateAction<string>>;
  setBalanceModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveCardId: React.Dispatch<React.SetStateAction<string | null>>;
  setCardModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setFuelModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onOpenAddModal: (type: TransactionType, cardId?: string) => void;
  onOpenEditModal: (tx: Transaction) => void;
  onOpenCardExpenseModal: (cardId?: string) => void;
  onOpenEditCardExpenseModal: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
  onToggleTransactionStatus: (tx: Transaction) => Promise<void>;
  onSaveCard: (
    cardData: Partial<CreditCard> & {
      name: string;
      totalLimit: number;
      closingDay: number;
      dueDay: number;
    }
  ) => Promise<void>;
  onDeleteCard: (cardId: string) => Promise<void>;
  onPayCardInvoice: (cardId: string, invoiceMonth: string) => Promise<void>;
  onSaveFuelLog: (fuelData: {
    id?: string;
    date: string;
    odometer: number;
    pricePerLiter: number;
    totalCost: number;
    liters: number;
    fuelType: FuelType;
    stationName: string;
    isFullTank: boolean;
    notes?: string;
  }) => Promise<void>;
  onDeleteFuelLog: (id: string) => Promise<void>;
  onUpdateTankCapacity: (capacity: number) => Promise<void>;
  onLeaveFamily: () => void;
  onUpdateSettings: MobileSyncModalProps['onUpdateSettings'];
  onAddCategory: MobileSyncModalProps['onAddCategory'];
  onUpdateCategory: MobileSyncModalProps['onUpdateCategory'];
  onDeleteCategory: MobileSyncModalProps['onDeleteCategory'];
  onImportBackup: MobileSyncModalProps['onImportBackup'];
  onExportBackup: MobileSyncModalProps['onExportBackup'];
  onResetAccount: MobileSyncModalProps['onResetAccount'];
}

export const AppMainContent: React.FC<AppMainContentProps> = (props) => {
  const {
    activeTab,
    selectedMonth,
    state,
    language,
    theme,
    openRefuelTrigger,
    isOnlineWithServer,
    pendingOfflineCount,
    currentBankBalance,
    familyId,
    masterKey,
    setActiveTab,
    setSelectedMonth,
    setBalanceModalOpen,
    setActiveCardId,
    setCardModalOpen,
    setFuelModalOpen,
    onOpenAddModal,
    onOpenEditModal,
    onOpenCardExpenseModal,
    onOpenEditCardExpenseModal,
    onDeleteTransaction,
    onToggleTransactionStatus,
    onSaveCard,
    onDeleteCard,
    onPayCardInvoice,
    onSaveFuelLog,
    onDeleteFuelLog,
    onUpdateTankCapacity,
    onLeaveFamily,
    onUpdateSettings,
    onAddCategory,
    onUpdateCategory,
    onDeleteCategory,
    onImportBackup,
    onExportBackup,
    onResetAccount,
  } = props;

  return (
    <main className="flex-1 max-w-lg w-full mx-auto px-4 pt-4 pb-28 lg:max-w-none lg:mx-0 lg:p-0 lg:pl-64">
      <div className="w-full lg:max-w-7xl lg:mx-auto lg:px-6 lg:py-6">
      {activeTab === 'dashboard' && (
        <ErrorBoundary fallbackTitle="Erro ao carregar o Painel Principal">
          <DashboardView
            selectedMonth={selectedMonth}
            currency={state.settings.currency}
            language={language}
            theme={theme}
            initialBalance={state.settings.initialBalance}
            categories={state.categories}
            creditCards={state.creditCards || []}
            transactions={state.transactions}
            recurringTemplates={state.recurringTemplates}
            onOpenAddModal={onOpenAddModal}
            onOpenEditModal={onOpenEditModal}
            onDeleteTransaction={onDeleteTransaction}
            onToggleTransactionStatus={onToggleTransactionStatus}
            onOpenBalanceModal={() => setBalanceModalOpen(true)}
            onNavigateTab={setActiveTab}
          />
        </ErrorBoundary>
      )}

      {activeTab === 'transactions' && (
        <TransactionsView
          selectedMonth={selectedMonth}
          currency={state.settings.currency}
          language={language}
          categories={state.categories}
          creditCards={state.creditCards || []}
          transactions={state.transactions}
          onOpenAddModal={onOpenAddModal}
          onOpenEditModal={onOpenEditModal}
          onDeleteTransaction={onDeleteTransaction}
          onToggleTransactionStatus={onToggleTransactionStatus}
        />
      )}

      {activeTab === 'cards' && (
        <ErrorBoundary fallbackTitle="Erro ao carregar Cartões de Crédito">
          <CreditCardsView
            selectedMonth={selectedMonth}
            creditCards={state.creditCards || []}
            transactions={state.transactions}
            categories={state.categories}
            currency={state.settings.currency}
            language={language}
            theme={theme}
            onSaveCard={onSaveCard}
            onDeleteCard={onDeleteCard}
            onPayInvoice={onPayCardInvoice}
            onOpenAddExpense={onOpenCardExpenseModal}
            onEditTransaction={onOpenEditCardExpenseModal}
            onDeleteTransaction={(tx) => onDeleteTransaction(tx.id)}
            onActiveCardChange={setActiveCardId}
            onModalOpenChange={setCardModalOpen}
          />
        </ErrorBoundary>
      )}

      {activeTab === 'fuel' && (
        <FuelView
          selectedMonth={selectedMonth}
          currency={state.settings.currency}
          language={language}
          theme={theme}
          tankCapacity={state.settings.tankCapacity || 50}
          fuelLogs={state.fuelLogs || []}
          onSaveFuelLog={onSaveFuelLog}
          onDeleteFuelLog={onDeleteFuelLog}
          onUpdateTankCapacity={onUpdateTankCapacity}
          openRefuelTrigger={openRefuelTrigger}
          onModalOpenChange={setFuelModalOpen}
        />
      )}

      {activeTab === 'reports' && (
        <ReportsView
          selectedMonth={selectedMonth}
          familyName={state.settings.familyName}
          currency={state.settings.currency}
          language={language}
          theme={theme}
          initialBalance={state.settings.initialBalance}
          categories={state.categories}
          creditCards={state.creditCards || []}
          transactions={state.transactions}
          recurringTemplates={state.recurringTemplates}
          fuelLogs={state.fuelLogs || []}
          onSelectMonth={setSelectedMonth}
        />
      )}

      {activeTab === 'export' && (
        <DataExportSection
          state={state}
          language={language}
          embedded
          onNavigateSettings={() => setActiveTab('settings')}
          onBackMobile={() => setActiveTab('dashboard')}
        />
      )}

      {activeTab === 'settings' && (
        <ErrorBoundary fallbackTitle="Erro ao carregar Configurações">
          <SettingsView
            state={state}
            language={language}
            theme={theme}
            isOnlineWithServer={isOnlineWithServer}
            pendingOfflineCount={pendingOfflineCount}
            currentBankBalance={currentBankBalance}
            familyId={familyId}
            masterKey={masterKey}
            onLeaveFamily={onLeaveFamily}
            onUpdateSettings={onUpdateSettings}
            onAddCategory={onAddCategory}
            onUpdateCategory={onUpdateCategory}
            onDeleteCategory={onDeleteCategory}
            onImportBackup={onImportBackup}
            onExportBackup={onExportBackup}
            onResetAccount={onResetAccount}
            onNavigateTab={setActiveTab}
          />
        </ErrorBoundary>
      )}
      </div>
    </main>
  );
};
