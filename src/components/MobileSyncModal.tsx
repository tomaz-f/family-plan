import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Smartphone,
  Wifi,
  Copy,
  Check,
  Download,
  Upload,
  Settings,
  Tag,
  Plus,
  Pencil,
  Trash2,
  Database,
  Sun,
  Moon,
  Sparkles,
  AlertTriangle,
  FileSpreadsheet,
  FileText,
  Calendar,
  Languages,
  Landmark,
  SlidersHorizontal,
  Contrast,
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

interface MobileSyncModalProps {
  isOpen: boolean;
  activeTabInitial?: 'mobile' | 'settings' | 'categories' | 'export' | 'backup';
  state: AppState;
  language: AppLanguage;
  theme: AppTheme;
  isOnlineWithServer: boolean;
  pendingOfflineCount: number;
  currentBankBalance?: number;
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
  onAddCategory: (cat: { name: string; type: TransactionType; color: string; icon: string }) => Promise<void>;
  onUpdateCategory: (
    id: string,
    cat: { name: string; type: TransactionType; color: string; icon: string }
  ) => Promise<void>;
  onDeleteCategory: (id: string) => Promise<void>;
  onImportBackup: (data: Partial<AppState>, mode: 'merge' | 'replace') => Promise<void>;
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

export const MobileSyncModal: React.FC<MobileSyncModalProps> = ({
  isOpen,
  activeTabInitial = 'mobile',
  state,
  language,
  theme,
  isOnlineWithServer,
  pendingOfflineCount,
  currentBankBalance,
  onOpenBalanceModal,
  onClose,
  onUpdateSettings,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onImportBackup,
  onResetAccount,
}) => {
  const t = TRANSLATIONS[language];
  const [tab, setTab] = useState<'mobile' | 'settings' | 'categories' | 'export' | 'backup'>(activeTabInitial);
  const [copied, setCopied] = useState(false);

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

  // Reset confirmation safety states
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInputText, setResetInputText] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);

  // Settings form state
  const [familyName, setFamilyName] = useState(state.settings.familyName);
  const [currency, setCurrency] = useState(state.settings.currency);
  const [selectedLang, setSelectedLang] = useState<AppLanguage>(language);
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>(theme);
  const [savingSettings, setSavingSettings] = useState(false);

  // Category create/edit state
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catType, setCatType] = useState<TransactionType>('expense');
  const [catColor, setCatColor] = useState('#6366f1');
  const [catIcon, setCatIcon] = useState<string>('Tag');

  // Backup import status
  const [importStatus, setImportStatus] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setTab(activeTabInitial);
      setFamilyName(state.settings.familyName);
      setCurrency(state.settings.currency);
      setSelectedLang(language);
      setSelectedTheme(theme);
    }
    // Only initialize when modal opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTabInitial]);

  useEffect(() => {
    setSelectedTheme(theme);
  }, [theme]);

  useEffect(() => {
    setSelectedLang(language);
  }, [language]);

  if (!isOpen) return null;

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
        familyName,
        currency,
        language: selectedLang,
        theme: selectedTheme,
      });
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
    const payload = {
      exportedAt: new Date().toISOString(),
      settings: state.settings,
      categories: state.categories,
      transactions: state.transactions,
      recurringTemplates: state.recurringTemplates,
      fuelLogs: state.fuelLogs || [],
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `familyplan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>, mode: 'merge' | 'replace') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        await onImportBackup(parsed, mode);
        setImportStatus(t.backupImportedSuccess);
        setTimeout(() => setImportStatus(''), 3000);
      } catch {
        setImportStatus(t.backupInvalidError);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <Smartphone size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t.modalHeaderTitle}</h2>
              <p className="text-xs text-slate-500">
                {isOnlineWithServer ? t.connectedToSqlite : t.offlineModeActive}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-5 gap-1 p-2 bg-slate-50 border-b border-slate-200/80 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setTab('settings')}
            className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg transition-all ${
              tab === 'settings' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Settings size={14} className="shrink-0" />
            <span className="truncate">{t.tabPreferences}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('categories')}
            className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg transition-all ${
              tab === 'categories' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Tag size={14} className="shrink-0" />
            <span className="truncate">{t.tabCategories}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('export')}
            className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg transition-all ${
              tab === 'export' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <FileText size={14} className="shrink-0" />
            <span className="truncate">{t.tabExport}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('mobile')}
            className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg transition-all ${
              tab === 'mobile' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Wifi size={14} className="shrink-0" />
            <span className="truncate">{t.tabWifiPhone}</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('backup')}
            className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-lg transition-all ${
              tab === 'backup' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200/60'
            }`}
          >
            <Database size={14} className="shrink-0" />
            <span className="truncate">{t.tabBackup}</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {tab === 'mobile' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                {state.networkInfo?.qrCodeDataUrl ? (
                  <img
                    src={state.networkInfo.qrCodeDataUrl}
                    alt="Scan to open on phone"
                    className="w-40 h-40 rounded-xl border border-slate-200 bg-white p-2 shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-40 h-40 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-xs text-slate-400 text-center p-4">
                    QR Code
                  </div>
                )}

                <div className="space-y-2.5 text-center sm:text-left">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                    <Wifi size={13} />
                    {t.localHomeWifiSync}
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">{t.openOnYourPhone}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{t.openOnPhoneDesc}</p>

                  <div className="flex items-center gap-2 pt-1">
                    <code className="flex-1 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-mono font-semibold text-slate-800 select-all">
                      {primaryUrl}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      {copied ? t.copiedBtn : t.copyBtn}
                    </button>
                  </div>
                </div>
              </div>

              {state.networkInfo?.lanUrls && state.networkInfo.lanUrls.length > 1 && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                  <p className="font-semibold text-slate-700">{t.availableAdapters}</p>
                  {state.networkInfo.lanUrls.map((item) => (
                    <div key={item.url} className="flex items-center justify-between text-slate-600">
                      <span>{item.name}</span>
                      <code className="font-mono font-semibold text-slate-800">{item.url}</code>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-900">{t.installOnPhoneTitle}</p>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-line">{t.installOnPhoneBody}</p>
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-900">{t.installOnWindowsTitle}</p>
                  <p className="text-slate-600 leading-relaxed whitespace-pre-line">{t.installOnWindowsBody}</p>
                </div>
              </div>

              {pendingOfflineCount > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 font-medium">
                  {t.offlineQueuedAlert(pendingOfflineCount)}
                </div>
              )}
            </div>
          )}

          {tab === 'categories' && (
            <div className="space-y-4">
              <form
                onSubmit={handleSaveCategory}
                className={`p-4 rounded-2xl border space-y-3.5 transition-colors ${
                  editingCategoryId
                    ? 'bg-indigo-50/40 border-indigo-300'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
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
                    className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                  />
                  <select
                    value={catType}
                    onChange={(e) => setCatType(e.target.value as TransactionType)}
                    className="px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white font-medium"
                  >
                    <option value="expense">{t.expenseCategoryOpt}</option>
                    <option value="income">{t.incomeCategoryOpt}</option>
                  </select>
                </div>

                {/* Color Picker */}
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t.chooseColorLabel}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCatColor(c)}
                        className={`w-7 h-7 rounded-full transition-transform ${
                          catColor === c ? 'scale-110 ring-2 ring-offset-2 ring-slate-900' : 'opacity-85 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                {/* Visual Icon Picker Grid (shows actual icons instead of 'Icon: Tag' text!) */}
                <div>
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t.chooseIconLabel}
                  </span>
                  <div className="grid grid-cols-9 sm:grid-cols-13 gap-1.5 p-2 rounded-xl bg-white border border-slate-200 max-h-32 overflow-y-auto">
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
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                  >
                    {editingCategoryId ? <Check size={14} /> : <Plus size={14} />}
                    {editingCategoryId ? t.updateCategoryBtn : t.addCategoryBtn}
                  </button>
                  {editingCategoryId && (
                    <button
                      type="button"
                      onClick={handleCancelEditCategory}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100"
                    >
                      {t.cancelEditBtn}
                    </button>
                  )}
                </div>
              </form>

              {/* Category List with Edit & Delete on EVERY Category */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {state.categories.map((cat: Category) => {
                  const isBeingEdited = editingCategoryId === cat.id;
                  return (
                    <div
                      key={cat.id}
                      className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                        isBeingEdited
                          ? 'border-indigo-400 bg-indigo-50/30'
                          : 'border-slate-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CategoryIcon icon={cat.icon} color={cat.color} size={16} badgeSize="sm" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate">
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
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title={t.editCategoryTooltip}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteCategory(cat.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
          )}

          {tab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  {t.familyAccountTitleLabel}
                </label>
                <input
                  type="text"
                  required
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t.appLanguageLabel}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLang('pt-BR');
                        onUpdateSettings({ language: 'pt-BR' });
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        selectedLang === 'pt-BR'
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Languages size={15} />
                      <span>Português</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLang('en');
                        onUpdateSettings({ language: 'en' });
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        selectedLang === 'en'
                          ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Languages size={15} />
                      <span>English</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    {t.displayCurrencyLabel}
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Theme Picker Cards */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  {t.appThemeLabel}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTheme('light');
                      onUpdateSettings({ theme: 'light' });
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      selectedTheme === 'light'
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Sun size={15} />
                    {t.themeLight}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTheme('dark');
                      onUpdateSettings({ theme: 'dark' });
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      selectedTheme === 'dark'
                        ? 'border-slate-900 bg-slate-900 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Moon size={15} />
                    {t.themeDark}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTheme('tokyo-night');
                      onUpdateSettings({ theme: 'tokyo-night' });
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      selectedTheme === 'tokyo-night'
                        ? 'border-indigo-500 bg-[#1a1b26] text-[#7aa2f7] shadow-sm'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Sparkles size={15} />
                    {t.themeTokyo}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTheme('oled');
                      onUpdateSettings({ theme: 'oled' });
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                      selectedTheme === 'oled'
                        ? 'border-blue-500 bg-[#000000] text-white shadow-sm ring-1 ring-blue-500/60'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                    title={t.themeOled}
                  >
                    <Contrast size={15} className="text-blue-400" />
                    <span>OLED</span>
                  </button>
                </div>
              </div>

              {/* Bank Balance Setting / Adjustment Section */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                      <Landmark size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider truncate">
                        {t.bankAccountBalanceTitle}
                      </h4>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                        {typeof currentBankBalance === 'number' && (
                          <span>
                            {t.currentBankBalance}:{' '}
                            <strong className="text-slate-800 font-bold">
                              {formatCurrency(currentBankBalance, currency)}
                            </strong>
                          </span>
                        )}
                        <span>•</span>
                        <span>
                          {t.startingBase}:{' '}
                          <strong className="text-slate-700">
                            {formatCurrency(state.settings.initialBalance ?? 0, currency)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {onOpenBalanceModal && (
                    <button
                      type="button"
                      onClick={() => onOpenBalanceModal()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-800 transition-colors shadow-xs shrink-0"
                      title={t.setAdjustBalance}
                    >
                      <SlidersHorizontal size={13} />
                      <span>{t.setAdjustBalance}</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {t.syncWithRealBankSub}
                </p>
              </div>

              {state.networkInfo?.dbPath && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                  <p className="font-semibold text-slate-800 mb-1">{t.localSqliteDbFile}</p>
                  <code className="font-mono text-[11px] break-all">{state.networkInfo.dbPath}</code>
                </div>
              )}

              <button
                type="submit"
                disabled={savingSettings}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
              >
                {savingSettings ? t.savingBtn : t.savePreferencesBtn}
              </button>

              {/* Safety-Protected Reset Account History Section */}
              <div className="pt-4 mt-4 border-t border-slate-200">
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={18} className="text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-rose-500">{t.resetHistoryTitle}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">{t.resetHistoryDesc}</p>
                    </div>
                  </div>

                  {!showResetConfirm ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowResetConfirm(true);
                        setResetInputText('');
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-colors"
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
            </form>
          )}

          {tab === 'export' && (
            <div className="space-y-4">
              {/* Header Box */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Calendar size={16} className="text-indigo-500" />
                  {t.exportHistoryTitle}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">{t.exportHistoryDesc}</p>
              </div>

              {/* Filter Mode & Year/Month Selectors */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
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
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                        {t.exportYearLabel}
                      </label>
                      <select
                        value={exportYear}
                        onChange={(e) => setExportYear(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
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
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                      {t.exportEntryTypeLabel}
                    </label>
                    <select
                      value={exportTypeFilter}
                      onChange={(e) => setExportTypeFilter(e.target.value as ExportTypeFilter)}
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold bg-white"
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
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
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
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">
                      {t.exportPreviewTitle}
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      {exportPreview.periodTitle}
                    </h4>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-xs font-bold text-slate-700">
                    {t.entriesCount(exportPreview.filteredTransactionsAsc.length)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                    <p className="text-[10px] font-semibold uppercase text-slate-400">
                      {t.exportOpeningBalance}
                    </p>
                    <p className="text-xs font-bold text-slate-800 mt-0.5">
                      {formatCurrency(exportPreview.openingBalance, state.settings.currency)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                    <p className="text-[10px] font-semibold uppercase text-emerald-600">
                      {t.periodInputs}
                    </p>
                    <p className="text-xs font-bold text-emerald-600 mt-0.5">
                      +{formatCurrency(exportPreview.totalIncome, state.settings.currency)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                    <p className="text-[10px] font-semibold uppercase text-rose-600">
                      {t.periodExpenses}
                    </p>
                    <p className="text-xs font-bold text-rose-600 mt-0.5">
                      -{formatCurrency(exportPreview.totalExpense, state.settings.currency)}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                    <p className="text-[10px] font-semibold uppercase text-indigo-600">
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
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
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

              {/* Action Buttons: CSV and PDF Report + Charts */}
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => exportFilteredHistoryToCSV(exportFilterOptions)}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-sm transition-all"
                  >
                    <FileSpreadsheet size={16} className="text-emerald-600 shrink-0" />
                    {t.exportDownloadCsvBtn}
                  </button>

                  <button
                    type="button"
                    onClick={() => exportFilteredHistoryToPDF(exportFilterOptions)}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition-all"
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

          {tab === 'backup' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <h3 className="text-sm font-bold text-slate-900">{t.exportFullBackupTitle}</h3>
                <p className="text-xs text-slate-600">{t.exportFullBackupDesc}</p>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  <Download size={15} />
                  {t.downloadBackupBtn}
                </button>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <h3 className="text-sm font-bold text-slate-900">{t.restoreImportTitle}</h3>
                <p className="text-xs text-slate-600">{t.restoreImportDesc}</p>
                <div className="flex flex-wrap gap-2.5 pt-1">
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold cursor-pointer hover:bg-slate-100">
                    <Upload size={15} />
                    {t.mergeBackupBtn}
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={(e) => handleFileImport(e, 'merge')}
                    />
                  </label>
                  <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold cursor-pointer hover:bg-rose-100">
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
                {importStatus && <p className="text-xs font-semibold text-emerald-600 pt-1">{importStatus}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
