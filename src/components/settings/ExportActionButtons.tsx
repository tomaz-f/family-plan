import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
} from 'lucide-react';
import { AppLanguage } from '../../types';

export interface ExportActionButtonsProps {
  language: AppLanguage;
  isGeneratingPdf: boolean;
  pdfToast: { type: 'success' | 'error'; message: string } | null;
  onDownloadPDF: () => void;
  onDownloadODS: () => void;
  onDownloadCSV: () => void;
}

export const ExportActionButtons: React.FC<ExportActionButtonsProps> = ({
  language,
  isGeneratingPdf,
  pdfToast,
  onDownloadPDF,
  onDownloadODS,
  onDownloadCSV,
}) => {
  const isPt = language === 'pt-BR';

  return (
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
  );
};
