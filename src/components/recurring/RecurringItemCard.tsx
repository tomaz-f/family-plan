import React from 'react';
import { CheckCircle2, Clock, Trash2, Play, Layers } from 'lucide-react';
import { AppLanguage, Category } from '../../types';
import { formatCurrency, formatMonthLabel, formatShortMonthLabel } from '../../utils/format';
import { getCategoryDisplayName, TRANSLATIONS } from '../../utils/i18n';
import { CategoryIcon } from '../CategoryIcon';
import { EvaluatedRecurringTemplate } from './RecurringSummaryBar';

export interface RecurringItemCardProps {
  tpl: EvaluatedRecurringTemplate;
  category?: Category;
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  onApplySingleRecurring: (id: string, month: string) => Promise<void>;
  onDeleteRecurring: (id: string) => Promise<void>;
}

export const RecurringItemCard: React.FC<RecurringItemCardProps> = ({
  tpl,
  category,
  selectedMonth,
  currency,
  language,
  onApplySingleRecurring,
  onDeleteRecurring,
}) => {
  const t = TRANSLATIONS[language];
  const monthFull = formatMonthLabel(selectedMonth, language);

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-slate-50/70 transition-colors ${
        tpl.isConcluded ? 'opacity-55' : ''
      }`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <CategoryIcon
          icon={category?.icon || 'Tag'}
          color={category?.color || '#64748b'}
          size={18}
          badgeSize="lg"
        />
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-slate-900">{tpl.description}</p>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
              {t.dueDayBadge(tpl.dayOfMonth)}
            </span>

            {tpl.isInstallment && tpl.totalInstallments && tpl.endMonth && (
              <>
                {!tpl.isConcluded && !tpl.isBeforeStart && tpl.instNum !== null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-500 text-[11px] font-bold">
                    <Layers size={11} />
                    {t.installmentBadge(tpl.instNum, tpl.totalInstallments)} (
                    {t.remainingInstBadge(tpl.remaining || 0)})
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-500 text-[11px] font-semibold">
                  {tpl.isConcluded
                    ? t.concludedBadge(formatShortMonthLabel(tpl.endMonth, language))
                    : t.endsInBadge(formatShortMonthLabel(tpl.endMonth, language))}
                </span>
              </>
            )}

            {!tpl.isConcluded && !tpl.isBeforeStart && (
              tpl.isApplied ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 text-[11px] font-semibold">
                  <CheckCircle2 size={11} />
                  {t.appliedInMonth(monthFull)}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 text-[11px] font-semibold">
                  <Clock size={11} />
                  {t.pendingForMonth(monthFull)}
                </span>
              )
            )}
          </div>
          <p className="text-xs text-slate-500">
            {getCategoryDisplayName(category, language)} •{' '}
            {tpl.type === 'income' ? t.monthlyInputType : t.monthlyExpenseType}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 pl-14 sm:pl-0 shrink-0">
        <span
          className={`text-base font-extrabold ${
            tpl.type === 'income' ? 'text-emerald-500' : 'text-rose-500'
          }`}
        >
          {tpl.type === 'income' ? '+' : '-'}
          {formatCurrency(tpl.amount, currency)}
        </span>

        {tpl.isDueInSelectedMonth && !tpl.isApplied && (
          <button
            type="button"
            onClick={() => onApplySingleRecurring(tpl.id, selectedMonth)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-500 text-xs font-semibold transition-colors"
          >
            <Play size={12} />
            {t.applyToMonthBtn(monthFull.split(' ')[0])}
          </button>
        )}

        <button
          type="button"
          onClick={() => onDeleteRecurring(tpl.id)}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
          title={t.deleteTooltip}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
};
