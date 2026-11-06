import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';
import { AppLanguage } from '../../types';
import { ComputedExportData } from '../../utils/exportReport';
import { formatCurrency } from '../../utils/format';
import { TRANSLATIONS } from '../../utils/i18n';

interface ExportPreviewCardProps {
  language: AppLanguage;
  currency: string;
  exportPreview: ComputedExportData;
  isGeneratingPdf: boolean;
  pdfToast: { type: 'success' | 'error'; message: string } | null;
  onDownloadCSV: () => void;
  onDownloadPDF: () => void;
}

export const ExportPreviewCard: React.FC<ExportPreviewCardProps> = ({
  language,
  currency,
  exportPreview,
  isGeneratingPdf,
  pdfToast,
  onDownloadCSV,
  onDownloadPDF,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <>
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
              {formatCurrency(exportPreview.openingBalance, currency)}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="text-[10px] font-semibold uppercase text-emerald-500">
              {t.periodInputs}
            </p>
            <p className="text-xs font-bold text-emerald-500 mt-0.5">
              +{formatCurrency(exportPreview.totalIncome, currency)}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="text-[10px] font-semibold uppercase text-rose-500">
              {t.periodExpenses}
            </p>
            <p className="text-xs font-bold text-rose-500 mt-0.5">
              -{formatCurrency(exportPreview.totalExpense, currency)}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
            <p className="text-[10px] font-semibold uppercase text-indigo-400">
              {t.exportClosingBalance}
            </p>
            <p className="text-xs font-bold text-slate-900 mt-0.5">
              {formatCurrency(exportPreview.closingBalance, currency)}
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
            onClick={onDownloadCSV}
            className="min-h-[46px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-bold shadow-xs transition-all"
          >
            <FileSpreadsheet size={16} className="text-emerald-500 shrink-0" />
            {t.exportDownloadCsvBtn}
          </button>

          <button
            type="button"
            onClick={onDownloadPDF}
            disabled={isGeneratingPdf}
            className="min-h-[46px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#6E5440] hover:bg-[#7E624B] text-white text-xs font-bold shadow-xs transition-all disabled:opacity-75 disabled:cursor-wait"
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 size={16} className="animate-spin shrink-0 text-white" />
                <span>{language === 'pt-BR' ? 'Gerando PDF...' : 'Generating PDF...'}</span>
              </>
            ) : (
              <>
                <FileText size={16} className="shrink-0" />
                <span>{t.exportDownloadPdfBtn}</span>
              </>
            )}
          </button>
        </div>

        {pdfToast && (
          <div
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold animate-fadeIn ${
              pdfToast.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400'
            }`}
          >
            {pdfToast.type === 'success' ? (
              <CheckCircle2 size={15} className="shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle size={15} className="shrink-0 text-red-500" />
            )}
            <span>{pdfToast.message}</span>
          </div>
        )}

        <p className="text-[11px] text-slate-500 text-center leading-relaxed px-2">
          {t.exportPdfIncludesNote}
        </p>
      </div>
    </>
  );
};
