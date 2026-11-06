import React, { useCallback } from 'react';
import {
  exportFilteredHistoryToCSV,
  exportFilteredHistoryToPDF,
} from './utils/exportReport';
import { FamilyOnboardingScreen } from './components/FamilyOnboardingScreen';
import {
  DEFAULT_CORE_CATEGORIES,
  useAppStorageState,
} from './hooks/useAppStorageState';
import { useAppUiState } from './hooks/useAppUiState';
import { useCloudSyncLifecycle } from './hooks/useCloudSyncLifecycle';
import { useTransactionCrud } from './hooks/useTransactionCrud';
import { useSettingsCategoriesCrud } from './hooks/useSettingsCategoriesCrud';
import { useCardFuelRecurringCrud } from './hooks/useCardFuelRecurringCrud';
import { AppHeaderBar } from './components/layout/AppHeaderBar';
import { AppMainContent } from './components/layout/AppMainContent';
import { AppBottomNavigation } from './components/layout/AppBottomNavigation';
import { AppModalsHost } from './components/layout/AppModalsHost';

export { DEFAULT_CORE_CATEGORIES };

export const App: React.FC = () => {
  const {
    familyId,
    setFamilyId,
    masterKey,
    setMasterKey,
    authErrorMessage,
    setAuthErrorMessage,
    authFamilyId,
    setAuthFamilyId,
    state,
    setState,
    pendingOfflineTx,
    setPendingOfflineTx,
    isOnlineWithServer,
    setIsOnlineWithServer,
    language,
    theme,
    saveStateToCache,
    currentBankBalance,
  } = useAppStorageState();

  const ui = useAppUiState(state.creditCards);

  const { handleLeaveFamily, handleDecryptionFailure } = useCloudSyncLifecycle({
    familyId,
    masterKey,
    state,
    isAnyModalOpen: ui.isAnyModalOpen,
    setFamilyId,
    setMasterKey,
    setAuthFamilyId,
    setAuthErrorMessage,
    setState,
    setPendingOfflineTx,
    setIsOnlineWithServer,
    saveStateToCache,
  });

  const {
    handleSaveTransaction,
    handleToggleTransactionStatus,
    executeDeleteTransaction,
    handleDeleteTransaction,
  } = useTransactionCrud({
    state,
    familyId,
    masterKey,
    pendingOfflineTx,
    setPendingOfflineTx,
    setIsOnlineWithServer,
    setDeletingSeriesTx: ui.setDeletingSeriesTx,
    saveStateToCache,
    handleDecryptionFailure,
  });

  const {
    handleUpdateSettings,
    handleAddCategory,
    handleUpdateCategory,
    handleDeleteCategory,
    handleExportBackup,
    handleImportBackup,
    handleResetAccount,
  } = useSettingsCategoriesCrud({
    state,
    familyId,
    masterKey,
    language,
    pendingOfflineTx,
    categoryManagerContext: ui.categoryManagerContext,
    setPendingOfflineTx,
    setIsOnlineWithServer,
    setNewlyCreatedCategoryId: ui.setNewlyCreatedCategoryId,
    setSyncModalOpen: ui.setSyncModalOpen,
    setCategoryManagerContext: ui.setCategoryManagerContext,
    saveStateToCache,
  });

  const {
    handleSaveFuelLog,
    handleDeleteFuelLog,
    handleSaveCard,
    handleDeleteCard,
    handlePayCardInvoice,
  } = useCardFuelRecurringCrud({
    state,
    familyId,
    masterKey,
    language,
    setIsOnlineWithServer,
    saveStateToCache,
    handleDecryptionFailure,
  });

  const buildCurrentMonthExportOptions = useCallback(
    () => ({
      periodMode: 'monthly' as const,
      year: ui.selectedMonth.slice(0, 4),
      month: ui.selectedMonth.slice(5, 7),
      typeFilter: 'all' as const,
      familyName: state.settings.familyName,
      currency: state.settings.currency,
      language,
      initialBalance: state.settings.initialBalance,
      categories: state.categories,
      transactions: state.transactions,
      fuelLogs: state.fuelLogs || [],
    }),
    [
      ui.selectedMonth,
      state.settings.familyName,
      state.settings.currency,
      state.settings.initialBalance,
      state.categories,
      state.transactions,
      state.fuelLogs,
      language,
    ]
  );

  const handleExportMonthlyPDF = () => {
    ui.setFabMenuOpen(false);
    void exportFilteredHistoryToPDF(buildCurrentMonthExportOptions()).catch((err) => {
      console.error('Failed to export monthly PDF report:', err);
    });
  };

  const handleExportMonthlySpreadsheet = () => {
    ui.setFabMenuOpen(false);
    exportFilteredHistoryToCSV(buildCurrentMonthExportOptions());
  };

  if (!familyId || !masterKey) {
    return (
      <FamilyOnboardingScreen
        onJoined={(newId, newKey) => {
          setFamilyId(newId);
          setMasterKey(newKey);
          setAuthErrorMessage(null);
          setAuthFamilyId(null);
        }}
        initialError={authErrorMessage}
        initialFamilyId={authFamilyId}
      />
    );
  }

  return (
    <div className="app-shell min-h-[100dvh] w-full flex flex-col bg-[#F8FAFC] text-slate-900 pb-28 transition-colors">
      <AppHeaderBar
        familyName={state.settings.familyName}
        selectedMonth={ui.selectedMonth}
        language={language}
        theme={theme}
        headerMenuOpen={ui.headerMenuOpen}
        setActiveTab={ui.setActiveTab}
        setSelectedMonth={ui.setSelectedMonth}
        setHeaderMenuOpen={ui.setHeaderMenuOpen}
        setSyncModalTab={ui.setSyncModalTab}
        setSyncModalOpen={ui.setSyncModalOpen}
        onUpdateTheme={(nextTheme) => handleUpdateSettings({ theme: nextTheme })}
      />

      <AppMainContent
        activeTab={ui.activeTab}
        selectedMonth={ui.selectedMonth}
        state={state}
        language={language}
        theme={theme}
        openRefuelTrigger={ui.openRefuelTrigger}
        setActiveTab={ui.setActiveTab}
        setSelectedMonth={ui.setSelectedMonth}
        setBalanceModalOpen={ui.setBalanceModalOpen}
        setActiveCardId={ui.setActiveCardId}
        setCardModalOpen={ui.setCardModalOpen}
        setFuelModalOpen={ui.setFuelModalOpen}
        onOpenAddModal={ui.handleOpenAddModal}
        onOpenEditModal={ui.handleOpenEditModal}
        onOpenCardExpenseModal={ui.handleOpenCardExpenseModal}
        onOpenEditCardExpenseModal={ui.handleOpenEditCardExpenseModal}
        onDeleteTransaction={handleDeleteTransaction}
        onToggleTransactionStatus={handleToggleTransactionStatus}
        onSaveCard={handleSaveCard}
        onDeleteCard={handleDeleteCard}
        onPayCardInvoice={handlePayCardInvoice}
        onSaveFuelLog={handleSaveFuelLog}
        onDeleteFuelLog={handleDeleteFuelLog}
        onUpdateTankCapacity={(cap) => handleUpdateSettings({ tankCapacity: cap })}
      />

      <AppBottomNavigation
        activeTab={ui.activeTab}
        fabMenuOpen={ui.fabMenuOpen}
        language={language}
        activeCardId={ui.activeCardId}
        creditCards={state.creditCards || []}
        setActiveTab={ui.setActiveTab}
        setFabMenuOpen={ui.setFabMenuOpen}
        setOpenRefuelTrigger={ui.setOpenRefuelTrigger}
        onOpenAddModal={ui.handleOpenAddModal}
        onOpenCardExpenseModal={ui.handleOpenCardExpenseModal}
        onExportMonthlyPDF={handleExportMonthlyPDF}
        onExportMonthlySpreadsheet={handleExportMonthlySpreadsheet}
      />

      <AppModalsHost
        state={state}
        language={language}
        theme={theme}
        isOnlineWithServer={isOnlineWithServer}
        pendingOfflineCount={pendingOfflineTx.length}
        currentBankBalance={currentBankBalance}
        familyId={familyId}
        masterKey={masterKey}
        txModalOpen={ui.txModalOpen}
        txModalInitialType={ui.txModalInitialType}
        txModalInitialCardId={ui.txModalInitialCardId}
        editingTx={ui.editingTx}
        cardExpenseModalOpen={ui.cardExpenseModalOpen}
        cardExpenseInitialCardId={ui.cardExpenseInitialCardId}
        editingCardTx={ui.editingCardTx}
        deletingSeriesTx={ui.deletingSeriesTx}
        balanceModalOpen={ui.balanceModalOpen}
        syncModalOpen={ui.syncModalOpen}
        syncModalTab={ui.syncModalTab}
        categoryManagerContext={ui.categoryManagerContext}
        newlyCreatedCategoryId={ui.newlyCreatedCategoryId}
        setTxModalOpen={ui.setTxModalOpen}
        setCardExpenseModalOpen={ui.setCardExpenseModalOpen}
        setDeletingSeriesTx={ui.setDeletingSeriesTx}
        setBalanceModalOpen={ui.setBalanceModalOpen}
        setSyncModalOpen={ui.setSyncModalOpen}
        setSyncModalTab={ui.setSyncModalTab}
        setCategoryManagerContext={ui.setCategoryManagerContext}
        setNewlyCreatedCategoryId={ui.setNewlyCreatedCategoryId}
        onSaveTransaction={handleSaveTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        onExecuteDeleteTransaction={executeDeleteTransaction}
        onLeaveFamily={handleLeaveFamily}
        onUpdateSettings={handleUpdateSettings}
        onAddCategory={handleAddCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
        onImportBackup={handleImportBackup}
        onExportBackup={handleExportBackup}
        onResetAccount={handleResetAccount}
      />
    </div>
  );
};
