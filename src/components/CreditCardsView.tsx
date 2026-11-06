import React, { useState, useMemo, useEffect, useRef } from 'react';
import { CreditCard } from '../types';
import { computeCardFirstInvoiceMonth, getTodayDateStr } from '../utils/format';
import { TRANSLATIONS } from '../utils/i18n';
import { CreditCardModal } from './CreditCardModal';
import {
  CreditCardsViewProps,
  computeCardsMetrics,
  computeConsolidatedLimits,
  computeInvoiceCycleStatus,
  computeStatementData,
} from './cards/cardStatementMath';
import { CreditCardCarousel } from './cards/CreditCardCarousel';
import {
  CardBrandBadge,
  CardInvoiceHeaderAndActions,
} from './cards/CardInvoiceHeaderAndActions';
import { CardInvoiceItemsList } from './cards/CardInvoiceItemsList';
import {
  DeleteCardConfirmModal,
  ManageCardsModal,
  PayInvoiceConfirmModal,
} from './cards/ManageCardsModal';

export { CardBrandBadge };
export type { CreditCardsViewProps };

export const CreditCardsView: React.FC<CreditCardsViewProps> = ({
  selectedMonth,
  creditCards,
  transactions,
  categories,
  currency,
  language,
  theme,
  onSaveCard,
  onDeleteCard,
  onPayInvoice,
  onOpenAddExpense,
  onEditTransaction,
  onDeleteTransaction,
  onActiveCardChange,
  onModalOpenChange,
}) => {
  const t = TRANSLATIONS[language];
  const isOled = theme === 'oled';
  const todayStr = getTodayDateStr();
  const currentMonthStr = todayStr.slice(0, 7);

  const [activeIndex, setActiveIndex] = useState<number>(0);

  const defaultOpenMonth = useMemo(() => {
    const card = creditCards[0];
    if (!card) return currentMonthStr;
    return computeCardFirstInvoiceMonth(todayStr, card.closingDay).invoiceMonth;
  }, [creditCards, todayStr, currentMonthStr]);

  const [internalStatementMonth, setInternalStatementMonth] = useState<string>(defaultOpenMonth);
  const statementMonth = selectedMonth || internalStatementMonth;

  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [cardModalOpen, setCardModalOpen] = useState<boolean>(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [isManageModalOpen, setIsManageModalOpen] = useState<boolean>(false);

  useEffect(() => {
    onModalOpenChange?.(cardModalOpen || isManageModalOpen);
  }, [cardModalOpen, isManageModalOpen, onModalOpenChange]);

  useEffect(() => {
    if (!isManageModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsManageModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isManageModalOpen]);

  const [deleteConfirmCardId, setDeleteConfirmCardId] = useState<string | null>(null);
  const [payingInvoiceCycle, setPayingInvoiceCycle] = useState<{
    cardId: string;
    invoiceMonth: string;
  } | null>(null);
  const [payingSubmitting, setPayingSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (creditCards.length === 0) {
      setActiveIndex(0);
    } else if (activeIndex >= creditCards.length) {
      setActiveIndex(creditCards.length - 1);
    }
  }, [creditCards.length, activeIndex]);

  const activeCard = useMemo(
    () => creditCards[activeIndex] || creditCards[0] || null,
    [creditCards, activeIndex]
  );

  useEffect(() => {
    onActiveCardChange?.(activeCard?.id || null);
  }, [activeCard?.id, onActiveCardChange]);

  const prevActiveCardIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedMonth && activeCard && activeCard.id !== prevActiveCardIdRef.current) {
      prevActiveCardIdRef.current = activeCard.id;
      const cardOpenMonth = computeCardFirstInvoiceMonth(
        todayStr,
        activeCard.closingDay
      ).invoiceMonth;
      setInternalStatementMonth(cardOpenMonth);
    }
  }, [selectedMonth, activeCard?.id, activeCard?.closingDay, todayStr]);

  const cardsMetrics = useMemo(
    () => computeCardsMetrics(creditCards, transactions, currentMonthStr, statementMonth),
    [creditCards, transactions, currentMonthStr, statementMonth]
  );

  const consolidated = useMemo(() => computeConsolidatedLimits(cardsMetrics), [cardsMetrics]);

  const statementData = useMemo(
    () => computeStatementData(activeCard, transactions, statementMonth),
    [activeCard, transactions, statementMonth]
  );

  const invoiceCycleStatus = useMemo(
    () => computeInvoiceCycleStatus(activeCard, statementData.isSettled, statementMonth),
    [activeCard, statementData.isSettled, statementMonth]
  );

  const openAddCardModal = () => {
    setEditingCard(null);
    setCardModalOpen(true);
  };

  const openEditCardModal = (card: CreditCard) => {
    setEditingCard(card);
    setCardModalOpen(true);
  };

  const handleConfirmPayInvoice = async () => {
    if (!payingInvoiceCycle) return;
    setPayingSubmitting(true);
    try {
      await onPayInvoice(payingInvoiceCycle.cardId, payingInvoiceCycle.invoiceMonth);
      setPayingInvoiceCycle(null);
    } finally {
      setPayingSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-fadeIn max-w-lg mx-auto w-full">
      <CreditCardCarousel
        creditCards={creditCards}
        cardsMetrics={cardsMetrics}
        consolidated={consolidated}
        activeIndex={activeIndex}
        setActiveIndex={setActiveIndex}
        currency={currency}
        language={language}
        isOled={isOled}
        t={t}
        onOpenAddCard={openAddCardModal}
        onOpenManageCards={() => setIsManageModalOpen(true)}
      />

      {activeCard && (
        <div
          className={`rounded-2xl p-4 border space-y-3.5 transition-colors ${
            isOled
              ? 'bg-[#0D1117] border-[#21262D] shadow-xl text-[#F8FAFC]'
              : 'bg-white border-slate-200 shadow-sm text-slate-900'
          }`}
        >
          <CardInvoiceHeaderAndActions
            isOled={isOled}
            language={language}
            activeCard={activeCard}
            statementMonth={statementMonth}
            statementData={statementData}
            invoiceCycleStatus={invoiceCycleStatus}
            onOpenAddExpense={onOpenAddExpense}
            onPayInvoiceClick={(cardId, invoiceMonth) =>
              setPayingInvoiceCycle({ cardId, invoiceMonth })
            }
          />

          <CardInvoiceItemsList
            txs={statementData.txs}
            categories={categories}
            currency={currency}
            language={language}
            isOled={isOled}
            openRowId={openRowId}
            onSetOpenRow={setOpenRowId}
            onEditTransaction={onEditTransaction}
            onDeleteTransaction={onDeleteTransaction}
          />
        </div>
      )}

      <CreditCardModal
        isOpen={cardModalOpen}
        editingCard={editingCard}
        existingCardsCount={creditCards.length}
        currency={currency}
        language={language}
        theme={theme}
        onClose={() => {
          setCardModalOpen(false);
          setEditingCard(null);
        }}
        onSaveCard={onSaveCard}
      />

      <DeleteCardConfirmModal
        deleteConfirmCardId={deleteConfirmCardId}
        isOled={isOled}
        t={t}
        onCancel={() => setDeleteConfirmCardId(null)}
        onConfirmDelete={async (id) => {
          setDeleteConfirmCardId(null);
          await onDeleteCard(id);
        }}
      />

      <PayInvoiceConfirmModal
        payingInvoiceCycle={payingInvoiceCycle}
        creditCards={creditCards}
        language={language}
        isOled={isOled}
        payingSubmitting={payingSubmitting}
        t={t}
        onCancel={() => setPayingInvoiceCycle(null)}
        onConfirmPayInvoice={handleConfirmPayInvoice}
      />

      <ManageCardsModal
        isOpen={isManageModalOpen}
        creditCards={creditCards}
        language={language}
        isOled={isOled}
        onClose={() => setIsManageModalOpen(false)}
        onEditCard={openEditCardModal}
        onRequestDeleteCard={(cardId) => setDeleteConfirmCardId(cardId)}
        onRegisterNewCard={openAddCardModal}
      />
    </div>
  );
};
