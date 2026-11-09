import React from 'react';
import {
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Scale,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { AppLanguage } from '../../types';
import { formatCurrency } from '../../utils/format';
import { FilterChipId } from './transactionsViewMath';

export interface TransactionsHeroSummaryProps {
  selectedMonth?: string;
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
  allFilterOptions?: { id: FilterChipId; label: string }[];
  activeFilterOption?: { id: FilterChipId; label: string };
  activeFilterChip: FilterChipId;
  onSelectFilterChip: (id: FilterChipId) => void;
  isDropdownFilterActive: boolean;
  activeDropdownFilter?: { id: FilterChipId; label: string };
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  dropdownPos: { top: number; left?: number; right?: number };
  dropdownContainerRef?: React.RefObject<HTMLDivElement>;
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
  allFilterOptions,
  activeFilterOption,
  activeFilterChip,
  onSelectFilterChip,
  isDropdownOpen,
  onToggleDropdown,
  dropdownContainerRef,
  dropdownBtnRef,
  dropdownMenuRef,
  balanceCard,
  hasMonthStats,
}) => {
  const filterOptions = allFilterOptions ?? [...primaryFilterChips, ...dropdownFilters];
  const currentOption =
    activeFilterOption ??
    filterOptions.find((opt) => opt.id === activeFilterChip) ??
    filterOptions[0];
  const isCustomFilterSelected = activeFilterChip !== 'all';

  const projectedFinal =
    effectiveBankBalance + effectiveStats.pendingIncome - effectiveStats.pendingExpense;

  const formatUnsigned = (val: number): string => formatCurrency(Math.abs(val), currency);

  return (
    <>
      <div className="w-full flex flex-col gap-2.5 px-0 py-1">
        {/* Independent 2x2 Mini-Cards Grid */}
        <div className="grid grid-cols-2 gap-2.5 w-full">
          {/* Mini-Bloco 1 (Row 1, Left) — Saldo (Vertically Centered 2-Line Card) */}
          <div
            role={onOpenBalanceModal ? 'button' : undefined}
            tabIndex={onOpenBalanceModal ? 0 : undefined}
            onClick={onOpenBalanceModal}
            onKeyDown={(e) => {
              if (onOpenBalanceModal && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onOpenBalanceModal();
              }
            }}
            title={
              onOpenBalanceModal
                ? language === 'pt-BR'
                  ? 'Ajustar saldo inicial'
                  : 'Adjust initial balance'
                : undefined
            }
            className={`p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] flex items-center gap-2.5 min-h-[82px] transition-colors shadow-sm min-w-0 ${
              onOpenBalanceModal ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-[#161B22]' : ''
            }`}
          >
            <span className="w-8 h-8 rounded-full bg-blue-500/10 dark:bg-blue-500/15 flex items-center justify-center shrink-0">
              <Wallet size={16} className="text-blue-600 dark:text-blue-400" />
            </span>
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <span className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                {language === 'pt-BR' ? 'Saldo' : 'Balance'}
              </span>
              <span className="text-base sm:text-lg font-black tracking-tight leading-tight truncate text-slate-900 dark:text-slate-50 mt-0.5">
                {isBalanceHidden ? 'R$ ••••••' : formatUnsigned(effectiveBankBalance)}
              </span>
            </div>
          </div>

          {/* Mini-Bloco 2 (Row 1, Right) — Balanço Mensal (Vertically Centered 2-Line Card) */}
          <div className="p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] flex items-center gap-2.5 min-h-[82px] transition-colors shadow-sm min-w-0">
            <span className="w-8 h-8 rounded-full bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Scale size={16} />
            </span>
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <span className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                {language === 'pt-BR' ? 'Balanço Mensal' : 'Monthly Balance'}
              </span>
              <span
                className={`text-base sm:text-lg font-black tracking-tight leading-tight truncate mt-0.5 ${
                  projectedFinal >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                }`}
              >
                {isBalanceHidden ? 'R$ ••••••' : formatUnsigned(projectedFinal)}
              </span>
            </div>
          </div>

          {/* Mini-Bloco 3 (Row 2, Left) — Receitas */}
          <div className="p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] flex items-start gap-2.5 min-h-[82px] transition-colors shadow-sm min-w-0">
            <span className="w-8 h-8 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <TrendingUp size={16} className="text-[#10B981]" />
            </span>
            <div className="flex flex-col justify-start min-w-0 flex-1">
              <span className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                {language === 'pt-BR' ? 'Receitas' : 'Income'}
              </span>
              <span className="text-base sm:text-lg font-black tracking-tight leading-tight truncate text-[#10B981] mt-1">
                {isBalanceHidden ? 'R$ ••••••' : formatUnsigned(effectiveStats.income)}
              </span>
              <span className="text-[11px] font-bold tracking-tight truncate mt-1 text-emerald-600/90 dark:text-emerald-400/90">
                {isBalanceHidden ? '+R$ ••••' : `+${formatUnsigned(effectiveStats.pendingIncome)}`}
              </span>
            </div>
          </div>

          {/* Mini-Bloco 4 (Row 2, Right) — Despesas */}
          <div className="p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] flex items-start gap-2.5 min-h-[82px] transition-colors shadow-sm min-w-0">
            <span className="w-8 h-8 rounded-full bg-red-500/10 dark:bg-red-500/15 flex items-center justify-center shrink-0 mt-0.5">
              <TrendingDown size={16} className="text-[#EF4444]" />
            </span>
            <div className="flex flex-col justify-start min-w-0 flex-1">
              <span className="text-xs sm:text-[13px] font-bold text-slate-800 dark:text-slate-200 truncate leading-tight">
                {language === 'pt-BR' ? 'Despesas' : 'Expenses'}
              </span>
              <span className="text-base sm:text-lg font-black tracking-tight leading-tight truncate text-[#EF4444] mt-1">
                {isBalanceHidden ? 'R$ ••••••' : formatUnsigned(effectiveStats.expense)}
              </span>
              <span className="text-[11px] font-bold tracking-tight truncate mt-1 text-red-500/90 dark:text-red-400/90">
                {isBalanceHidden ? '-R$ ••••' : `-${formatUnsigned(effectiveStats.pendingExpense)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Independent Search, Filter, and Privacy Bar */}
        <div className="flex items-center gap-2 w-full pt-1">
          {/* 1. Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 z-10 w-3.5 h-3.5"
            />
            <input
              type="text"
              placeholder={
                language === 'pt-BR' ? 'Pesquisar lançamentos...' : 'Search transactions...'
              }
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="whatsapp-search-input flex-1 w-full h-10 px-3 pl-9 pr-8 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 shadow-sm focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchQueryChange('')}
                style={{ touchAction: 'manipulation' }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors z-10 cursor-pointer select-none"
                title={language === 'pt-BR' ? 'Limpar busca' : 'Clear search'}
              >
                <X size={14} className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 2. Filter Dropdown Button & Popover */}
          <div ref={dropdownContainerRef} className="relative shrink-0">
            <button
              ref={dropdownBtnRef}
              type="button"
              onClick={onToggleDropdown}
              aria-expanded={isDropdownOpen}
              aria-haspopup="true"
              style={{ touchAction: 'manipulation' }}
              className={`h-9 sm:h-10 px-3 rounded-xl border shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer select-none text-xs font-semibold whitespace-nowrap ${
                isCustomFilterSelected
                  ? 'border-[#6E5440] bg-[#6E5440]/15 text-[#6E5440] dark:border-[#7E624B] dark:bg-[#6E5440]/30 dark:text-[#F8FAFC]'
                  : 'border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] hover:bg-slate-50 dark:hover:bg-[#161B22] text-slate-700 dark:text-slate-200'
              }`}
            >
              {isCustomFilterSelected && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shrink-0" />
              )}
              <span>{currentOption?.label}</span>
              <ChevronDown
                size={14}
                className={`text-slate-400 dark:text-slate-400 shrink-0 transition-transform duration-200 ${
                  isDropdownOpen ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>

            {isDropdownOpen && (
              <div
                ref={dropdownMenuRef}
                role="menu"
                className="absolute right-0 top-full z-50 min-w-[200px] shadow-xl bg-white dark:bg-[#161B22] border border-slate-200 dark:border-[#21262D] rounded-xl py-1 mt-1 flex flex-col"
              >
                {filterOptions.map((filter) => {
                  const isSelected = activeFilterChip === filter.id;
                  return (
                    <button
                      key={filter.id}
                      type="button"
                      role="menuitem"
                      onClick={() => onSelectFilterChip(filter.id)}
                      style={{ touchAction: 'manipulation' }}
                      className={`px-3 py-2.5 text-xs font-medium cursor-pointer select-none transition-colors flex items-center justify-between text-left ${
                        isSelected
                          ? 'bg-emerald-500/10 text-[#10B981] font-semibold dark:bg-emerald-500/15'
                          : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#21262D]'
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

          {/* 3. Privacy Eye Toggle Button */}
          <button
            type="button"
            onClick={onToggleBalancePrivacy}
            style={{ touchAction: 'manipulation' }}
            aria-label="Ocultar ou exibir valores"
            title="Ocultar ou exibir valores"
            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 shadow-sm cursor-pointer select-none transition-colors"
          >
            {isBalanceHidden ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {balanceCard && !hasMonthStats && balanceCard}
    </>
  );
};
