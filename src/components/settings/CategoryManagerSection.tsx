import React, { useMemo, useState } from 'react';
import { ChevronDown, Pencil, Trash2 } from 'lucide-react';
import { AppLanguage, AppTheme, Category, TransactionType } from '../../types';
import { getCategoryDisplayName, TRANSLATIONS } from '../../utils/i18n';
import { CategoryIcon } from '../CategoryIcon';
import { CategoryEditorForm } from './CategoryEditorForm';
import { MobileSyncModalProps, PRESET_COLORS } from './settingsTypes';

interface CategoryManagerSectionProps {
  categories: Category[];
  language: AppLanguage;
  theme: AppTheme;
  onAddCategory: MobileSyncModalProps['onAddCategory'];
  onCategoryCreated?: MobileSyncModalProps['onCategoryCreated'];
  onUpdateCategory: MobileSyncModalProps['onUpdateCategory'];
  onDeleteCategory: MobileSyncModalProps['onDeleteCategory'];
}

export const CategoryManagerSection: React.FC<CategoryManagerSectionProps> = ({
  categories,
  language,
  theme,
  onAddCategory,
  onCategoryCreated,
  onUpdateCategory,
  onDeleteCategory,
}) => {
  const t = TRANSLATIONS[language];

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<TransactionType>('expense');
  const [catColor, setCatColor] = useState(PRESET_COLORS[0]);
  const [catIcon, setCatIcon] = useState<string>('etiqueta-preco');
  const [expenseSectionOpen, setExpenseSectionOpen] = useState(true);
  const [incomeSectionOpen, setIncomeSectionOpen] = useState(true);

  const expenseCategories = useMemo(() => {
    return categories
      .filter((cat: Category) => cat.type === 'expense')
      .slice()
      .sort((a: Category, b: Category) => {
        const nameA = getCategoryDisplayName(a, language) || a.name;
        const nameB = getCategoryDisplayName(b, language) || b.name;
        return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
      });
  }, [categories, language]);

  const incomeCategories = useMemo(() => {
    return categories
      .filter((cat: Category) => cat.type === 'income')
      .slice()
      .sort((a: Category, b: Category) => {
        const nameA = getCategoryDisplayName(a, language) || a.name;
        const nameB = getCategoryDisplayName(b, language) || b.name;
        return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
      });
  }, [categories, language]);

  const handleStartEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setCatName(getCategoryDisplayName(cat, language));
    setCatType(cat.type);
    setCatColor(cat.color);
    setCatIcon(cat.icon);
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null);
    setCatName('');
    setCatType('expense');
    setCatColor(PRESET_COLORS[0]);
    setCatIcon('etiqueta-preco');
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    if (editingCategoryId) {
      await onUpdateCategory(editingCategoryId, {
        name: catName.trim(),
        type: catType,
        color: catColor,
        icon: catIcon,
      });
      handleCancelEditCategory();
    } else {
      const created = await onAddCategory({
        name: catName.trim(),
        type: catType,
        color: catColor,
        icon: catIcon,
      });
      setCatName('');
      if (onCategoryCreated && created) {
        onCategoryCreated(created);
      }
    }
  };

  const renderCategoryRows = (items: Category[], typeLabel: string, emptyText: string) => {
    if (items.length === 0) {
      return (
        <div className="p-4 text-center text-xs text-slate-400 italic">{emptyText}</div>
      );
    }

    return items.map((cat: Category) => {
      const isBeingEdited = editingCategoryId === cat.id;
      return (
        <div
          key={cat.id}
          className={`flex items-center justify-between p-3.5 transition-colors ${
            isBeingEdited
              ? 'bg-indigo-500/10'
              : 'hover:bg-slate-50 dark:hover:bg-[#161B22]/50'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <CategoryIcon icon={cat.icon} color={cat.color} size={16} badgeSize="sm" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {getCategoryDisplayName(cat, language)}
              </p>
              <p className="text-[11px] text-slate-400">{typeLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleStartEditCategory(cat)}
              className="p-2 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-[#161B22] transition-colors"
              title={t.editCategoryTooltip}
            >
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={() => onDeleteCategory(cat.id)}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
              title={t.deleteCategoryTooltip}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="px-4 pt-5 pb-8 space-y-5 animate-fadeIn">
      <CategoryEditorForm
        language={language}
        theme={theme}
        editingCategoryId={editingCategoryId}
        catName={catName}
        catType={catType}
        catColor={catColor}
        catIcon={catIcon}
        onChangeName={setCatName}
        onChangeType={setCatType}
        onChangeColor={setCatColor}
        onChangeIcon={setCatIcon}
        onSubmit={handleSaveCategory}
        onCancelEdit={handleCancelEditCategory}
      />

      {/* Category List with Collapsible Accordion Sections */}
      <div className="space-y-4">
        {/* 1. Categorias de Despesa */}
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setExpenseSectionOpen((prev) => !prev)}
            className="w-full py-2 flex items-center justify-between cursor-pointer select-none text-left focus:outline-none"
          >
            <div className="flex items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {language === 'pt-BR' ? 'Categorias de Despesa' : 'Expense Categories'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-[#161B22] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-[#21262D] ml-2">
                {expenseCategories.length}
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`text-slate-400 transition-transform duration-200 ${
                expenseSectionOpen ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>

          {expenseSectionOpen && (
            <div className="settings-group-card bg-white border border-slate-200 rounded-2xl divide-y divide-slate-200 overflow-hidden">
              {renderCategoryRows(
                expenseCategories,
                t.expenseTypeLabel,
                language === 'pt-BR'
                  ? 'Nenhuma categoria de despesa cadastrada'
                  : 'No expense categories registered'
              )}
            </div>
          )}
        </div>

        {/* 2. Categorias de Entrada */}
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setIncomeSectionOpen((prev) => !prev)}
            className="w-full py-2 flex items-center justify-between cursor-pointer select-none text-left focus:outline-none"
          >
            <div className="flex items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {language === 'pt-BR' ? 'Categorias de Entrada' : 'Income Categories'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-[#161B22] text-slate-600 dark:text-slate-400 border border-slate-200/60 dark:border-[#21262D] ml-2">
                {incomeCategories.length}
              </span>
            </div>
            <ChevronDown
              size={16}
              className={`text-slate-400 transition-transform duration-200 ${
                incomeSectionOpen ? 'rotate-180' : 'rotate-0'
              }`}
            />
          </button>

          {incomeSectionOpen && (
            <div className="settings-group-card bg-white border border-slate-200 rounded-2xl divide-y divide-slate-200 overflow-hidden">
              {renderCategoryRows(
                incomeCategories,
                t.incomeTypeLabel,
                language === 'pt-BR'
                  ? 'Nenhuma categoria de entrada cadastrada'
                  : 'No income categories registered'
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
