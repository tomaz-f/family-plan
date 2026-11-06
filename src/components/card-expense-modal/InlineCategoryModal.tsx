import React, { useRef } from 'react';
import { Tag, X } from 'lucide-react';
import { AppLanguage, Category } from '../../types';
import { getCategoryDisplayName } from '../../utils/i18n';
import { CategoryIcon } from '../CategoryIcon';

interface InlineCategoryModalProps {
  isOpen: boolean;
  isOled: boolean;
  language: AppLanguage;
  expenseCategories: Category[];
  selectedCategory: Category | null;
  onSelectCategory: (categoryId: string) => void;
  onClose: () => void;
  onManageCategories?: () => void;
}

export const InlineCategoryModal: React.FC<InlineCategoryModalProps> = ({
  isOpen,
  isOled,
  language,
  expenseCategories,
  selectedCategory,
  onSelectCategory,
  onClose,
  onManageCategories,
}) => {
  const categoryMouseDownTargetRef = useRef<EventTarget | null>(null);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn"
      onMouseDown={(e) => {
        categoryMouseDownTargetRef.current = e.target;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && categoryMouseDownTargetRef.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`w-full max-w-md rounded-t-3xl sm:rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[80vh] ${
          isOled
            ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sheet Header */}
        <div
          className={`sticky top-0 z-10 flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${
            isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-100'
          }`}
        >
          <div>
            <h4 className="text-sm font-bold">
              {language === 'pt-BR' ? 'Selecionar Categoria' : 'Select Category'}
            </h4>
            <p className={`text-[11px] ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
              {language === 'pt-BR'
                ? 'Toque para escolher a categoria'
                : 'Tap to choose category'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onManageCategories?.();
              }}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 min-h-[36px] active:scale-95 ${
                isOled
                  ? 'bg-[#161B22] border border-[#21262D] text-slate-300 hover:bg-[#21262D] hover:text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Tag size={14} className="text-[#6E5440]" />
              <span>{language === 'pt-BR' ? 'Gerenciar' : 'Manage'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`p-1.5 rounded-full transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center ${
                isOled
                  ? 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#161B22]'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Dense Category Grid (No horizontal scroll!) */}
        <div className="p-4 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          {expenseCategories.map((cat) => {
            const isSelected = cat.id === selectedCategory?.id;
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
                  isSelected
                    ? isOled
                      ? 'bg-[#161B22] border-[#6E5440] ring-2 ring-[#6E5440]/50 shadow-xs'
                      : 'bg-[#6E5440]/10 border-[#6E5440] ring-2 ring-[#6E5440]/40 shadow-xs'
                    : isOled
                    ? 'bg-[#161B22]/40 border-[#21262D] hover:bg-[#161B22] hover:border-[#30363D]'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <CategoryIcon
                  icon={cat.icon || 'Tag'}
                  color={cat.color || '#94A3B8'}
                  size={22}
                  badgeSize="md"
                />
                <span
                  className={`text-xs font-bold text-center truncate max-w-full ${
                    isSelected
                      ? isOled
                        ? 'text-[#F8FAFC]'
                        : 'text-[#6E5440]'
                      : isOled
                      ? 'text-[#94A3B8]'
                      : 'text-slate-700'
                  }`}
                >
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
