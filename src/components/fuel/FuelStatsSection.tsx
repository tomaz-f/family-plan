import React from 'react';
import { Plus, Zap } from 'lucide-react';
import { AppLanguage } from '../../types';
import { formatCurrency, formatMonthLabel } from '../../utils/format';
import { AppIcon } from '../icons';
import { FuelMetricsSummary } from './fuelMetrics';

export interface FuelStatsSectionProps {
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  metrics: FuelMetricsSummary;
  onOpenNew: () => void;
}

export const FuelStatsSection: React.FC<FuelStatsSectionProps> = ({
  selectedMonth,
  currency,
  language,
  metrics,
  onOpenNew,
}) => {
  return (
    <div className="oled-main-card p-4 rounded-2xl border border-slate-200/90 shadow-sm space-y-3">
      <div className="flex items-center justify-between pb-0.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
            <AppIcon name="posto-gasolina" size={17} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 leading-none">
              {language === 'pt-BR' ? 'Resumo de Combustível' : 'Fuel Summary'}
            </h2>
            <span className="text-[11px] text-slate-400 capitalize">
              {formatMonthLabel(selectedMonth, language)}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenNew}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-xs active:scale-95 transition-all"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span>{language === 'pt-BR' ? 'Abastecer' : 'Refuel'}</span>
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {/* 1. Gasto no Mês */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between min-h-[72px]">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
            {language === 'pt-BR' ? 'Gasto no Mês' : 'Month Spend'}
          </span>
          <p className="text-base sm:text-lg font-extrabold text-rose-500 mt-1 truncate">
            {formatCurrency(metrics.monthSpend, currency)}
          </p>
        </div>

        {/* 2. Projeção no Mês */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between min-h-[72px]">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
            {language === 'pt-BR' ? 'Projeção no Mês' : 'Month Projection'}
          </span>
          <p className="text-base sm:text-lg font-extrabold text-slate-900 mt-1 truncate">
            {metrics.projectedMonthlySpend > 0
              ? formatCurrency(metrics.projectedMonthlySpend, currency)
              : '—'}
          </p>
        </div>

        {/* 3. Volume Total */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between min-h-[72px]">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
            {language === 'pt-BR' ? 'Volume Total' : 'Total Volume'}
          </span>
          <div className="mt-1">
            <p className="text-base sm:text-lg font-extrabold text-sky-500 truncate leading-tight">
              {metrics.monthLiters.toLocaleString(
                language === 'pt-BR' ? 'pt-BR' : 'en-US',
                { minimumFractionDigits: 1, maximumFractionDigits: 1 }
              )}{' '}
              L
            </p>
            {(metrics.monthGasolineLiters > 0 || metrics.monthEthanolLiters > 0) && (
              <span className="text-[10px] text-slate-400 truncate block mt-0.5">
                {metrics.monthGasolineLiters.toFixed(0)}L Gas • {metrics.monthEthanolLiters.toFixed(0)}L Eta
              </span>
            )}
          </div>
        </div>

        {/* 4. Distância Percorrida */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between min-h-[72px]">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
            {language === 'pt-BR' ? 'Distância Percorrida' : 'Distance Driven'}
          </span>
          <p className="text-base sm:text-lg font-extrabold text-slate-900 mt-1 truncate">
            {metrics.monthDistance.toLocaleString(language === 'pt-BR' ? 'pt-BR' : 'en-US')} km
          </p>
        </div>

        {/* 5. Consumo Médio */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between min-h-[72px]">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
            {language === 'pt-BR' ? 'Consumo Médio' : 'Avg Efficiency'}
          </span>
          <p className="text-base sm:text-lg font-extrabold text-emerald-500 mt-1 truncate flex items-center gap-1">
            <Zap size={14} className="shrink-0 text-emerald-500" />
            <span>{metrics.avgKmPerLiter ? `${metrics.avgKmPerLiter.toFixed(2)} km/L` : '—'}</span>
          </p>
        </div>

        {/* 6. Autonomia Estimada */}
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col justify-between min-h-[72px]">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
            {language === 'pt-BR' ? 'Autonomia Estimada' : 'Projected Range'}
          </span>
          <p className="text-base sm:text-lg font-extrabold text-purple-400 mt-1 truncate">
            {metrics.estimatedFullTankRange
              ? `~${Math.round(metrics.estimatedFullTankRange).toLocaleString(
                  language === 'pt-BR' ? 'pt-BR' : 'en-US'
                )} km`
              : '—'}
          </p>
        </div>
      </div>
    </div>
  );
};
