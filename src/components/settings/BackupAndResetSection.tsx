import React, { useState } from 'react';
import { AlertTriangle, Download, Sparkles, Trash2, Upload, Wifi } from 'lucide-react';
import { AppLanguage, AppState } from '../../types';
import { TRANSLATIONS } from '../../utils/i18n';
import { MobileSyncModalProps } from './settingsTypes';

interface BackupAndResetSectionProps {
  state: AppState;
  language: AppLanguage;
  isOnlineWithServer: boolean;
  pendingOfflineCount: number;
  onImportBackup: MobileSyncModalProps['onImportBackup'];
  onExportBackup: MobileSyncModalProps['onExportBackup'];
  onResetAccount: MobileSyncModalProps['onResetAccount'];
}

export const BackupAndResetSection: React.FC<BackupAndResetSectionProps> = ({
  state,
  language,
  isOnlineWithServer,
  pendingOfflineCount,
  onImportBackup,
  onExportBackup,
  onResetAccount,
}) => {
  const t = TRANSLATIONS[language];

  const [importStatus, setImportStatus] = useState<string>('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInputText, setResetInputText] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleExportJSON = () => {
    try {
      const summary = onExportBackup();
      const countMsg =
        language === 'pt-BR'
          ? `Backup baixado: ${summary.transactions} transações (${summary.cardTransactions} em cartões), ${summary.creditCards} cartões, ${summary.fuelLogs} abastecimentos.`
          : `Backup downloaded: ${summary.transactions} transactions (${summary.cardTransactions} on cards), ${summary.creditCards} cards, ${summary.fuelLogs} fuel logs.`;
      setImportStatus(countMsg);
      setTimeout(() => setImportStatus(''), 7000);
    } catch (err: unknown) {
      console.error('Export failed:', err);
      const errMessage = err instanceof Error ? err.message : '';
      setImportStatus(
        errMessage ||
          (language === 'pt-BR' ? 'Erro ao gerar backup.' : 'Failed to export backup.')
      );
    }
  };

  const handleFileImport = (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'merge' | 'replace'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        const result = await onImportBackup(parsed, mode);
        let msg = t.backupImportedSuccess;
        if (result?.warnings?.length) {
          msg += ` (${result.warnings.join(' • ')})`;
        }
        if (result?.offline) {
          msg +=
            language === 'pt-BR'
              ? ' [Salvo localmente (offline)]'
              : ' [Saved locally (offline)]';
        }
        setImportStatus(msg);
        setTimeout(() => setImportStatus(''), 8000);
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : '';
        setImportStatus(errMessage || t.backupInvalidError);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="px-4 pt-5 pb-8 space-y-4 animate-fadeIn">
      {/* Server / SQLite Status Banner */}
      <div
        className={`p-4 rounded-2xl border flex items-center justify-between ${
          isOnlineWithServer
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
            : 'bg-amber-500/10 border-amber-500/25 text-amber-400'
        }`}
      >
        <div className="flex items-center gap-3">
          <Wifi size={20} className="shrink-0" />
          <div>
            <p className="text-xs font-bold">
              {isOnlineWithServer ? t.connectedToSqlite : t.offlineModeActive}
            </p>
            {pendingOfflineCount > 0 && (
              <p className="text-[11px] opacity-80 mt-0.5">
                {t.offlineQueuedAlert(pendingOfflineCount)}
              </p>
            )}
          </div>
        </div>
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            isOnlineWithServer ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        />
      </div>

      {state.networkInfo?.dbPath && (
        <div className="settings-group-card p-3.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-500">
          <p className="font-bold text-slate-900 mb-1">{t.localSqliteDbFile}</p>
          <code className="font-mono text-[11px] break-all select-all">
            {state.networkInfo.dbPath}
          </code>
        </div>
      )}

      {/* Current Data Overview Pill Grid */}
      <div className="settings-group-card p-4 rounded-2xl bg-white border border-slate-200">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
          {language === 'pt-BR'
            ? 'Dados Atuais no Espaço Familiar'
            : 'Current Family Space Data'}
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="block text-base font-extrabold text-slate-900">
              {state.transactions.length}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold uppercase">
              {language === 'pt-BR' ? 'Transações' : 'Transactions'}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="block text-base font-extrabold text-indigo-400">
              {(state.creditCards || []).length}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold uppercase">
              {language === 'pt-BR' ? 'Cartões' : 'Cards'}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="block text-base font-extrabold text-emerald-400">
              {(state.fuelLogs || []).length}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold uppercase">
              {language === 'pt-BR' ? 'Abastecimentos' : 'Fuel Logs'}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span className="block text-base font-extrabold text-amber-400">
              {state.recurringTemplates.length}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold uppercase">
              {language === 'pt-BR' ? 'Recorrências' : 'Recurring'}
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 col-span-2 sm:col-span-1">
            <span className="block text-base font-extrabold text-slate-700">
              {state.categories.length}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold uppercase">
              {language === 'pt-BR' ? 'Categorias' : 'Categories'}
            </span>
          </div>
        </div>
      </div>

      {/* Export Full Backup Box */}
      <div className="settings-group-card p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <Download size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{t.exportFullBackupTitle}</h3>
            <p className="text-[11px] text-slate-500">
              {language === 'pt-BR'
                ? 'Formato completo v2: transações, cartões, faturas, abastecimentos e configurações.'
                : 'Complete format v2: transactions, cards, invoices, fuel logs, and settings.'}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{t.exportFullBackupDesc}</p>
        <button
          type="button"
          onClick={handleExportJSON}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all shadow-sm active:scale-95"
        >
          <Download size={15} />
          {t.downloadBackupBtn}
        </button>
      </div>

      {/* Restore / Import Backup Box */}
      <div className="settings-group-card p-4 rounded-2xl bg-white border border-slate-200 space-y-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
            <Upload size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{t.restoreImportTitle}</h3>
            <p className="text-[11px] text-slate-500">
              {language === 'pt-BR'
                ? 'Compatível com backups v1 e v2. Criptografia E2EE automática.'
                : 'Compatible with v1 and v2 backups. Automatic E2EE encryption.'}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">{t.restoreImportDesc}</p>

        <div className="flex flex-wrap gap-2.5 pt-1">
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold cursor-pointer hover:bg-slate-100 transition-all shadow-xs active:scale-95">
            <Upload size={15} />
            {t.mergeBackupBtn}
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => handleFileImport(e, 'merge')}
            />
          </label>
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold cursor-pointer hover:bg-rose-500/20 transition-all shadow-xs active:scale-95">
            <Upload size={15} />
            {t.replaceAllDataBtn}
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => handleFileImport(e, 'replace')}
            />
          </label>
        </div>

        {importStatus && (
          <div className="mt-2 p-3 rounded-xl bg-slate-900 text-white text-xs font-medium flex items-start gap-2 border border-slate-700">
            <Sparkles size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{importStatus}</span>
          </div>
        )}
      </div>

      {/* Danger Zone: Reset Account History */}
      <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-rose-500">{t.resetHistoryTitle}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{t.resetHistoryDesc}</p>
          </div>
        </div>

        {!showResetConfirm ? (
          <button
            type="button"
            onClick={() => {
              setShowResetConfirm(true);
              setResetInputText('');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-colors"
          >
            <Trash2 size={14} />
            {t.resetHistoryBtn}
          </button>
        ) : (
          <div className="p-3.5 rounded-xl bg-white border border-rose-500/40 space-y-2.5">
            <p className="text-xs font-semibold text-slate-800">{t.resetConfirmPrompt}</p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                placeholder={t.resetConfirmWord}
                value={resetInputText}
                onChange={(e) => setResetInputText(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold uppercase tracking-wider"
              />
              <button
                type="button"
                disabled={resetInputText.trim().toUpperCase() !== t.resetConfirmWord}
                onClick={async () => {
                  await onResetAccount();
                  setShowResetConfirm(false);
                  setResetInputText('');
                  setResetSuccess(true);
                  setTimeout(() => setResetSuccess(false), 3500);
                }}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold transition-all"
              >
                {t.resetConfirmBtn}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetInputText('');
                }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold"
              >
                {t.cancelBtn}
              </button>
            </div>
          </div>
        )}

        {resetSuccess && (
          <p className="text-xs font-bold text-emerald-500">{t.resetSuccessMsg}</p>
        )}
      </div>
    </div>
  );
};
