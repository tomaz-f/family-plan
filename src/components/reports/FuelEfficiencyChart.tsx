import React, { useMemo } from 'react';
import { Fuel } from 'lucide-react';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { AppLanguage } from '../../types';
import { CURRENCIES, formatCompactNumber, formatCurrency } from '../../utils/format';
import { FuelChartPoint, FuelEfficiencySummary } from '../../utils/reportAggregators';

export interface FuelEfficiencyChartProps {
  summary: FuelEfficiencySummary;
  currency: string;
  language: AppLanguage;
  isOled: boolean;
}

interface FuelTooltipProps {
  active?: boolean;
  payload?: Array<{ payload?: FuelChartPoint }>;
  currency: string;
  language: AppLanguage;
}

const FuelTooltip: React.FC<FuelTooltipProps> = ({ active, payload, currency, language }) => {
  const point = active && payload?.length ? payload[0]?.payload : undefined;
  if (!point) return null;
  const isPt = language === 'pt-BR';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-[#21262D] bg-white/95 dark:bg-[#0D1117]/95 backdrop-blur-sm px-3 py-2 shadow-lg text-xs">
      <p className="font-bold text-slate-900 dark:text-white">{point.fullDate}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-1.5 truncate max-w-[180px]">
        {point.stationName}
      </p>
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">{isPt ? 'Consumo' : 'Efficiency'}</span>
          {point.kmPerLiter !== null && point.kmPerLiter > 0 ? (
            <span className="font-extrabold text-[#10B981] tabular-nums">
              {point.kmPerLiter.toFixed(1)} km/L
            </span>
          ) : (
            <span className="font-semibold text-slate-400 dark:text-slate-500">
              {!point.isFullTank
                ? isPt
                  ? 'Aguardando tanque cheio'
                  : 'Awaiting full tank'
                : '— km/L'}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-500 dark:text-slate-400">{isPt ? 'Custo' : 'Cost'}</span>
          <span className="font-extrabold text-[#EF4444] tabular-nums">
            {formatCurrency(point.totalCost, currency)}
          </span>
        </div>
      </div>
    </div>
  );
};

export const FuelEfficiencyChart: React.FC<FuelEfficiencyChartProps> = React.memo(
  ({ summary, currency, language, isOled }) => {
    const isPt = language === 'pt-BR';

    const derived = useMemo(() => {
      const currencySymbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? 'R$';
      const avgLabel =
        summary.avgKmPerLiter !== null ? `${summary.avgKmPerLiter.toFixed(1)} km/L` : '— km/L';
      const pillLabel =
        summary.avgKmPerLiter !== null ? avgLabel : isPt ? 'Sem média' : 'No avg';
      return {
        currencySymbol,
        pillLabel,
        avgLabel,
        totalSpendFormatted: formatCurrency(summary.totalSpend, currency),
        totalLitersFormatted: `${summary.totalLiters.toFixed(1)} L`,
        gridStroke: isOled ? '#21262D' : '#E2E8F0',
        axisTickColor: isOled ? '#94A3B8' : '#64748B',
      };
    }, [summary, currency, isPt, isOled]);

    return (
      <section
        aria-label={isPt ? 'Eficiência de Combustível' : 'Fuel Efficiency'}
        className="rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] p-3.5 sm:p-4 shadow-sm transition-colors"
      >
        {/* Unified Slide Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10 text-[#10B981]">
              <Fuel size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {isPt ? 'Eficiência de Combustível' : 'Fuel Efficiency'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {isPt
                  ? 'Consumo (km/L) e custo por abastecimento'
                  : 'Consumption (km/L) and cost per fill-up'}
              </p>
            </div>
          </div>

          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold shrink-0 whitespace-nowrap bg-emerald-500/10 text-[#10B981] border border-emerald-500/20">
            {derived.pillLabel}
          </span>
        </div>

        {!summary.hasData ? (
          <div className="py-10 text-center px-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-[#161B22] flex items-center justify-center text-slate-400 dark:text-slate-500 mb-3">
              <Fuel size={28} aria-hidden="true" />
            </div>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {isPt ? 'Nenhum abastecimento registrado' : 'No refuelings logged yet'}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              {isPt
                ? 'As curvas de eficiência e custo aparecem automaticamente após registrar lançamentos na aba Combustível.'
                : 'Fuel efficiency and cost curves appear automatically once refuelings are logged in the Fuel tab.'}
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] font-bold mb-1.5 px-1">
              <span className="inline-flex items-center gap-1.5 text-[#10B981]">
                <span className="w-2 h-2 rounded-full bg-[#10B981]" aria-hidden="true" />
                km/L
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#EF4444]">
                {derived.currencySymbol}
                <span className="w-2 h-2 rounded-full bg-[#EF4444]" aria-hidden="true" />
              </span>
            </div>

            <div className="w-full h-[210px]">
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={summary.points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={derived.gridStroke} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: derived.axisTickColor }} axisLine={false} tickLine={false} dy={4} />
                  <YAxis yAxisId="eff" width={36} tick={{ fontSize: 10, fill: '#10B981', fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis
                    yAxisId="cost"
                    orientation="right"
                    width={42}
                    tick={{ fontSize: 10, fill: '#EF4444', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => formatCompactNumber(Number(v))}
                  />
                  <Tooltip
                    content={<FuelTooltip currency={currency} language={language} />}
                    cursor={{ stroke: derived.gridStroke, strokeWidth: 1, strokeDasharray: '3 3' }}
                  />
                  <Line
                    yAxisId="eff"
                    type="monotone"
                    dataKey="kmPerLiter"
                    connectNulls
                    stroke="#10B981"
                    strokeWidth={2.5}
                    dot={{ r: 3.5, fill: '#10B981' }}
                    activeDot={{ r: 5 }}
                    animationBegin={0}
                    animationDuration={380}
                    animationEasing="ease-out"
                  />
                  <Line
                    yAxisId="cost"
                    type="monotone"
                    dataKey="totalCost"
                    stroke="#EF4444"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#EF4444' }}
                    activeDot={{ r: 4.5 }}
                    animationBegin={0}
                    animationDuration={380}
                    animationEasing="ease-out"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <div className="border border-emerald-500/20 bg-emerald-500/5 dark:bg-[#161B22] rounded-xl p-3 min-w-0">
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                  {isPt ? 'Média de Consumo' : 'Average Consumption'}
                </p>
                <p className="text-sm sm:text-base font-extrabold text-[#10B981] tabular-nums mt-0.5 truncate">
                  {derived.avgLabel}
                </p>
              </div>
              <div className="border border-red-500/20 bg-red-500/5 dark:bg-[#161B22] rounded-xl p-3 min-w-0">
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                  {isPt ? 'Total Abastecido' : 'Total Spent'}
                </p>
                <p className="text-sm sm:text-base font-extrabold text-[#EF4444] tabular-nums mt-0.5 truncate">
                  {derived.totalSpendFormatted}
                </p>
                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                  {derived.totalLitersFormatted}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }
);

FuelEfficiencyChart.displayName = 'FuelEfficiencyChart';
