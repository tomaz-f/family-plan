import React from 'react';
import {
  AppLanguage,
  AppState,
  AppTheme,
  Category,
  Transaction,
  TransactionType,
} from '../../types';
import { TransactionModal } from '../TransactionModal';
import { CreditCardExpenseModal } from '../CreditCardExpenseModal';
import { BalanceModal } from '../BalanceModal';
import { MobileSyncModal } from '../MobileSyncModal';
import { BackupSummary } from '../../utils/backup';
import {
  SeriesConfirmModal,
  SeriesScope,
  getSubsequentPendingSeriesTransactions,
} from '../SeriesConfirmModal';
import {
  RecurringPlanInput,
  TransactionSaveInput,
} from '../../hooks/transactionCrudHelpers';
import { SyncModalTab } from './AppHeaderBar';

interface AppModalsHostProps {
  state: AppState;
  language: AppLanguage;
  theme: AppTheme;
  isOnlineWithServer: boolean;
  pendingOfflineCount: number;
  currentBankBalance: number;
  familyId: string | null;
  masterKey: string | null;
  txModalOpen: boolean;
  txModalInitialType: TransactionType;
  txModalInitialCardId: string | null;
  editingTx: Transaction | null;
  cardExpenseModalOpen: boolean;
  cardExpenseInitialCardId: string | null;
  editingCardTx: Transaction | null;
  deletingSeriesTx: Transaction | null;
  balanceModalOpen: boolean;
  syncModalOpen: boolean;
  syncModalTab: SyncModalTab;
  categoryManagerContext: 'standalone' | 'transaction' | 'cardExpense';
  newlyCreatedCategoryId: string | null;
  setTxModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCardExpenseModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeletingSeriesTx: React.Dispatch<React.SetStateAction<Transaction | null>>;
  setBalanceModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSyncModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSyncModalTab: React.Dispatch<React.SetStateAction<SyncModalTab>>;
  setCategoryManagerContext: React.Dispatch<
    React.SetStateAction<'standalone' | 'transaction' | 'cardExpense'>
  >;
  setNewlyCreatedCategoryId: React.Dispatch<React.SetStateAction<string | null>>;
  onSaveTransaction: (
    txData: TransactionSaveInput,
    recurringPlan?: RecurringPlanInput,
    scope?: SeriesScope
  ) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onExecuteDeleteTransaction: (id: string, scope?: SeriesScope) => Promise<void>;
  onLeaveFamily: () => void;
  onUpdateSettings: (payload: {
    familyName?: string;
    currency?: string;
    language?: AppLanguage;
    theme?: AppTheme;
    initialBalance?: number;
    tankCapacity?: number;
    targetCurrentBalance?: number;
  }) => Promise<void>;
  onAddCategory: (cat: {
    name: string;
    type: TransactionType;
    color: string;
    icon: string;
  }) => Promise<Category>;
  onUpdateCategory: (
    id: string,
    cat: { name: string; type: TransactionType; color: string; icon: string }
  ) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onImportBackup: (
    backupData: unknown,
    mode: 'merge' | 'replace'
  ) => Promise<{ warnings: string[]; offline: boolean }>;
  onExportBackup: () => BackupSummary;
  onResetAccount: () => Promise<void>;
}

