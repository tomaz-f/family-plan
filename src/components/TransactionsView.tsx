import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Pencil,
  Trash2,
  Plus,
  Minus,
  Repeat,
  Layers,
  ThumbsUp,
  ThumbsDown,
  Clock,
  CreditCard as CreditCardIcon,
} from 'lucide-react';
import { AppLanguage, Category, CreditCard, Transaction, TransactionType } from '../types';
import {
  exportTransactionsToCSV,
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
  formatShortMonthLabel,
  shiftMonth,
} from '../utils/format';
import { getCategoryDisplayName, TRANSLATIONS } from '../utils/i18n';
import { CategoryIcon } from './CategoryIcon';

interface TransactionsViewProps {
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  categories: Category[];
  creditCards?: CreditCard[];
  transactions: Transaction[];
  onOpenAddModal: (type: TransactionType) => void;
  onOpenEditModal: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
  onToggleTransactionStatus: (tx: Transaction) => Promise<void>;
}

export const TransactionsView: React.FC<TransactionsViewProps> = ({
  selectedMonth,
  currency,
  language,
  categories,
  creditCards = [],
  transactions,
  onOpenAddModal,
  onOpenEditModal,
  onDeleteTransaction,
  onToggleTransactionStatus,
}) => {
  const t = TRANSLATIONS[language];
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'>('date-desc');

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((tx) => {
        if (scope === 'month' && !tx.date.startsWith(selectedMonth)) return false;
        if (typeFilter !== 'all' && tx.type !== typeFilter) return false;
        const txStatus = tx.status === 'unpaid' ? 'unpaid' : 'paid';
        if (statusFilter !== 'all' && txStatus !== statusFilter) return false;
        if (categoryFilter !== 'all' && tx.categoryId !== categoryFilter) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const cat = categoryMap.get(tx.categoryId);
          const catName = getCategoryDisplayName(cat, language).toLowerCase();
          const matchDesc = tx.description.toLowerCase().includes(q);
          const matchNotes = (tx.notes || '').toLowerCase().includes(q);
          const matchCat = catName.includes(q);
          if (!matchDesc && !matchNotes && !matchCat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') return b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt);
        if (sortBy === 'date-asc') return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt);
        if (sortBy === 'amount-desc') return b.amount - a.amount;
        return a.amount - b.amount;
      });
  }, [transactions, scope, selectedMonth, typeFilter, statusFilter, categoryFilter, searchQuery, sortBy, categoryMap, language]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let pendingAmount = 0;
    let pendingCount = 0;
    for (const tx of filteredTransactions) {
      if (tx.status === 'unpaid') {
        pendingCount++;
        pendingAmount += tx.amount;
        continue;
      }
      if (tx.type === 'income') income += tx.amount;
      else expense += tx.amount;
    }
    return {
      income,
      expense,
      net: income - expense,
      pendingAmount,
      pendingCount,
      count: filteredTransactions.length,
    };
  }, [filteredTransactions]);

  return (
    <div className="space-y-5">
      {/* Header & Quick Add */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-900">{t.historyTitle}</h1>
          <p className="text-xs text-slate-500">
            {scope === 'month'
              ? t.showingRecordsMonth(summary.count, formatMonthLabel(selectedMonth, language))
              : t.showingRecordsAll(summary.count)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              exportTransactionsToCSV(
                filteredTransactions,
                categories,
                `familyplan-${scope === 'month' ? selectedMonth : 'all-time'}.csv`,
                language
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold"
          >
            <Download size={14} />
            {t.exportCsv}
          </button>
          <button
            type="button"
            onClick={() => onOpenAddModal('income')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
          >
            <Plus size={15} strokeWidth={2.5} />
            {t.addInputShort}
          </button>
          <button
            type="button"
            onClick={() => onOpenAddModal('expense')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
          >
            <Minus size={15} strokeWidth={2.5} />
            {t.addExpenseShort}
          </button>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Scope: Selected Month vs All Time */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setScope('month')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                scope === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {formatMonthLabel(selectedMonth, language)}
            </button>
            <button
              type="button"
              onClick={() => setScope('all')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all ${
                scope === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {t.allTime}
            </button>
          </div>

          {/* Category Filter */}
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            >
              <option value="all">{t.allCategories}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.type === 'income' ? t.inputPrefix : t.expensePrefix}
                  {getCategoryDisplayName(cat, language)}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
            >
              <option value="date-desc">{t.sortNewest}</option>
              <option value="date-asc">{t.sortOldest}</option>
              <option value="amount-desc">{t.sortHighest}</option>
              <option value="amount-asc">{t.sortLowest}</option>
            </select>
          </div>
        </div>

        {/* Type & Status Pills & Filtered Totals */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'expense', 'income'] as const).map((typeOpt) => (
              <button
                key={typeOpt}
                type="button"
                onClick={() => setTypeFilter(typeOpt)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  typeFilter === typeOpt
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {typeOpt === 'all'
                  ? t.filterAllEntries
                  : typeOpt === 'income'
                  ? t.filterInputsOnly
                  : t.filterExpensesOnly}
              </button>
            ))}

            <span className="text-slate-300 mx-1">|</span>

            {(['all', 'paid', 'unpaid'] as const).map((stOpt) => (
              <button
                key={stOpt}
                type="button"
                onClick={() => setStatusFilter(stOpt)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-colors ${
                  statusFilter === stOpt
                    ? stOpt === 'unpaid'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {stOpt === 'all'
                  ? t.filterAllEntries
                  : stOpt === 'paid'
                  ? t.filterPaidOnly
                  : t.filterPendingOnly}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className="text-slate-600">
              {t.inputsLabel}: <strong className="text-emerald-500">+{formatCurrency(summary.income, currency)}</strong>
            </span>
            <span className="text-slate-600">
              {t.expensesLabel}: <strong className="text-rose-500">-{formatCurrency(summary.expense, currency)}</strong>
            </span>
            {summary.pendingCount > 0 && (
              <span className="text-amber-500">
                {t.pendingSummaryLabel} ({summary.pendingCount}):{' '}
                <strong>{formatCurrency(summary.pendingAmount, currency)}</strong>
              </span>
            )}
            <span className="text-slate-600">
              {t.netLabel}:{' '}
              <strong className={summary.net >= 0 ? 'text-slate-900' : 'text-rose-500'}>
                {summary.net >= 0 ? '+' : ''}
                {formatCurrency(summary.net, currency)}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-sm font-semibold text-slate-600">{t.noMatchingEntries}</p>
            <p className="text-xs text-slate-400">{t.noMatchingDesc}</p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenAddModal('expense')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold"
              >
                <Plus size={14} />
                {t.addExpenseShort}
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTransactions.map((tx) => {
              const cat = categoryMap.get(tx.categoryId);
              const isUnpaid = tx.status === 'unpaid';
              const cardObj = tx.cardId ? creditCards.find((c) => c.id === tx.cardId) : null;
              return (
                <div
                  key={tx.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50/70 transition-all gap-3 ${
                    isUnpaid ? 'bg-amber-500/5' : ''
                  }`}
                >
                  <div
                    className={`flex items-start sm:items-center gap-3.5 min-w-0 transition-opacity ${
                      isUnpaid ? 'opacity-65' : 'opacity-100'
                    }`}
                  >
                    <CategoryIcon
                      icon={cat?.icon || 'Tag'}
                      color={cat?.color || '#64748b'}
                      size={18}
                      badgeSize="lg"
                    />
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={`text-sm font-bold ${
                            isUnpaid ? 'text-slate-500' : 'text-slate-900'
                          }`}
                        >
                          {tx.description}
                        </p>
                        {cardObj && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-xs"
                            style={{ backgroundColor: cardObj.color || '#6366f1' }}
                          >
                            <CreditCardIcon size={10} />
                            {cardObj.name}
                            {tx.invoiceMonth && ` (${formatShortMonthLabel(tx.invoiceMonth, language)})`}
                          </span>
                        )}
                        {isUnpaid && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[10px] font-extrabold uppercase tracking-wide">
                            <Clock size={10} />
                            {t.pendingBadge}
                          </span>
                        )}
                        {tx.installmentTotal && tx.installmentTotal > 1 ? (
                          <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-500 text-[10px] font-bold">
                              <Layers size={10} />
                              {t.installmentBadge(tx.installmentCurrent || 1, tx.installmentTotal)}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-500 text-[10px] font-semibold">
                              {t.endsInBadge(
                                formatShortMonthLabel(
                                  shiftMonth(
                                    tx.date.slice(0, 7),
                                    Math.max(0, tx.installmentTotal - (tx.installmentCurrent || 1))
                                  ),
                                  language
                                )
                              )}
                            </span>
                          </>
                        ) : tx.recurringId ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 text-[10px] font-semibold">
                            <Repeat size={10} />
                            {t.recurringBadge}
                          </span>
                        ) : null}
                        {tx.dueDay && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                            {t.dueDayBadge(tx.dueDay)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                        <span
                          className="font-semibold"
                          style={{ color: cat?.color || '#64748b' }}
                        >
                          {getCategoryDisplayName(cat, language)}
                        </span>
                        <span>•</span>
                        <span>{formatShortDate(tx.date, language)}</span>
                        {tx.notes && (
                          <>
                            <span>•</span>
                            <span className="italic text-slate-400">{tx.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3.5 pl-14 sm:pl-0 shrink-0">
                    <span
                      className={`text-base font-extrabold transition-opacity ${
                        isUnpaid
                          ? 'opacity-60 text-amber-500'
                          : tx.type === 'income'
                          ? 'text-emerald-500'
                          : 'text-rose-500'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatCurrency(tx.amount, currency)}
                    </span>

                    <div className="flex items-center gap-1">
                      {/* Interactive Paid / Unpaid ThumbsUp / ThumbsDown Status Toggle Button */}
                      <button
                        type="button"
                        onClick={() => onToggleTransactionStatus(tx)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                          isUnpaid
                            ? 'bg-amber-500/15 border-amber-500/30 text-amber-500 hover:bg-emerald-500/20 hover:border-emerald-500/40 hover:text-emerald-500'
                            : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-500 hover:bg-amber-500/15 hover:border-amber-500/30 hover:text-amber-500'
                        }`}
                        title={isUnpaid ? t.markAsPaidTooltip : t.markAsUnpaidTooltip}
                      >
                        {isUnpaid ? <ThumbsDown size={14} /> : <ThumbsUp size={14} />}
                        <span className="hidden md:inline">
                          {isUnpaid ? t.pendingBadge : t.paidBadge}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenEditModal(tx)}
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                        title={t.editTooltip}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(tx.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                        title={t.deleteTooltip}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
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
