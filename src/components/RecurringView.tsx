import React, { useState, useMemo } from 'react';
import { Repeat, Plus } from 'lucide-react';
import { AppLanguage, Category, RecurringTemplate, Transaction, TransactionType } from '../types';
import { shiftMonth } from '../utils/format';
import { TRANSLATIONS } from '../utils/i18n';
import { RecurringAddForm } from './recurring/RecurringAddForm';
import { RecurringItemCard } from './recurring/RecurringItemCard';
import { RecurringSummaryBar } from './recurring/RecurringSummaryBar';
import { evaluateRecurringTemplates } from './recurring/recurringUtils';

export type {
  EvaluatedRecurringTemplate,
  RecurringSummaryBarProps,
} from './recurring/RecurringSummaryBar';
export type { RecurringItemCardProps } from './recurring/RecurringItemCard';
export type { RecurringAddFormProps } from './recurring/RecurringAddForm';

export interface RecurringViewProps {
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
  const evaluatedTemplates = useMemo(
    () => evaluateRecurringTemplates(recurringTemplates, appliedInSelectedMonth, selectedMonth),
    [recurringTemplates, appliedInSelectedMonth, selectedMonth]
  );

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
      <RecurringSummaryBar
        selectedMonth={selectedMonth}
        currency={currency}
        language={language}
        pendingCount={pendingCount}
        showAddForm={showAddForm}
        monthlyTotals={monthlyTotals}
        onApplyAllRecurring={onApplyAllRecurring}
        onToggleAddForm={() => setShowAddForm((v) => !v)}
      />

      {showAddForm && (
        <RecurringAddForm
          language={language}
          type={type}
          onTypeChange={handleTypeChange}
          planMode={planMode}
          onPlanModeChange={setPlanMode}
          description={description}
          onDescriptionChange={setDescription}
          amount={amount}
          onAmountChange={setAmount}
          dayOfMonth={dayOfMonth}
          onDayOfMonthChange={setDayOfMonth}
          currentInst={currentInst}
          onCurrentInstChange={setCurrentInst}
          totalInst={totalInst}
          onTotalInstChange={setTotalInst}
          categoryId={categoryId}
          onCategoryIdChange={setCategoryId}
          filteredCategories={filteredCategories}
          saving={saving}
          onCancel={() => setShowAddForm(false)}
          onSubmit={handleSubmit}
        />
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
            {evaluatedTemplates.map((tpl) => (
              <RecurringItemCard
                key={tpl.id}
                tpl={tpl}
                category={categoryMap.get(tpl.categoryId)}
                selectedMonth={selectedMonth}
                currency={currency}
                language={language}
                onApplySingleRecurring={onApplySingleRecurring}
                onDeleteRecurring={onDeleteRecurring}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
