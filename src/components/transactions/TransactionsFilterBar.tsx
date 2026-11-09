import React from 'react';
import { ArrowUpDown, Check, ChevronDown, Download, SlidersHorizontal, X } from 'lucide-react';
import { AppLanguage, Category, Transaction } from '../../types';
import { exportTransactionsToCSV, formatMonthLabel } from '../../utils/format';
import { getCategoryDisplayName, TRANSLATIONS } from '../../utils/i18n';
import { FeedViewMode, SortByMode } from './transactionsViewMath';

export interface TransactionsFeedHeaderBarProps {
  language: AppLanguage;
  filteredCount: number;
  isOrderMenuOpen: boolean;
  setIsOrderMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  orderMenuRef: React.RefObject<HTMLDivElement>;
  viewModeOptions: { id: FeedViewMode; label: string }[];
  feedViewMode: FeedViewMode;
  onSelectViewMode: (mode: FeedViewMode) => void;
}

export const TransactionsFeedHeaderBar: React.FC<TransactionsFeedHeaderBarProps> = ({
  language, filteredCount, isOrderMenuOpen, setIsOrderMenuOpen,
  orderMenuRef, viewModeOptions, feedViewMode, onSelectViewMode,
}) => {
  return (
    <div className="flex items-center justify-between w-full pt-3 pb-1">
      <div className="text-xs font-bold tracking-wider uppercase text-slate-600 dark:text-slate-400 flex items-center gap-2">
        <h2>{language === 'pt-BR' ? 'Lançamentos' : 'Transactions'}</h2>
        {filteredCount > 0 && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-[#161B22] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-[#21262D]">
            {filteredCount}
          </span>
        )}
      </div>

      <div className="relative inline-block text-left" ref={orderMenuRef}>
        <button
          type="button"
          onClick={() => setIsOrderMenuOpen((prev) => !prev)}
          aria-expanded={isOrderMenuOpen}
          aria-haspopup="true"
          style={{ touchAction: 'manipulation' }}
          className="h-9 sm:h-10 px-3 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] hover:bg-slate-50 dark:hover:bg-[#161B22] shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer select-none text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap"
          title={
            language === 'pt-BR'
              ? 'Opções de ordenação e exibição'
              : 'Sorting and view options'
          }
        >
          <ArrowUpDown size={14} className="text-slate-400 dark:text-slate-400 shrink-0" />
          <span>{language === 'pt-BR' ? 'Ordenar' : 'Sort'}</span>
          <ChevronDown
            size={14}
            className={`text-slate-400 dark:text-slate-400 shrink-0 transition-transform duration-200 ${
              isOrderMenuOpen ? 'rotate-180' : 'rotate-0'
            }`}
          />
        </button>

        {isOrderMenuOpen && (
          <div
            className="absolute right-0 mt-1.5 min-w-[210px] p-1.5 rounded-xl shadow-2xl z-50 flex flex-col gap-1 bg-white border border-slate-200 text-slate-800 shadow-slate-200/60 dark:bg-[#161B22] dark:border-[#21262D] dark:text-slate-100 dark:shadow-black/80 animate-in fade-in"
            role="menu"
          >
            {viewModeOptions.map((opt) => {
              const isActive = feedViewMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitem"
                  onClick={() => onSelectViewMode(opt.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center justify-between text-left ${
                    isActive
                      ? 'bg-emerald-500/10 text-[#10B981] font-semibold dark:bg-emerald-500/15'
                      : 'hover:bg-slate-100 dark:hover:bg-[#21262D]'
                  }`}
                >
                  <span>{opt.label}</span>
                  {isActive && <Check size={14} className="text-[#10B981] shrink-0 ml-2" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export interface TransactionsFilterSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: AppLanguage;
  selectedMonth: string;
  categories: Category[];
  filteredTransactions: Transaction[];
  activeFilterCount: number;
  onResetFilters: () => void;
  scope: 'month' | 'all';
  setScope: (val: 'month' | 'all') => void;
  typeFilter: 'all' | 'income' | 'expense';
  setTypeFilter: (val: 'all' | 'income' | 'expense') => void;
  statusFilter: 'all' | 'paid' | 'unpaid';
  setStatusFilter: (val: 'all' | 'paid' | 'unpaid') => void;
  categoryFilter: string;
  setCategoryFilter: (val: string) => void;
  sortBy: SortByMode;
  setSortBy: (val: SortByMode) => void;
  t: (typeof TRANSLATIONS)[AppLanguage];
}

export const TransactionsFilterSheetModal: React.FC<TransactionsFilterSheetModalProps> = ({
  isOpen, onClose, language, selectedMonth, categories, filteredTransactions,
  activeFilterCount, onResetFilters, scope, setScope, typeFilter, setTypeFilter,
  statusFilter, setStatusFilter, categoryFilter, setCategoryFilter, sortBy, setSortBy, t,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-200 shadow-2xl p-4 sm:p-5 space-y-4 max-h-[85vh] overflow-y-auto z-10 animate-in slide-in-from-bottom duration-200">
        <div className="w-10 h-1 bg-slate-300 rounded-full mx-auto sm:hidden -mt-1 mb-2" />

        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">{t.filterSheetTitle}</h3>
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={onResetFilters}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                {t.clearFiltersBtn}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

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

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
            {language === 'pt-BR' ? 'Ordenar por' : 'Sort by'}
          </label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortByMode)}
            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm bg-white"
          >
            <option value="date-desc">{t.sortNewest}</option>
            <option value="date-asc">{t.sortOldest}</option>
            <option value="amount-desc">{t.sortHighest}</option>
            <option value="amount-asc">{t.sortLowest}</option>
          </select>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={() =>
              exportTransactionsToCSV(
                filteredTransactions,
                categories,
                `prumo-${scope === 'month' ? selectedMonth : 'all-time'}.csv`,
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

        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-bold hover:bg-slate-800 transition-colors shadow-xs"
          >
            {t.viewFilteredCount(filteredTransactions.length)}
          </button>
        </div>
      </div>
    </div>
  );
};
