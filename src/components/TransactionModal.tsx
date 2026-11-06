import React from 'react';
import { X, ArrowUpRight, ArrowDownRight, Layers, Trash2 } from 'lucide-react';
import { formatCurrency } from '../utils/format';
import { SeriesConfirmModal } from './SeriesConfirmModal';
import { RecurrenceMode, TransactionModalProps } from './transaction-modal/transactionModalMath';
import { useTransactionModalState } from './transaction-modal/useTransactionModalState';
import { AccountCardDropdown } from './transaction-modal/AccountCardDropdown';
import {
  CategoryPickerModal, CategorySelectorRow, TransactionDateStatusRow,
} from './transaction-modal/CategorySelectorSection';
import { TransactionAdvancedOptions } from './transaction-modal/TransactionAdvancedOptions';

export type { RecurrenceMode, TransactionModalProps };

export const TransactionModal: React.FC<TransactionModalProps> = (props) => {
  const {
    isOpen, initialCardId = null, editingTransaction, creditCards = [],
    currency, language, onClose, onDelete, onManageCategories,
  } = props;

  const {
    t, isOled, type, setType, status, setStatus, amount, description, setDescription,
    categoryId, setCategoryId, date, notes, setNotes, selectedCardId, setSelectedCardId,
    recurrenceMode, setRecurrenceMode, dueDay, setDueDay, setDueDayManuallyEdited,
    installmentCurrent, setInstallmentCurrent, installmentTotal, setInstallmentTotal,
    submitting, showSeriesEditConfirm, setShowSeriesEditConfirm, categoryPickerOpen,
    setCategoryPickerOpen, isMoreOptionsOpen, setIsMoreOptionsOpen, isAccountDropdownOpen,
    setIsAccountDropdownOpen, amountInputRef, backdropMouseDownTargetRef,
    categoryMouseDownTargetRef, filteredCategories, selectedCategory, selectedCard,
    cardAvailableLimits, handleSelectCard, handleDateChange, parsedDueDay, parsedInstCur,
    parsedInstTot, installmentBreakdown, cardCycleInfo, concludingMonthLabel,
    subsequentSeriesCount, executeSave, handleAmountChange, handleSubmit, currencySymbol,
  } = useTransactionModalState(props);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm bg-black/60 animate-fadeIn"
        onMouseDown={(e) => { backdropMouseDownTargetRef.current = e.target; }}
        onClick={(e) => {
          if (e.target === e.currentTarget && backdropMouseDownTargetRef.current === e.currentTarget) onClose();
        }}
      >
        <div
          className={`w-full max-w-md max-h-[88dvh] sm:max-h-[90vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl transition-all ${
            isOled
              ? 'bg-[#0D1117] border border-[#21262D] text-slate-100 shadow-black/90'
              : 'bg-white border border-slate-200 text-slate-900 shadow-xl'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Compact Header */}
          <div className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${
            isOled ? 'border-[#21262D]' : 'border-slate-100'
          }`}>
            <h2 className={`text-sm sm:text-base font-bold tracking-tight ${
              isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
            }`}>
              {editingTransaction
                ? type === 'income'
                  ? language === 'pt-BR' ? 'Editar Entrada' : 'Edit Income'
                  : language === 'pt-BR' ? 'Editar Despesa' : 'Edit Expense'
                : language === 'pt-BR' ? 'Novo Lançamento' : 'New Transaction'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-full transition-colors ${
                isOled
                  ? 'text-slate-400 hover:text-white hover:bg-[#161B22]'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              aria-label={t.cancelBtn}
            >
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar">
              {/* Type Switcher */}
              <div className={`grid grid-cols-2 gap-1 p-1 rounded-2xl border ${
                isOled ? 'bg-[#161B22] border-[#21262D]' : 'bg-slate-100 border-slate-200/80'
              }`}>
                <button
                  type="button"
                  onClick={() => {
                    setType('expense');
                    if (!selectedCardId && initialCardId) setSelectedCardId(initialCardId);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    type === 'expense'
                      ? 'bg-[#EF4444] text-white shadow-xs'
                      : isOled ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <ArrowDownRight size={14} strokeWidth={2.5} />
                  <span>{language === 'pt-BR' ? 'Despesa' : 'Expense'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setType('income');
                    setSelectedCardId(null);
                    setIsAccountDropdownOpen(false);
                  }}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition-all ${
                    type === 'income'
                      ? 'bg-[#10B981] text-white shadow-xs'
                      : isOled ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <ArrowUpRight size={14} strokeWidth={2.5} />
                  <span>{language === 'pt-BR' ? 'Entrada' : 'Income'}</span>
                </button>
              </div>

              {/* Unified Contiguous Monetary Value Input */}
              <div
                className="relative flex flex-col items-center justify-center my-3 sm:my-4 cursor-text"
                onClick={() => amountInputRef.current?.focus()}
              >
                <div className="flex items-baseline justify-center select-none pointer-events-none">
                  <span className={`text-2xl sm:text-3xl font-bold opacity-60 mr-1.5 ${
                    isOled ? 'text-[#D0B595]' : 'text-[#6E5440]'
                  }`}>
                    {currencySymbol}
                  </span>
                  <span className={`text-4xl sm:text-5xl font-black tracking-tight ${
                    isOled ? 'text-slate-50' : 'text-slate-900'
                  }`}>
                    {amount ? amount.replace('.', ',') : '0,00'}
                  </span>
                </div>

                <input
                  ref={amountInputRef}
                  type="text"
                  inputMode="decimal"
                  autoFocus={!editingTransaction}
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-text w-full h-full text-center z-10"
                  aria-label={language === 'pt-BR' ? 'Valor' : 'Amount'}
                />

                {recurrenceMode === 'installment' && parsedInstTot > 1 && (
                  <div className={`mt-2 px-3 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1.5 ${
                    isOled ? 'bg-[#161B22] text-slate-300 border border-[#21262D]' : 'bg-slate-100 text-slate-700'
                  }`}>
                    <Layers size={12} className="text-[#D0B595] shrink-0" />
                    <span>
                      {language === 'pt-BR'
                        ? `Total ${formatCurrency(installmentBreakdown.totalAmount, currency)} em ${installmentBreakdown.count}x de ${formatCurrency(installmentBreakdown.regularInstallmentAmount, currency)}`
                        : `Total ${formatCurrency(installmentBreakdown.totalAmount, currency)} in ${installmentBreakdown.count}x of ${formatCurrency(installmentBreakdown.regularInstallmentAmount, currency)}`}
                    </span>
                  </div>
                )}
              </div>

              {/* Unified Essential Fields Card */}
              <div className={`rounded-2xl border overflow-hidden ${
                isOled ? 'bg-[#161B22]/70 border-[#21262D]' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className={`px-3.5 py-3 border-b ${
                  isOled ? 'border-[#21262D]/60' : 'border-slate-200/60'
                }`}>
                  <input
                    type="text"
                    required
                    placeholder={language === 'pt-BR' ? 'Descrição do lançamento' : 'Transaction description'}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className={`w-full bg-transparent text-xs sm:text-sm font-medium focus:outline-none placeholder:text-slate-500 ${
                      isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                    }`}
                  />
                </div>

                <CategorySelectorRow
                  isOled={isOled}
                  language={language}
                  selectedCategory={selectedCategory}
                  onOpenPicker={() => setCategoryPickerOpen(true)}
                />

                {type === 'expense' && (
                  <AccountCardDropdown
                    isOled={isOled} language={language} currency={currency}
                    selectedCard={selectedCard} selectedCardId={selectedCardId}
                    creditCards={creditCards} cardAvailableLimits={cardAvailableLimits}
                    cardCycleInfo={cardCycleInfo} isAccountDropdownOpen={isAccountDropdownOpen}
                    setIsAccountDropdownOpen={setIsAccountDropdownOpen}
                    onSelectCard={handleSelectCard} t={t}
                  />
                )}

                <TransactionDateStatusRow
                  isOled={isOled} language={language} date={date}
                  onDateChange={handleDateChange} selectedCard={selectedCard}
                  status={status} onStatusChange={setStatus}
                />
              </div>

              <TransactionAdvancedOptions
                isOled={isOled} language={language} type={type}
                isMoreOptionsOpen={isMoreOptionsOpen} setIsMoreOptionsOpen={setIsMoreOptionsOpen}
                recurrenceMode={recurrenceMode} setRecurrenceMode={setRecurrenceMode}
                dueDay={dueDay} setDueDay={setDueDay} setDueDayManuallyEdited={setDueDayManuallyEdited}
                installmentCurrent={installmentCurrent} setInstallmentCurrent={setInstallmentCurrent}
                installmentTotal={installmentTotal} setInstallmentTotal={setInstallmentTotal}
                parsedInstCur={parsedInstCur} parsedInstTot={parsedInstTot}
                parsedDueDay={parsedDueDay} concludingMonthLabel={concludingMonthLabel}
                selectedCard={selectedCard} notes={notes} setNotes={setNotes} t={t}
              />
            </div>

            {/* Pinned Action Footer */}
            <div className={`p-3.5 sm:p-4 border-t shrink-0 flex items-center gap-2 ${
              isOled ? 'border-[#21262D] bg-[#0D1117]' : 'border-slate-100 bg-white'
            }`}>
              {editingTransaction && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(editingTransaction);
                    onClose();
                  }}
                  disabled={submitting}
                  className="h-12 w-12 rounded-2xl border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 active:scale-95 flex items-center justify-center shrink-0 transition-all"
                  title={language === 'pt-BR' ? 'Excluir lançamento' : 'Delete transaction'}
                  aria-label={language === 'pt-BR' ? 'Excluir lançamento' : 'Delete transaction'}
                >
                  <Trash2 size={18} />
                </button>
              )}

              <button
                type="submit"
                disabled={submitting}
                className={`w-full flex-1 h-12 rounded-2xl font-bold text-sm text-white shadow-md transition-all active:scale-[0.99] flex items-center justify-center ${
                  type === 'income' ? 'bg-[#10B981] hover:bg-emerald-600' : 'bg-[#EF4444] hover:bg-rose-600'
                }`}
              >
                {submitting
                  ? t.savingBtn
                  : type === 'income'
                  ? language === 'pt-BR' ? 'Salvar Entrada' : 'Save Income'
                  : language === 'pt-BR' ? 'Salvar Despesa' : 'Save Expense'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <CategoryPickerModal
        isOpen={categoryPickerOpen} isOled={isOled} language={language}
        filteredCategories={filteredCategories} categoryId={categoryId}
        categoryMouseDownTargetRef={categoryMouseDownTargetRef}
        onSelectCategory={setCategoryId} onClose={() => setCategoryPickerOpen(false)}
        onManageCategories={onManageCategories}
      />

      <SeriesConfirmModal
        isOpen={showSeriesEditConfirm}
        mode="edit"
        transaction={
          editingTransaction
            ? {
                ...editingTransaction,
                type,
                amount:
                  recurrenceMode === 'installment' && parsedInstTot > 1
                    ? parsedInstCur === 1
                      ? installmentBreakdown.firstInstallmentAmount
                      : installmentBreakdown.regularInstallmentAmount
                    : parseFloat(amount.replace(',', '.')) || editingTransaction.amount,
                description: description.trim() || editingTransaction.description,
                date,
              }
            : null
        }
        subsequentCount={subsequentSeriesCount}
        currency={currency}
        language={language}
        submitting={submitting}
        onSelectScope={(scope) => executeSave(scope)}
        onCancel={() => setShowSeriesEditConfirm(false)}
      />
    </>
  );
};
