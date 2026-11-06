import React from 'react';
import { AlertCircle, DollarSign, Pencil, Trash2, X } from 'lucide-react';
import { AppLanguage, CreditCard } from '../../types';
import { AppIcon, resolveBankInfo } from '../icons';
import { formatMonthLabel } from '../../utils/format';
import { TRANSLATIONS } from '../../utils/i18n';

export interface DeleteCardConfirmModalProps {
  deleteConfirmCardId: string | null;
  isOled: boolean;
  t: (typeof TRANSLATIONS)[AppLanguage];
  onCancel: () => void;
  onConfirmDelete: (cardId: string) => Promise<void>;
}

export const DeleteCardConfirmModal: React.FC<DeleteCardConfirmModalProps> = ({
  deleteConfirmCardId,
  isOled,
  t,
  onCancel,
  onConfirmDelete,
}) => {
  if (!deleteConfirmCardId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn">
      <div
        className={`border w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 ${
          isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
            <AlertCircle size={22} />
          </div>
          <div>
            <h3 className={`text-base font-bold ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
              {t.deleteCardModalTitle || 'Excluir Cartão'}
            </h3>
            <p className={`text-xs mt-0.5 ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              {t.deleteCardModalDesc || 'Tem certeza de que deseja remover este cartão?'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold transition-colors ${
              isOled
                ? 'border-[#21262D] text-[#94A3B8] hover:bg-[#161B22]'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.cancelBtn || 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={async () => {
              await onConfirmDelete(deleteConfirmCardId);
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-xs transition-all active:scale-95"
          >
            {t.confirmDeleteCardBtn || 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
};

export interface PayInvoiceConfirmModalProps {
  payingInvoiceCycle: { cardId: string; invoiceMonth: string } | null;
  creditCards: CreditCard[];
  language: AppLanguage;
  isOled: boolean;
  payingSubmitting: boolean;
  t: (typeof TRANSLATIONS)[AppLanguage];
  onCancel: () => void;
  onConfirmPayInvoice: () => Promise<void>;
}

export const PayInvoiceConfirmModal: React.FC<PayInvoiceConfirmModalProps> = ({
  payingInvoiceCycle, creditCards, language, isOled, payingSubmitting,
  t, onCancel, onConfirmPayInvoice,
}) => {
  if (!payingInvoiceCycle) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn">
      <div
        className={`border w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 ${
          isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#6E5440]/20 text-[#D0B595]">
            <DollarSign size={22} />
          </div>
          <div>
            <h3 className={`text-base font-bold ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
              {t.payInvoiceConfirmTitle || 'Confirmar Pagamento de Fatura'}
            </h3>
            <p className={`text-xs mt-0.5 ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              {t.payInvoiceConfirmDesc?.(
                creditCards.find((c) => c.id === payingInvoiceCycle.cardId)?.name || '',
                formatMonthLabel(payingInvoiceCycle.invoiceMonth, language)
              ) || 'Gerar despesa no extrato bancário para esta fatura?'}
            </p>
          </div>
        </div>

        <div
          className={`p-3.5 rounded-xl border text-xs space-y-1 ${
            isOled
              ? 'bg-[#161B22] border-[#21262D] text-[#E2E8F0]'
              : 'bg-slate-50 border-slate-200 text-slate-700'
          }`}
        >
          <p className={`font-semibold ${isOled ? 'text-[#D0B595]' : 'text-[#6E5440]'}`}>
            Como funciona:
          </p>
          <p className={`text-[11px] leading-relaxed ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
            {t.payInvoiceHowItWorksDesc ||
              'Uma despesa consolidada será criada no extrato principal com a data do pagamento da fatura. Seu saldo bancário será debitado e o limite do cartão será liberado.'}
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className={`flex-1 py-2.5 px-4 rounded-xl border text-xs font-bold transition-colors ${
              isOled
                ? 'border-[#21262D] text-[#94A3B8] hover:bg-[#161B22]'
                : 'border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.cancelBtn || 'Cancelar'}
          </button>
          <button
            type="button"
            disabled={payingSubmitting}
            onClick={onConfirmPayInvoice}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold shadow-xs transition-all active:scale-95"
          >
            {payingSubmitting
              ? t.generatingInvoicePayment || 'Gerando...'
              : t.confirmPayInvoiceBtn || 'Confirmar Pagamento'}
          </button>
        </div>
      </div>
    </div>
  );
};

export interface ManageCardsModalProps {
  isOpen: boolean;
  creditCards: CreditCard[];
  language: AppLanguage;
  isOled: boolean;
  onClose: () => void;
  onEditCard: (card: CreditCard) => void;
  onRequestDeleteCard: (cardId: string) => void;
  onRegisterNewCard: () => void;
}

export const ManageCardsModal: React.FC<ManageCardsModalProps> = ({
  isOpen, creditCards, language, isOled,
  onClose, onEditCard, onRequestDeleteCard, onRegisterNewCard,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`border w-full max-w-md rounded-2xl shadow-2xl p-5 space-y-4 ${
          isOled
            ? 'bg-[#0D1117] border-[#21262D] text-slate-100 shadow-black/80'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#21262D]">
          <h3 className={`text-sm sm:text-base font-bold ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
            {language === 'pt-BR' ? 'Gerenciar Cartões' : 'Manage Cards'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-xl border border-transparent transition-colors ${
              isOled
                ? 'text-slate-400 hover:text-white hover:bg-[#161B22]'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
            }`}
            aria-label={language === 'pt-BR' ? 'Fechar' : 'Close'}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1 my-3">
          {creditCards.length === 0 ? (
            <p className={`text-xs text-center py-4 ${isOled ? 'text-slate-400' : 'text-slate-500'}`}>
              {language === 'pt-BR' ? 'Nenhum cartão cadastrado.' : 'No cards registered.'}
            </p>
          ) : (
            creditCards.map((card) => {
              const bankInfo = resolveBankInfo(card);
              const brandBgColor =
                card.color && card.color !== '#6E5440'
                  ? card.color
                  : bankInfo.primaryColor || card.color || '#6E5440';

              return (
                <div
                  key={card.id}
                  className={`flex items-center justify-between p-3 rounded-xl border ${
                    isOled
                      ? 'border-[#21262D] bg-[#161B22]/50'
                      : 'border-slate-200/80 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm text-white"
                      style={{ backgroundColor: brandBgColor }}
                    >
                      <AppIcon name={bankInfo.iconName} size={18} color="#FFFFFF" />
                    </div>
                    <div className="min-w-0">
                      <h4
                        className={`text-xs sm:text-sm font-semibold truncate ${
                          isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                        }`}
                      >
                        {card.name}
                      </h4>
                      <span
                        className={`text-[11px] font-mono block ${
                          isOled ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        •••• {card.lastDigits || '••••'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onEditCard(card);
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        isOled
                          ? 'text-slate-400 hover:text-slate-200 hover:bg-[#21262D]'
                          : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200/60'
                      }`}
                      title={language === 'pt-BR' ? 'Editar cartão' : 'Edit card'}
                      aria-label={language === 'pt-BR' ? 'Editar cartão' : 'Edit card'}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onRequestDeleteCard(card.id);
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        isOled
                          ? 'text-slate-400 hover:text-red-500 hover:bg-red-500/20'
                          : 'text-slate-400 hover:text-red-500 hover:bg-red-500/10'
                      }`}
                      title={language === 'pt-BR' ? 'Excluir cartão' : 'Delete card'}
                      aria-label={language === 'pt-BR' ? 'Excluir cartão' : 'Delete card'}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 dark:border-[#21262D] flex flex-col w-full">
          <button
            type="button"
            onClick={() => {
              onClose();
              onRegisterNewCard();
            }}
            className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs sm:text-sm bg-[#10B981] hover:bg-emerald-600 active:bg-emerald-700 text-white transition-colors shadow-sm text-center"
          >
            {language === 'pt-BR' ? 'Cadastrar Novo Cartão' : 'Register New Card'}
          </button>
        </div>
      </div>
    </div>
  );
};
