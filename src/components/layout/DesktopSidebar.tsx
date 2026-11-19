import React from 'react';
import {
  LayoutDashboard,
  PieChart,
  Download,
  Settings,
  Sun,
  Moon,
  Plus,
} from 'lucide-react';
import { AppLanguage, AppTheme } from '../../types';
import { PrumoLogoIcon } from '../PrumoLogoIcon';
import { AppIcon } from '../icons';
import { AppActiveTab } from './AppHeaderBar';
import { MonthSelector } from './MonthSelector';

export interface DesktopSidebarProps {
  familyName: string;
  activeTab: AppActiveTab;
  syncModalOpen: boolean;
  selectedMonth: string;
  language: AppLanguage;
  theme: AppTheme;
  setActiveTab: React.Dispatch<React.SetStateAction<AppActiveTab>>;
  setSelectedMonth: React.Dispatch<React.SetStateAction<string>>;
  setSyncModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onUpdateTheme: (theme: AppTheme) => void;
  onOpenNewTransaction: () => void;
}

export const DesktopSidebar: React.FC<DesktopSidebarProps> = ({
  familyName,
  activeTab,
  syncModalOpen,
  selectedMonth,
  language,
  theme,
  setActiveTab,
  setSelectedMonth,
  setSyncModalOpen,
  onUpdateTheme,
  onOpenNewTransaction,
}) => {
  const isPt = language === 'pt-BR';
  const openMainTab = (tab: AppActiveTab) => {
    setSyncModalOpen(false);
    setActiveTab(tab);
  };

  const navItems: Array<{
    id: string;
    label: string;
    active: boolean;
    icon: React.ReactNode;
    onClick: () => void;
  }> = [
    {
      id: 'dashboard',
      label: isPt ? 'Início' : 'Home',
      active: activeTab === 'dashboard' && !syncModalOpen,
      icon: <LayoutDashboard size={18} className="shrink-0" />,
      onClick: () => openMainTab('dashboard'),
    },
    {
      id: 'cards',
      label: isPt ? 'Cartões' : 'Cards',
      active: activeTab === 'cards' && !syncModalOpen,
      icon: <AppIcon name="cartao" size={18} className="shrink-0" />,
      onClick: () => openMainTab('cards'),
    },
    {
      id: 'fuel',
      label: isPt ? 'Combustível' : 'Fuel',
      active: activeTab === 'fuel' && !syncModalOpen,
      icon: <AppIcon name="posto-gasolina" size={18} className="shrink-0" />,
      onClick: () => openMainTab('fuel'),
    },
    {
      id: 'reports',
      label: isPt ? 'Relatórios' : 'Reports',
      active: activeTab === 'reports' && !syncModalOpen,
      icon: <PieChart size={18} className="shrink-0" />,
      onClick: () => openMainTab('reports'),
    },
    {
      id: 'export',
      label: isPt ? 'Exportar Dados' : 'Export Data',
      active: activeTab === 'export' && !syncModalOpen,
      icon: <Download size={18} className="shrink-0" />,
      onClick: () => openMainTab('export'),
    },
    {
      id: 'settings',
      label: isPt ? 'Configurações' : 'Settings',
      active: activeTab === 'settings' && !syncModalOpen,
      icon: <Settings size={18} className="shrink-0" />,
      onClick: () => openMainTab('settings'),
    },
  ];

  const handleToggleTheme = () => {
    const nextTheme: AppTheme = theme === 'oled' ? 'light' : 'oled';
    onUpdateTheme(nextTheme);
  };

  const themeToggleLabel =
    theme === 'oled'
      ? isPt
        ? 'Alternar para Modo Claro'
        : 'Switch to Light Mode'
      : isPt
      ? 'Alternar para Modo OLED'
      : 'Switch to OLED Mode';

  return (
    <aside className="hidden lg:flex lg:flex-col fixed top-0 left-0 h-dvh w-64 z-30 bg-white dark:bg-[#0D1117] border-r border-slate-200/80 dark:border-[#21262D] px-4 py-5 select-none print:hidden transition-colors">
      {/* Brand Header & Theme Toggle */}
      <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-200/80 dark:border-[#21262D]">
        <button
          type="button"
          onClick={() => {
            setSyncModalOpen(false);
            setActiveTab('dashboard');
          }}
          className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer focus:outline-none"
          title={isPt ? 'Prumo - Início' : 'Prumo - Home'}
        >
          <PrumoLogoIcon size={32} className="h-8 w-auto shrink-0 select-none" />
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-extrabold tracking-tight text-slate-900 dark:text-slate-100 leading-tight">
              PRUMO
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate leading-tight">
              {familyName}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={handleToggleTheme}
          aria-label={themeToggleLabel}
          title={themeToggleLabel}
          className="w-9 h-9 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-slate-50 dark:bg-[#161B22] hover:bg-slate-200/70 dark:hover:bg-[#21262D] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
        >
          {theme === 'oled' ? (
            <Sun size={16} className="text-amber-400" />
          ) : (
            <Moon size={16} className="text-slate-600" />
          )}
        </button>
      </div>

      {/* Month / Year Quick Selector */}
      <div className="mt-4 mb-5">
        <MonthSelector
          selectedMonth={selectedMonth}
          language={language}
          onSelectMonth={setSelectedMonth}
          popoverAlign="left"
          fullWidth
        />
      </div>

      {/* Primary Navigation */}
      <nav
        aria-label={isPt ? 'Navegação principal' : 'Primary navigation'}
        className="flex-1 flex flex-col gap-1.5 overflow-y-auto"
      >
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            aria-current={item.active ? 'page' : undefined}
            className={`min-h-[44px] w-full rounded-xl px-3.5 text-sm font-semibold flex items-center justify-between transition-colors cursor-pointer ${
              item.active
                ? 'bg-[#6E5440] text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#161B22]'
            }`}
          >
            <span className="flex items-center gap-3 min-w-0">
              {item.icon}
              <span className="truncate">{item.label}</span>
            </span>
            {item.active && (
              <span
                className="w-2 h-2 rounded-full bg-[#10B981] shrink-0"
                aria-hidden="true"
              />
            )}
          </button>
        ))}
      </nav>

      {/* Bottom Primary CTA */}
      <div className="mt-auto pt-4 border-t border-slate-200/80 dark:border-[#21262D]">
        <button
          type="button"
          onClick={onOpenNewTransaction}
          className="min-h-[46px] w-full rounded-xl bg-[#10B981] hover:bg-emerald-400 text-slate-950 font-extrabold text-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <Plus size={18} strokeWidth={2.75} className="shrink-0" />
          <span>{isPt ? 'Novo Lançamento' : 'New Entry'}</span>
        </button>
      </div>
    </aside>
  );
};
