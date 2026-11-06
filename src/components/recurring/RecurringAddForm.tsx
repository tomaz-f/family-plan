import React from 'react';
import { Repeat, ArrowUpRight, ArrowDownRight, Layers } from 'lucide-react';
import { AppLanguage, Category, TransactionType } from '../../types';
import { getCategoryDisplayName, TRANSLATIONS } from '../../utils/i18n';

export interface RecurringAddFormProps {
  language: AppLanguage;
  type: TransactionType;
  onTypeChange: (nextType: TransactionType) => void;
  planMode: 'recurring' | 'installment';
  onPlanModeChange: (mode: 'recurring' | 'installment') => void;
  description: string;
  onDescriptionChange: (val: string) => void;
  amount: string;
  onAmountChange: (val: string) => void;
  dayOfMonth: string;
  onDayOfMonthChange: (val: string) => void;
  currentInst: string;
  onCurrentInstChange: (val: string) => void;
  totalInst: string;
  onTotalInstChange: (val: string) => void;
  categoryId: string;
  onCategoryIdChange: (val: string) => void;
  filteredCategories: Category[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void>;
}

export const RecurringAddForm: React.FC<RecurringAddFormProps> = ({
  language,
  type,
  onTypeChange,
  planMode,
  onPlanModeChange,
  description,
  onDescriptionChange,
  amount,
  onAmountChange,
  dayOfMonth,
  onDayOfMonthChange,
  currentInst,
  onCurrentInstChange,
  totalInst,
  onTotalInstChange,
  categoryId,
  onCategoryIdChange,
  filteredCategories,
  saving,
  onCancel,
  onSubmit,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <form
      onSubmit={onSubmit}
      className="bg-white p-5 rounded-2xl border border-indigo-300 shadow-md space-y-4"
    >
      <h3 className="text-sm font-bold text-slate-900">{t.createRecurringTitle}</h3>

      <div className="flex flex-wrap items-center gap-3">
        {/* Expense vs Income */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => onTypeChange('expense')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold ${
              type === 'expense' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600'
            }`}
          >
            <ArrowDownRight size={14} />
            {t.monthlyBillExpense}
          </button>
          <button
            type="button"
            onClick={() => onTypeChange('income')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold ${
              type === 'income' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600'
            }`}
          >
            <ArrowUpRight size={14} />
            {t.monthlyInputSalary}
          </button>
        </div>

        {/* Fixed Monthly vs Installment */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => onPlanModeChange('recurring')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold ${
              planMode === 'recurring' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600'
            }`}
          >
            <Repeat size={13} />
            {t.freqRecurring}
          </button>
          <button
            type="button"
            onClick={() => onPlanModeChange('installment')}
            className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold ${
              planMode === 'installment' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600'
            }`}
          >
            <Layers size={13} />
            {t.freqInstallment}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            {t.descriptionLabel}
          </label>
          <input
            type="text"
            required
            placeholder={t.recurringPlaceholder}
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">{t.amountLabel}</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-bold"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            {type === 'income' ? t.expectedDayShortLabel : t.dueDayShortLabel}
          </label>
          <input
            type="number"
            min="1"
            max="31"
            required
            value={dayOfMonth}
            onChange={(e) => onDayOfMonthChange(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-bold"
          />
        </div>
      </div>

      {planMode === 'installment' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {t.currentInstLabel}
            </label>
            <input
              type="number"
              min="1"
              max="240"
              required
              value={currentInst}
              onChange={(e) => onCurrentInstChange(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-bold"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {t.totalInstLabel}
            </label>
            <input
              type="number"
              min="2"
              max="240"
              required
              value={totalInst}
              onChange={(e) => onTotalInstChange(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-bold"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-500 mb-1">{t.categoryLabel}</label>
          <select
            value={categoryId}
            onChange={(e) => onCategoryIdChange(e.target.value)}
            className="w-full sm:max-w-xs px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white"
          >
            {filteredCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {getCategoryDisplayName(c, language)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 pt-3 sm:pt-5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold"
          >
            {t.cancelBtn}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
          >
            {saving ? t.savingBtn : t.saveTemplateBtn}
          </button>
        </div>
      </div>
    </form>
  );
};
