import React from 'react';
import {
  LayoutDashboard,
  Plus,
  Minus,
  PieChart as PieChartIcon,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import { AppLanguage, CreditCard, TransactionType } from '../../types';
import { TRANSLATIONS } from '../../utils/i18n';
import { AppIcon } from '../icons';
import { AppActiveTab } from './AppHeaderBar';

interface AppBottomNavigationProps {
  activeTab: AppActiveTab;
  fabMenuOpen: boolean;
  language: AppLanguage;
  activeCardId: string | null;
  creditCards: CreditCard[];
  setActiveTab: React.Dispatch<React.SetStateAction<AppActiveTab>>;
  setFabMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setOpenRefuelTrigger: React.Dispatch<React.SetStateAction<number>>;
  onOpenAddModal: (type: TransactionType, cardId?: string) => void;
  onOpenCardExpenseModal: (cardId?: string) => void;
  onExportMonthlyPDF: () => void;
  onExportMonthlySpreadsheet: () => void;
}

export const AppBottomNavigation: React.FC<AppBottomNavigationProps> = ({
  activeTab,
  fabMenuOpen,
  language,
  activeCardId,
  creditCards,
  setActiveTab,
  setFabMenuOpen,
  setOpenRefuelTrigger,
  onOpenAddModal,
  onOpenCardExpenseModal,
  onExportMonthlyPDF,
  onExportMonthlySpreadsheet,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <>
      {/* CONTEXTUAL FAB SPEED-DIAL OVERLAY (Home & Reports Tabs) */}
      <div
        aria-hidden={!(fabMenuOpen && (activeTab === 'dashboard' || activeTab === 'reports'))}
        className={`fixed inset-0 z-30 bg-black/60 backdrop-blur-[2px] transition-opacity print:hidden ${
          fabMenuOpen && (activeTab === 'dashboard' || activeTab === 'reports')
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setFabMenuOpen(false)}
      />

      {/* STICKY BOTTOM NAVIGATION BAR WITH CENTRAL CONTEXTUAL FAB */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 pt-1.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] print:hidden">
        {/* Expanding Speed Dial Options when on Início */}
        <div
          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex items-center gap-3 z-50 transition-all duration-150 ${
            fabMenuOpen && activeTab === 'dashboard'
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setFabMenuOpen(false);
              onOpenAddModal('income');
            }}
            className="fab-option-btn flex items-center gap-2 pl-2.5 pr-4 py-2.5 rounded-full bg-slate-950 text-white border border-emerald-500/40 shadow-xl shadow-black/50 active:scale-95 transition-all whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-xs">
              <Plus size={16} strokeWidth={3} />
            </span>
            <span className="text-xs font-extrabold tracking-tight text-emerald-400">
              {language === 'en' ? 'Income' : 'Entrada'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFabMenuOpen(false);
              onOpenAddModal('expense');
            }}
            className="fab-option-btn flex items-center gap-2 pl-2.5 pr-4 py-2.5 rounded-full bg-slate-950 text-white border border-rose-500/40 shadow-xl shadow-black/50 active:scale-95 transition-all whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center font-black shadow-xs">
              <Minus size={16} strokeWidth={3} />
            </span>
            <span className="text-xs font-extrabold tracking-tight text-rose-400">
              {language === 'en' ? 'Expense' : 'Despesa'}
            </span>
          </button>
        </div>

        {/* Expanding Speed Dial Options when on Relatórios */}
        <div
          className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex items-center gap-2.5 z-50 transition-all duration-150 ${
            fabMenuOpen && activeTab === 'reports'
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          <button
            type="button"
            onClick={onExportMonthlyPDF}
            className="fab-option-btn flex items-center gap-2 pl-2.5 pr-4 py-2.5 rounded-full bg-slate-950 text-white border border-[#D0B595]/40 shadow-xl shadow-black/50 active:scale-95 transition-all whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-full bg-[#6E5440] text-[#FFFDF5] flex items-center justify-center font-black shadow-xs">
              <FileText size={15} strokeWidth={2.5} />
            </span>
            <span className="text-xs font-extrabold tracking-tight text-[#D0B595]">
              {language === 'en' ? 'Monthly PDF Report' : 'Relatório PDF do Mês'}
            </span>
          </button>

          <button
            type="button"
            onClick={onExportMonthlySpreadsheet}
            className="fab-option-btn flex items-center gap-2 pl-2.5 pr-4 py-2.5 rounded-full bg-slate-950 text-white border border-emerald-500/40 shadow-xl shadow-black/50 active:scale-95 transition-all whitespace-nowrap"
          >
            <span className="w-7 h-7 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black shadow-xs">
              <FileSpreadsheet size={15} strokeWidth={2.5} />
            </span>
            <span className="text-xs font-extrabold tracking-tight text-emerald-400">
              {language === 'en' ? 'Export Spreadsheet' : 'Exportar Planilha'}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-5 items-center gap-1 max-w-lg mx-auto">
          {/* 1. Início */}
          <button
            type="button"
            onClick={() => {
              setFabMenuOpen(false);
              setActiveTab('dashboard');
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-semibold active:scale-95 active:opacity-75 transition-all select-none ${
              activeTab === 'dashboard' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="mt-0.5 truncate">{t.navHomeMobile}</span>
          </button>

          {/* 2. Cartões */}
          <button
            type="button"
            onClick={() => {
              setFabMenuOpen(false);
              setActiveTab('cards');
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-semibold active:scale-95 active:opacity-75 transition-all select-none ${
              activeTab === 'cards' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <AppIcon name="cartao" size={20} />
            <span className="mt-0.5 truncate">{t.navCardsMobile}</span>
          </button>

          {/* Center: Elevated Contextual Primary Action Button (FAB) */}
          <div className="flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'dashboard' || activeTab === 'reports') {
                  setFabMenuOpen((prev) => !prev);
                } else if (activeTab === 'cards') {
                  setFabMenuOpen(false);
                  const targetCardId = activeCardId || creditCards?.[0]?.id || undefined;
                  onOpenCardExpenseModal(targetCardId);
                } else if (activeTab === 'fuel') {
                  setFabMenuOpen(false);
                  setOpenRefuelTrigger((n) => n + 1);
                } else {
                  setFabMenuOpen(false);
                  onOpenAddModal('expense');
                }
              }}
              aria-label="Primary Action"
              className="fab-primary-btn -mt-5 w-[52px] h-[52px] rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/35 border-4 border-white flex items-center justify-center active:scale-95 transition-all select-none"
            >
              <Plus
                size={26}
                strokeWidth={2.75}
                className={`transition-transform duration-200 ${
                  fabMenuOpen && (activeTab === 'dashboard' || activeTab === 'reports')
                    ? 'rotate-45'
                    : 'rotate-0'
                }`}
              />
            </button>
          </div>

          {/* 3. Combustível */}
          <button
            type="button"
            onClick={() => {
              setFabMenuOpen(false);
              setActiveTab('fuel');
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-semibold active:scale-95 active:opacity-75 transition-all select-none ${
              activeTab === 'fuel' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <AppIcon name="posto-gasolina" size={20} />
            <span className="mt-0.5 truncate">{t.navFuelMobile}</span>
          </button>

          {/* 4. Relatórios */}
          <button
            type="button"
            onClick={() => {
              setFabMenuOpen(false);
              setActiveTab('reports');
            }}
            className={`min-h-[48px] flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-semibold active:scale-95 active:opacity-75 transition-all select-none ${
              activeTab === 'reports' ? 'text-slate-900 font-bold' : 'text-slate-400'
            }`}
          >
            <PieChartIcon size={20} />
            <span className="mt-0.5 truncate">
              {language === 'en' ? 'Reports' : 'Relatórios'}
            </span>
          </button>
        </div>
      </div>
    </>
  );
};
