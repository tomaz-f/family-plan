import React from 'react';
import {
  ChevronRight,
  Database,
  FileSpreadsheet,
  Landmark,
  Languages,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { AppLanguage, AppState, AppTheme } from '../../types';
import { formatCurrency } from '../../utils/format';
import { TRANSLATIONS } from '../../utils/i18n';
import { PrumoLogoIcon } from '../PrumoLogoIcon';
import { SettingsSubScreen } from './settingsTypes';

interface SettingsMainHubProps {
  state: AppState;
  language: AppLanguage;
  theme: AppTheme;
  isOnlineWithServer: boolean;
  currentBankBalance?: number;
  familyId?: string | null;
  onNavigate: (target: SettingsSubScreen) => void;
}

export const SettingsMainHub: React.FC<SettingsMainHubProps> = ({
  state,
  language,
  theme,
  isOnlineWithServer,
  currentBankBalance,
  familyId,
  onNavigate,
}) => {
  const t = TRANSLATIONS[language];

  const displayBrandName =
    state.settings.familyName &&
    state.settings.familyName.toUpperCase() !== 'FAMILY PLAN' &&
    state.settings.familyName.toUpperCase() !== 'FAMILY FINANCE'
      ? state.settings.familyName
      : 'PRUMO';

  return (
    <div className="px-4 pt-6 pb-8 space-y-6 animate-fadeIn">
      {/* Top Hero Section */}
      <div className="flex flex-col items-center text-center">
        <div className="settings-hero-badge w-20 h-20 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-lg">
          <PrumoLogoIcon size={42} animate={false} />
        </div>
        <h2 className="mt-3.5 text-xl font-black tracking-[0.16em] uppercase text-slate-900">
          {displayBrandName}
        </h2>
        <div className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-semibold text-emerald-500">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnlineWithServer ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span>
            {familyId
              ? language === 'pt-BR'
                ? 'Sincronização Familiar Ativa • Criptografia AES-256'
                : 'Family Sync Active • AES-256 Encryption'
              : isOnlineWithServer
              ? t.connectedToSqlite
              : t.offlineModeActive}
          </span>
        </div>
      </div>

      {/* SEGMENT 1: Preferências & Conta */}
      <div className="space-y-2">
        <h3 className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {language === 'pt-BR' ? 'Preferências & Conta' : 'Preferences & Account'}
        </h3>
        <div className="settings-group-card bg-white border border-slate-200 rounded-2xl divide-y divide-slate-200 overflow-hidden shadow-xs">
          {/* Row 1: Saldo Inicial e Ajuste */}
          <button
            type="button"
            onClick={() => onNavigate('balance')}
            className="settings-row-item w-full flex items-center justify-between gap-3 p-3.5 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                <Landmark size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {language === 'pt-BR'
                    ? 'Saldo Inicial e Ajuste'
                    : 'Starting Balance & Adjustment'}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {typeof currentBankBalance === 'number'
                    ? `${t.currentBankBalance}: ${formatCurrency(
                        currentBankBalance,
                        state.settings.currency
                      )} • ${t.startingBase}: ${formatCurrency(
                        state.settings.initialBalance ?? 0,
                        state.settings.currency
                      )}`
                    : language === 'pt-BR'
                    ? 'Visualizar e calibrar o saldo base da conta'
                    : 'View and calibrate baseline account balance'}
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </button>

          {/* Row 2: Idioma e Moeda */}
          <button
            type="button"
            onClick={() => onNavigate('preferences')}
            className="settings-row-item w-full flex items-center justify-between gap-3 p-3.5 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                <Languages size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {language === 'pt-BR' ? 'Idioma e Moeda' : 'Language & Currency'}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {language === 'pt-BR' ? 'Português (BR)' : 'English'} •{' '}
                  {state.settings.currency} • {theme === 'oled' ? t.themeOled : t.themeLight}
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </button>
        </div>
      </div>

      {/* SEGMENT 2: Organização */}
      <div className="space-y-2">
        <h3 className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {language === 'pt-BR' ? 'Organização' : 'Organization'}
        </h3>
        <div className="settings-group-card bg-white border border-slate-200 rounded-2xl divide-y divide-slate-200 overflow-hidden shadow-xs">
          {/* Row 1: Gerenciar Categorias */}
          <button
            type="button"
            onClick={() => onNavigate('categories')}
            className="settings-row-item w-full flex items-center justify-between gap-3 p-3.5 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
                <Tag size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {language === 'pt-BR' ? 'Gerenciar Categorias' : 'Manage Categories'}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {language === 'pt-BR'
                    ? `${state.categories.length} categorias • Ícones e cores personalizadas`
                    : `${state.categories.length} categories • Custom icons & colors`}
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </button>

          {/* Row 2: Exportar Dados */}
          <button
            type="button"
            onClick={() => onNavigate('export')}
            className="settings-row-item w-full flex items-center justify-between gap-3 p-3.5 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center shrink-0">
                <FileSpreadsheet size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {language === 'pt-BR' ? 'Exportar Dados' : 'Export Data'}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {language === 'pt-BR'
                    ? 'Relatórios financeiros em PDF e planilhas CSV'
                    : 'Financial reports in PDF and CSV spreadsheets'}
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </button>
        </div>
      </div>

      {/* SEGMENT 3: Segurança e Sincronização */}
      <div className="space-y-2">
        <h3 className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {language === 'pt-BR' ? 'Segurança e Sincronização' : 'Security & Sync'}
        </h3>
        <div className="settings-group-card bg-white border border-slate-200 rounded-2xl divide-y divide-slate-200 overflow-hidden shadow-xs">
          {/* Row 1: Pareamento Familiar */}
          <button
            type="button"
            onClick={() => onNavigate('pairing')}
            className="settings-row-item w-full flex items-center justify-between gap-3 p-3.5 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {language === 'pt-BR' ? 'Pareamento Familiar' : 'Family Pairing'}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {language === 'pt-BR'
                    ? 'Código da família, chave mestre e QR Code'
                    : 'Family code, master key & QR Code'}
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </button>

          {/* Row 2: Servidor e Backup */}
          <button
            type="button"
            onClick={() => onNavigate('backup')}
            className="settings-row-item w-full flex items-center justify-between gap-3 p-3.5 text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 text-sky-400 flex items-center justify-center shrink-0">
                <Database size={18} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {language === 'pt-BR' ? 'Servidor e Backup' : 'Server & Backup'}
                </p>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {language === 'pt-BR'
                    ? 'Status SQLite, importar/exportar JSON e zerar conta'
                    : 'SQLite status, import/export JSON & reset account'}
                </p>
              </div>
            </div>
            <ChevronRight size={18} className="text-slate-400 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
};
