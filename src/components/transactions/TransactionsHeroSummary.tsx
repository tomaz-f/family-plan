import React from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Search,
  X,
} from 'lucide-react';
import { AppLanguage } from '../../types';
import { formatCurrency } from '../../utils/format';
import { FilterChipId } from './transactionsViewMath';

export interface TransactionsHeroSummaryProps {
  language: AppLanguage;
  currency: string;
  effectiveBankBalance: number;
  effectiveStats: {
    income: number;
    expense: number;
    pendingIncome: number;
    pendingExpense: number;
  };
  isBalanceHidden: boolean;
  onToggleBalancePrivacy: (e: React.MouseEvent) => void;
  onOpenBalanceModal?: () => void;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  primaryFilterChips: { id: FilterChipId; label: string }[];
  dropdownFilters: { id: FilterChipId; label: string }[];
  activeFilterChip: FilterChipId;
  onSelectFilterChip: (id: FilterChipId) => void;
  isDropdownFilterActive: boolean;
  activeDropdownFilter?: { id: FilterChipId; label: string };
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  dropdownPos: { top: number; left?: number; right?: number };
  dropdownBtnRef: React.RefObject<HTMLButtonElement>;
  dropdownMenuRef: React.RefObject<HTMLDivElement>;
  balanceCard?: React.ReactNode;
  hasMonthStats: boolean;
}

