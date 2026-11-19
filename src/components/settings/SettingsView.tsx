import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, Download, Settings, ShieldCheck } from 'lucide-react';
import { AppLanguage, AppState, AppTheme } from '../../types';
import { AppIcon } from '../icons';
import { AppActiveTab } from '../layout/AppHeaderBar';
import { AppearanceAndPreferencesSection } from './AppearanceAndPreferencesSection';
import { BackupAndResetSection } from './BackupAndResetSection';
import { BalanceAdjustmentSection } from './BalanceAdjustmentSection';
import { CategoryManagerSection } from './CategoryManagerSection';
import { FamilyVaultSyncSection } from './FamilyVaultSyncSection';
import { MobileSyncModalProps } from './settingsTypes';
import { VehicleFuelSettingsCard } from './VehicleFuelSettingsCard';

interface SettingsViewProps {
  state: AppState;
  language: AppLanguage;
  theme: AppTheme;
  isOnlineWithServer: boolean;
  pendingOfflineCount: number;
  currentBankBalance: number;
  familyId: string | null;
  masterKey: string | null;
  onLeaveFamily: () => void;
  onUpdateSettings: MobileSyncModalProps['onUpdateSettings'];
  onAddCategory: MobileSyncModalProps['onAddCategory'];
  onUpdateCategory: MobileSyncModalProps['onUpdateCategory'];
  onDeleteCategory: MobileSyncModalProps['onDeleteCategory'];
  onImportBackup: MobileSyncModalProps['onImportBackup'];
  onExportBackup: MobileSyncModalProps['onExportBackup'];
  onResetAccount: MobileSyncModalProps['onResetAccount'];
  onNavigateTab: (tab: AppActiveTab) => void;
}

const SectionHeading: React.FC<{ title: string }> = ({ title }) => (
  <h2 className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
    {title}
  </h2>
);

