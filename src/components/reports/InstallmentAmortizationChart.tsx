import React, { useState, useMemo } from 'react';
import { AppLanguage } from '../../types';
import { formatCurrency } from '../../utils/format';
import { AmortizationTimelinePoint } from './reportsTypes';

interface InstallmentAmortizationChartProps {
  amortizationTimeline: AmortizationTimelinePoint[];
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  isOled: boolean;
}

export const InstallmentAmortizationChart: React.FC<InstallmentAmortizationChartProps> = ({
  amortizationTimeline,
  selectedMonth,
  currency,
  language,
  isOled,
}) => {
  const [timelineSelection, setTimelineSelection] = useState<{ month: string; index: number }>({
    month: selectedMonth,
    index: 0,
  });
  const selectedTimelineIndex =
    timelineSelection.month === selectedMonth ? timelineSelection.index : 0;
  const setSelectedTimelineIndex = (index: number) =>
    setTimelineSelection({ month: selectedMonth, index });

  const safeSelectedIdx =
    amortizationTimeline.length > 0
      ? Math.min(selectedTimelineIndex, amortizationTimeline.length - 1)
      : 0;
  const activePoint = amortizationTimeline[safeSelectedIdx];

  const maxCommitment = useMemo(
    () => Math.max(...amortizationTimeline.map((p) => p.monthlyCommitment), 1),
    [amortizationTimeline]
  );

  const maxRemainingNode = useMemo(
    () => Math.max(...amortizationTimeline.map((p) => p.remainingBalance), 1),
    [amortizationTimeline]
  );

  const nodeCoords = useMemo(() => {
    const n = amortizationTimeline.length;
    if (n === 0) return [];
    const hasPositiveBalance = amortizationTimeline.some((p) => p.remainingBalance > 0);
    return amortizationTimeline.map((pt, idx) => {
      const xPct = ((idx + 0.5) / n) * 100;
      const ratio = hasPositiveBalance ? pt.remainingBalance / maxRemainingNode : 0;
      const yPct = 16 + (1 - ratio) * 70;
      return { xPct, yPct, pt };
    });
  }, [amortizationTimeline, maxRemainingNode]);

  const polylinePoints = useMemo(
    () => nodeCoords.map((c) => `${(c.xPct * 10).toFixed(2)},${c.yPct.toFixed(2)}`).join(' '),
    [nodeCoords]
  );

  if (amortizationTimeline.length === 0 || !activePoint) return null;

  const gridLineClass = `border-b border-dashed ${isOled ? 'border-[#21262D]' : 'border-slate-200'}`;
  const mutedLabelClass = `text-[10px] font-semibold ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`;

  return (
    <div
      className={`rounded-xl border p-3.5 mb-4 transition-colors ${
        isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200/80'
      }`}
    >
      {/* Chart Legend Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={`text-[10px] uppercase font-extrabold tracking-wider truncate ${
            isOled ? 'text-[#94A3B8]' : 'text-slate-500'
          }`}
        >
          {language === 'pt-BR' ? 'Amortização das Parcelas' : 'Installment Amortization'}
        </span>
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-t-xs bg-[#6E5440] inline-block" />
            <span className={mutedLabelClass}>
              {language === 'pt-BR' ? 'Parcela' : 'Monthly'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`w-2 h-2 rounded-full border-2 inline-block ${
                isOled ? 'bg-slate-400 border-[#21262D]' : 'bg-slate-600 border-white shadow-2xs'
              }`}
            />
            <span className={mutedLabelClass}>
              {language === 'pt-BR' ? 'Saldo' : 'Balance'}
            </span>
          </div>
        </div>
      </div>

      {/* Plot Canvas: Bars + Contrasting Line + Interactive Clickable Nodes */}
      <div className="relative h-28 w-full mt-1">
        <div className="absolute inset-0 flex flex-col justify-between py-3 pointer-events-none opacity-45">
          <div className={gridLineClass} />
          <div className={gridLineClass} />
          <div className={gridLineClass} />
        </div>

        {/* Monthly Commitment Vertical Bars (#6E5440) */}
        <div
          className="absolute inset-0 grid items-end z-10"
          style={{
            gridTemplateColumns: `repeat(${amortizationTimeline.length}, minmax(0, 1fr))`,
          }}
        >
          {amortizationTimeline.map((pt) => {
            const isSelected = pt.index === safeSelectedIdx;
            const barHeightPct =
              maxCommitment > 0 && pt.monthlyCommitment > 0
                ? Math.max(12, Math.round((pt.monthlyCommitment / maxCommitment) * 68))
                : 0;

            return (
              <button
                key={pt.month}
                type="button"
                onClick={() => setSelectedTimelineIndex(pt.index)}
                aria-label={`${pt.fullMonthLabel}: ${formatCurrency(pt.monthlyCommitment, currency)}`}
                className="h-full w-full flex flex-col items-center justify-end px-1 focus:outline-none group"
              >
                <div
                  style={{ height: `${barHeightPct}%` }}
                  className={`w-full max-w-[26px] rounded-t-sm transition-all duration-200 ${
                    isSelected
                      ? 'bg-[#6E5440] opacity-100 ring-1 ring-[#D0B595]/50'
                      : 'bg-[#6E5440]/65 group-hover:bg-[#6E5440]/85'
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Remaining Balance Line Trajectory (SVG) */}
        {nodeCoords.length > 1 && (
          <svg
            viewBox="0 0 1000 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none z-15 overflow-visible"
          >
            <polyline
              fill="none"
              stroke={isOled ? '#94A3B8' : '#475569'}
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              points={polylinePoints}
            />
          </svg>
        )}

        {/* Clickable Nodes on the Remaining Balance Line (36x36px Invisible Touch Hit Area) */}
        {nodeCoords.map(({ xPct, yPct, pt }) => {
          const isSelected = pt.index === safeSelectedIdx;
          return (
            <button
              key={`node-${pt.month}`}
              type="button"
              onClick={() => setSelectedTimelineIndex(pt.index)}
              style={{ left: `${xPct}%`, top: `${yPct}%` }}
              aria-label={`${pt.fullMonthLabel} - ${
                language === 'pt-BR' ? 'Saldo restante' : 'Remaining balance'
              }: ${formatCurrency(pt.remainingBalance, currency)}`}
              aria-pressed={isSelected}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-full z-20 focus:outline-none group"
            >
              <span
                className={`rounded-full border-2 transition-all duration-200 ${
                  isSelected
                    ? `w-3 h-3 bg-[#6E5440] scale-110 ${
                        isOled
                          ? 'border-[#F8FAFC] ring-4 ring-[#6E5440]/40'
                          : 'border-white ring-4 ring-[#6E5440]/30 shadow-xs'
                      }`
                    : `w-2.5 h-2.5 group-hover:scale-110 ${
                        isOled
                          ? 'bg-slate-400 border-[#21262D]'
                          : 'bg-slate-600 border-white shadow-2xs'
                      }`
                }`}
              />
            </button>
          );
        })}
      </div>

      {/* X-Axis Month Labels */}
      <div
        className="grid mt-1.5 pt-1.5 border-t border-dashed"
        style={{
          gridTemplateColumns: `repeat(${amortizationTimeline.length}, minmax(0, 1fr))`,
          borderColor: isOled ? '#21262D' : '#E2E8F0',
        }}
      >
        {amortizationTimeline.map((pt) => {
          const isSelected = pt.index === safeSelectedIdx;
          return (
            <button
              key={`lbl-${pt.month}`}
              type="button"
              onClick={() => setSelectedTimelineIndex(pt.index)}
              className="text-center focus:outline-none py-0.5"
            >
              <span
                className={`block text-[10px] font-bold uppercase tracking-tight truncate ${
                  isSelected
                    ? isOled
                      ? 'text-[#F8FAFC]'
                      : 'text-slate-900'
                    : isOled
                    ? 'text-[#94A3B8]'
                    : 'text-slate-500'
                }`}
              >
                {pt.shortMonthLabel}
              </span>
              {amortizationTimeline.length <= 8 && (
                <span
                  className={`block text-[9px] font-medium ${
                    isSelected
                      ? isOled
                        ? 'text-[#D0B595]'
                        : 'text-[#6E5440]'
                      : isOled
                      ? 'text-[#94A3B8]/60'
                      : 'text-slate-400'
                  }`}
                >
                  {pt.yearLabel}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tap-to-Inspect Interactive Mini-Summary Breakdown */}
      <div
        className={`mt-3 rounded-xl p-3.5 border transition-all ${
          isOled ? 'bg-[#161B22]/60 border-[#21262D]' : 'bg-slate-50 border-slate-200/80'
        } dark:bg-[#161B22]/60 dark:border-[#21262D]`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className={`text-xs font-bold ${isOled ? 'text-white' : 'text-slate-900'} dark:text-white`}>
            {activePoint.fullMonthLabel}
          </span>
          <span
            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border shrink-0 ${
              isOled
                ? 'bg-[#0D1117] text-slate-300 border-[#21262D]'
                : 'bg-white text-slate-700 border-slate-200/80'
            } dark:bg-[#0D1117] dark:text-slate-300 dark:border-[#21262D]`}
          >
            {activePoint.activeCount}{' '}
            {language === 'pt-BR'
              ? activePoint.activeCount === 1
                ? 'parcelamento ativo'
                : 'parcelamentos ativos'
              : activePoint.activeCount === 1
              ? 'active installment'
              : 'active installments'}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-t-xs bg-[#6E5440] shrink-0" />
            <span className={isOled ? 'text-slate-400' : 'text-slate-500'}>
              {language === 'pt-BR' ? 'Parcela do mês:' : 'Monthly installment:'}
            </span>
            <span className={`font-bold ${isOled ? 'text-white' : 'text-slate-900'} dark:text-white`}>
              {formatCurrency(activePoint.monthlyCommitment, currency)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full border shrink-0 ${
                isOled ? 'bg-slate-400 border-[#21262D]' : 'bg-slate-600 border-white'
              }`}
            />
            <span className={isOled ? 'text-slate-400' : 'text-slate-500'}>
              {language === 'pt-BR' ? 'Saldo devedor restante:' : 'Remaining balance:'}
            </span>
            <span className={`font-bold ${isOled ? 'text-white' : 'text-slate-900'} dark:text-white`}>
              {formatCurrency(activePoint.remainingBalance, currency)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
