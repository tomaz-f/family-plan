import React, { useState, useMemo } from 'react';
import {
  Repeat,
  Plus,
  CheckCircle2,
  Clock,
  Trash2,
  Play,
  ArrowUpRight,
  ArrowDownRight,
  Layers,
} from 'lucide-react';
import { AppLanguage, Category, RecurringTemplate, Transaction, TransactionType } from '../types';
import { formatCurrency, formatMonthLabel, formatShortMonthLabel, shiftMonth } from '../utils/format';
import { getCategoryDisplayName, TRANSLATIONS } from '../utils/i18n';
import { CategoryIcon } from './CategoryIcon';

interface RecurringViewProps {
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  categories: Category[];
  recurringTemplates: RecurringTemplate[];
  transactions: Transaction[];
  onCreateRecurring: (tpl: {
    type: TransactionType;
    amount: number;
    description: string;
    categoryId: string;
    dayOfMonth: number;
    isInstallment?: boolean;
    totalInstallments?: number;
    startMonth?: string;
  }) => Promise<void>;
  onDeleteRecurring: (id: string) => Promise<void>;
  onApplySingleRecurring: (id: string, month: string) => Promise<void>;
  onApplyAllRecurring: (month: string) => Promise<void>;
}

function getInstallmentNumberForMonth(startMonth?: string | null, targetMonth?: string): number | null {
  if (!startMonth || !targetMonth) return null;
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ty, tm] = targetMonth.split('-').map(Number);
  if (!sy || !sm || !ty || !tm) return null;
  return (ty - sy) * 12 + (tm - sm) + 1;
}

export const RecurringView: React.FC<RecurringViewProps> = ({
  selectedMonth,
  currency,
  language,
  categories,
  recurringTemplates,
  transactions,
  onCreateRecurring,
  onDeleteRecurring,
  onApplySingleRecurring,
  onApplyAllRecurring,
}) => {
  const t = TRANSLATIONS[language];
  const [showAddForm, setShowAddForm] = useState(false);
  const [type, setType] = useState<TransactionType>('expense');
  const [planMode, setPlanMode] = useState<'recurring' | 'installment'>('recurring');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dayOfMonth, setDayOfMonth] = useState('10');
  const [currentInst, setCurrentInst] = useState('1');
  const [totalInst, setTotalInst] = useState('12');
  const [categoryId, setCategoryId] = useState('exp-housing');
  const [saving, setSaving] = useState(false);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );

  const appliedInSelectedMonth = useMemo(() => {
    const set = new Set<string>();
    for (const tx of transactions) {
      if (tx.date.startsWith(selectedMonth) && tx.recurringId) {
        set.add(tx.recurringId);
      }
    }
    return set;
  }, [transactions, selectedMonth]);

  // Evaluate each template's status for selectedMonth
  const evaluatedTemplates = useMemo(() => {
    return recurringTemplates.map((tpl) => {
      const isApplied = appliedInSelectedMonth.has(tpl.id);
      if (tpl.isInstallment && tpl.totalInstallments && tpl.startMonth) {
        const instNum = getInstallmentNumberForMonth(tpl.startMonth, selectedMonth) || 1;
        const endMonth = shiftMonth(tpl.startMonth, tpl.totalInstallments - 1);
        const isConcluded = instNum > tpl.totalInstallments;
        const isBeforeStart = instNum < 1;
        const remaining = Math.max(0, tpl.totalInstallments - instNum);
        return {
          ...tpl,
          isApplied,
          instNum,
          endMonth,
          isConcluded,
          isBeforeStart,
          remaining,
          isDueInSelectedMonth: tpl.active && !isConcluded && !isBeforeStart,
        };
      }
      return {
        ...tpl,
        isApplied,
        instNum: null,
        endMonth: null,
        isConcluded: false,
        isBeforeStart: false,
        remaining: null,
        isDueInSelectedMonth: tpl.active,
      };
    });
  }, [recurringTemplates, appliedInSelectedMonth, selectedMonth]);

  const pendingCount = useMemo(
    () => evaluatedTemplates.filter((r) => r.isDueInSelectedMonth && !r.isApplied).length,
    [evaluatedTemplates]
  );

  const monthlyTotals = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (const r of evaluatedTemplates) {
      if (!r.isDueInSelectedMonth) continue;
      if (r.type === 'income') inc += r.amount;
      else exp += r.amount;
    }
    return { inc, exp, net: inc - exp };
  }, [evaluatedTemplates]);

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType);
    const firstCat = categories.find((c) => c.type === nextType);
    if (firstCat) setCategoryId(firstCat.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount.replace(',', '.'));
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0 || !description.trim()) return;

    setSaving(true);
    try {
      const curNum = Math.max(1, Number(currentInst) || 1);
      const totNum = Math.max(curNum, Number(totalInst) || 2);
      const startMonth = shiftMonth(selectedMonth, -(curNum - 1));

      await onCreateRecurring({
        type,
        amount: parsedAmount,
        description: description.trim(),
        categoryId,
        dayOfMonth: Math.min(31, Math.max(1, Number(dayOfMonth) || 1)),
        isInstallment: planMode === 'installment',
        totalInstallments: planMode === 'installment' ? totNum : undefined,
        startMonth: planMode === 'installment' ? startMonth : undefined,
      });
      setDescription('');
      setAmount('');
      setShowAddForm(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
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
            onClick={() => setShowAddForm((v) => !v)}
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

      {/* Add Form */}
      {showAddForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-5 rounded-2xl border border-indigo-300 shadow-md space-y-4"
        >
          <h3 className="text-sm font-bold text-slate-900">{t.createRecurringTitle}</h3>

          <div className="flex flex-wrap items-center gap-3">
            {/* Expense vs Income */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold ${
                  type === 'expense' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600'
                }`}
              >
                <ArrowDownRight size={14} />
                {t.monthlyBillExpense}
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('income')}
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
                onClick={() => setPlanMode('recurring')}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold ${
                  planMode === 'recurring' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600'
                }`}
              >
                <Repeat size={13} />
                {t.freqRecurring}
              </button>
              <button
                type="button"
                onClick={() => setPlanMode('installment')}
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
                onChange={(e) => setDescription(e.target.value)}
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
                onChange={(e) => setAmount(e.target.value)}
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
                onChange={(e) => setDayOfMonth(e.target.value)}
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
                  onChange={(e) => setCurrentInst(e.target.value)}
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
                  onChange={(e) => setTotalInst(e.target.value)}
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
                onChange={(e) => setCategoryId(e.target.value)}
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
                onClick={() => setShowAddForm(false)}
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
      )}

      {/* Templates List */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {evaluatedTemplates.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Repeat size={22} />
            </div>
            <p className="text-sm font-semibold text-slate-700">{t.noRecurringTitle}</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">{t.noRecurringDesc}</p>
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
            >
              <Plus size={14} />
              {t.createFirstTemplate}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {evaluatedTemplates.map((tpl) => {
              const cat = categoryMap.get(tpl.categoryId);
              const monthFull = formatMonthLabel(selectedMonth, language);
              return (
                <div
                  key={tpl.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-slate-50/70 transition-colors ${
                    tpl.isConcluded ? 'opacity-55' : ''
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <CategoryIcon
                      icon={cat?.icon || 'Tag'}
                      color={cat?.color || '#64748b'}
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
                        {getCategoryDisplayName(cat, language)} •{' '}
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
            })}
          </div>
        )}
      </div>
    </div>
  );
};
