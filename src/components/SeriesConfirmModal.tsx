import React from 'react';
import { AlertTriangle, Calendar, Layers, Repeat, Trash2, Check, X } from 'lucide-react';
import { AppLanguage, AppTheme, Transaction } from '../types';
import { formatCurrency, formatShortDate } from '../utils/format';
import { TRANSLATIONS } from '../utils/i18n';

export type SeriesScope = 'single' | 'future';

export function isSameSeries(a: Transaction, b: Transaction): boolean {
  if (a.id === b.id) return true;
  if (a.recurringId && b.recurringId) {
    return a.recurringId === b.recurringId;
  }
  if (
    !a.recurringId &&
    !b.recurringId &&
    a.installmentTotal &&
    a.installmentTotal > 1 &&
    b.installmentTotal === a.installmentTotal
  ) {
    return (
      a.categoryId === b.categoryId &&
      a.cardId === b.cardId &&
      a.description.trim().toLowerCase() === b.description.trim().toLowerCase()
    );
  }
  return false;
}

export function isPartOfSeries(tx: Transaction, allTransactions: Transaction[]): boolean {
  if (tx.recurringId) return true;
  if (tx.installmentTotal && tx.installmentTotal > 1) return true;
  return allTransactions.some((other) => other.id !== tx.id && isSameSeries(tx, other));
}

export function getSubsequentPendingSeriesTransactions(
  target: Transaction,
  allTransactions: Transaction[]
): Transaction[] {
  return allTransactions.filter((candidate) => {
    if (candidate.id === target.id) return false;
    if (!isSameSeries(candidate, target)) return false;
    if ((candidate.status || 'paid') !== 'unpaid') return false;

    // For installment purchases, include all unpaid installments of the same purchase
    // that are at or after the current installment number
    if (target.installmentTotal && target.installmentTotal > 1) {
      const curTarget = target.installmentCurrent || 1;
      const curCand = candidate.installmentCurrent || 1;
      return curCand >= curTarget;
    }

    return candidate.date >= target.date;
  });
}

interface SeriesConfirmModalProps {
  isOpen: boolean;
  mode: 'delete' | 'edit';
  transaction: Transaction | null;
  subsequentCount: number;
  currency: string;
  language: AppLanguage;
  theme?: AppTheme;
  submitting?: boolean;
  onSelectScope: (scope: SeriesScope) => void;
  onCancel: () => void;
}

