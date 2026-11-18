import React, { useMemo } from 'react';
import { Scale } from 'lucide-react';
import { AppLanguage } from '../../types';
import { formatCurrency } from '../../utils/format';
import { BudgetRigiditySummary } from '../../utils/reportAggregators';

export interface BudgetRigidityChartProps {
  summary: BudgetRigiditySummary;
  currency: string;
  language: AppLanguage;
  isOled: boolean;
}

export const BudgetRigidityChart: React.FC<BudgetRigidityChartProps> = React.memo(
  ({ summary, currency, language, isOled }) => {
    const isPt = language === 'pt-BR';

    const metrics = useMemo(() => {
      const hasBase = summary.totalBudgetBase > 0;
      const fixedBarWidth = Math.max(hasBase ? summary.fixedPct : 50, 8);
      const variableBarWidth = Math.max(hasBase ? summary.variablePct : 50, 8);
      const isHealthy = summary.fixedPct <= 55;

      return {
        fixedBarWidth,
        variableBarWidth,
        isHealthy,
        fixedFormatted: formatCurrency(summary.fixedAmount, currency),
        variableFormatted: formatCurrency(summary.variableAmount, currency),
        fixedCountLabel: isPt
          ? summary.fixedCount === 1
            ? '1 item'
            : `${summary.fixedCount} itens`
          : summary.fixedCount === 1
          ? '1 item'
          : `${summary.fixedCount} items`,
        variableCountLabel: isPt
          ? summary.variableCount === 1
            ? '1 item'
            : `${summary.variableCount} itens`
          : summary.variableCount === 1
          ? '1 item'
          : `${summary.variableCount} items`,
      };
    }, [summary, currency, isPt]);

    return (
      <section
        aria-label={isPt ? 'Fixos vs. Variáveis' : 'Fixed vs. Variable'}
        data-theme-oled={isOled ? 'true' : 'false'}
        className="rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] p-3.5 sm:p-4 shadow-sm transition-colors"
      >
        {/* Unified Slide Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10 text-[#10B981]">
              <Scale size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {isPt ? 'Fixos vs. Variáveis' : 'Fixed vs. Variable'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {isPt
                  ? 'Rigidez de compromissos vs. margem flexível'
                  : 'Committed rigidity vs. flexible margin'}
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 whitespace-nowrap ${
              metrics.isHealthy
                ? 'bg-emerald-500/10 text-[#10B981] border border-emerald-500/20'
                : 'bg-red-500/10 text-[#EF4444] border border-red-500/20'
            }`}
          >
            {summary.fixedPct.toFixed(0)}% {isPt ? 'fixo' : 'fixed'}
          </span>
        </div>

        {/* Proportional Horizontal Split Bar */}
        <div
          className="h-8 w-full rounded-xl overflow-hidden flex bg-slate-100 dark:bg-[#161B22] p-1 gap-1 my-4"
          role="img"
          aria-label={
            isPt
              ? `Proporção: ${summary.fixedPct.toFixed(0)}% fixo e ${summary.variablePct.toFixed(0)}% variável`
              : `Split: ${summary.fixedPct.toFixed(0)}% fixed and ${summary.variablePct.toFixed(0)}% variable`
          }
        >
          <div
            style={{ width: `${metrics.fixedBarWidth}%` }}
            className="bg-[#EF4444] rounded-lg transition-all duration-300 flex items-center justify-center text-[11px] font-extrabold text-white truncate px-2"
          >
            {summary.fixedPct.toFixed(0)}%
          </div>
          <div
            style={{ width: `${metrics.variableBarWidth}%` }}
            className="bg-[#10B981] rounded-lg transition-all duration-300 flex items-center justify-center text-[11px] font-extrabold text-white truncate px-2"
          >
            {summary.variablePct.toFixed(0)}%
          </div>
        </div>

        {/* Two Compact Summary Blocks */}
        <div className="grid grid-cols-2 gap-2.5 mt-3">
          <div className="border border-red-500/20 bg-red-500/5 dark:bg-[#161B22] rounded-xl p-3 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#EF4444] shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                {isPt ? 'Fixos e Parcelas' : 'Fixed & Installments'}
              </span>
            </div>
            <p className="text-sm sm:text-base font-extrabold text-[#EF4444] tabular-nums truncate">
              {metrics.fixedFormatted}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {summary.fixedPct.toFixed(1)}% • {metrics.fixedCountLabel}
            </p>
          </div>

          <div className="border border-emerald-500/20 bg-emerald-500/5 dark:bg-[#161B22] rounded-xl p-3 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-[#10B981] shrink-0" aria-hidden="true" />
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                {isPt ? 'Variáveis / Flexíveis' : 'Variable / Flexible'}
              </span>
            </div>
            <p className="text-sm sm:text-base font-extrabold text-[#10B981] tabular-nums truncate">
              {metrics.variableFormatted}
            </p>
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {summary.variablePct.toFixed(1)}% • {metrics.variableCountLabel}
            </p>
          </div>
        </div>
      </section>
    );
  }
);

BudgetRigidityChart.displayName = 'BudgetRigidityChart';
