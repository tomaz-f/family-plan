import React from 'react';
import {
  Settings,
  Sun,
  Moon,
  Menu,
  Download,
} from 'lucide-react';
import { AppLanguage, AppTheme } from '../../types';
import { PrumoLogoIcon } from '../PrumoLogoIcon';
import { MonthSelector } from './MonthSelector';

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
  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-[#000000] border-b border-slate-100 dark:border-[#21262D]/60 transition-colors print:hidden pt-[env(safe-area-inset-top,0px)]">
      <div className="w-full max-w-lg mx-auto flex items-center justify-between px-3 py-2.5 bg-white dark:bg-[#000000] border-b border-slate-100 dark:border-[#21262D]/60 transition-colors">
        {/* Left Side — Standalone Brand Logo */}
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className="w-10 h-10 rounded-xl flex items-center justify-center bg-transparent shrink-0 cursor-pointer select-none focus:outline-none"
          title="Prumo - Início"
        >
          <PrumoLogoIcon size={32} className="h-8 w-auto shrink-0 select-none drop-shadow-xs" />
        </button>

        {/* Center — Minimalist Swipeable/Clickable Month Selector Pill */}
        <MonthSelector
          selectedMonth={selectedMonth}
          language={language}
          onSelectMonth={setSelectedMonth}
        />

        {/* Right Side — Hamburger Menu Button & Dropdown */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setHeaderMenuOpen((prev) => !prev)}
            className="w-10 h-10 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#161B22] shadow-sm transition-colors cursor-pointer shrink-0"
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
    </header>
  );
};
