import React, { memo, useMemo } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AppLanguage } from '../../types';
import { formatCompactNumber, formatCurrency } from '../../utils/format';
import { CashflowEvolutionSummary, CashflowMonthPoint } from '../../utils/reportAggregators';

export interface CashflowEvolutionChartProps {
  summary: CashflowEvolutionSummary;
  currency: string;
  language: AppLanguage;
  isOled: boolean;
}

interface CashflowTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: CashflowMonthPoint }>;
  currency: string;
  language: AppLanguage;
  isOled: boolean;
}

const formatSignedAxisValue = (value: number | string): string => {
  const num = Number(value);
  const compact = formatCompactNumber(Math.abs(num));
  return num < 0 && compact !== '0' ? `-${compact}` : compact;
};

const CashflowTooltip = memo<CashflowTooltipProps>(
  ({ active, payload, currency, language, isOled }) => {
    const point = payload?.[0]?.payload;
    if (!active || !point) return null;

    const isPt = language === 'pt-BR';
    const netPositive = point.net >= 0;

    return (
      <div
        className={`rounded-xl border px-3 py-2.5 shadow-lg text-xs ${
          isOled
            ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <p className="font-bold mb-1.5 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {point.fullLabel}
        </p>
        <div className="space-y-1 min-w-[148px]">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-[#10B981]" />
              {isPt ? 'Receitas' : 'Income'}
            </span>
            <span className="font-semibold tabular-nums text-[#10B981]">
              {formatCurrency(point.income, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
              {isPt ? 'Despesas' : 'Expenses'}
            </span>
            <span className="font-semibold tabular-nums text-[#EF4444]">
              {formatCurrency(point.expense, currency)}
            </span>
          </div>
          <div className="pt-1 mt-1 border-t border-slate-200/80 dark:border-[#21262D] flex items-center justify-between gap-4">
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {isPt ? 'Saldo' : 'Net'}
            </span>
            <span className={`font-bold tabular-nums ${netPositive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {point.net > 0 ? '+' : ''}
              {formatCurrency(point.net, currency)}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

CashflowTooltip.displayName = 'CashflowTooltip';

export const CashflowEvolutionChart = memo<CashflowEvolutionChartProps>(
  ({ summary, currency, language, isOled }) => {
    const isPt = language === 'pt-BR';

    const labels = useMemo(
      () => ({
        title: isPt ? 'Evolução Mensal' : 'Monthly Evolution',
        subtitle: isPt
          ? 'Receitas vs. Despesas (últimos 6 meses)'
          : 'Income vs. Expenses (last 6 months)',
        avgPrefix: isPt ? 'Média' : 'Avg',
        incomeLabel: isPt ? 'Receitas (6m)' : 'Income (6m)',
        expenseLabel: isPt ? 'Despesas (6m)' : 'Expenses (6m)',
        avgNetLabel: isPt ? 'Saldo Médio' : 'Avg Net',
      }),
      [isPt]
    );

    const formatted = useMemo(() => {
      const avgSign = summary.avgNet > 0 ? '+' : '';
      return {
        avgPill: `${labels.avgPrefix}: ${avgSign}${formatCurrency(summary.avgNet, currency)}`,
        totalIncome: formatCurrency(summary.totalIncome, currency),
        totalExpense: formatCurrency(summary.totalExpense, currency),
        avgNet: `${avgSign}${formatCurrency(summary.avgNet, currency)}`,
      };
    }, [summary.avgNet, summary.totalIncome, summary.totalExpense, currency, labels.avgPrefix]);

    const chartColors = useMemo(
      () => ({
        grid: isOled ? '#21262D' : '#E2E8F0',
        tick: isOled ? '#8B949E' : '#64748B',
        line: isOled ? '#8B949E' : '#64748B',
        dotFill: isOled ? '#0D1117' : '#FFFFFF',
        cursorFill: isOled ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
      }),
      [isOled]
    );

    const isPositiveAvg = summary.avgNet >= 0;

    return (
      <section className="rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] p-3.5 sm:p-4 shadow-sm transition-colors">
        <div className="flex items-start justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-[#10B981] flex items-center justify-center shrink-0">
              <BarChart3 size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {labels.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {labels.subtitle}
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 tabular-nums border ${
              isPositiveAvg
                ? 'bg-emerald-500/10 text-[#10B981] border-emerald-500/20'
                : 'bg-red-500/10 text-[#EF4444] border-red-500/20'
            }`}
          >
            {formatted.avgPill}
          </span>
        </div>

        <div className="w-full h-[220px]">
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={summary.points} margin={{ top: 8, right: 6, left: -6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: chartColors.tick }} />
              <YAxis tickLine={false} axisLine={false} width={44} tickFormatter={formatSignedAxisValue} tick={{ fontSize: 10, fill: chartColors.tick }} />
              <Tooltip
                cursor={{ fill: chartColors.cursorFill }}
                content={<CashflowTooltip currency={currency} language={language} isOled={isOled} />}
              />
              <Bar dataKey="income" fill="#10B981" radius={[5, 5, 0, 0]} maxBarSize={22} animationBegin={0} animationDuration={380} animationEasing="ease-out" />
              <Bar dataKey="expense" fill="#EF4444" radius={[5, 5, 0, 0]} maxBarSize={22} animationBegin={0} animationDuration={380} animationEasing="ease-out" />
              <Line type="monotone" dataKey="net" stroke={chartColors.line} strokeWidth={2} dot={{ r: 3, fill: chartColors.dotFill, strokeWidth: 2 }} animationBegin={0} animationDuration={380} animationEasing="ease-out" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-[#21262D]">
          <div className="rounded-xl bg-slate-50 dark:bg-[#161B22] px-2.5 py-2 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 truncate">
              {labels.incomeLabel}
            </p>
            <p className="text-xs sm:text-sm font-bold text-[#10B981] tabular-nums truncate mt-0.5">
              {formatted.totalIncome}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-[#161B22] px-2.5 py-2 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 truncate">
              {labels.expenseLabel}
            </p>
            <p className="text-xs sm:text-sm font-bold text-[#EF4444] tabular-nums truncate mt-0.5">
              {formatted.totalExpense}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-[#161B22] px-2.5 py-2 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 truncate">
              {labels.avgNetLabel}
            </p>
            <p
              className={`text-xs sm:text-sm font-bold tabular-nums truncate mt-0.5 ${
                isPositiveAvg ? 'text-[#10B981]' : 'text-[#EF4444]'
              }`}
            >
              {formatted.avgNet}
            </p>
          </div>
        </div>
      </section>
    );
  }
);

CashflowEvolutionChart.displayName = 'CashflowEvolutionChart';
