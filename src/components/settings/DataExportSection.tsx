import React, { useMemo, useState } from 'react';
import { ArrowLeft, Download, Settings } from 'lucide-react';
import { AppLanguage, AppState } from '../../types';
import {
  computeExportData,
  exportFilteredHistoryToCSV,
  exportFilteredHistoryToODS,
  exportFilteredHistoryToPDF,
  ExportPeriodMode,
  ExportTypeFilter,
} from '../../utils/exportReport';
import { TRANSLATIONS } from '../../utils/i18n';
import { ExportActionButtons } from './ExportActionButtons';
import { ExportDesktopPreviewTable } from './ExportDesktopPreviewTable';
import { ExportPreviewCard } from './ExportPreviewCard';

interface DataExportSectionProps {
  state: AppState;
  language: AppLanguage;
  embedded?: boolean;
  onNavigateSettings?: () => void;
  onBackMobile?: () => void;
}

export const DataExportSection: React.FC<DataExportSectionProps> = ({
  state,
  language,
  embedded = false,
  onNavigateSettings,
  onBackMobile,
}) => {
  const t = TRANSLATIONS[language];
  const isPt = language === 'pt-BR';
  const currentYearStr = String(new Date().getFullYear());
  const currentMonthNum = String(new Date().getMonth() + 1).padStart(2, '0');

  const [exportPeriodMode, setExportPeriodMode] = useState<ExportPeriodMode>('monthly');
  const [exportYear, setExportYear] = useState<string>(currentYearStr);
  const [exportMonth, setExportMonth] = useState<string>(currentMonthNum);
  const [exportTypeFilter, setExportTypeFilter] = useState<ExportTypeFilter>('all');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfToast, setPdfToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>([currentYearStr, String(Number(currentYearStr) - 1)]);
    for (const tx of state.transactions) {
      if (tx.date && tx.date.length >= 4) yearsSet.add(tx.date.slice(0, 4));
    }
    return Array.from(yearsSet).sort().reverse();
  }, [state.transactions, currentYearStr]);

  const monthsWithEntriesInSelectedYear = useMemo(() => {
    const set = new Set<string>();
    for (const tx of state.transactions) {
      if (tx.date.startsWith(`${exportYear}-`)) set.add(tx.date.slice(5, 7));
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
      creditCards: state.creditCards || [],
      recurringTemplates: state.recurringTemplates || [],
      fuelLogs: state.fuelLogs || [],
    }),
    [
      exportPeriodMode, exportYear, exportMonth, exportTypeFilter,
      state.settings.familyName, state.settings.currency, state.settings.initialBalance,
      state.categories, state.transactions, state.creditCards, state.recurringTemplates, state.fuelLogs, language,
    ]
  );

  const exportPreview = useMemo(() => computeExportData(exportFilterOptions), [exportFilterOptions]);

  const handleDownloadPDF = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfToast(null);
    try {
      await new Promise((r) => setTimeout(r, 60));
      await exportFilteredHistoryToPDF(exportFilterOptions);
      setPdfToast({
        type: 'success',
        message: isPt ? 'Relatório PDF preparado com sucesso!' : 'PDF Report prepared successfully!',
      });
      setTimeout(() => setPdfToast(null), 4000);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      setPdfToast({
        type: 'error',
        message: isPt ? 'Não foi possível gerar o PDF. Tente novamente.' : 'Could not generate PDF. Please try again.',
      });
      setTimeout(() => setPdfToast(null), 5000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const actionButtonsProps = {
    language,
    isGeneratingPdf,
    pdfToast,
    onDownloadPDF: handleDownloadPDF,
    onDownloadODS: () => exportFilteredHistoryToODS(exportFilterOptions),
    onDownloadCSV: () => exportFilteredHistoryToCSV(exportFilterOptions),
  };

  return (
    <div className={embedded ? 'space-y-4 pb-8 lg:pb-2 animate-fadeIn' : 'px-4 pt-4 pb-8 space-y-3.5 animate-fadeIn'}>
      {embedded && (
        <>
          <div className="lg:hidden flex items-center justify-between gap-2 pb-1">
            <div className="flex items-center gap-2 min-w-0">
              {onBackMobile && (
                <button
                  type="button"
                  onClick={onBackMobile}
                  className="min-h-[44px] min-w-[44px] rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] hover:bg-slate-50 dark:hover:bg-[#161B22] flex items-center justify-center text-slate-700 dark:text-slate-200 transition-colors cursor-pointer shrink-0"
                  aria-label={isPt ? 'Voltar' : 'Back'}
                >
                  <ArrowLeft size={18} />
                </button>
              )}
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white truncate">
                {isPt ? 'Exportar Dados' : 'Export Data'}
              </h2>
            </div>
            {onNavigateSettings && (
              <button
                type="button"
                onClick={onNavigateSettings}
                className="min-h-[44px] px-3 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] hover:bg-slate-50 dark:hover:bg-[#161B22] text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Settings size={14} className="shrink-0" />
                <span>{isPt ? 'Todas Config.' : 'All Settings'}</span>
              </button>
            )}
          </div>

          <div className="hidden lg:flex items-center justify-between gap-4 pb-1">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#6E5440]/10 dark:bg-[#6E5440]/20 flex items-center justify-center shrink-0">
                <Download size={20} className="text-[#6E5440] dark:text-[#D0B595]" />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-extrabold text-slate-900 dark:text-white truncate">
                  {isPt ? 'Exportar Dados' : 'Export Data'}
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {isPt
                    ? 'Exporte relatórios executivos em PDF e planilhas ODS ou CSV'
                    : 'Export executive PDF reports and ODS or CSV spreadsheets'}
                </p>
              </div>
            </div>
            {onNavigateSettings && (
              <button
                type="button"
                onClick={onNavigateSettings}
                className="min-h-[40px] px-3.5 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] hover:bg-slate-50 dark:hover:bg-[#161B22] text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer shrink-0 transition-colors"
              >
                <Settings size={15} className="shrink-0" />
                <span>{isPt ? 'Todas Config.' : 'All Settings'}</span>
              </button>
            )}
          </div>
        </>
      )}

      <div className={embedded ? 'grid grid-cols-1 lg:grid-cols-12 gap-3.5 lg:gap-6 items-start' : 'space-y-3.5'}>
        <div className={embedded ? 'lg:col-span-6 xl:col-span-5 space-y-3.5 lg:space-y-4 min-w-0' : 'space-y-3.5'}>
          {/* Period Filter Card */}
          <div className="rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] p-3.5 sm:p-4 shadow-sm space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                {t.exportPeriodFilterLabel}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'monthly', label: t.exportModeMonthly },
                    { id: 'annual', label: t.exportModeAnnual },
                    { id: 'all', label: t.exportModeAllTime },
                  ] as const
                ).map((modeOpt) => {
                  const isSelected = exportPeriodMode === modeOpt.id;
                  return (
                    <button
                      key={modeOpt.id}
                      type="button"
                      onClick={() => setExportPeriodMode(modeOpt.id)}
                      className={`min-h-[44px] py-1.5 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                        isSelected
                          ? 'bg-[#6E5440] border-[#6E5440] text-white shadow-xs'
                          : 'bg-slate-50 dark:bg-[#161B22] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-[#21262D] hover:bg-slate-200/70 dark:hover:bg-[#21262D]'
                      }`}
                    >
                      {modeOpt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Year & Transaction Type Dropdowns */}
            <div className="grid grid-cols-2 gap-2.5">
              {exportPeriodMode !== 'all' && (
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    {t.exportYearLabel}
                  </label>
                  <select
                    value={exportYear}
                    onChange={(e) => setExportYear(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-slate-50 dark:bg-[#161B22] text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>{yr}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className={exportPeriodMode === 'all' ? 'col-span-2' : ''}>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  {t.exportEntryTypeLabel}
                </label>
                <select
                  value={exportTypeFilter}
                  onChange={(e) => setExportTypeFilter(e.target.value as ExportTypeFilter)}
                  className="w-full h-10 px-3 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-slate-50 dark:bg-[#161B22] text-xs font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="all">{t.filterAllEntries}</option>
                  <option value="income">{t.filterInputsOnly}</option>
                  <option value="expense">{t.filterExpensesOnly}</option>
                </select>
              </div>
            </div>

            {/* Compact 12-Month Pill Grid (Monthly mode) */}
            {exportPeriodMode === 'monthly' && (
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  {t.exportMonthLabel} ({exportYear})
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {Array.from({ length: 12 }, (_, idx) => {
                    const mNum = String(idx + 1).padStart(2, '0');
                    const shortLabel = new Date(Number(exportYear), idx, 1)
                      .toLocaleDateString(isPt ? 'pt-BR' : 'en-US', { month: 'short' })
                      .replace('.', '');
                    const isSelected = exportMonth === mNum;
                    const hasData = monthsWithEntriesInSelectedYear.has(mNum);

                    return (
                      <button
                        key={mNum}
                        type="button"
                        onClick={() => setExportMonth(mNum)}
                        className={`relative h-9 px-2 rounded-xl border text-xs font-bold capitalize transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-[#6E5440] text-white border-[#6E5440] shadow-xs'
                            : 'bg-slate-50 dark:bg-[#161B22] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-[#21262D] hover:bg-slate-200/70 dark:hover:bg-[#21262D]'
                        }`}
                      >
                        {shortLabel}
                        {hasData && (
                          <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-[#10B981]'}`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {embedded && (
            <div className="hidden lg:block">
              <ExportActionButtons {...actionButtonsProps} />
            </div>
          )}
        </div>

        <div className={embedded ? 'lg:col-span-6 xl:col-span-7 space-y-3.5 lg:space-y-4 min-w-0' : 'space-y-3.5'}>
          <ExportPreviewCard language={language} currency={state.settings.currency} exportPreview={exportPreview} />
          {embedded && (
            <ExportDesktopPreviewTable
              language={language}
              currency={state.settings.currency}
              categories={state.categories}
              exportPreview={exportPreview}
            />
          )}
          {embedded ? (
            <div className="lg:hidden">
              <ExportActionButtons {...actionButtonsProps} />
            </div>
          ) : (
            <ExportActionButtons {...actionButtonsProps} />
          )}
        </div>
      </div>
    </div>
  );
};