export const SettingsView: React.FC<SettingsViewProps> = ({
  state, language, theme, isOnlineWithServer, pendingOfflineCount, currentBankBalance,
  familyId, masterKey, onLeaveFamily, onUpdateSettings, onAddCategory, onUpdateCategory,
  onDeleteCategory, onImportBackup, onExportBackup, onResetAccount, onNavigateTab,
}) => {
  const isPt = language === 'pt-BR';
  const [pairingExpanded, setPairingExpanded] = useState(false);

  const cardsCount = (state.creditCards || []).length;
  const cardsSubtitle = isPt
    ? `${cardsCount} ${cardsCount === 1 ? 'cartão ativo' : 'cartões ativos'}`
    : `${cardsCount} ${cardsCount === 1 ? 'active card' : 'active cards'}`;

  const pairingSubtitle = familyId
    ? isPt
      ? `Família ${familyId} • Clique para exibir códigos e QR`
      : `Family ${familyId} • Click to view codes & QR`
    : isPt
    ? 'Conectar celular via Wi-Fi local e QR Code'
    : 'Connect phone via local Wi-Fi & QR Code';

  return (
    <div className="space-y-5 pb-8 lg:pb-2 animate-fadeIn">
      {/* Mobile resize fallback header */}
      <div className="lg:hidden flex items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => onNavigateTab('dashboard')}
            className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] hover:bg-slate-50 dark:hover:bg-[#161B22] flex items-center justify-center text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
            aria-label={isPt ? 'Voltar' : 'Back'}
          >
            <ArrowLeft size={18} />
          </button>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
            {isPt ? 'Configurações' : 'Settings'}
          </h2>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('export')}
          className="min-h-[44px] px-3 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] hover:bg-slate-50 dark:hover:bg-[#161B22] text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
        >
          <Download size={14} className="shrink-0" />
          <span>{isPt ? 'Exportar' : 'Export'}</span>
        </button>
      </div>

      {/* Desktop page header */}
      <div className="hidden lg:flex items-center justify-between gap-4 pb-1">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#6E5440]/10 dark:bg-[#6E5440]/20 flex items-center justify-center shrink-0">
            <Settings size={20} className="text-[#6E5440] dark:text-[#D0B595]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white truncate">
              {isPt ? 'Configurações' : 'Settings'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {isPt
                ? 'Preferências do app, veículo, categorias, backup e sincronização'
                : 'App preferences, vehicle, categories, backup, and sync'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('export')}
          className="min-h-[40px] px-3.5 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] hover:bg-slate-50 dark:hover:bg-[#161B22] text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer shrink-0 transition-colors"
        >
          <Download size={15} className="shrink-0" />
          <span>{isPt ? 'Exportar Dados' : 'Export Data'}</span>
        </button>
      </div>

      {/* 2-Column Bento Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-6 space-y-4 min-w-0">
          <div className="space-y-2">
            <SectionHeading title={isPt ? 'Aparência e Preferências' : 'Appearance & Preferences'} />
            <AppearanceAndPreferencesSection
              state={state} language={language} theme={theme}
              onUpdateSettings={onUpdateSettings} embedded
            />
          </div>

          <VehicleFuelSettingsCard
            tankCapacity={state.settings.tankCapacity || 50}
            fuelLogsCount={(state.fuelLogs || []).length}
            language={language}
            onUpdateTankCapacity={(cap) => onUpdateSettings({ tankCapacity: cap })}
            onNavigateFuel={() => onNavigateTab('fuel')}
          />

          <div className="space-y-2">
            <SectionHeading title={isPt ? 'Saldo e Conta' : 'Balance & Account'} />
            <BalanceAdjustmentSection
              state={state} language={language} currentBankBalance={currentBankBalance}
              onUpdateSettings={onUpdateSettings} embedded
            />
          </div>
        </div>

        <div className="lg:col-span-6 space-y-4 min-w-0">
          <div className="settings-group-card p-4 rounded-2xl bg-white dark:bg-[#0D1117] border border-slate-200/80 dark:border-[#21262D] shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-500 flex items-center justify-center shrink-0">
                <AppIcon name="cartao" size={20} />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {isPt ? 'Contas e Cartões' : 'Accounts & Cards'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{cardsSubtitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('cards')}
              className="min-h-[44px] px-3.5 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-slate-50 dark:bg-[#161B22] hover:bg-slate-200/70 dark:hover:bg-[#21262D] text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
            >
              {isPt ? 'Gerenciar Cartões' : 'Manage Cards'}
            </button>
          </div>

          <div className="space-y-2">
            <SectionHeading title={isPt ? 'Categorias' : 'Categories'} />
            <CategoryManagerSection
              categories={state.categories} language={language} theme={theme}
              onAddCategory={onAddCategory} onUpdateCategory={onUpdateCategory}
              onDeleteCategory={onDeleteCategory} embedded
            />
          </div>

          <div className="space-y-2">
            <SectionHeading title={isPt ? 'Backup e Gestão de Dados' : 'Backup & Data Management'} />
            <BackupAndResetSection
              state={state} language={language} isOnlineWithServer={isOnlineWithServer}
              pendingOfflineCount={pendingOfflineCount} onImportBackup={onImportBackup}
              onExportBackup={onExportBackup} onResetAccount={onResetAccount} embedded
            />
          </div>

          <div className="space-y-2">
            <div className="settings-group-card rounded-2xl border border-slate-200/80 dark:border-[#21262D] overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setPairingExpanded((prev) => !prev)}
                aria-expanded={pairingExpanded}
                className="settings-row-item w-full min-h-[56px] p-4 flex items-center justify-between gap-3 text-left cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="min-w-0">
                    <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">
                      {isPt ? 'Pareamento Familiar e QR Code' : 'Family Pairing & QR Code'}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                      {pairingSubtitle}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  size={18}
                  className={`text-slate-400 shrink-0 transition-transform duration-200 ${
                    pairingExpanded ? 'rotate-180' : 'rotate-0'
                  }`}
                />
              </button>
            </div>

            {pairingExpanded && (
              <FamilyVaultSyncSection
                state={state} language={language} familyId={familyId}
                masterKey={masterKey} onLeaveFamily={onLeaveFamily} embedded
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
