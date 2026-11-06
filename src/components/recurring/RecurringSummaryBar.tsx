import React from 'react';
import { Repeat, Plus, Play } from 'lucide-react';
import { AppLanguage } from '../../types';
import { formatCurrency, formatMonthLabel, formatShortMonthLabel } from '../../utils/format';
import { TRANSLATIONS } from '../../utils/i18n';

export type { EvaluatedRecurringTemplate } from './recurringUtils';

export interface RecurringSummaryBarProps {
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  pendingCount: number;
  showAddForm: boolean;
  monthlyTotals: {
    inc: number;
    exp: number;
    net: number;
  };
  onApplyAllRecurring: (month: string) => Promise<void>;
  onToggleAddForm: () => void;
}

export const RecurringSummaryBar: React.FC<RecurringSummaryBarProps> = ({
  selectedMonth,
  currency,
  language,
  pendingCount,
  showAddForm,
  monthlyTotals,
  onApplyAllRecurring,
  onToggleAddForm,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <>
      {/* Header & Summary */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-500">
            <Repeat size={14} />
            {t.monthlyAutomation}
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">{t.recurringTitle}</h1>
          <p className="text-xs text-slate-500">{t.recurringDesc}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => onApplyAllRecurring(selectedMonth)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm"
            >
              <Play size={14} />
              {t.applyAllPendingToMonth(pendingCount, formatMonthLabel(selectedMonth, language))}
            </button>
          )}
          <button
            type="button"
            onClick={onToggleAddForm}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            <Plus size={15} />
            {showAddForm ? t.closeForm : t.newRecurringItem}
          </button>
        </div>
      </div>

      {/* Summary Strip for Selected Month */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t.fixedMonthlyInputs} ({formatShortMonthLabel(selectedMonth, language)})
          </span>
          <p className="text-xl font-extrabold text-emerald-500 mt-1">
            +{formatCurrency(monthlyTotals.inc, currency)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t.fixedMonthlyBills} ({formatShortMonthLabel(selectedMonth, language)})
          </span>
          <p className="text-xl font-extrabold text-rose-500 mt-1">
            -{formatCurrency(monthlyTotals.exp, currency)}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t.fixedMonthlyNet}
          </span>
          <p
            className={`text-xl font-extrabold mt-1 ${
              monthlyTotals.net >= 0 ? 'text-slate-900' : 'text-rose-500'
            }`}
          >
            {monthlyTotals.net >= 0 ? '+' : ''}
            {formatCurrency(monthlyTotals.net, currency)}
          </p>
        </div>
      </div>
    </>
  );
};
