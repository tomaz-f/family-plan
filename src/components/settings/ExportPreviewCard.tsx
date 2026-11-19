import React from 'react';
import {
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
}

export const ExportPreviewCard: React.FC<ExportPreviewCardProps> = ({
  language,
  currency,
  exportPreview,
}) => {
  const t = TRANSLATIONS[language];
  const isPt = language === 'pt-BR';

  return (
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
  );
};
