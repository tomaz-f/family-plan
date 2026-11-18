import React, { useMemo, useState } from 'react';
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
import { ExportPreviewCard } from './ExportPreviewCard';

interface DataExportSectionProps {
  state: AppState;
  language: AppLanguage;
}

export const DataExportSection: React.FC<DataExportSectionProps> = ({ state, language }) => {
  const t = TRANSLATIONS[language];

  const currentYearStr = String(new Date().getFullYear());
  const currentMonthNum = String(new Date().getMonth() + 1).padStart(2, '0');
  const [exportPeriodMode, setExportPeriodMode] = useState<ExportPeriodMode>('monthly');
  const [exportYear, setExportYear] = useState<string>(currentYearStr);
  const [exportMonth, setExportMonth] = useState<string>(currentMonthNum);
  const [exportTypeFilter, setExportTypeFilter] = useState<ExportTypeFilter>('all');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [pdfToast, setPdfToast] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

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
      creditCards: state.creditCards || [],
      recurringTemplates: state.recurringTemplates || [],
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
      state.creditCards,
      state.recurringTemplates,
      state.fuelLogs,
      language,
    ]
  );

  const exportPreview = useMemo(
    () => computeExportData(exportFilterOptions),
    [exportFilterOptions]
  );

  const handleDownloadPDF = async () => {
    if (isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    setPdfToast(null);
    try {
      await new Promise((r) => setTimeout(r, 60));
      await exportFilteredHistoryToPDF(exportFilterOptions);
      setPdfToast({
        type: 'success',
        message:
          language === 'pt-BR'
            ? 'Relatório PDF preparado com sucesso!'
            : 'PDF Report prepared successfully!',
      });
      setTimeout(() => setPdfToast(null), 4000);
    } catch (err) {
      console.error('Failed to export PDF:', err);
      setPdfToast({
        type: 'error',
        message:
          language === 'pt-BR'
            ? 'Não foi possível gerar o PDF. Tente novamente.'
            : 'Could not generate PDF. Please try again.',
      });
      setTimeout(() => setPdfToast(null), 5000);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div className="px-4 pt-4 pb-8 space-y-3.5 animate-fadeIn">
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
                  className={`h-10 px-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-[#6E5440] border-[#6E5440] text-white shadow-xs'
                      : 'bg-slate-50 dark:bg-[#161B22] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-[#21262D] hover:bg-slate-100 dark:hover:bg-[#21262D]'
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
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
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
                    className={`relative h-9 px-2 rounded-xl border text-xs font-bold capitalize transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-[#6E5440] text-white border-[#6E5440] shadow-xs'
                        : 'bg-slate-50 dark:bg-[#161B22] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-[#21262D] hover:bg-slate-100 dark:hover:bg-[#21262D]'
                    }`}
                  >
                    {shortLabel}
                    {hasData && (
                      <span
                        className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-white' : 'bg-[#10B981]'
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

      <ExportPreviewCard
        language={language}
        currency={state.settings.currency}
        exportPreview={exportPreview}
        isGeneratingPdf={isGeneratingPdf}
        pdfToast={pdfToast}
        onDownloadODS={() => exportFilteredHistoryToODS(exportFilterOptions)}
        onDownloadCSV={() => exportFilteredHistoryToCSV(exportFilterOptions)}
        onDownloadPDF={handleDownloadPDF}
      />
    </div>
  );
};
