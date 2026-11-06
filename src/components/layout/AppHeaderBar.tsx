import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  Sun,
  Moon,
  Menu,
  Download,
} from 'lucide-react';
import { AppLanguage, AppTheme } from '../../types';
import {
  formatShortMonthLabel,
  getCurrentMonthStr,
  shiftMonth,
} from '../../utils/format';
import { TRANSLATIONS } from '../../utils/i18n';
import { PrumoLogoIcon } from '../PrumoLogoIcon';

export type AppActiveTab = 'dashboard' | 'transactions' | 'cards' | 'fuel' | 'reports';
export type SyncModalTab = 'mobile' | 'settings' | 'categories' | 'export' | 'backup';

interface AppHeaderBarProps {
  familyName: string;
  selectedMonth: string;
  language: AppLanguage;
  theme: AppTheme;
  headerMenuOpen: boolean;
  setActiveTab: React.Dispatch<React.SetStateAction<AppActiveTab>>;
  setSelectedMonth: React.Dispatch<React.SetStateAction<string>>;
  setHeaderMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSyncModalTab: React.Dispatch<React.SetStateAction<SyncModalTab>>;
  setSyncModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onUpdateTheme: (theme: AppTheme) => void;
}

export const AppHeaderBar: React.FC<AppHeaderBarProps> = ({
  familyName,
  selectedMonth,
  language,
  theme,
  headerMenuOpen,
  setActiveTab,
  setSelectedMonth,
  setHeaderMenuOpen,
  setSyncModalTab,
  setSyncModalOpen,
  onUpdateTheme,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 print:hidden pt-[env(safe-area-inset-top,0px)]">
      <div className="max-w-lg w-full mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {/* Brand */}
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className="flex items-center gap-2.5 shrink-0 cursor-pointer select-none text-left focus:outline-none group py-1 -my-1 min-h-[44px]"
          title="Prumo - Início"
        >
          <PrumoLogoIcon className="h-8 w-auto shrink-0 select-none drop-shadow-xs" />
          <div className="shrink-0">
            <span className="text-base font-black tracking-[0.14em] uppercase text-slate-900 group-hover:text-[#D0B595] transition-colors block leading-none whitespace-nowrap">
              {familyName &&
              familyName.toUpperCase() !== 'FAMILY PLAN' &&
              familyName.toUpperCase() !== 'FAMILY FINANCE'
                ? familyName
                : 'PRUMO'}
            </span>
          </div>
        </button>

        {/* Month Selector & Quick Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Compact Month Switcher with generous touch targets */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200/50 min-h-[44px]">
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white active:scale-95 transition-all"
              title={t.prevMonth}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setSelectedMonth(getCurrentMonthStr())}
              className="px-2 py-1 text-xs font-bold text-slate-800 hover:text-[#D0B595] active:scale-95 transition-all min-w-[78px] text-center capitalize"
              title={t.jumpCurrentMonth}
            >
              <span>{formatShortMonthLabel(selectedMonth, language)}</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white active:scale-95 transition-all"
              title={t.nextMonth}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Hamburger Menu & Telegram-Style Floating Dropdown */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setHeaderMenuOpen((prev) => !prev)}
              className="w-10 h-10 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 active:opacity-75 transition-all shadow-xs shrink-0"
              title={language === 'pt-BR' ? 'Menu e Configurações' : 'Menu & Settings'}
              aria-expanded={headerMenuOpen}
              aria-haspopup="menu"
            >
              <Menu size={20} />
            </button>

            {headerMenuOpen && (
              <>
                {/* Invisible click-outside backdrop */}
                <div
                  className="fixed inset-0 z-40 bg-transparent"
                  onClick={() => setHeaderMenuOpen(false)}
                />

                {/* Telegram-style dropdown popover */}
                <div
                  role="menu"
                  className="telegram-dropdown-menu absolute right-0 top-full mt-2 min-w-[215px] py-1.5 rounded-2xl border shadow-2xl z-50 flex flex-col"
                >
                  {/* 1. Theme Toggle: Modo Claro / Modo OLED */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      const nextTheme: AppTheme = theme === 'oled' ? 'light' : 'oled';
                      onUpdateTheme(nextTheme);
                      setHeaderMenuOpen(false);
                    }}
                    className="telegram-dropdown-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-colors min-h-[44px]"
                  >
                    {theme === 'oled' ? (
                      <Sun size={18} className="text-amber-400 shrink-0" />
                    ) : (
                      <Moon size={18} className="text-slate-600 shrink-0" />
                    )}
                    <span>
                      {theme === 'oled'
                        ? language === 'pt-BR'
                          ? 'Modo Claro'
                          : 'Light Mode'
                        : language === 'pt-BR'
                        ? 'Modo OLED'
                        : 'OLED Mode'}
                    </span>
                  </button>

                  {/* 2. Configurações */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setSyncModalTab('settings');
                      setSyncModalOpen(true);
                    }}
                    className="telegram-dropdown-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-colors min-h-[44px]"
                  >
                    <Settings size={18} className="text-slate-400 shrink-0" />
                    <span>{language === 'pt-BR' ? 'Configurações' : 'Settings'}</span>
                  </button>

                  {/* 3. Exportar Dados */}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setSyncModalTab('export');
                      setSyncModalOpen(true);
                    }}
                    className="telegram-dropdown-item w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold transition-colors min-h-[44px]"
                  >
                    <Download size={18} className="text-emerald-500 shrink-0" />
                    <span>{language === 'pt-BR' ? 'Exportar Dados' : 'Export Data'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
