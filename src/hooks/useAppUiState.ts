import { useState } from 'react';
import { CreditCard, Transaction, TransactionType } from '../types';
import { getCurrentMonthStr } from '../utils/format';
import { AppActiveTab, SyncModalTab } from '../components/layout/AppHeaderBar';

export function useAppUiState(creditCards?: CreditCard[]) {
  const [activeTab, setActiveTab] = useState<AppActiveTab>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthStr());

  const [txModalOpen, setTxModalOpen] = useState<boolean>(false);
  const [txModalInitialType, setTxModalInitialType] = useState<TransactionType>('expense');
  const [txModalInitialCardId, setTxModalInitialCardId] = useState<string | null>(null);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [cardExpenseModalOpen, setCardExpenseModalOpen] = useState<boolean>(false);
  const [cardExpenseInitialCardId, setCardExpenseInitialCardId] = useState<string | null>(null);
  const [editingCardTx, setEditingCardTx] = useState<Transaction | null>(null);
  const [deletingSeriesTx, setDeletingSeriesTx] = useState<Transaction | null>(null);
  const [balanceModalOpen, setBalanceModalOpen] = useState<boolean>(false);
  const [syncModalOpen, setSyncModalOpen] = useState<boolean>(false);
  const [syncModalTab, setSyncModalTab] = useState<SyncModalTab>('settings');
  const [headerMenuOpen, setHeaderMenuOpen] = useState<boolean>(false);
  const [fabMenuOpen, setFabMenuOpen] = useState<boolean>(false);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [openRefuelTrigger, setOpenRefuelTrigger] = useState<number>(0);
  const [cardModalOpen, setCardModalOpen] = useState<boolean>(false);
  const [fuelModalOpen, setFuelModalOpen] = useState<boolean>(false);
  const [categoryManagerContext, setCategoryManagerContext] = useState<
    'standalone' | 'transaction' | 'cardExpense'
  >('standalone');
  const [newlyCreatedCategoryId, setNewlyCreatedCategoryId] = useState<string | null>(null);

  const isAnyModalOpen =
    txModalOpen ||
    cardExpenseModalOpen ||
    balanceModalOpen ||
    syncModalOpen ||
    Boolean(deletingSeriesTx) ||
    cardModalOpen ||
    fuelModalOpen;

  const handleOpenAddModal = (type: TransactionType, cardId?: string) => {
    setEditingTx(null);
    setTxModalInitialType(type);
    setTxModalInitialCardId(cardId || null);
    setTxModalOpen(true);
  };

  const handleOpenCardExpenseModal = (cardId?: string) => {
    setEditingCardTx(null);
    setCardExpenseInitialCardId(cardId || activeCardId || creditCards?.[0]?.id || null);
    setCardExpenseModalOpen(true);
  };

  const handleOpenEditCardExpenseModal = (tx: Transaction) => {
    setEditingCardTx(tx);
    setCardExpenseInitialCardId(tx.cardId || activeCardId || null);
    setCardExpenseModalOpen(true);
  };

  const handleOpenEditModal = (tx: Transaction) => {
    if (tx.cardId) {
      handleOpenEditCardExpenseModal(tx);
      return;
    }
    setEditingTx(tx);
    setTxModalInitialType(tx.type);
    setTxModalInitialCardId(null);
    setTxModalOpen(true);
  };

  return {
    activeTab,
    setActiveTab,
    selectedMonth,
    setSelectedMonth,
    txModalOpen,
    setTxModalOpen,
    txModalInitialType,
    txModalInitialCardId,
    editingTx,
    cardExpenseModalOpen,
    setCardExpenseModalOpen,
    cardExpenseInitialCardId,
    editingCardTx,
    deletingSeriesTx,
    setDeletingSeriesTx,
    balanceModalOpen,
    setBalanceModalOpen,
    syncModalOpen,
    setSyncModalOpen,
    syncModalTab,
    setSyncModalTab,
    headerMenuOpen,
    setHeaderMenuOpen,
    fabMenuOpen,
    setFabMenuOpen,
    activeCardId,
    setActiveCardId,
    openRefuelTrigger,
    setOpenRefuelTrigger,
    setCardModalOpen,
    setFuelModalOpen,
    categoryManagerContext,
    setCategoryManagerContext,
    newlyCreatedCategoryId,
    setNewlyCreatedCategoryId,
    isAnyModalOpen,
    handleOpenAddModal,
    handleOpenCardExpenseModal,
    handleOpenEditCardExpenseModal,
    handleOpenEditModal,
  };
}
