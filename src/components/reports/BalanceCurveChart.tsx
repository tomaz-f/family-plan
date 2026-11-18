import React, { memo, useMemo } from 'react';
import { TrendingUp } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AppLanguage } from '../../types';
import { formatCompactNumber, formatCurrency } from '../../utils/format';
import { BalanceCurvePoint, BalanceCurveSummary } from '../../utils/reportAggregators';

export interface BalanceCurveChartProps {
  summary: BalanceCurveSummary;
  currency: string;
  language: AppLanguage;
  isOled: boolean;
}

interface BalanceTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: BalanceCurvePoint }>;
  currency: string;
  language: AppLanguage;
  isOled: boolean;
}

const formatSignedAxisValue = (value: number | string): string => {
  const num = Number(value);
  const compact = formatCompactNumber(Math.abs(num));
  return num < 0 && compact !== '0' ? `-${compact}` : compact;
};

const BalanceTooltip = memo<BalanceTooltipProps>(
  ({ active, payload, currency, language, isOled }) => {
    const point = payload?.[0]?.payload;
    if (!active || !point) return null;

    const isPt = language === 'pt-BR';
    const deltaPositive = point.monthlyDelta >= 0;
    const balancePositive = point.balance >= 0;

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
        <div className="space-y-1 min-w-[152px]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-600 dark:text-slate-300">
              {isPt ? 'Saldo' : 'Balance'}
            </span>
            <span className={`font-bold tabular-nums ${balancePositive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {formatCurrency(point.balance, currency)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-200/80 dark:border-[#21262D]">
            <span className="text-slate-600 dark:text-slate-300">
              {isPt ? 'Variação no mês' : 'Monthly delta'}
            </span>
            <span className={`font-semibold tabular-nums ${deltaPositive ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {point.monthlyDelta > 0 ? '+' : ''}
              {formatCurrency(point.monthlyDelta, currency)}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

BalanceTooltip.displayName = 'BalanceTooltip';

export const BalanceCurveChart = memo<BalanceCurveChartProps>(
  ({ summary, currency, language, isOled }) => {
    const isPt = language === 'pt-BR';

    const labels = useMemo(
      () => ({
        title: isPt ? 'Curva do Saldo' : 'Balance Curve',
        subtitle: isPt ? 'Acumulado patrimonial em 6 meses' : '6-month cumulative balance',
        startLabel: isPt ? 'Saldo Inicial da Janela' : 'Window Start Balance',
        changeLabel: isPt ? 'Variação no Período' : 'Period Change',
      }),
      [isPt]
    );

    const formatted = useMemo(() => {
      const changeSign = summary.periodChange > 0 ? '+' : '';
      return {
        currentBalance: formatCurrency(summary.currentBalance, currency),
        startBalance: formatCurrency(summary.startBalance, currency),
        periodChange: `${changeSign}${formatCurrency(summary.periodChange, currency)}`,
      };
    }, [summary.currentBalance, summary.startBalance, summary.periodChange, currency]);

    const chartColors = useMemo(
      () => ({
        tick: isOled ? '#8B949E' : '#64748B',
        dotStroke: isOled ? '#0D1117' : '#FFFFFF',
        cursorStroke: isOled ? '#30363D' : '#CBD5E1',
      }),
      [isOled]
    );

    const isPositiveCurrent = summary.currentBalance >= 0;
    const isPositiveChange = summary.periodChange >= 0;

    return (
      <section className="rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] p-3.5 sm:p-4 shadow-sm transition-colors">
        <div className="flex items-start justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-[#10B981] flex items-center justify-center shrink-0">
              <TrendingUp size={18} />
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
              isPositiveCurrent
                ? 'bg-emerald-500/10 text-[#10B981] border-emerald-500/20'
                : 'bg-red-500/10 text-[#EF4444] border-red-500/20'
            }`}
          >
            {formatted.currentBalance}
          </span>
        </div>

        <div className="w-full h-[220px]">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={summary.points} margin={{ top: 8, right: 6, left: -6, bottom: 0 }}>
              <defs>
                <linearGradient id="balanceEmeraldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: chartColors.tick }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                tickFormatter={formatSignedAxisValue}
                tick={{ fontSize: 10, fill: chartColors.tick }}
              />
              <Tooltip
                cursor={{
                  stroke: chartColors.cursorStroke,
                  strokeWidth: 1,
                  strokeDasharray: '3 3',
                }}
                content={<BalanceTooltip currency={currency} language={language} isOled={isOled} />}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="#10B981"
                strokeWidth={2.5}
                fill="url(#balanceEmeraldGrad)"
                activeDot={{ r: 5, fill: '#10B981', stroke: chartColors.dotStroke, strokeWidth: 2 }}
                animationBegin={0}
                animationDuration={380}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-[#21262D]">
          <div className="rounded-xl bg-slate-50 dark:bg-[#161B22] px-3 py-2 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 truncate">
              {labels.startLabel}
            </p>
            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tabular-nums truncate mt-0.5">
              {formatted.startBalance}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 dark:bg-[#161B22] px-3 py-2 min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 truncate">
              {labels.changeLabel}
            </p>
            <p
              className={`text-xs sm:text-sm font-bold tabular-nums truncate mt-0.5 ${
                isPositiveChange ? 'text-[#10B981]' : 'text-[#EF4444]'
              }`}
            >
              {formatted.periodChange}
            </p>
          </div>
        </div>
      </section>
    );
  }
);

BalanceCurveChart.displayName = 'BalanceCurveChart';
