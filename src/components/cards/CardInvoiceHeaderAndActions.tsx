import React from 'react';
import { CheckCircle2, Clock, DollarSign } from 'lucide-react';
import { AppLanguage, CreditCard, CreditCardBrand } from '../../types';
import { AppIcon, resolveBankInfo } from '../icons';
import { formatCurrency } from '../../utils/format';
import { ConsolidatedLimits, InvoiceCycleStatus, StatementData } from './cardStatementMath';

export const CardBrandBadge: React.FC<{
  brand?: CreditCardBrand;
  card?: CreditCard;
  className?: string;
  size?: number;
  color?: string;
}> = ({ brand = 'default', card, className = '', size = 22, color }) => {
  const bank = resolveBankInfo(card || brand);
  return (
    <AppIcon
      name={bank.iconName}
      size={size}
      color={color || (className.includes('text-white') ? '#FFFFFF' : undefined)}
      className={className}
    />
  );
};

export interface CardsGlobalLimitsBarProps {
  isOled: boolean;
  language: AppLanguage;
  currency: string;
  consolidated: ConsolidatedLimits;
  onOpenManageCards: () => void;
}

export const CardsGlobalLimitsBar: React.FC<CardsGlobalLimitsBarProps> = ({
  isOled,
  language,
  currency,
  consolidated,
  onOpenManageCards,
}) => (
  <div className="flex items-center justify-between gap-2 flex-nowrap w-full py-1">
    <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar min-w-0">
      <div
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] sm:text-xs shrink-0 ${
          isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200 shadow-2xs'
        }`}
      >
        <span className={`font-medium ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
          {language === 'pt-BR' ? 'Limite:' : 'Limit:'}
        </span>
        <span className={`font-bold ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
          {formatCurrency(consolidated.totalLimit, currency)}
        </span>
      </div>

      <div
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] sm:text-xs shrink-0 ${
          isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200 shadow-2xs'
        }`}
      >
        <span className={`font-medium ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
          {language === 'pt-BR' ? 'Disponível:' : 'Available:'}
        </span>
        <span className="font-bold text-[#10B981]">
          {formatCurrency(consolidated.totalAvailable, currency)}
        </span>
      </div>
    </div>

    <button
      type="button"
      onClick={onOpenManageCards}
      className="bg-[#10B981] hover:bg-emerald-600 text-white font-semibold text-xs px-3.5 py-2 rounded-xl transition-colors shadow-sm flex-shrink-0 whitespace-nowrap active:scale-95"
    >
      {language === 'pt-BR' ? 'Gerenciar Cartões' : 'Manage Cards'}
    </button>
  </div>
);

export interface CardInvoiceHeaderAndActionsProps {
  isOled: boolean;
  language: AppLanguage;
  activeCard: CreditCard;
  statementMonth: string;
  statementData: StatementData;
  invoiceCycleStatus: InvoiceCycleStatus;
  onOpenAddExpense: (cardId?: string) => void;
  onPayInvoiceClick: (cardId: string, invoiceMonth: string) => void;
}

export const CardInvoiceHeaderAndActions: React.FC<CardInvoiceHeaderAndActionsProps> = ({
  isOled,
  language,
  activeCard,
  statementMonth,
  statementData,
  invoiceCycleStatus,
  onOpenAddExpense,
  onPayInvoiceClick,
}) => {
  return (
    <div className="flex items-center justify-between gap-2 w-full pb-3 border-b border-slate-100 dark:border-[#21262D]">
      {/* Left Side: Invoice Status Badge */}
      <span
        className={`px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 border shrink-0 ${
          invoiceCycleStatus.color === 'emerald'
            ? isOled
              ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : invoiceCycleStatus.color === 'amber'
            ? isOled
              ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              : 'bg-amber-50 border-amber-200 text-amber-700'
            : isOled
            ? 'bg-sky-500/15 border-sky-500/30 text-sky-400'
            : 'bg-sky-50 border-sky-200 text-sky-700'
        }`}
      >
        {statementData.isSettled ? (
          <CheckCircle2 size={13} />
        ) : statementData.isPendingPayment ? (
          <Clock size={13} />
        ) : (
          <span className="w-1.5 h-1.5 rounded-full bg-current inline-block" />
        )}
        <span>{invoiceCycleStatus.label}</span>
      </span>

      {/* Right Side: Grouped Action Buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onOpenAddExpense(activeCard.id)}
          className="text-xs font-semibold px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#21262D] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#161B22] transition-colors active:scale-95 shrink-0 whitespace-nowrap"
        >
          {language === 'pt-BR' ? 'Lançar compra' : 'Add purchase'}
        </button>

        {statementData.isSettled ? (
          <span className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1 shrink-0 whitespace-nowrap">
            <CheckCircle2 size={13} />
            <span>{language === 'pt-BR' ? 'Fatura Paga' : 'Paid'}</span>
          </span>
        ) : (
          <button
            type="button"
            disabled={statementData.total <= 0}
            onClick={() => onPayInvoiceClick(activeCard.id, statementMonth)}
            className={`text-xs font-semibold px-3.5 py-2 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white flex items-center gap-1 shadow-sm transition-all shrink-0 whitespace-nowrap active:scale-95 ${
              statementData.total <= 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <DollarSign size={13} />
            <span>{language === 'pt-BR' ? 'Pagar Fatura' : 'Pay Invoice'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