export const SeriesConfirmModal: React.FC<SeriesConfirmModalProps> = ({
  isOpen,
  mode,
  transaction,
  subsequentCount,
  currency,
  language,
  theme = 'oled',
  submitting = false,
  onSelectScope,
  onCancel,
}) => {
  if (!isOpen || !transaction) return null;

  const t = TRANSLATIONS[language];
  const isOled = theme === 'oled';
  const isInstallment = Boolean(transaction.installmentTotal && transaction.installmentTotal > 1);

  const modalTitle = isInstallment
    ? mode === 'delete'
      ? (language === 'pt-BR' ? 'Excluir compra parcelada' : 'Delete installment purchase')
      : (language === 'pt-BR' ? 'Editar compra parcelada' : 'Edit installment purchase')
    : mode === 'delete'
      ? t.seriesDeletePromptTitle
      : t.seriesEditPromptTitle;

  const singleChoiceTitle = isInstallment
    ? mode === 'delete'
      ? (language === 'pt-BR' ? 'Excluir apenas esta parcela' : 'Delete only this installment')
      : (language === 'pt-BR' ? 'Alterar apenas esta parcela' : 'Edit only this installment')
    : mode === 'delete'
      ? t.seriesDeleteOnlyThisBtn
      : t.seriesEditOnlyThisBtn;

  const singleChoiceSub = isInstallment
    ? mode === 'delete'
      ? (language === 'pt-BR'
          ? 'Exclui exclusivamente esta parcela, mantendo as demais da fatura.'
          : 'Deletes only this installment, preserving other installments.')
      : (language === 'pt-BR'
          ? 'Aplica as alterações apenas a esta parcela específica.'
          : 'Applies changes only to this specific installment.')
    : mode === 'delete'
      ? t.seriesDeleteOnlyThisSub
      : t.seriesEditOnlyThisSub;

  const futureChoiceTitle = isInstallment
    ? mode === 'delete'
      ? (language === 'pt-BR' ? 'Excluir todas as parcelas restantes' : 'Delete all remaining installments')
      : (language === 'pt-BR' ? 'Alterar todas as parcelas restantes' : 'Edit all remaining installments')
    : mode === 'delete'
      ? t.seriesDeleteThisAndFutureBtn
      : t.seriesEditThisAndFutureBtn;

  const futureChoiceSub = isInstallment
    ? mode === 'delete'
      ? (language === 'pt-BR'
          ? (subsequentCount > 0
              ? `Exclui esta e mais ${subsequentCount} parcela(s) pendente(s) desta compra.`
              : 'Exclui todas as parcelas pendentes desta compra.')
          : `Deletes this and ${subsequentCount} remaining pending installment(s).`)
      : (language === 'pt-BR'
          ? `Aplica as alterações a esta e às próximas ${subsequentCount} parcelas.`
          : `Applies changes to this and next ${subsequentCount} installments.`)
    : mode === 'delete'
      ? t.seriesDeleteThisAndFutureSub(subsequentCount)
      : t.seriesEditThisAndFutureSub(subsequentCount);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-fadeIn">
      <div
        className={`w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden transition-all ${
          isOled
            ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
            : 'bg-white border-slate-200 text-slate-900 shadow-xl'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b ${
            isOled ? 'border-[#21262D]' : 'border-slate-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                mode === 'delete'
                  ? 'bg-rose-500/15 text-rose-500'
                  : 'bg-indigo-500/15 text-indigo-500'
              }`}
            >
              {mode === 'delete' ? <Trash2 size={20} /> : <AlertTriangle size={20} />}
            </div>
            <div>
              <h3
                className={`text-base font-bold leading-snug ${
                  isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                }`}
              >
                {modalTitle}
              </h3>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className={`p-1.5 rounded-full transition-colors ${
              isOled
                ? 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#161B22]'
                : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Selected Transaction Preview Pill */}
          <div
            className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
              isOled
                ? 'bg-[#161B22] border-[#21262D]'
                : 'bg-slate-50 border-slate-200/80'
            }`}
          >
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-sm font-bold truncate ${
                    isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                  }`}
                >
                  {transaction.description}
                </span>
                {isInstallment ? (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isOled
                        ? 'bg-[#6E5440]/30 text-[#D0B595] border border-[#6E5440]/40'
                        : 'bg-indigo-500/15 text-indigo-600'
                    }`}
                  >
                    <Layers size={10} />
                    {t.installmentBadge(
                      transaction.installmentCurrent || 1,
                      transaction.installmentTotal || 2
                    )}
                  </span>
                ) : (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isOled
                        ? 'bg-[#6E5440]/30 text-[#D0B595] border border-[#6E5440]/40'
                        : 'bg-indigo-500/15 text-indigo-600'
                    }`}
                  >
                    <Repeat size={10} />
                    {t.recurringBadge}
                  </span>
                )}
              </div>
              <div
                className={`flex items-center gap-1.5 text-xs ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                }`}
              >
                <Calendar size={12} />
                <span>{formatShortDate(transaction.date, language)}</span>
              </div>
            </div>

            <span
              className={`text-sm font-extrabold shrink-0 ${
                transaction.type === 'income' ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {transaction.type === 'income' ? '+' : '-'}
              {formatCurrency(transaction.amount, currency)}
            </span>
          </div>

          {/* Actionable Choices */}
          <div className="space-y-2.5">
            {/* Option 1: Only This Entry */}
            <button
              type="button"
              disabled={submitting}
              onClick={() => onSelectScope('single')}
              className={`w-full text-left p-3.5 rounded-xl border transition-all group flex items-start justify-between gap-3 ${
                isOled
                  ? 'border-[#21262D] bg-[#161B22] hover:bg-[#21262D]/60'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="space-y-0.5">
                <p
                  className={`text-sm font-bold transition-colors ${
                    isOled
                      ? 'text-[#F8FAFC] group-hover:text-[#D0B595]'
                      : 'text-slate-900 group-hover:text-indigo-600'
                  }`}
                >
                  {singleChoiceTitle}
                </p>
                <p
                  className={`text-xs ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}
                >
                  {singleChoiceSub}
                </p>
              </div>
              <Check
                size={16}
                className={`shrink-0 mt-0.5 transition-colors ${
                  isOled
                    ? 'text-[#94A3B8] group-hover:text-[#D0B595]'
                    : 'text-slate-400 group-hover:text-indigo-600'
                }`}
              />
            </button>

            {/* Option 2: This and Following */}
            <button
              type="button"
              disabled={submitting}
              onClick={() => onSelectScope('future')}
              className={`w-full text-left p-3.5 rounded-xl border transition-all group flex items-start justify-between gap-3 ${
                mode === 'delete'
                  ? isOled
                    ? 'border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20'
                    : 'border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20'
                  : isOled
                    ? 'border-[#6E5440]/50 bg-[#6E5440]/15 hover:bg-[#6E5440]/25'
                    : 'border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20'
              }`}
            >
              <div className="space-y-0.5">
                <p
                  className={`text-sm font-bold ${
                    mode === 'delete'
                      ? 'text-rose-500'
                      : isOled
                        ? 'text-[#D0B595]'
                        : 'text-indigo-600'
                  }`}
                >
                  {futureChoiceTitle}
                </p>
                <p
                  className={`text-xs ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}
                >
                  {futureChoiceSub}
                </p>
              </div>
              {mode === 'delete' ? (
                <Trash2 size={16} className="text-rose-500 shrink-0 mt-0.5" />
              ) : (
                <Layers
                  size={16}
                  className={`shrink-0 mt-0.5 ${
                    isOled ? 'text-[#D0B595]' : 'text-indigo-600'
                  }`}
                />
              )}
            </button>
          </div>

          {/* Option 3: Cancel */}
          <div className="pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={onCancel}
              className={`w-full py-2.5 px-4 rounded-xl border text-xs font-bold transition-colors ${
                isOled
                  ? 'border-[#21262D] bg-[#161B22] text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#21262D]'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {t.cancelBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
