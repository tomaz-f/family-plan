import React, { useRef } from 'react';
import { Check, Trash2, X } from 'lucide-react';
import { BankIcon } from './icons';
import { SeriesConfirmModal } from './SeriesConfirmModal';
import { CardAndCategorySection } from './card-expense-modal/CardAndCategorySection';
import { InlineCategoryModal } from './card-expense-modal/InlineCategoryModal';
import { RecurrenceAndInstallmentSection } from './card-expense-modal/RecurrenceAndInstallmentSection';
import { CreditCardExpenseModalProps, useCardExpenseForm } from './card-expense-modal/useCardExpenseForm';

export type { CreditCardExpenseModalProps };

export const CreditCardExpenseModal: React.FC<CreditCardExpenseModalProps> = (props) => {
  const {
    isOpen,
    editingTransaction = null,
    creditCards = [],
    currency,
    language,
    theme,
    onClose,
    onDelete,
    onManageCategories,
  } = props;

  const isOled = theme === 'oled';
  const backdropMouseDownTargetRef = useRef<EventTarget | null>(null);

  const {
    amount,
    setAmount,
    description,
    setDescription,
    setCategoryId,
    date,
    setDate,
    notes,
    setNotes,
    setSelectedCardId,
    isInstallment,
    setIsInstallment,
    installmentCount,
    setInstallmentCount,
    categoryPickerOpen,
    setCategoryPickerOpen,
    submitting,
    showSeriesEditConfirm,
    setShowSeriesEditConfirm,
    showSeriesDeleteConfirm,
    setShowSeriesDeleteConfirm,
    expenseCategories,
    selectedCard,
    selectedCategory,
    cardCycleInfo,
    installmentBreakdown,
    subsequentSeriesCount,
    executeSave,
    handleSubmit,
    handleDelete,
  } = useCardExpenseForm(props);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn"
        onMouseDown={(e) => {
          backdropMouseDownTargetRef.current = e.target;
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget && backdropMouseDownTargetRef.current === e.currentTarget) {
            onClose();
          }
        }}
      >
        <div
          className={`w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
            isOled
              ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
              : 'bg-white border-slate-200 text-slate-900 shadow-xl'
          }`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-5 py-4 border-b shrink-0 ${
              isOled ? 'border-[#21262D]' : 'border-slate-100'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  isOled
                    ? 'bg-[#161B22] border-[#21262D] text-[#D0B595]'
                    : 'bg-amber-500/10 border-amber-500/20 text-[#6E5440]'
                }`}
              >
                <BankIcon card={selectedCard} size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold leading-tight">
                  {editingTransaction ? 'Editar Compra no Cartão' : 'Lançar no Cartão'}
                </h3>
                <p
                  className={`text-[11px] ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}
                >
                  Registrado exclusivamente na fatura do cartão
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className={`p-1.5 rounded-full transition-colors ${
                isOled
                  ? 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#161B22]'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
              title="Fechar"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
            <CardAndCategorySection
              isOled={isOled}
              creditCards={creditCards}
              selectedCard={selectedCard}
              onSelectCard={setSelectedCardId}
              cardCycleInfo={cardCycleInfo}
              isInstallment={isInstallment}
              currency={currency}
              editingTransaction={editingTransaction}
              amount={amount}
              onChangeAmount={setAmount}
              language={language}
              selectedCategory={selectedCategory}
              onOpenCategoryPicker={() => setCategoryPickerOpen(true)}
              onManageCategories={() => {
                setCategoryPickerOpen(false);
                onManageCategories?.();
              }}
              description={description}
              onChangeDescription={setDescription}
              date={date}
              onChangeDate={setDate}
            />

            <RecurrenceAndInstallmentSection
              isOled={isOled}
              isInstallment={isInstallment}
              onChangeIsInstallment={setIsInstallment}
              installmentCount={installmentCount}
              onChangeInstallmentCount={setInstallmentCount}
              installmentBreakdown={installmentBreakdown}
              currency={currency}
              notes={notes}
              onChangeNotes={setNotes}
            />
          </form>

          {/* Action Bar (Footer) */}
          <div
            className={`p-4 border-t flex items-center justify-between gap-3 shrink-0 ${
              isOled ? 'border-[#21262D] bg-[#0D1117]' : 'border-slate-100 bg-white'
            }`}
          >
            {editingTransaction ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={submitting}
                className="h-11 px-3.5 rounded-xl border border-rose-500/40 text-rose-500 hover:bg-rose-500/10 active:scale-95 flex items-center justify-center gap-1.5 font-bold text-xs transition-colors shrink-0"
                title="Excluir esta compra"
              >
                <Trash2 size={15} />
                <span>Excluir</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className={`h-11 px-4 rounded-xl border text-xs font-bold transition-colors ${
                  isOled
                    ? 'border-[#21262D] bg-[#161B22] text-[#94A3B8] hover:text-[#F8FAFC]'
                    : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !amount.trim()}
                className="h-11 px-5 rounded-xl bg-[#6E5440] hover:bg-[#7E624B] text-[#F8FAFC] font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Check size={16} />
                <span>{editingTransaction ? 'Salvar Alterações' : 'Lançar Compra'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <InlineCategoryModal
        isOpen={categoryPickerOpen}
        isOled={isOled}
        language={language}
        expenseCategories={expenseCategories}
        selectedCategory={selectedCategory}
        onSelectCategory={setCategoryId}
        onClose={() => setCategoryPickerOpen(false)}
        onManageCategories={onManageCategories}
      />

      {showSeriesEditConfirm && editingTransaction && (
        <SeriesConfirmModal
          isOpen={showSeriesEditConfirm}
          mode="edit"
          transaction={editingTransaction}
          subsequentCount={subsequentSeriesCount}
          currency={currency}
          language={language}
          theme={theme}
          onSelectScope={async (scope) => {
            setShowSeriesEditConfirm(false);
            await executeSave(scope);
          }}
          onCancel={() => setShowSeriesEditConfirm(false)}
        />
      )}

      {showSeriesDeleteConfirm && editingTransaction && (
        <SeriesConfirmModal
          isOpen={showSeriesDeleteConfirm}
          mode="delete"
          transaction={editingTransaction}
          subsequentCount={subsequentSeriesCount}
          currency={currency}
          language={language}
          theme={theme}
          onSelectScope={(scope) => {
            setShowSeriesDeleteConfirm(false);
            if (onDelete) {
              onDelete(editingTransaction, scope);
            }
            onClose();
          }}
          onCancel={() => setShowSeriesDeleteConfirm(false)}
        />
      )}
    </>
  );
};
