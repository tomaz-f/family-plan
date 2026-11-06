import React, { useMemo, useState } from 'react';
import { Calendar } from 'lucide-react';
import { AppLanguage, AppState } from '../../types';
import {
  computeExportData,
  exportFilteredHistoryToCSV,
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
            ? 'Relatório PDF baixado com sucesso!'
            : 'PDF Report downloaded successfully!',
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

      <ExportPreviewCard
        language={language}
        currency={state.settings.currency}
        exportPreview={exportPreview}
        isGeneratingPdf={isGeneratingPdf}
        pdfToast={pdfToast}
        onDownloadCSV={() => exportFilteredHistoryToCSV(exportFilterOptions)}
        onDownloadPDF={handleDownloadPDF}
      />
    </div>
  );
};
