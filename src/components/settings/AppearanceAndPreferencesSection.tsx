import React, { useState } from 'react';
import { Check, Languages, Moon, Sun } from 'lucide-react';
import { AppLanguage, AppState, AppTheme } from '../../types';
import { CURRENCIES } from '../../utils/format';
import { TRANSLATIONS } from '../../utils/i18n';
import { MobileSyncModalProps } from './settingsTypes';

interface AppearanceAndPreferencesSectionProps {
  state: AppState;
  language: AppLanguage;
  theme: AppTheme;
  onUpdateSettings: MobileSyncModalProps['onUpdateSettings'];
}

export const AppearanceAndPreferencesSection: React.FC<AppearanceAndPreferencesSectionProps> = ({
  state,
  language,
  theme,
  onUpdateSettings,
}) => {
  const t = TRANSLATIONS[language];

  const [familyName, setFamilyName] = useState(state.settings.familyName);
  const [currency, setCurrency] = useState(state.settings.currency);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await onUpdateSettings({
        familyName: familyName.trim() || 'PRUMO',
        currency,
        language,
        theme,
      });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2500);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <form onSubmit={handleSaveSettings} className="px-4 pt-5 pb-8 space-y-4 animate-fadeIn">
      <div className="settings-group-card p-4 rounded-2xl bg-white border border-slate-200 space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            {t.familyAccountTitleLabel}
          </label>
          <input
            type="text"
            required
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 text-slate-900"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            {t.appLanguageLabel}
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onUpdateSettings({ language: 'pt-BR' })}
              className={`min-h-[46px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                language === 'pt-BR'
                  ? 'border-[#8A6F57] bg-[#6E5440] text-[#FFFDF5] shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Languages size={16} />
              <span>Português (BR)</span>
            </button>
            <button
              type="button"
              onClick={() => onUpdateSettings({ language: 'en' })}
              className={`min-h-[46px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                language === 'en'
                  ? 'border-[#8A6F57] bg-[#6E5440] text-[#FFFDF5] shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Languages size={16} />
              <span>English</span>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            {t.displayCurrencyLabel}
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 text-slate-900"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </div>

        {/* 2-Option Theme Selector (OLED vs Claro) */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            {t.appThemeLabel}
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onUpdateSettings({ theme: 'oled' })}
              className={`min-h-[46px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-bold transition-all ${
                theme === 'oled'
                  ? 'border-[#8A6F57] bg-[#6E5440] text-[#FFFDF5] shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Moon size={15} />
              <span>{t.themeOled}</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdateSettings({ theme: 'light' })}
              className={`min-h-[46px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-bold transition-all ${
                theme === 'light'
                  ? 'border-[#8A6F57] bg-[#6E5440] text-[#FFFDF5] shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Sun size={15} />
              <span>{t.themeLight}</span>
            </button>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={savingSettings}
        className="w-full min-h-[46px] py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold shadow-sm transition-all active:scale-95"
      >
        {savingSettings ? t.savingBtn : t.savePreferencesBtn}
      </button>

      {savedFeedback && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
          <Check size={15} />
          <span>
            {language === 'pt-BR'
              ? 'Preferências salvas com sucesso!'
              : 'Preferences saved successfully!'}
          </span>
        </div>
      )}
    </form>
  );
};
