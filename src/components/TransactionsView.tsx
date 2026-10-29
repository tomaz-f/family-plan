import React, { useState, useMemo } from 'react';
import {
  Search,
  SlidersHorizontal,
  X,
  Download,
  Pencil,
  Trash2,
  Clock,
  ThumbsUp,
  CreditCard as CreditCardIcon,
  Repeat,
  RotateCcw,
} from 'lucide-react';
import { AppLanguage, Category, CreditCard, Transaction, TransactionType } from '../types';
import {
  exportTransactionsToCSV,
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
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
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState<boolean>(false);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Count active non-default filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (scope === 'all') count++;
    if (typeFilter !== 'all') count++;
    if (statusFilter !== 'all') count++;
    if (categoryFilter !== 'all') count++;
    if (sortBy !== 'date-desc') count++;
    return count;
  }, [scope, typeFilter, statusFilter, categoryFilter, sortBy]);

  const handleResetFilters = () => {
    setScope('month');
    setTypeFilter('all');
    setStatusFilter('all');
    setCategoryFilter('all');
    setSortBy('date-desc');
  };

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

  const selectedCategoryObj = categoryFilter !== 'all' ? categoryMap.get(categoryFilter) : null;

  return (
    <div className="space-y-3.5">
      {/* 1. COMPACT SUMMARY BAR (Topo do Extrato: 4 Números Essenciais Lado a Lado) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-2xs">
        <div className="grid grid-cols-4 divide-x divide-slate-100">
          {/* Entradas */}
          <div className="px-1 sm:px-3 text-center min-w-0">
            <span className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
              {t.inputsLabel}
            </span>
            <span className="text-xs sm:text-base font-extrabold text-emerald-500 truncate block mt-0.5">
              +{formatCurrency(summary.income, currency)}
            </span>
          </div>

          {/* Saídas */}
          <div className="px-1 sm:px-3 text-center min-w-0">
            <span className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
              {t.expensesLabel}
            </span>
            <span className="text-xs sm:text-base font-extrabold text-rose-500 truncate block mt-0.5">
              -{formatCurrency(summary.expense, currency)}
            </span>
          </div>

          {/* Pendentes */}
          <div className="px-1 sm:px-3 text-center min-w-0">
            <span className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
              {t.pendingBadge}
            </span>
            <span className="text-xs sm:text-base font-semibold text-slate-500 truncate block mt-0.5">
              {formatCurrency(summary.pendingAmount, currency)}
            </span>
          </div>

          {/* Saldo Correspondente */}
          <div className="px-1 sm:px-3 text-center min-w-0">
            <span className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
              {t.netLabel}
            </span>
            <span
              className={`text-xs sm:text-base font-extrabold truncate block mt-0.5 ${
                summary.net >= 0 ? 'text-slate-900' : 'text-rose-500'
              }`}
            >
              {summary.net >= 0 ? '+' : ''}
              {formatCurrency(summary.net, currency)}
            </span>
          </div>
        </div>
      </div>

      {/* 2. SLIM TOOLBAR: Busca Minimalista + Botão de Filtros */}
      <div className="flex items-center gap-2">
        {/* Campo de Busca Compacto */}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={language === 'pt-BR' ? 'Pesquisar...' : 'Search...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              title={language === 'pt-BR' ? 'Limpar busca' : 'Clear search'}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Botão de Filtros (Abre Bottom Sheet) */}
        <button
          type="button"
          onClick={() => setIsFilterSheetOpen(true)}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold transition-all shrink-0 active:scale-95 active:opacity-85 ${
            activeFilterCount > 0
              ? 'border-blue-500 bg-blue-500/10 text-blue-500 shadow-xs'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          <SlidersHorizontal size={14} />
          <span>{t.filtersBtn}</span>
          {activeFilterCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active Filter Pills (quando houver filtros aplicados) */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
          {scope === 'all' && (
            <button
              type="button"
              onClick={() => setScope('month')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium shrink-0 hover:bg-slate-200"
            >
              <span>{t.allTime}</span>
              <X size={11} className="text-slate-400" />
            </button>
          )}

          {typeFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium shrink-0 hover:bg-slate-200"
            >
              <span>{typeFilter === 'income' ? t.filterInputsOnly : t.filterExpensesOnly}</span>
              <X size={11} className="text-slate-400" />
            </button>
          )}

          {statusFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium shrink-0 hover:bg-slate-200"
            >
              <span>{statusFilter === 'paid' ? t.filterPaidOnly : t.filterPendingOnly}</span>
              <X size={11} className="text-slate-400" />
            </button>
          )}

          {selectedCategoryObj && (
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium shrink-0 hover:bg-slate-200"
            >
              <span>{getCategoryDisplayName(selectedCategoryObj, language)}</span>
              <X size={11} className="text-slate-400" />
            </button>
          )}

          {sortBy !== 'date-desc' && (
            <button
              type="button"
              onClick={() => setSortBy('date-desc')}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium shrink-0 hover:bg-slate-200"
            >
              <span>
                {sortBy === 'date-asc'
                  ? t.sortOldest
                  : sortBy === 'amount-desc'
                  ? t.sortHighest
                  : t.sortLowest}
              </span>
              <X size={11} className="text-slate-400" />
            </button>
          )}

          <button
            type="button"
            onClick={handleResetFilters}
            className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 px-1 shrink-0 ml-1"
          >
            {t.clearFiltersBtn}
          </button>
        </div>
      )}

      {/* 3. CLEAN TRANSACTIONS LIST: Visual Neutro e Elegante */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {filteredTransactions.length === 0 ? (
          <div className="py-14 text-center space-y-2 px-4">
            <p className="text-xs sm:text-sm font-semibold text-slate-600">{t.noMatchingEntries}</p>
            <p className="text-[11px] sm:text-xs text-slate-400">{t.noMatchingDesc}</p>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 mt-2"
              >
                <RotateCcw size={12} />
                <span>{t.clearFiltersBtn}</span>
              </button>
            )}
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
                  className="flex items-center justify-between p-3 sm:p-3.5 hover:bg-slate-50/70 active:bg-slate-100/60 transition-colors gap-2 sm:gap-3 select-none"
                >
                  {/* Left: Category Icon with custom category color + Clean Info */}
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    {/* Category Icon with category color tint & vibrant icon drawing */}
                    <CategoryIcon
                      icon={cat?.icon || 'Tag'}
                      color={cat?.color || '#64748b'}
                      size={16}
                      badgeSize="md"
                    />

                    {/* Text info */}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate leading-snug">
                        {tx.description}
                      </p>

                      {/* Subtitle / Details: Neutral typography */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-400 mt-0.5 leading-none">
                        <span className="text-slate-500 font-medium truncate max-w-[110px] sm:max-w-none">
                          {getCategoryDisplayName(cat, language)}
                        </span>
                        <span>•</span>
                        <span className="whitespace-nowrap">{formatShortDate(tx.date, language)}</span>

                        {cardObj && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                              <CreditCardIcon size={9} />
                              <span className="truncate max-w-[70px] sm:max-w-none">{cardObj.name}</span>
                            </span>
                          </>
                        )}

                        {tx.installmentTotal && tx.installmentTotal > 1 && (
                          <>
                            <span>•</span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                              {tx.installmentCurrent || 1}/{tx.installmentTotal}
                            </span>
                          </>
                        )}

                        {isUnpaid && (
                          <>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-semibold">
                              <Clock size={9} />
                              <span>{t.pendingBadge}</span>
                            </span>
                          </>
                        )}

                        {tx.recurringId && !tx.installmentTotal && (
                          <>
                            <span>•</span>
                            <Repeat size={10} className="text-slate-400" />
                          </>
                        )}

                        {tx.notes && (
                          <>
                            <span>•</span>
                            <span className="italic truncate max-w-[90px] sm:max-w-[180px]">{tx.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Semantic Value + Minimal Quick Action Buttons */}
                  <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                    {/* Exclusive semantic color for financial value */}
                    <span
                      className={`text-xs sm:text-sm font-bold whitespace-nowrap ${
                        tx.type === 'income' ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {tx.type === 'income' ? '+' : '-'}
                      {formatCurrency(tx.amount, currency)}
                    </span>

                    {/* Minimalist discreet action buttons */}
                    <div className="flex items-center gap-0.5">
                      {/* Status toggle (pago / pendente) */}
                      <button
                        type="button"
                        onClick={() => onToggleTransactionStatus(tx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-90 active:opacity-75 transition-all"
                        title={isUnpaid ? t.markAsPaidTooltip : t.markAsUnpaidTooltip}
                      >
                        {isUnpaid ? (
                          <Clock size={14} className="text-amber-500" />
                        ) : (
                          <ThumbsUp size={14} className="text-slate-400 hover:text-slate-600" />
                        )}
                      </button>

                      {/* Edit */}
                      <button
                        type="button"
                        onClick={() => onOpenEditModal(tx)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:scale-90 active:opacity-75 transition-all"
                        title={t.editTooltip}
                      >
                        <Pencil size={14} />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => onDeleteTransaction(tx.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 active:scale-90 active:opacity-75 transition-all"
                        title={t.deleteTooltip}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. BOTTOM SHEET MODAL (Opções de Período, Categorias, Status e Ordenação) */}
      {isFilterSheetOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          {/* Backdrop Click Dismiss */}
          <div
            className="fixed inset-0"
            onClick={() => setIsFilterSheetOpen(false)}
            aria-hidden="true"
          />

          {/* Bottom Sheet Card */}
          <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl p-4 sm:p-5 space-y-4 max-h-[85vh] overflow-y-auto z-10 animate-in slide-in-from-bottom duration-200">
            {/* Sheet pull bar (mobile only) */}
            <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto sm:hidden -mt-1 mb-2" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">{t.filterSheetTitle}</h3>
              </div>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    {t.clearFiltersBtn}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsFilterSheetOpen(false)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter Section: Período */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {language === 'pt-BR' ? 'Período' : 'Period'}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setScope('month')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    scope === 'month'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {formatMonthLabel(selectedMonth, language)}
                </button>
                <button
                  type="button"
                  onClick={() => setScope('all')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                    scope === 'all'
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {t.allTime}
                </button>
              </div>
            </div>

            {/* Filter Section: Tipo */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {language === 'pt-BR' ? 'Tipo de Lançamento' : 'Type'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['all', 'income', 'expense'] as const).map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setTypeFilter(tp)}
                    className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                      typeFilter === tp
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {tp === 'all'
                      ? t.filterAllEntries
                      : tp === 'income'
                      ? t.filterInputsOnly
                      : t.filterExpensesOnly}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Section: Status */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {language === 'pt-BR' ? 'Status de Pagamento' : 'Payment Status'}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['all', 'paid', 'unpaid'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all ${
                      statusFilter === st
                        ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {st === 'all'
                      ? t.filterAllEntries
                      : st === 'paid'
                      ? t.filterPaidOnly
                      : t.filterPendingOnly}
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Section: Categoria */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {language === 'pt-BR' ? 'Categoria' : 'Category'}
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
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

            {/* Filter Section: Ordenação */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                {language === 'pt-BR' ? 'Ordenar por' : 'Sort by'}
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
              >
                <option value="date-desc">{t.sortNewest}</option>
                <option value="date-asc">{t.sortOldest}</option>
                <option value="amount-desc">{t.sortHighest}</option>
                <option value="amount-asc">{t.sortLowest}</option>
              </select>
            </div>

            {/* Exportar CSV (utilitário discreto) */}
            <div className="pt-1">
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
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Download size={13} />
                <span>
                  {t.exportCsv} ({filteredTransactions.length})
                </span>
              </button>
            </div>

            {/* Primary Dismiss Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsFilterSheetOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-bold hover:bg-slate-800 transition-colors shadow-xs"
              >
                {t.viewFilteredCount(filteredTransactions.length)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
