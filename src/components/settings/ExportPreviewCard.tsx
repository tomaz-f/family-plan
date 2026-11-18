import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
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
  onDownloadODS: () => void;
  onDownloadCSV: () => void;
  onDownloadPDF: () => void;
}

export const ExportPreviewCard: React.FC<ExportPreviewCardProps> = ({
  language,
  currency,
  exportPreview,
  isGeneratingPdf,
  pdfToast,
  onDownloadODS,
  onDownloadCSV,
  onDownloadPDF,
}) => {
  const t = TRANSLATIONS[language];
  const isPt = language === 'pt-BR';

  return (
    <div className="space-y-3.5">
      {/* Period Summary Preview Card */}
      <div className="rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] p-3.5 sm:p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate capitalize">
              {exportPreview.periodTitle}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.exportPreviewTitle}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#161B22] border border-slate-200/80 dark:border-[#21262D] text-[11px] font-bold text-slate-700 dark:text-slate-300 shrink-0">
            {t.entriesCount(exportPreview.filteredTransactionsAsc.length)}
          </span>
        </div>

        {/* 2x2 Mini-Cards Grid matching DashboardView anatomy */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* 1. Saldo Inicial */}
          <div className="p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-slate-50/60 dark:bg-[#161B22]/60 flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-full bg-blue-500/10 dark:bg-blue-500/15 flex items-center justify-center shrink-0">
              <Wallet size={15} className="text-blue-600 dark:text-blue-400" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate leading-tight">
                {t.exportOpeningBalance}
              </p>
              <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate mt-0.5 tabular-nums">
                {formatCurrency(exportPreview.openingBalance, currency)}
              </p>
            </div>
          </div>

          {/* 2. Entradas (Consolidado + Pendente) */}
          <div className="p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-slate-50/60 dark:bg-[#161B22]/60 flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
              <TrendingUp size={15} className="text-[#10B981]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate leading-tight">
                {t.periodInputs}
              </p>
              <p className="text-xs sm:text-sm font-black text-[#10B981] truncate mt-0.5 tabular-nums">
                +{formatCurrency(exportPreview.totalIncome, currency)}
              </p>
              <p className="text-xs font-semibold text-emerald-600/90 dark:text-emerald-400/90 truncate mt-0.5 tabular-nums">
                {isPt ? 'Pendente' : 'Pending'}: +{formatCurrency(exportPreview.pendingIncome, currency)}
              </p>
            </div>
          </div>

          {/* 3. Despesas (Consolidado + Pendente) */}
          <div className="p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-slate-50/60 dark:bg-[#161B22]/60 flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-full bg-red-500/10 dark:bg-red-500/15 flex items-center justify-center shrink-0">
              <TrendingDown size={15} className="text-[#EF4444]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate leading-tight">
                {t.periodExpenses}
              </p>
              <p className="text-xs sm:text-sm font-black text-[#EF4444] truncate mt-0.5 tabular-nums">
                -{formatCurrency(exportPreview.totalExpense, currency)}
              </p>
              <p className="text-xs font-semibold text-red-500/90 dark:text-red-400/90 truncate mt-0.5 tabular-nums">
                {isPt ? 'Pendente' : 'Pending'}: -{formatCurrency(exportPreview.pendingExpense, currency)}
              </p>
            </div>
          </div>

          {/* 4. Saldo Projetado (Projetado + Consolidado) */}
          <div className="p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-slate-50/60 dark:bg-[#161B22]/60 flex items-center gap-2.5 min-w-0">
            <span className="w-8 h-8 rounded-full bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Scale size={15} className="text-amber-600 dark:text-amber-400" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate leading-tight">
                {isPt ? 'Saldo Projetado' : 'Projected Balance'}
              </p>
              <p
                className={`text-xs sm:text-sm font-black truncate mt-0.5 tabular-nums ${
                  exportPreview.projectedBalance >= 0
                    ? 'text-[#10B981]'
                    : 'text-[#EF4444]'
                }`}
              >
                {formatCurrency(exportPreview.projectedBalance, currency)}
              </p>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5 tabular-nums">
                {isPt ? 'Consolidado' : 'Consolidated'}: {formatCurrency(exportPreview.closingBalance, currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Proportional Category Bar */}
        {exportPreview.expenseByCategory.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="h-2.5 w-full rounded-full overflow-hidden flex bg-slate-100 dark:bg-[#161B22]">
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
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
              {exportPreview.expenseByCategory.slice(0, 5).map((cat) => (
                <span key={cat.id} className="inline-flex items-center gap-1 font-medium">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="truncate max-w-[110px]">{cat.name}</span>
                  <span>({cat.share.toFixed(0)}%)</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Redesigned Export Action Area (3 Formats, Zero Clutter) */}
      <div className="space-y-2.5">
        {/* Primary Full-Width CTA: PDF */}
        <button
          type="button"
          onClick={onDownloadPDF}
          disabled={isGeneratingPdf}
          className="h-11 w-full rounded-xl bg-[#6E5440] hover:bg-[#5c4534] text-white font-bold text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer select-none disabled:opacity-75 disabled:cursor-wait"
        >
          {isGeneratingPdf ? (
            <>
              <Loader2 size={16} className="animate-spin shrink-0 text-white" />
              <span>{isPt ? 'Gerando PDF...' : 'Generating PDF...'}</span>
            </>
          ) : (
            <>
              <FileText size={16} className="shrink-0" />
              <span>{isPt ? 'Baixar Relatório PDF (.pdf)' : 'Download PDF Report (.pdf)'}</span>
            </>
          )}
        </button>

        {/* Secondary 2-Column Row: ODS & CSV */}
        <div className="grid grid-cols-2 gap-2.5 w-full">
          <button
            type="button"
            onClick={onDownloadODS}
            className="h-10 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] hover:bg-slate-50 dark:hover:bg-[#161B22] text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer select-none"
          >
            <FileSpreadsheet size={15} className="text-[#10B981] shrink-0" />
            <span>{isPt ? 'Planilha ODS (.ods)' : 'ODS Sheet (.ods)'}</span>
          </button>

          <button
            type="button"
            onClick={onDownloadCSV}
            className="h-10 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] hover:bg-slate-50 dark:hover:bg-[#161B22] text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 shadow-sm transition-colors cursor-pointer select-none"
          >
            <FileSpreadsheet size={15} className="text-[#10B981] shrink-0" />
            <span>{isPt ? 'Planilha CSV (.csv)' : 'CSV Sheet (.csv)'}</span>
          </button>
        </div>

        {pdfToast && (
          <div
            className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold animate-fadeIn ${
              pdfToast.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/20 text-[#10B981]'
                : 'bg-red-500/10 border border-red-500/20 text-[#EF4444]'
            }`}
          >
            {pdfToast.type === 'success' ? (
              <CheckCircle2 size={15} className="shrink-0 text-[#10B981]" />
            ) : (
              <AlertCircle size={15} className="shrink-0 text-[#EF4444]" />
            )}
            <span>{pdfToast.message}</span>
          </div>
        )}
      </div>
    </div>
  );
};