export const AppModalsHost: React.FC<AppModalsHostProps> = ({
  state,
  language,
  theme,
  isOnlineWithServer,
  pendingOfflineCount,
  currentBankBalance,
  familyId,
  masterKey,
  txModalOpen,
  txModalInitialType,
  txModalInitialCardId,
  editingTx,
  cardExpenseModalOpen,
  cardExpenseInitialCardId,
  editingCardTx,
  deletingSeriesTx,
  balanceModalOpen,
  syncModalOpen,
  syncModalTab,
  categoryManagerContext,
  newlyCreatedCategoryId,
  setTxModalOpen,
  setCardExpenseModalOpen,
  setDeletingSeriesTx,
  setBalanceModalOpen,
  setSyncModalOpen,
  setSyncModalTab,
  setCategoryManagerContext,
  setNewlyCreatedCategoryId,
  onSaveTransaction,
  onDeleteTransaction,
  onExecuteDeleteTransaction,
  onLeaveFamily,
  onUpdateSettings,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onImportBackup,
  onExportBackup,
  onResetAccount,
}) => {
  return (
    <>
      <TransactionModal
        isOpen={txModalOpen}
        initialType={txModalInitialType}
        initialCardId={txModalInitialCardId}
        editingTransaction={editingTx}
        allTransactions={state.transactions}
        categories={state.categories}
        creditCards={state.creditCards || []}
        currency={state.settings.currency}
        language={language}
        theme={theme}
        onClose={() => setTxModalOpen(false)}
        onDelete={(tx) => onDeleteTransaction(tx.id)}
        onSave={onSaveTransaction}
        onManageCategories={() => {
          setCategoryManagerContext('transaction');
          setSyncModalTab('categories');
          setSyncModalOpen(true);
        }}
        newlyCreatedCategoryId={newlyCreatedCategoryId}
      />

      <CreditCardExpenseModal
        isOpen={cardExpenseModalOpen}
        initialCardId={cardExpenseInitialCardId}
        editingTransaction={editingCardTx}
        allTransactions={state.transactions}
        categories={state.categories}
        creditCards={state.creditCards || []}
        currency={state.settings.currency}
        language={language}
        theme={theme}
        onClose={() => setCardExpenseModalOpen(false)}
        onSave={onSaveTransaction}
        onDelete={async (tx, scope) => {
          if (scope) {
            await onExecuteDeleteTransaction(tx.id, scope);
          } else {
            await onDeleteTransaction(tx.id);
          }
        }}
        onManageCategories={() => {
          setCategoryManagerContext('cardExpense');
          setSyncModalTab('categories');
          setSyncModalOpen(true);
        }}
        newlyCreatedCategoryId={newlyCreatedCategoryId}
      />

      <SeriesConfirmModal
        isOpen={Boolean(deletingSeriesTx)}
        mode="delete"
        transaction={deletingSeriesTx}
        subsequentCount={
          deletingSeriesTx
            ? getSubsequentPendingSeriesTransactions(deletingSeriesTx, state.transactions).length
            : 0
        }
        currency={state.settings.currency}
        language={language}
        theme={theme}
        onSelectScope={async (scope) => {
          if (!deletingSeriesTx) return;
          const idToDel = deletingSeriesTx.id;
          setDeletingSeriesTx(null);
          await onExecuteDeleteTransaction(idToDel, scope);
        }}
        onCancel={() => setDeletingSeriesTx(null)}
      />

      <BalanceModal
        isOpen={balanceModalOpen}
        currentBalance={currentBankBalance}
        initialBalance={state.settings.initialBalance}
        currency={state.settings.currency}
        language={language}
        onClose={() => setBalanceModalOpen(false)}
        onUpdateSettings={onUpdateSettings}
      />

      <MobileSyncModal
        isOpen={syncModalOpen}
        activeTabInitial={syncModalTab}
        state={state}
        language={language}
        theme={theme}
        isOnlineWithServer={isOnlineWithServer}
        pendingOfflineCount={pendingOfflineCount}
        currentBankBalance={currentBankBalance}
        familyId={familyId}
        masterKey={masterKey}
        onLeaveFamily={onLeaveFamily}
        onOpenBalanceModal={() => {
          setSyncModalOpen(false);
          setBalanceModalOpen(true);
        }}
        onClose={() => {
          setSyncModalOpen(false);
          setCategoryManagerContext('standalone');
        }}
        onUpdateSettings={onUpdateSettings}
        onAddCategory={onAddCategory}
        onCategoryCreated={(newCat) => {
          setNewlyCreatedCategoryId(newCat.id);
          if (categoryManagerContext !== 'standalone') {
            setSyncModalOpen(false);
            setCategoryManagerContext('standalone');
          }
        }}
        onUpdateCategory={onUpdateCategory}
        onDeleteCategory={onDeleteCategory}
        onImportBackup={onImportBackup}
        onExportBackup={onExportBackup}
        onResetAccount={onResetAccount}
      />
    </>
  );
};
