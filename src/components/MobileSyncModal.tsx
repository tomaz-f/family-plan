import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AppearanceAndPreferencesSection } from './settings/AppearanceAndPreferencesSection';
import { BackupAndResetSection } from './settings/BackupAndResetSection';
import { BalanceAdjustmentSection } from './settings/BalanceAdjustmentSection';
import { CategoryManagerSection } from './settings/CategoryManagerSection';
import { DataExportSection } from './settings/DataExportSection';
import { FamilyVaultSyncSection } from './settings/FamilyVaultSyncSection';
import { SettingsMainHub } from './settings/SettingsMainHub';
import {
  getSettingsHeaderTitle,
  mapInitialTabToSubScreen,
  MobileSyncModalProps,
  SettingsSubScreen,
} from './settings/settingsTypes';

export type { MobileSyncModalProps, SettingsSubScreen };

export const MobileSyncModal: React.FC<MobileSyncModalProps> = ({
  isOpen,
  activeTabInitial = 'settings',
  state,
  language,
  theme,
  isOnlineWithServer,
  pendingOfflineCount,
  currentBankBalance,
  familyId,
  masterKey,
  onLeaveFamily,
  onClose,
  onUpdateSettings,
  onAddCategory,
  onCategoryCreated,
  onUpdateCategory,
  onDeleteCategory,
  onImportBackup,
  onExportBackup,
  onResetAccount,
}) => {
  const [subScreen, setSubScreen] = useState<SettingsSubScreen>(() =>
    mapInitialTabToSubScreen(activeTabInitial)
  );
  const [cameFromIndex, setCameFromIndex] = useState<boolean>(false);

  const prevIsOpenRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      return;
    }

    if (!prevIsOpenRef.current) {
      prevIsOpenRef.current = true;
      const target = mapInitialTabToSubScreen(activeTabInitial);
      setSubScreen(target);
      setCameFromIndex(false);
    }
  }, [isOpen, activeTabInitial]);

  if (!isOpen) return null;

  const navigateToSubScreen = (target: SettingsSubScreen) => {
    setCameFromIndex(true);
    setSubScreen(target);
  };

  const handleBackNavigation = () => {
    if (subScreen === 'index') {
      onClose();
    } else if (cameFromIndex) {
      setSubScreen('index');
    } else {
      onClose();
    }
  };

  return (
    <div className="settings-screen-shell fixed inset-0 z-[100] overflow-y-auto">
      <div className="max-w-lg w-full mx-auto min-h-[100dvh] flex flex-col pb-16">
        {/* Sticky Top Navigation Bar (Telegram / iOS Style) */}
        <div className="settings-header-bar sticky top-0 z-20 flex items-center justify-between gap-3 px-4 py-3 border-b backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleBackNavigation}
              className="w-10 h-10 min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-100 active:scale-95 transition-all shrink-0"
              title={language === 'pt-BR' ? 'Voltar' : 'Back'}
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-base font-bold text-slate-900 truncate">
              {getSettingsHeaderTitle(subScreen, language)}
            </h1>
          </div>

          {subScreen !== 'index' && !cameFromIndex && (
            <button
              type="button"
              onClick={() => {
                setCameFromIndex(true);
                setSubScreen('index');
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors shrink-0"
            >
              {language === 'pt-BR' ? 'Todas Config.' : 'All Settings'}
            </button>
          )}
        </div>

        {/* MAIN SETTINGS INDEX VIEW */}
        {subScreen === 'index' && (
          <SettingsMainHub
            state={state}
            language={language}
            theme={theme}
            isOnlineWithServer={isOnlineWithServer}
            currentBankBalance={currentBankBalance}
            familyId={familyId}
            onNavigate={navigateToSubScreen}
          />
        )}

        {/* SUB-SCREEN 1: SALDO INICIAL E AJUSTE */}
        {subScreen === 'balance' && (
          <BalanceAdjustmentSection
            state={state}
            language={language}
            currentBankBalance={currentBankBalance}
            onUpdateSettings={onUpdateSettings}
          />
        )}

        {/* SUB-SCREEN 2: IDIOMA E MOEDA (PREFERÊNCIAS) */}
        {subScreen === 'preferences' && (
          <AppearanceAndPreferencesSection
            state={state}
            language={language}
            theme={theme}
            onUpdateSettings={onUpdateSettings}
          />
        )}

        {/* SUB-SCREEN 3: GERENCIAR CATEGORIAS */}
        {subScreen === 'categories' && (
          <CategoryManagerSection
            categories={state.categories}
            language={language}
            theme={theme}
            onAddCategory={onAddCategory}
            onCategoryCreated={onCategoryCreated}
            onUpdateCategory={onUpdateCategory}
            onDeleteCategory={onDeleteCategory}
          />
        )}

        {/* SUB-SCREEN 4: PAREAMENTO FAMILIAR */}
        {subScreen === 'pairing' && (
          <FamilyVaultSyncSection
            state={state}
            language={language}
            familyId={familyId}
            masterKey={masterKey}
            onLeaveFamily={onLeaveFamily}
            onClose={onClose}
          />
        )}

        {/* SUB-SCREEN 5: SERVIDOR E BACKUP */}
        {subScreen === 'backup' && (
          <BackupAndResetSection
            state={state}
            language={language}
            isOnlineWithServer={isOnlineWithServer}
            pendingOfflineCount={pendingOfflineCount}
            onImportBackup={onImportBackup}
            onExportBackup={onExportBackup}
            onResetAccount={onResetAccount}
          />
        )}

        {/* SUB-SCREEN 6: EXPORTAR DADOS (PDF & CSV) */}
        {subScreen === 'export' && (
          <DataExportSection state={state} language={language} />
        )}
      </div>
    </div>
  );
};
