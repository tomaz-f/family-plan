import React from 'react';
import { AppLanguage, AppTheme, TransactionType } from '../../types';
import { TRANSLATIONS } from '../../utils/i18n';
import { AVAILABLE_ICONS, CategoryIcon } from '../CategoryIcon';
import { PRESET_COLORS } from './settingsTypes';

interface CategoryEditorFormProps {
  language: AppLanguage;
  theme: AppTheme;
  editingCategoryId: string | null;
  catName: string;
  catType: TransactionType;
  catColor: string;
  catIcon: string;
  onChangeName: (val: string) => void;
  onChangeType: (val: TransactionType) => void;
  onChangeColor: (val: string) => void;
  onChangeIcon: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancelEdit: () => void;
}

export const CategoryEditorForm: React.FC<CategoryEditorFormProps> = ({
  language,
  theme,
  editingCategoryId,
  catName,
  catType,
  catColor,
  catIcon,
  onChangeName,
  onChangeType,
  onChangeColor,
  onChangeIcon,
  onSubmit,
  onCancelEdit,
}) => {
  const t = TRANSLATIONS[language];
  const isOled = theme === 'oled';

  return (
    <form
      onSubmit={onSubmit}
      className="settings-group-card p-4 rounded-2xl bg-white border border-slate-200 space-y-3.5"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          {editingCategoryId ? t.editCategoryTitle : t.addCustomCategoryTitle}
        </h3>
        {editingCategoryId && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
          >
            {t.cancelEditBtn}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <input
          type="text"
          required
          placeholder={t.categoryNamePlaceholder}
          value={catName}
          onChange={(e) => onChangeName(e.target.value)}
          className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50"
        />
        <select
          value={catType}
          onChange={(e) => onChangeType(e.target.value as TransactionType)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50 font-medium"
        >
          <option value="expense">{t.expenseCategoryOpt}</option>
          <option value="income">{t.incomeCategoryOpt}</option>
        </select>
      </div>

      {/* Color Picker */}
      <div>
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          {t.chooseColorLabel}
        </span>
        <div className="flex flex-wrap justify-center items-center gap-2.5 p-2.5 max-h-32 overflow-y-auto">
          {PRESET_COLORS.map((c) => {
            const isSelected = catColor.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => onChangeColor(c)}
                className={`w-6 h-6 rounded-full flex-shrink-0 transition-all ${
                  isSelected
                    ? 'scale-110 ring-2 ring-offset-2 ring-slate-900 dark:ring-white ring-offset-white dark:ring-offset-[#0D1117]'
                    : 'opacity-85 hover:opacity-100 hover:scale-105'
                }`}
                style={{ backgroundColor: c }}
              />
            );
          })}
        </div>
      </div>

      {/* Visual Icon Picker Grid */}
      <div>
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          {t.chooseIconLabel}
        </span>
        <div
          className={`grid grid-cols-6 sm:grid-cols-8 gap-2.5 max-h-52 overflow-y-auto scroll-smooth p-3 rounded-xl border transition-colors scrollbar-thin ${
            isOled
              ? 'bg-[#161B22] border-[#21262D] text-slate-300 scrollbar-thumb-slate-700'
              : 'bg-slate-50 border-slate-200/80 text-slate-700 scrollbar-thumb-slate-300'
          }`}
        >
          {AVAILABLE_ICONS.map((ic) => {
            const isSelected = catIcon === ic;
            return (
              <button
                key={ic}
                type="button"
                onClick={() => onChangeIcon(ic)}
                title={ic}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? 'border shadow-sm scale-105'
                    : isOled
                    ? 'text-slate-400 hover:bg-[#21262D]'
                    : 'text-slate-600 hover:bg-slate-200/70 transition-colors'
                }`}
                style={
                  isSelected
                    ? {
                        backgroundColor: isOled ? `${catColor}33` : `${catColor}26`,
                        borderColor: isOled ? `${catColor}99` : `${catColor}66`,
                        color: catColor,
                      }
                    : undefined
                }
              >
                <CategoryIcon
                  icon={ic}
                  size={20}
                  color={isSelected ? catColor : 'currentColor'}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 w-full">
        <button
          type="submit"
          disabled={!catName.trim()}
          className={`w-full py-3 px-4 rounded-xl text-sm font-semibold shadow-sm transition-colors flex items-center justify-center ${
            !catName.trim()
              ? 'opacity-50 cursor-not-allowed bg-slate-300 dark:bg-slate-700 text-slate-500'
              : 'bg-[#10B981] hover:bg-[#059669] text-white active:scale-[0.99]'
          }`}
        >
          {editingCategoryId
            ? language === 'pt-BR'
              ? 'Salvar Categoria'
              : 'Save Category'
            : language === 'pt-BR'
            ? 'Adicionar Categoria'
            : 'Add Category'}
        </button>
        {editingCategoryId && (
          <button
            type="button"
            onClick={onCancelEdit}
            className="w-full sm:w-auto py-3 px-4 rounded-xl border border-slate-200 dark:border-[#21262D] text-slate-600 dark:text-slate-300 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-[#161B22] transition-colors"
          >
            {language === 'pt-BR' ? 'Cancelar' : 'Cancel'}
          </button>
        )}
      </div>
    </form>
  );
};
