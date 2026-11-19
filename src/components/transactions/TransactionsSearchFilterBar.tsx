import React from 'react';
import { Check, ChevronDown, Eye, EyeOff, Search, X } from 'lucide-react';
import { AppLanguage } from '../../types';
import { FilterChipId } from './transactionsViewMath';

export interface TransactionsSearchFilterBarProps {
  language: AppLanguage;
  isBalanceHidden: boolean;
  onToggleBalancePrivacy: (e: React.MouseEvent) => void;
  searchQuery: string;
  onSearchQueryChange: (val: string) => void;
  primaryFilterChips: { id: FilterChipId; label: string }[];
  dropdownFilters: { id: FilterChipId; label: string }[];
  allFilterOptions?: { id: FilterChipId; label: string }[];
  activeFilterOption?: { id: FilterChipId; label: string };
  activeFilterChip: FilterChipId;
  onSelectFilterChip: (id: FilterChipId) => void;
  isDropdownOpen: boolean;
  onToggleDropdown: () => void;
  dropdownContainerRef?: React.RefObject<HTMLDivElement>;
  dropdownBtnRef: React.RefObject<HTMLButtonElement>;
  dropdownMenuRef: React.RefObject<HTMLDivElement>;
}

export const TransactionsSearchFilterBar: React.FC<TransactionsSearchFilterBarProps> = ({
  language,
  isBalanceHidden,
  onToggleBalancePrivacy,
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
}) => {
  const filterOptions = allFilterOptions ?? [...primaryFilterChips, ...dropdownFilters];
  const currentOption =
    activeFilterOption ??
    filterOptions.find((opt) => opt.id === activeFilterChip) ??
    filterOptions[0];
  const isCustomFilterSelected = activeFilterChip !== 'all';

  return (
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
  );
};
