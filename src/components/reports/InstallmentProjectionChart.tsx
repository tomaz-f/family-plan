import React, { memo, useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AppLanguage } from '../../types';
import { formatCompactNumber, formatCurrency } from '../../utils/format';
import {
  InstallmentProjectionPoint,
  InstallmentProjectionSummary,
} from '../../utils/reportAggregators';

export interface InstallmentProjectionChartProps {
  summary: InstallmentProjectionSummary;
  currency: string;
  language: AppLanguage;
  isOled: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: InstallmentProjectionPoint }>;
  currency: string;
  language: AppLanguage;
  isOled: boolean;
}

const ProjectionTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  currency,
  language,
  isOled,
}) => {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  const isPt = language === 'pt-BR';
  const countLabel = isPt
    ? `${point.activeCount} ${point.activeCount === 1 ? 'parcela ativa' : 'parcelas ativas'}`
    : `${point.activeCount} ${point.activeCount === 1 ? 'active installment' : 'active installments'}`;

  return (
    <div
      className={`rounded-xl border px-3 py-2 shadow-lg text-xs ${
        isOled
          ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
          : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      <p className="font-bold mb-1 capitalize">{point.fullLabel}</p>
      <div className="flex items-center justify-between gap-4">
        <span className={isOled ? 'text-slate-400' : 'text-slate-500'}>
          {isPt ? 'Total comprometido' : 'Total committed'}
        </span>
        <span className="font-bold tabular-nums text-[#EF4444]">
          {formatCurrency(point.total, currency)}
        </span>
      </div>
      <p className={`mt-0.5 text-[11px] ${isOled ? 'text-slate-400' : 'text-slate-500'}`}>
        {countLabel}
      </p>
      {point.isReliefMonth && (
        <p className="mt-1 pt-1 border-t border-slate-200/60 dark:border-[#21262D] text-[11px] font-semibold text-[#10B981]">
          {isPt
            ? `Alívio: -${formatCurrency(Math.abs(point.deltaFromPrev), currency)} vs. mês anterior`
            : `Relief: -${formatCurrency(Math.abs(point.deltaFromPrev), currency)} vs. prev month`}
        </p>
      )}
    </div>
  );
};

export const InstallmentProjectionChart = memo<InstallmentProjectionChartProps>(
  ({ summary, currency, language, isOled }) => {
    const isPt = language === 'pt-BR';

    const chartTheme = useMemo(
      () => ({
        gridStroke: isOled ? '#21262D' : '#E2E8F0',
        tickColor: isOled ? '#8B949E' : '#64748B',
        cursorFill: isOled ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)',
      }),
      [isOled]
    );

    const formattedValues = useMemo(
      () => ({
        total6m: formatCurrency(summary.totalCommitted6m, currency),
        currentMonth: formatCurrency(summary.currentMonthTotal, currency),
        reliefCount:
          summary.reliefMonthsCount === 1
            ? isPt
              ? '1 mês'
              : '1 month'
            : isPt
              ? `${summary.reliefMonthsCount} meses`
              : `${summary.reliefMonthsCount} months`,
      }),
      [summary.totalCommitted6m, summary.currentMonthTotal, summary.reliefMonthsCount, currency, isPt]
    );

    return (
      <section className="rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] p-3.5 sm:p-4 shadow-sm transition-colors">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-red-500/10 text-[#EF4444]">
              <CalendarClock size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {isPt ? 'Parcelamentos Futuros' : 'Future Installments'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {isPt
                  ? 'Comprometimento de parcelas nos próximos 6 meses'
                  : 'Committed installments over next 6 months'}
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 tabular-nums bg-red-500/10 text-[#EF4444] border border-red-500/20">
            {formattedValues.total6m}
          </span>
        </div>

        <div className="w-full h-[220px]">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={summary.points} margin={{ top: 8, right: 6, left: -6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: chartTheme.tickColor }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v) => formatCompactNumber(Math.abs(Number(v)))}
                tick={{ fontSize: 10, fill: chartTheme.tickColor }}
              />
              <Tooltip
                cursor={{ fill: chartTheme.cursorFill }}
                content={<ProjectionTooltip currency={currency} language={language} isOled={isOled} />}
              />
              <Bar
                dataKey="total"
                radius={[6, 6, 0, 0]}
                maxBarSize={32}
                animationBegin={0}
                animationDuration={380}
                animationEasing="ease-out"
              >
                {summary.points.map((point) => (
                  <Cell
                    key={point.month}
                    fill={point.isReliefMonth ? '#10B981' : '#EF4444'}
                    fillOpacity={!point.isReliefMonth && !point.isPeakMonth ? 0.75 : 1}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-[#21262D] grid grid-cols-2 gap-2.5">
          <div className="rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200/60 dark:border-[#21262D]">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              {isPt ? 'Mês Atual' : 'Current Month'}
            </p>
            <p className="text-sm font-bold tabular-nums text-[#EF4444] mt-0.5 truncate">
              {formattedValues.currentMonth}
            </p>
          </div>
          <div className="rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200/60 dark:border-[#21262D]">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              {isPt ? 'Meses de Alívio' : 'Relief Months'}
            </p>
            <p className="text-sm font-bold tabular-nums text-[#10B981] mt-0.5 truncate">
              {formattedValues.reliefCount}
            </p>
          </div>
        </div>
      </section>
    );
  }
);

InstallmentProjectionChart.displayName = 'InstallmentProjectionChart';
