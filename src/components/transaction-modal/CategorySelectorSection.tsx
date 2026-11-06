import React from 'react';
import { ChevronDown, Tag, X } from 'lucide-react';
import { AppLanguage, Category, CreditCard, TransactionStatus } from '../../types';
import { CategoryIcon } from '../CategoryIcon';
import { getTodayDateStr } from '../../utils/format';
import { getCategoryDisplayName } from '../../utils/i18n';
import { getYesterdayDateStr } from './transactionModalMath';

export interface CategorySelectorRowProps {
  isOled: boolean;
  language: AppLanguage;
  selectedCategory: Category | null;
  onOpenPicker: () => void;
}

export const CategorySelectorRow: React.FC<CategorySelectorRowProps> = ({
  isOled,
  language,
  selectedCategory,
  onOpenPicker,
}) => (
  <button
    type="button"
    onClick={onOpenPicker}
    className={`w-full px-3.5 py-2.5 flex items-center justify-between border-b transition-colors active:scale-[0.99] ${
      isOled
        ? 'border-[#21262D]/60 hover:bg-[#161B22]'
        : 'border-slate-200/60 hover:bg-slate-100'
    }`}
  >
    <div className="flex items-center gap-2.5 min-w-0">
      <CategoryIcon
        icon={selectedCategory?.icon || 'Tag'}
        color={selectedCategory?.color || '#94A3B8'}
        size={16}
        badgeSize="sm"
      />
      <span
        className={`text-xs sm:text-sm font-semibold truncate ${
          isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
        }`}
      >
        {getCategoryDisplayName(selectedCategory, language) ||
          (language === 'pt-BR' ? 'Selecionar Categoria' : 'Select Category')}
      </span>
    </div>
    <ChevronDown size={15} className="text-slate-400 shrink-0" />
  </button>
);

export interface TransactionDateStatusRowProps {
  isOled: boolean;
  language: AppLanguage;
  date: string;
  onDateChange: (newDate: string) => void;
  selectedCard: CreditCard | null;
  status: TransactionStatus;
  onStatusChange: (newStatus: TransactionStatus) => void;
}

export const TransactionDateStatusRow: React.FC<TransactionDateStatusRowProps> = ({
  isOled,
  language,
  date,
  onDateChange,
  selectedCard,
  status,
  onStatusChange,
}) => {
  const todayStr = getTodayDateStr();
  const yesterdayStr = getYesterdayDateStr();

  return (
    <div className="px-3.5 py-2.5 flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onDateChange(todayStr)}
          className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
            date === todayStr
              ? 'bg-[#6E5440] text-white shadow-2xs'
              : isOled
              ? 'bg-[#0D1117] text-slate-400 hover:text-white'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          {language === 'pt-BR' ? 'Hoje' : 'Today'}
        </button>
        <button
          type="button"
          onClick={() => onDateChange(yesterdayStr)}
          className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
            date === yesterdayStr
              ? 'bg-[#6E5440] text-white shadow-2xs'
              : isOled
              ? 'bg-[#0D1117] text-slate-400 hover:text-white'
              : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
          }`}
        >
          {language === 'pt-BR' ? 'Ontem' : 'Yesterday'}
        </button>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className={`text-[11px] font-medium bg-transparent focus:outline-none cursor-pointer ${
            isOled ? 'text-slate-300' : 'text-slate-700'
          }`}
        />
      </div>

      {!selectedCard && (
        <div
          className={`flex items-center p-0.5 rounded-xl border ${
            isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => onStatusChange('paid')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
              status === 'paid'
                ? 'bg-[#10B981] text-white shadow-2xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {language === 'pt-BR' ? 'Pago' : 'Paid'}
          </button>
          <button
            type="button"
            onClick={() => onStatusChange('unpaid')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
              status === 'unpaid'
                ? 'bg-[#F59E0B] text-slate-950 shadow-2xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {language === 'pt-BR' ? 'Pendente' : 'Pending'}
          </button>
        </div>
      )}
    </div>
  );
};

export interface CategoryPickerModalProps {
  isOpen: boolean;
  isOled: boolean;
  language: AppLanguage;
  filteredCategories: Category[];
  categoryId: string;
  categoryMouseDownTargetRef: React.MutableRefObject<EventTarget | null>;
  onSelectCategory: (id: string) => void;
  onClose: () => void;
  onManageCategories?: () => void;
}

export const CategoryPickerModal: React.FC<CategoryPickerModalProps> = ({
  isOpen,
  isOled,
  language,
  filteredCategories,
  categoryId,
  categoryMouseDownTargetRef,
  onSelectCategory,
  onClose,
  onManageCategories,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn"
      onMouseDown={(e) => {
        categoryMouseDownTargetRef.current = e.target;
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (
          e.target === e.currentTarget &&
          categoryMouseDownTargetRef.current === e.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[80vh] ${
          isOled
            ? 'bg-[#0D1117] border-[#21262D] text-slate-100'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`sticky top-0 z-10 border-b shrink-0 flex items-center justify-between px-5 py-3.5 ${
            isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-100'
          }`}
        >
          <div>
            <h4 className="text-sm font-bold">
              {language === 'pt-BR' ? 'Selecionar Categoria' : 'Select Category'}
            </h4>
            <p className="text-[11px] text-slate-400">
              {language === 'pt-BR' ? 'Toque para escolher' : 'Tap to select'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onManageCategories?.();
              }}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1.5 min-h-[36px] ${
                isOled
                  ? 'bg-[#161B22] text-slate-200 hover:bg-[#21262D]'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Tag size={13} className="text-[#D0B595]" />
              <span>{language === 'pt-BR' ? 'Gerenciar' : 'Manage'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-full transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
                isOled
                  ? 'text-slate-400 hover:text-white hover:bg-[#161B22]'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="p-4 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {filteredCategories.map((cat) => {
            const selected = cat.id === categoryId;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectCategory(cat.id);
                  onClose();
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 gap-2 ${
                  selected
                    ? isOled
                      ? 'bg-[#161B22] border-[#D0B595] text-white shadow-xs'
                      : 'bg-slate-900 border-slate-900 text-white shadow-xs'
                    : isOled
                    ? 'bg-[#161B22]/50 border-[#21262D] text-slate-300 hover:bg-[#161B22]'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <CategoryIcon
                  icon={cat.icon}
                  color={selected ? '#ffffff' : cat.color}
                  size={20}
                  badgeSize="md"
                />
                <span className="text-xs font-bold text-center truncate max-w-full">
                  {getCategoryDisplayName(cat, language)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
