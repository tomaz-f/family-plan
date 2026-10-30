import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Landmark,
  Languages,
  LogOut,
  Moon,
  Pencil,
  Plus,
  QrCode,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Tag,
  Trash2,
  Upload,
  Wifi,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { AppLanguage, AppState, AppTheme, Category, TransactionType } from '../types';
import { CURRENCIES, formatCurrency } from '../utils/format';
import {
  computeExportData,
  exportFilteredHistoryToCSV,
  exportFilteredHistoryToPDF,
  ExportPeriodMode,
  ExportTypeFilter,
} from '../utils/exportReport';
import { getCategoryDisplayName, TRANSLATIONS } from '../utils/i18n';
import { CategoryIcon, AVAILABLE_ICONS } from './CategoryIcon';
import { BackupSummary } from '../utils/backup';
import { PrumoLogoIcon } from './PrumoLogoIcon';

export type SettingsSubScreen =
  | 'index'
  | 'balance'
  | 'preferences'
  | 'categories'
  | 'pairing'
  | 'backup'
  | 'export';

interface MobileSyncModalProps {
  isOpen: boolean;
  activeTabInitial?: 'mobile' | 'settings' | 'categories' | 'export' | 'backup';
  state: AppState;
  language: AppLanguage;
  theme: AppTheme;
  isOnlineWithServer: boolean;
  pendingOfflineCount: number;
  currentBankBalance?: number;
  familyId?: string | null;
  masterKey?: string | null;
  onLeaveFamily?: () => void;
  onOpenBalanceModal?: () => void;
  onClose: () => void;
  onUpdateSettings: (payload: {
    familyName?: string;
    currency?: string;
    language?: AppLanguage;
    theme?: AppTheme;
    initialBalance?: number;
    targetCurrentBalance?: number;
  }) => Promise<void>;
  onAddCategory: (cat: {
    name: string;
    type: TransactionType;
    color: string;
    icon: string;
  }) => Promise<void>;
  onUpdateCategory: (
    id: string,
    cat: { name: string; type: TransactionType; color: string; icon: string }
  ) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onImportBackup: (
    data: unknown,
    mode: 'merge' | 'replace'
  ) => Promise<{ warnings: string[]; offline: boolean }>;
  onExportBackup: () => BackupSummary;
  onResetAccount: () => Promise<void>;
}

const PRESET_COLORS = [
  '#10b981',
  '#0ea5e9',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#f43f5e',
  '#f97316',
  '#f59e0b',
  '#14b8a6',
  '#64748b',
];