export const TransactionsHeroSummary: React.FC<TransactionsHeroSummaryProps> = ({
  language,
  currency,
  effectiveBankBalance,
  effectiveStats,
  isBalanceHidden,
  onToggleBalancePrivacy,
  onOpenBalanceModal,
  searchQuery,
  onSearchQueryChange,
  primaryFilterChips,
  dropdownFilters,
  activeFilterChip,
  onSelectFilterChip,
  isDropdownFilterActive,
  activeDropdownFilter,
  isDropdownOpen,
  onToggleDropdown,
  dropdownPos,
  dropdownBtnRef,
  dropdownMenuRef,
  balanceCard,
  hasMonthStats,
}) => {
  return (
    <>
      <div className="oled-main-card rounded-2xl sm:rounded-3xl bg-[#0D1117] text-white p-4 sm:p-5 border border-[#21262D] shadow-xs">
        <div className="flex items-center justify-between gap-3.5 sm:gap-5">
          {/* Left Column: Balance, Search, Filter Chips */}
          <div className="flex-1 min-w-0 flex flex-col justify-between space-y-2.5 sm:space-y-3">
            {/* Row 1: Balance Amount & Privacy Toggle */}
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <h1
                role={onOpenBalanceModal ? 'button' : undefined}
                tabIndex={onOpenBalanceModal ? 0 : undefined}
                onClick={onOpenBalanceModal}
                onKeyDown={(e) => {
                  if (onOpenBalanceModal && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onOpenBalanceModal();
                  }
                }}
                className={`text-[28px] min-[375px]:text-3xl min-[410px]:text-[34px] sm:text-4xl font-black tracking-tight leading-none truncate ${
                  onOpenBalanceModal ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
                } ${
                  effectiveBankBalance < 0
                    ? 'text-rose-500 dark:text-rose-400'
                    : 'text-slate-900 dark:text-[#F8FAFC]'
                }`}
                title={
                  onOpenBalanceModal
                    ? language === 'pt-BR'
                      ? 'Ajustar saldo inicial'
                      : 'Adjust initial balance'
                    : undefined
                }
              >
                {isBalanceHidden ? 'R$ ••••••' : formatCurrency(effectiveBankBalance, currency)}
              </h1>

              <button
                type="button"
                onClick={onToggleBalancePrivacy}
                className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white active:scale-90 transition-all shrink-0 focus:outline-none flex items-center justify-center"
                title={
                  isBalanceHidden
                    ? language === 'pt-BR'
                      ? 'Mostrar saldo'
                      : 'Show balance'
                    : language === 'pt-BR'
                    ? 'Ocultar saldo'
                    : 'Hide balance'
                }
                aria-label={isBalanceHidden ? 'Show balance' : 'Hide balance'}
              >
                {isBalanceHidden ? (
                  <EyeOff size={22} className="stroke-[2.2]" />
                ) : (
                  <Eye size={22} className="stroke-[2.2]" />
                )}
              </button>
            </div>

            {/* Row 2: Integrated WhatsApp-style Search Input */}
            <div className="relative w-full">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 z-10 w-4 h-4"
              />
              <input
                type="text"
                placeholder={
                  language === 'pt-BR' ? 'Pesquisar lançamentos...' : 'Search transactions...'
                }
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                className="whatsapp-search-input w-full h-9 sm:h-9.5 pl-11 pr-10 rounded-full text-xs sm:text-sm text-slate-900 dark:text-[#F8FAFC] placeholder:text-slate-400 focus:outline-none transition-all shadow-inner-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchQueryChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors z-10"
                  title={language === 'pt-BR' ? 'Limpar busca' : 'Clear search'}
                >
                  <X size={14} className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Row 3: Horizontal Primary Filter Chips & Compact Overflow Menu */}
            <div className="w-full flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 -my-0.5 min-w-0">
              {primaryFilterChips.map((chip) => {
                const isSelected = activeFilterChip === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => onSelectFilterChip(chip.id)}
                    className={`h-8 rounded-full px-3 text-xs font-medium whitespace-nowrap border shrink-0 transition-all active:scale-95 select-none flex items-center justify-center ${
                      isSelected ? 'filter-chip-active font-semibold shadow-xs' : 'filter-chip-inactive'
                    }`}
                  >
                    {chip.label}
                  </button>
                );
              })}

              <button
                ref={dropdownBtnRef}
                type="button"
                onClick={onToggleDropdown}
                aria-expanded={isDropdownOpen}
                aria-haspopup="true"
                title={
                  isDropdownFilterActive
                    ? activeDropdownFilter?.label
                    : language === 'pt-BR'
                    ? 'Mais filtros'
                    : 'More filters'
                }
                className={`h-8 rounded-full px-2.5 text-xs font-medium whitespace-nowrap border shrink-0 flex-shrink-0 transition-all active:scale-95 select-none flex items-center justify-center gap-1.5 ${
                  isDropdownFilterActive
                    ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/60 font-semibold shadow-xs'
                    : 'bg-slate-100 text-slate-600 border-slate-200/80 hover:bg-slate-200 dark:bg-[#161B22] dark:text-slate-300 dark:border-[#21262D] dark:hover:bg-[#21262D]'
                }`}
              >
                {isDropdownFilterActive && (
                  <span className="w-2 h-2 rounded-full bg-[#10B981] shadow-xs shrink-0" />
                )}
                <ChevronDown
                  size={14}
                  className={`transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180' : 'rotate-0'
                  }`}
                />
              </button>

              {isDropdownOpen && (
                <div
                  ref={dropdownMenuRef}
                  style={{
                    position: 'fixed',
                    top: dropdownPos.top,
                    left: dropdownPos.left,
                    right: dropdownPos.right,
                    zIndex: 50,
                  }}
                  className="min-w-[180px] p-1.5 rounded-xl shadow-xl flex flex-col gap-1 bg-white border border-slate-200 text-slate-700 shadow-slate-200/50 dark:bg-[#161B22] dark:border-[#21262D] dark:text-slate-200 dark:shadow-black/60 animate-fadeIn"
                >
                  {dropdownFilters.map((filter) => {
                    const isSelected = activeFilterChip === filter.id;
                    return (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => onSelectFilterChip(filter.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors flex items-center justify-between text-left ${
                          isSelected
                            ? 'bg-emerald-500/10 text-[#10B981] font-semibold dark:bg-emerald-500/15'
                            : 'hover:bg-slate-100 dark:hover:bg-[#21262D]'
                        }`}
                      >
                        <span>{filter.label}</span>
                        {isSelected && <Check size={14} className="text-[#10B981] shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Stacked Income & Expenses Summary */}
          <div className="shrink-0 text-right flex flex-col items-end justify-between space-y-3 sm:space-y-3.5 pl-2 sm:pl-3">
            <div className="flex flex-col items-end text-right">
              <div className="flex items-center gap-1 text-[#10B981] mb-0.5 justify-end">
                <ArrowUpRight size={14} strokeWidth={2.5} className="shrink-0" />
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {language === 'pt-BR' ? 'ENTRADAS' : 'INCOME'}
                </span>
              </div>
              <p className="text-base sm:text-lg font-black text-[#10B981] tracking-tight leading-tight">
                {isBalanceHidden ? '+R$ ••••••' : `+${formatCurrency(effectiveStats.income, currency)}`}
              </p>
              <p
                className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-[#94A3B8] mt-0.5 whitespace-nowrap"
                title={`${language === 'pt-BR' ? 'A receber:' : 'To receive:'} ${formatCurrency(
                  effectiveStats.pendingIncome,
                  currency
                )}`}
              >
                {language === 'pt-BR' ? 'A receber:' : 'To receive:'}{' '}
                <span className="text-slate-900 dark:text-white font-bold ml-0.5">
                  {isBalanceHidden
                    ? 'R$ ••••'
                    : formatCurrency(effectiveStats.pendingIncome, currency)}
                </span>
              </p>
            </div>

            <div className="flex flex-col items-end text-right">
              <div className="flex items-center gap-1 text-[#EF4444] mb-0.5 justify-end">
                <ArrowDownRight size={14} strokeWidth={2.5} className="shrink-0" />
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  {language === 'pt-BR' ? 'DESPESAS' : 'EXPENSES'}
                </span>
              </div>
              <p className="text-base sm:text-lg font-black text-[#EF4444] tracking-tight leading-tight">
                {isBalanceHidden ? '-R$ ••••••' : `-${formatCurrency(effectiveStats.expense, currency)}`}
              </p>
              <p
                className="text-[11px] sm:text-xs font-medium text-slate-500 dark:text-[#94A3B8] mt-0.5 whitespace-nowrap"
                title={`${language === 'pt-BR' ? 'A pagar:' : 'To pay:'} ${formatCurrency(
                  effectiveStats.pendingExpense,
                  currency
                )}`}
              >
                {language === 'pt-BR' ? 'A pagar:' : 'To pay:'}{' '}
                <span className="text-slate-900 dark:text-white font-bold ml-0.5">
                  {isBalanceHidden
                    ? 'R$ ••••'
                    : formatCurrency(effectiveStats.pendingExpense, currency)}
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {balanceCard && !hasMonthStats && balanceCard}
    </>
  );
};
