import React from 'react';
import { AlertTriangle, Calendar, Layers, Repeat, Trash2, Check, X } from 'lucide-react';
import { AppLanguage, Transaction } from '../types';
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
    // so editing or deleting the series never leaves orphaned unpaid installments on the card.
    if (target.installmentTotal && target.installmentTotal > 1) {
      return true;
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
  submitting = false,
  onSelectScope,
  onCancel,
}) => {
  if (!isOpen || !transaction) return null;

  const t = TRANSLATIONS[language];
  const isInstallment = Boolean(transaction.installmentTotal && transaction.installmentTotal > 1);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-3 border-b border-slate-100">
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
              <h3 className="text-base font-bold text-slate-900 leading-snug">
                {mode === 'delete' ? t.seriesDeletePromptTitle : t.seriesEditPromptTitle}
              </h3>
            </div>
          </div>
          <button
            type="button"
            disabled={submitting}
            onClick={onCancel}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Selected Transaction Preview Pill */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-900 truncate">
                  {transaction.description}
                </span>
                {isInstallment ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-500 text-[10px] font-bold">
                    <Layers size={10} />
                    {t.installmentBadge(
                      transaction.installmentCurrent || 1,
                      transaction.installmentTotal || 2
                    )}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-500 text-[10px] font-bold">
                    <Repeat size={10} />
                    {t.recurringBadge}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
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
              className="w-full text-left p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all group flex items-start justify-between gap-3"
            >
              <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-900 group-hover:text-indigo-500 transition-colors">
                  {mode === 'delete' ? t.seriesDeleteOnlyThisBtn : t.seriesEditOnlyThisBtn}
                </p>
                <p className="text-xs text-slate-500">
                  {mode === 'delete' ? t.seriesDeleteOnlyThisSub : t.seriesEditOnlyThisSub}
                </p>
              </div>
              <Check size={16} className="text-slate-400 group-hover:text-indigo-500 shrink-0 mt-0.5" />
            </button>

            {/* Option 2: This and Following */}
            <button
              type="button"
              disabled={submitting}
              onClick={() => onSelectScope('future')}
              className={`w-full text-left p-3.5 rounded-xl border transition-all group flex items-start justify-between gap-3 ${
                mode === 'delete'
                  ? 'border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20'
                  : 'border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20'
              }`}
            >
              <div className="space-y-0.5">
                <p
                  className={`text-sm font-bold ${
                    mode === 'delete' ? 'text-rose-500' : 'text-indigo-500'
                  }`}
                >
                  {mode === 'delete'
                    ? t.seriesDeleteThisAndFutureBtn
                    : t.seriesEditThisAndFutureBtn}
                </p>
                <p className="text-xs text-slate-500">
                  {mode === 'delete'
                    ? t.seriesDeleteThisAndFutureSub(subsequentCount)
                    : t.seriesEditThisAndFutureSub(subsequentCount)}
                </p>
              </div>
              {mode === 'delete' ? (
                <Trash2 size={16} className="text-rose-500 shrink-0 mt-0.5" />
              ) : (
                <Layers size={16} className="text-indigo-500 shrink-0 mt-0.5" />
              )}
            </button>
          </div>

          {/* Option 3: Cancel */}
          <div className="pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={onCancel}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
            >
              {t.cancelBtn}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