function mapInitialTabToSubScreen(
  tab?: 'mobile' | 'settings' | 'categories' | 'export' | 'backup'
): SettingsSubScreen {
  if (tab === 'export') return 'export';
  if (tab === 'categories') return 'categories';
  if (tab === 'backup') return 'backup';
  if (tab === 'mobile') return 'pairing';
  return 'index';
}

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
  onUpdateCategory,
  onDeleteCategory,
  onImportBackup,
  onExportBackup,
  onResetAccount,
}) => {
  const t = TRANSLATIONS[language];

  const [subScreen, setSubScreen] = useState<SettingsSubScreen>(() =>
    mapInitialTabToSubScreen(activeTabInitial)
  );
  const [cameFromIndex, setCameFromIndex] = useState<boolean>(false);

  const [copied, setCopied] = useState(false);
  const [familyCodeCopied, setFamilyCodeCopied] = useState(false);
  const [masterKeyCopied, setMasterKeyCopied] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Settings form state
  const [familyName, setFamilyName] = useState(state.settings.familyName);
  const [currency, setCurrency] = useState(state.settings.currency);
  const [selectedLang, setSelectedLang] = useState<AppLanguage>(language);
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>(theme);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  // Balance sub-screen calibration state
  const [balanceMode, setBalanceMode] = useState<'current' | 'initial'>('current');
  const [balanceAmountInput, setBalanceAmountInput] = useState<string>(() => {
    const safeCurrent =
      typeof currentBankBalance === 'number' && !Number.isNaN(currentBankBalance)
        ? currentBankBalance
        : 0;
    return safeCurrent.toFixed(2);
  });
  const [savingBalance, setSavingBalance] = useState<boolean>(false);
  const [balanceSavedFeedback, setBalanceSavedFeedback] = useState<boolean>(false);

  // Reset confirmation safety states
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInputText, setResetInputText] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Category create/edit state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<TransactionType>('expense');
  const [catColor, setCatColor] = useState('#6366f1');
  const [catIcon, setCatIcon] = useState<string>('Tag');

  // Backup import status
  const [importStatus, setImportStatus] = useState<string>('');

  // Export filter states
  const currentYearStr = String(new Date().getFullYear());
  const currentMonthNum = String(new Date().getMonth() + 1).padStart(2, '0');
  const [exportPeriodMode, setExportPeriodMode] = useState<ExportPeriodMode>('monthly');
  const [exportYear, setExportYear] = useState<string>(currentYearStr);
  const [exportMonth, setExportMonth] = useState<string>(currentMonthNum);
  const [exportTypeFilter, setExportTypeFilter] = useState<ExportTypeFilter>('all');

  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>([currentYearStr, String(Number(currentYearStr) - 1)]);
    for (const tx of state.transactions) {
      if (tx.date && tx.date.length >= 4) {
        yearsSet.add(tx.date.slice(0, 4));
      }
    }
    return Array.from(yearsSet).sort().reverse();
  }, [state.transactions, currentYearStr]);

  const monthsWithEntriesInSelectedYear = useMemo(() => {
    const set = new Set<string>();
    for (const tx of state.transactions) {
      if (tx.date.startsWith(`${exportYear}-`)) {
        set.add(tx.date.slice(5, 7));
      }
    }
    return set;
  }, [state.transactions, exportYear]);

  const exportFilterOptions = useMemo(
    () => ({
      periodMode: exportPeriodMode,
      year: exportYear,
      month: exportMonth,
      typeFilter: exportTypeFilter,
      familyName: state.settings.familyName,
      currency: state.settings.currency,
      language,
      initialBalance: state.settings.initialBalance,
      categories: state.categories,
      transactions: state.transactions,
      fuelLogs: state.fuelLogs || [],
    }),
    [
      exportPeriodMode,
      exportYear,
      exportMonth,
      exportTypeFilter,
      state.settings.familyName,
      state.settings.currency,
      state.settings.initialBalance,
      state.categories,
      state.transactions,
      state.fuelLogs,
      language,
    ]
  );

  const exportPreview = useMemo(
    () => computeExportData(exportFilterOptions),
    [exportFilterOptions]
  );

  useEffect(() => {
    if (isOpen) {
      const target = mapInitialTabToSubScreen(activeTabInitial);
      setSubScreen(target);
      setCameFromIndex(false);
      setFamilyName(state.settings.familyName);
      setCurrency(state.settings.currency);
      setSelectedLang(language);
      setSelectedTheme(theme);
      setImportStatus('');
      setShowResetConfirm(false);
      setResetInputText('');
      setResetSuccess(false);
      setShowLeaveConfirm(false);
      setEditingCategoryId(null);
      setCatName('');
      setSavedFeedback(false);
      setBalanceSavedFeedback(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTabInitial]);

  useEffect(() => {
    setSelectedTheme(theme);
  }, [theme]);

  useEffect(() => {
    setSelectedLang(language);
  }, [language]);

  if (!isOpen) return null;

  const navigateToSubScreen = (target: SettingsSubScreen) => {
    if (target === 'balance') {
      setBalanceMode('current');
      const safeCurrent =
        typeof currentBankBalance === 'number' && !Number.isNaN(currentBankBalance)
          ? currentBankBalance
          : 0;
      setBalanceAmountInput(safeCurrent.toFixed(2));
      setBalanceSavedFeedback(false);
    }
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

  const handleBalanceModeSwitch = (nextMode: 'current' | 'initial') => {
    setBalanceMode(nextMode);
    const safeCurrent =
      typeof currentBankBalance === 'number' && !Number.isNaN(currentBankBalance)
        ? currentBankBalance
        : 0;
    const safeInitial =
      typeof state.settings.initialBalance === 'number' &&
      !Number.isNaN(state.settings.initialBalance)
        ? state.settings.initialBalance
        : 0;
    setBalanceAmountInput(
      nextMode === 'current' ? safeCurrent.toFixed(2) : safeInitial.toFixed(2)
    );
  };

  const handleSaveBalanceSubScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(balanceAmountInput.replace(',', '.'));
    if (Number.isNaN(parsed)) return;

    setSavingBalance(true);
    try {
      if (balanceMode === 'current') {
        await onUpdateSettings({ targetCurrentBalance: parsed });
      } else {
        await onUpdateSettings({ initialBalance: parsed });
      }
      setBalanceSavedFeedback(true);
      setTimeout(() => setBalanceSavedFeedback(false), 2500);
    } finally {
      setSavingBalance(false);
    }
  };

  const handleCopyFamilyCode = async (code: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setFamilyCodeCopied(true);
      setTimeout(() => setFamilyCodeCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleCopyMasterKey = async (key: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(key);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = key;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setMasterKeyCopied(true);
      setTimeout(() => setMasterKeyCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  const primaryUrl = state.networkInfo?.primaryUrl || window.location.origin;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(primaryUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await onUpdateSettings({
        familyName: familyName.trim() || 'PRUMO',
        currency,
        language: selectedLang,
        theme: selectedTheme,
      });
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2500);
    } finally {
      setSavingSettings(false);
    }
  };

  const handleStartEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setCatName(getCategoryDisplayName(cat, language));
    setCatType(cat.type);
    setCatColor(cat.color);
    setCatIcon(cat.icon);
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null);
    setCatName('');
    setCatType('expense');
    setCatColor('#6366f1');
    setCatIcon('Tag');
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    if (editingCategoryId) {
      await onUpdateCategory(editingCategoryId, {
        name: catName.trim(),
        type: catType,
        color: catColor,
        icon: catIcon,
      });
      handleCancelEditCategory();
    } else {
      await onAddCategory({
        name: catName.trim(),
        type: catType,
        color: catColor,
        icon: catIcon,
      });
      setCatName('');
    }
  };

  const handleExportJSON = () => {
    try {
      const summary = onExportBackup();
      const countMsg =
        language === 'pt-BR'
          ? `Backup baixado: ${summary.transactions} transações (${summary.cardTransactions} em cartões), ${summary.creditCards} cartões, ${summary.fuelLogs} abastecimentos.`
          : `Backup downloaded: ${summary.transactions} transactions (${summary.cardTransactions} on cards), ${summary.creditCards} cards, ${summary.fuelLogs} fuel logs.`;
      setImportStatus(countMsg);
      setTimeout(() => setImportStatus(''), 7000);
    } catch (err: any) {
      console.error('Export failed:', err);
      setImportStatus(
        err?.message ||
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
      } catch (err: any) {
        setImportStatus(err?.message || t.backupInvalidError);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getHeaderTitle = (): string => {
    switch (subScreen) {
      case 'balance':
        return language === 'pt-BR' ? 'Saldo Inicial e Ajuste' : 'Starting Balance & Adjustment';
      case 'preferences':
        return language === 'pt-BR' ? 'Idioma e Moeda' : 'Language & Currency';
      case 'categories':
        return language === 'pt-BR' ? 'Gerenciar Categorias' : 'Manage Categories';
      case 'pairing':
        return language === 'pt-BR' ? 'Pareamento Familiar' : 'Family Pairing';
      case 'backup':
        return language === 'pt-BR' ? 'Servidor e Backup' : 'Server & Backup';
      case 'export':
        return language === 'pt-BR' ? 'Exportar Dados' : 'Export Data';
      case 'index':
      default:
        return language === 'pt-BR' ? 'Configurações' : 'Settings';
    }
  };

  const displayBrandName =
    state.settings.familyName &&
    state.settings.familyName.toUpperCase() !== 'FAMILY PLAN' &&
    state.settings.familyName.toUpperCase() !== 'FAMILY FINANCE'
      ? state.settings.familyName
      : 'PRUMO';

  return (
    <div className="settings-screen-shell fixed inset-0 z-50 overflow-y-auto">
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
            <h1 className="text-base font-bold text-slate-900 truncate">{getHeaderTitle()}</h1>
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
                  onClick={() => navigateToSubScreen('balance')}
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
                  onClick={() => navigateToSubScreen('preferences')}
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
                        {state.settings.currency} •{' '}
                        {theme === 'oled' ? t.themeOled : t.themeLight}
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
                  onClick={() => navigateToSubScreen('categories')}
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
                  onClick={() => navigateToSubScreen('export')}
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
                  onClick={() => navigateToSubScreen('pairing')}
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
                  onClick={() => navigateToSubScreen('backup')}
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
        )}

        {/* SUB-SCREEN 1: SALDO INICIAL E AJUSTE */}
        {subScreen === 'balance' && (
          <form
            onSubmit={handleSaveBalanceSubScreen}
            className="px-4 pt-5 pb-8 space-y-4 animate-fadeIn"
          >
            <div className="settings-group-card p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
                  <Landmark size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {t.bankAccountBalanceTitle}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{t.syncWithRealBankSub}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {t.currentBankBalance}
                  </span>
                  <span className="block text-lg font-extrabold text-emerald-500 mt-1">
                    {formatCurrency(currentBankBalance ?? 0, state.settings.currency)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    {t.startingBase}
                  </span>
                  <span className="block text-lg font-extrabold text-slate-900 mt-1">
                    {formatCurrency(state.settings.initialBalance ?? 0, state.settings.currency)}
                  </span>
                </div>
              </div>

              {/* Segmented Mode Switcher: Current Bank Balance vs Starting Base */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => handleBalanceModeSwitch('current')}
                  className={`min-h-[42px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    balanceMode === 'current'
                      ? 'bg-[#6E5440] text-[#FFFDF5] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Check size={14} />
                  <span>{t.setCurrentBalanceTab}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleBalanceModeSwitch('initial')}
                  className={`min-h-[42px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    balanceMode === 'initial'
                      ? 'bg-[#6E5440] text-[#FFFDF5] shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <SlidersHorizontal size={14} />
                  <span>{t.startingBaseBalanceTab}</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 leading-relaxed">
                {balanceMode === 'current' ? t.currentBalanceExplain : t.initialBalanceExplain}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  {balanceMode === 'current'
                    ? t.exactCurrentBankBalanceLabel
                    : t.startingBaseBalanceLabel}
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={balanceAmountInput}
                  onChange={(e) => setBalanceAmountInput(e.target.value)}
                  className="w-full text-xl font-bold px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingBalance}
              className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-all shadow-sm active:scale-95"
            >
              <Check size={16} />
              <span>{savingBalance ? t.updatingBtn : t.saveBalanceBtn}</span>
            </button>

            {balanceSavedFeedback && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
                <Check size={15} />
                <span>
                  {language === 'pt-BR'
                    ? 'Saldo atualizado e sincronizado com sucesso!'
                    : 'Balance updated and synced successfully!'}
                </span>
              </div>
            )}
          </form>
        )}

        {/* SUB-SCREEN 2: IDIOMA E MOEDA (PREFERÊNCIAS) */}
        {subScreen === 'preferences' && (
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
                    onClick={() => {
                      setSelectedLang('pt-BR');
                      onUpdateSettings({ language: 'pt-BR' });
                    }}
                    className={`min-h-[46px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      selectedLang === 'pt-BR'
                        ? 'border-[#8A6F57] bg-[#6E5440] text-[#FFFDF5] shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Languages size={16} />
                    <span>Português (BR)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedLang('en');
                      onUpdateSettings({ language: 'en' });
                    }}
                    className={`min-h-[46px] flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                      selectedLang === 'en'
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
                    onClick={() => {
                      setSelectedTheme('oled');
                      onUpdateSettings({ theme: 'oled' });
                    }}
                    className={`min-h-[46px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-bold transition-all ${
                      selectedTheme === 'oled'
                        ? 'border-[#8A6F57] bg-[#6E5440] text-[#FFFDF5] shadow-sm'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Moon size={15} />
                    <span>{t.themeOled}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTheme('light');
                      onUpdateSettings({ theme: 'light' });
                    }}
                    className={`min-h-[46px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl border text-xs font-bold transition-all ${
                      selectedTheme === 'light'
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
        )}

        {/* SUB-SCREEN 3: GERENCIAR CATEGORIAS */}
        {subScreen === 'categories' && (
          <div className="px-4 pt-5 pb-8 space-y-5 animate-fadeIn">
            <form
              onSubmit={handleSaveCategory}
              className="settings-group-card p-4 rounded-2xl bg-white border border-slate-200 space-y-3.5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {editingCategoryId ? t.editCategoryTitle : t.addCustomCategoryTitle}
                </h3>
                {editingCategoryId && (
                  <button
                    type="button"
                    onClick={handleCancelEditCategory}
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
                  onChange={(e) => setCatName(e.target.value)}
                  className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-slate-50"
                />
                <select
                  value={catType}
                  onChange={(e) => setCatType(e.target.value as TransactionType)}
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
                <div className="flex flex-wrap items-center gap-2">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCatColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        catColor === c
                          ? 'scale-110 ring-2 ring-offset-2 ring-slate-900'
                          : 'opacity-85 hover:opacity-100'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Visual Icon Picker Grid */}
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  {t.chooseIconLabel}
                </span>
                <div className="grid grid-cols-7 sm:grid-cols-10 gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-200 max-h-36 overflow-y-auto">
                  {AVAILABLE_ICONS.map((ic) => {
                    const isSelected = catIcon === ic;
                    return (
                      <button
                        key={ic}
                        type="button"
                        onClick={() => setCatIcon(ic)}
                        title={ic}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                          isSelected
                            ? 'ring-2 ring-slate-900 shadow-sm scale-105'
                            : 'hover:bg-slate-100 text-slate-600'
                        }`}
                        style={
                          isSelected
                            ? { backgroundColor: `${catColor}22`, color: catColor }
                            : undefined
                        }
                      >
                        <CategoryIcon icon={ic} size={17} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
                >
                  {editingCategoryId ? <Check size={14} /> : <Plus size={14} />}
                  {editingCategoryId ? t.updateCategoryBtn : t.addCategoryBtn}
                </button>
                {editingCategoryId && (
                  <button
                    type="button"
                    onClick={handleCancelEditCategory}
                    className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100"
                  >
                    {t.cancelEditBtn}
                  </button>
                )}
              </div>
            </form>

            {/* Category List */}
            <div className="space-y-2">
              <h3 className="px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'pt-BR' ? 'Categorias Cadastradas' : 'Registered Categories'} (
                {state.categories.length})
              </h3>
              <div className="settings-group-card bg-white border border-slate-200 rounded-2xl divide-y divide-slate-200 overflow-hidden">
                {state.categories.map((cat: Category) => {
                  const isBeingEdited = editingCategoryId === cat.id;
                  return (
                    <div
                      key={cat.id}
                      className={`flex items-center justify-between p-3.5 transition-colors ${
                        isBeingEdited ? 'bg-indigo-500/10' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CategoryIcon icon={cat.icon} color={cat.color} size={16} badgeSize="sm" />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate">
                            {getCategoryDisplayName(cat, language)}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {cat.type === 'income' ? t.incomeTypeLabel : t.expenseTypeLabel}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEditCategory(cat)}
                          className="p-2 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-slate-100 transition-colors"
                          title={t.editCategoryTooltip}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCategory(cat.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title={t.deleteCategoryTooltip}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* SUB-SCREEN 4: PAREAMENTO FAMILIAR */}
        {subScreen === 'pairing' && (
          <div className="px-4 pt-5 pb-8 space-y-4 animate-fadeIn">
            {familyId && (
              <div className="settings-group-card p-4 rounded-2xl bg-white border border-slate-200 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">
                      {language === 'pt-BR'
                        ? 'Segurança e Pareamento Familiar'
                        : 'Family Security & Pairing'}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {language === 'pt-BR'
                        ? 'Criptografia de ponta a ponta (AES-256) ativa'
                        : 'End-to-end encryption (AES-256) active'}
                    </p>
                  </div>
                </div>

                {/* Pairing Code */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-0.5">
                      {language === 'pt-BR'
                        ? '1. Código da Família'
                        : '1. Family Pairing Code'}
                    </span>
                    <code className="text-base font-black tracking-widest text-slate-900 font-mono select-all">
                      {familyId}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyFamilyCode(familyId)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all active:scale-95 shrink-0"
                  >
                    {familyCodeCopied ? <Check size={14} /> : <Copy size={14} />}
                    <span>
                      {familyCodeCopied
                        ? language === 'pt-BR'
                          ? 'Copiado!'
                          : 'Copied!'
                        : language === 'pt-BR'
                        ? 'Copiar'
                        : 'Copy'}
                    </span>
                  </button>
                </div>

                {/* Master Key */}
                {masterKey && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-0.5">
                          <KeyRound size={12} />
                          {language === 'pt-BR'
                            ? '2. Chave Mestre de Segurança (E2EE)'
                            : '2. Master Security Key (E2EE)'}
                        </span>
                        <code className="text-xs font-bold tracking-wider text-slate-800 font-mono break-all select-all">
                          {masterKey}
                        </code>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyMasterKey(masterKey)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all active:scale-95 shrink-0"
                      >
                        {masterKeyCopied ? <Check size={14} /> : <Copy size={14} />}
                        <span>
                          {masterKeyCopied
                            ? language === 'pt-BR'
                              ? 'Copiada!'
                              : 'Copied!'
                            : language === 'pt-BR'
                            ? 'Copiar Chave'
                            : 'Copy Key'}
                        </span>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      {language === 'pt-BR'
                        ? 'Compartilhe o Código da Família e a Chave Mestre apenas com seu parceiro(a).'
                        : 'Share the Family Code and Master Key only with your partner.'}
                    </p>
                  </div>
                )}

                {/* Disconnect / Leave Family */}
                {onLeaveFamily && (
                  <div className="pt-2 border-t border-slate-200">
                    {!showLeaveConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowLeaveConfirm(true)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-500 hover:text-rose-400 transition-colors py-1"
                      >
                        <LogOut size={14} />
                        <span>
                          {language === 'pt-BR'
                            ? 'Desconectar / Trocar de Família'
                            : 'Disconnect / Switch Family'}
                        </span>
                      </button>
                    ) : (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2.5">
                        <p className="text-xs font-bold text-rose-400">
                          {language === 'pt-BR'
                            ? 'Tem certeza que deseja sair deste espaço familiar neste aparelho?'
                            : 'Are you sure you want to disconnect from this family space on this device?'}
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setShowLeaveConfirm(false)}
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold"
                          >
                            {language === 'pt-BR' ? 'Cancelar' : 'Cancel'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onLeaveFamily();
                              onClose();
                            }}
                            className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold active:scale-95 shadow-sm"
                          >
                            {language === 'pt-BR' ? 'Sim, desconectar' : 'Yes, disconnect'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Local Wi-Fi QR Code & LAN URLs Card */}
            <div className="settings-group-card p-4 rounded-2xl bg-white border border-slate-200 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center shrink-0">
                  <QrCode size={18} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{t.openOnYourPhone}</h4>
                  <p className="text-xs text-slate-500">{t.openOnPhoneDesc}</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200">
                {state.networkInfo?.qrCodeDataUrl ? (
                  <img
                    src={state.networkInfo.qrCodeDataUrl}
                    alt="Scan to open on phone"
                    className="w-40 h-40 rounded-xl border border-slate-200 bg-white p-2 shrink-0 shadow-xs"
                  />
                ) : (
                  <div className="w-40 h-40 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-xs text-slate-400 text-center p-4">
                    QR Code
                  </div>
                )}

                <div className="w-full flex items-center gap-2 pt-1">
                  <code className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono font-semibold text-slate-800 truncate select-all">
                    {primaryUrl}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopyUrl}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 shrink-0"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? t.copiedBtn : t.copyBtn}
                  </button>
                </div>
              </div>

              {state.networkInfo?.lanUrls && state.networkInfo.lanUrls.length > 1 && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <p className="font-semibold text-slate-700">{t.availableAdapters}</p>
                  {state.networkInfo.lanUrls.map((item) => (
                    <div
                      key={item.url}
                      className="flex items-center justify-between text-slate-600"
                    >
                      <span>{item.name}</span>
                      <code className="font-mono font-semibold text-slate-800">{item.url}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SUB-SCREEN 5: SERVIDOR E BACKUP */}
        {subScreen === 'backup' && (
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
        )}

        {/* SUB-SCREEN 6: EXPORTAR DADOS (PDF & CSV) */}
        {subScreen === 'export' && (
          <div className="px-4 pt-5 pb-8 space-y-4 animate-fadeIn">
            {/* Header Box */}
            <div className="settings-group-card p-4 rounded-2xl bg-white border border-slate-200 space-y-1">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar size={16} className="text-indigo-500" />
                {t.exportHistoryTitle}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">{t.exportHistoryDesc}</p>
            </div>

            {/* Filter Mode & Year/Month Selectors */}
            <div className="settings-group-card p-4 rounded-2xl bg-white border border-slate-200 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  {t.exportPeriodFilterLabel}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'monthly', label: t.exportModeMonthly },
                      { id: 'annual', label: t.exportModeAnnual },
                      { id: 'all', label: t.exportModeAllTime },
                    ] as const
                  ).map((modeOpt) => (
                    <button
                      key={modeOpt.id}
                      type="button"
                      onClick={() => setExportPeriodMode(modeOpt.id)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        exportPeriodMode === modeOpt.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {modeOpt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Year & Entry Type Filters */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {exportPeriodMode !== 'all' && (
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      {t.exportYearLabel}
                    </label>
                    <select
                      value={exportYear}
                      onChange={(e) => setExportYear(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
                    >
                      {availableYears.map((yr) => (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className={exportPeriodMode === 'all' ? 'sm:col-span-2' : ''}>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    {t.exportEntryTypeLabel}
                  </label>
                  <select
                    value={exportTypeFilter}
                    onChange={(e) => setExportTypeFilter(e.target.value as ExportTypeFilter)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50"
                  >
                    <option value="all">{t.filterAllEntries}</option>
                    <option value="income">{t.filterInputsOnly}</option>
                    <option value="expense">{t.filterExpensesOnly}</option>
                  </select>
                </div>
              </div>

              {/* Interactive 12-Month Grid Selector (for Monthly mode) */}
              {exportPeriodMode === 'monthly' && (
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    {t.exportMonthLabel} ({exportYear})
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                    {Array.from({ length: 12 }, (_, idx) => {
                      const mNum = String(idx + 1).padStart(2, '0');
                      const dateObj = new Date(Number(exportYear), idx, 1);
                      const shortLabel = dateObj
                        .toLocaleDateString(language === 'pt-BR' ? 'pt-BR' : 'en-US', {
                          month: 'short',
                        })
                        .replace('.', '');
                      const isSelected = exportMonth === mNum;
                      const hasData = monthsWithEntriesInSelectedYear.has(mNum);

                      return (
                        <button
                          key={mNum}
                          type="button"
                          onClick={() => setExportMonth(mNum)}
                          className={`relative py-2 px-2 rounded-xl border text-xs font-bold capitalize transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : hasData
                              ? 'bg-white text-slate-800 border-slate-300 hover:border-indigo-400'
                              : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {shortLabel}
                          {hasData && (
                            <span
                              className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                                isSelected ? 'bg-white' : 'bg-emerald-500'
                              }`}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Live Filtered Summary Preview Card */}
            <div className="settings-group-card p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
                    {t.exportPreviewTitle}
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900">
                    {exportPreview.periodTitle}
                  </h4>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700">
                  {t.entriesCount(exportPreview.filteredTransactionsAsc.length)}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">
                    {t.exportOpeningBalance}
                  </p>
                  <p className="text-xs font-bold text-slate-800 mt-0.5">
                    {formatCurrency(exportPreview.openingBalance, state.settings.currency)}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <p className="text-[10px] font-semibold uppercase text-emerald-500">
                    {t.periodInputs}
                  </p>
                  <p className="text-xs font-bold text-emerald-500 mt-0.5">
                    +{formatCurrency(exportPreview.totalIncome, state.settings.currency)}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <p className="text-[10px] font-semibold uppercase text-rose-500">
                    {t.periodExpenses}
                  </p>
                  <p className="text-xs font-bold text-rose-500 mt-0.5">
                    -{formatCurrency(exportPreview.totalExpense, state.settings.currency)}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                  <p className="text-[10px] font-semibold uppercase text-indigo-400">
                    {t.exportClosingBalance}
                  </p>
                  <p className="text-xs font-bold text-slate-900 mt-0.5">
                    {formatCurrency(exportPreview.closingBalance, state.settings.currency)}
                  </p>
                </div>
              </div>

              {/* Mini stacked bar preview of expense categories */}
              {exportPreview.expenseByCategory.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-200">
                    {exportPreview.expenseByCategory.map((cat) => (
                      <div
                        key={cat.id}
                        style={{
                          width: `${Math.max(2, cat.share)}%`,
                          backgroundColor: cat.color,
                        }}
                        title={`${cat.name}: ${cat.share.toFixed(1)}%`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    {exportPreview.expenseByCategory.slice(0, 5).map((cat) => (
                      <span key={cat.id} className="inline-flex items-center gap-1 font-medium">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name} ({cat.share.toFixed(0)}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons: CSV and PDF Report */}
            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => exportFilteredHistoryToCSV(exportFilterOptions)}
                  className="min-h-[46px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-xs transition-all"
                >
                  <FileSpreadsheet size={16} className="text-emerald-500 shrink-0" />
                  {t.exportDownloadCsvBtn}
                </button>

                <button
                  type="button"
                  onClick={() => exportFilteredHistoryToPDF(exportFilterOptions)}
                  className="min-h-[46px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all"
                >
                  <FileText size={16} className="shrink-0" />
                  {t.exportDownloadPdfBtn}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 text-center leading-relaxed px-2">
                {t.exportPdfIncludesNote}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
