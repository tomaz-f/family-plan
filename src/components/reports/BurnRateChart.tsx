import React, { memo, useMemo } from 'react';
import { Activity } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AppLanguage } from '../../types';
import { formatCompactNumber, formatCurrency } from '../../utils/format';
import { BurnRateDayPoint, BurnRateSummary } from '../../utils/reportAggregators';

export interface BurnRateChartProps {
  summary: BurnRateSummary;
  currency: string;
  language: AppLanguage;
  isOled: boolean;
}

interface BurnRateTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: BurnRateDayPoint }>;
  currency: string;
  language: AppLanguage;
  isOled: boolean;
}

const BurnRateTooltip: React.FC<BurnRateTooltipProps> = ({
  active,
  payload,
  currency,
  language,
  isOled,
}) => {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  const isPt = language === 'pt-BR';

  return (
    <div
      className={`rounded-xl border px-3 py-2 shadow-lg text-xs ${
        isOled
          ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
          : 'bg-white border-slate-200 text-slate-900'
      }`}
    >
      <p className="font-bold mb-1">
        {isPt ? `Dia ${point.day}` : `Day ${point.day}`}
      </p>
      {point.actualCumulative !== null && (
        <div className="flex items-center justify-between gap-4">
          <span className={isOled ? 'text-slate-400' : 'text-slate-500'}>
            {isPt ? 'Acumulado atual' : 'Actual spend'}
          </span>
          <span className="font-bold tabular-nums text-[#EF4444]">
            {formatCurrency(point.actualCumulative, currency)}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 mt-0.5">
        <span className={isOled ? 'text-slate-400' : 'text-slate-500'}>
          {isPt ? 'Média histórica' : 'Historical avg'}
        </span>
        <span
          className={`font-semibold tabular-nums ${
            isOled ? 'text-slate-300' : 'text-slate-600'
          }`}
        >
          {formatCurrency(point.averageCumulative, currency)}
        </span>
      </div>
    </div>
  );
};

export const BurnRateChart = memo<BurnRateChartProps>(
  ({ summary, currency, language, isOled }) => {
    const isPt = language === 'pt-BR';

    const chartTheme = useMemo(
      () => ({
        gridStroke: isOled ? '#21262D' : '#E2E8F0',
        tickColor: isOled ? '#8B949E' : '#64748B',
        refLineStroke: isOled ? '#8B949E' : '#64748B',
      }),
      [isOled]
    );

    const statusBadge = useMemo(() => {
      if (summary.isOverPace) {
        return {
          label: isPt ? 'Acima da média' : 'Above average',
          pillClass: 'bg-red-500/10 text-[#EF4444] border border-red-500/20',
          iconClass: 'bg-red-500/10 text-[#EF4444]',
        };
      }
      return {
        label: isPt ? 'Dentro do ritmo' : 'On track',
        pillClass: 'bg-emerald-500/10 text-[#10B981] border border-emerald-500/20',
        iconClass: 'bg-emerald-500/10 text-[#10B981]',
      };
    }, [summary.isOverPace, isPt]);

    const formattedValues = useMemo(
      () => ({
        currentSpend: formatCurrency(summary.currentSpend, currency),
        expectedRef: formatCurrency(summary.referenceAtCurrentDay, currency),
      }),
      [summary.currentSpend, summary.referenceAtCurrentDay, currency]
    );

    return (
      <section className="rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] p-3.5 sm:p-4 shadow-sm transition-colors">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${statusBadge.iconClass}`}
            >
              <Activity size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {isPt ? 'Ritmo de Gastos' : 'Spending Pace'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {isPt
                  ? 'Acumulado diário (Dias 1–30) vs. média histórica'
                  : 'Daily cumulative spend vs. historical average'}
              </p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 ${statusBadge.pillClass}`}
          >
            {statusBadge.label}
          </span>
        </div>

        <div className="w-full h-[220px]">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={summary.points} margin={{ top: 8, right: 8, left: -6, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.gridStroke} />
              <XAxis
                dataKey="dayLabel"
                interval={4}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: chartTheme.tickColor }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={(v) => formatCompactNumber(Math.abs(Number(v)))}
                tick={{ fontSize: 10, fill: chartTheme.tickColor }}
              />
              <Tooltip
                content={<BurnRateTooltip currency={currency} language={language} isOled={isOled} />}
              />
              <Line
                type="monotone"
                dataKey="averageCumulative"
                stroke={chartTheme.refLineStroke}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                animationBegin={0}
                animationDuration={380}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="actualCumulative"
                stroke="#EF4444"
                strokeWidth={2.5}
                dot={false}
                connectNulls={false}
                animationBegin={0}
                animationDuration={380}
                animationEasing="ease-out"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-[#21262D] grid grid-cols-2 gap-2.5">
          <div className="rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200/60 dark:border-[#21262D]">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              {isPt ? 'Acumulado Atual' : 'Current Spend'}
            </p>
            <p className="text-sm font-bold tabular-nums text-[#EF4444] mt-0.5 truncate">
              {formattedValues.currentSpend}
            </p>
          </div>
          <div className="rounded-xl px-3 py-2 bg-slate-50 dark:bg-[#161B22] border border-slate-200/60 dark:border-[#21262D]">
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              {isPt ? 'Referência Esperada' : 'Expected Reference'}
            </p>
            <p
              className={`text-sm font-bold tabular-nums mt-0.5 truncate ${
                summary.isOverPace
                  ? 'text-slate-600 dark:text-slate-300'
                  : 'text-[#10B981]'
              }`}
            >
              {formattedValues.expectedRef}
            </p>
          </div>
        </div>
      </section>
    );
  }
);

BurnRateChart.displayName = 'BurnRateChart';
