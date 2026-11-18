import React, { memo, useCallback, useId, useMemo } from 'react';
import { Cell, Pie, PieChart } from 'recharts';
import { AppLanguage } from '../../types';
import { formatCurrency } from '../../utils/format';
import { CategorySliceItem } from './reportsTypes';

interface ReportsDonutChartProps {
  ariaLabel: string;
  centerLabel: string;
  amountColorClass: string;
  totalAmount: number;
  slices: CategorySliceItem[];
  activeSliceId: string | null;
  activeSlice: CategorySliceItem | null;
  currency: string;
  language: AppLanguage;
  isOled: boolean;
  onToggleSlice: (sliceId: string) => void;
  onResetSlice: () => void;
}

const CHART_SIZE = 220;
const INNER_RADIUS = 70;
const OUTER_RADIUS = 98;

const CELL_BASE_STYLE: React.CSSProperties = {
  transition: 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1), opacity 220ms ease-out',
  transformOrigin: 'center',
  transformBox: 'fill-box',
  cursor: 'pointer',
};

interface DonutPieSvgProps {
  ariaLabel: string;
  slices: CategorySliceItem[];
  onToggleSlice: (sliceId: string) => void;
}

/**
 * Isolated Recharts Pie SVG wrapper memoized separately from selection state
 * so toggling slices or expanding accordions never triggers SVG path re-renders.
 */
const DonutPieSvg = memo<DonutPieSvgProps>(({ ariaLabel, slices, onToggleSlice }) => {
  const handlePieClick = useCallback(
    (_entry: unknown, index: number) => {
      const target = slices[index];
      if (target) {
        onToggleSlice(target.id);
      }
    },
    [slices, onToggleSlice]
  );

  return (
    <div role="img" aria-label={ariaLabel} className="w-[220px] h-[220px]">
      <PieChart width={CHART_SIZE} height={CHART_SIZE} className="overflow-visible">
        <Pie
          data={slices}
          dataKey="amount"
          nameKey="name"
          cx="50%"
          cy="50%"
          startAngle={90}
          endAngle={-270}
          innerRadius={INNER_RADIUS}
          outerRadius={OUTER_RADIUS}
          paddingAngle={slices.length > 1 ? 2 : 0}
          cornerRadius={4}
          stroke="none"
          isAnimationActive={true}
          animationBegin={0}
          animationDuration={380}
          animationEasing="ease-out"
          onClick={handlePieClick}
        >
          {slices.map((slice) => (
            <Cell key={slice.id} fill={slice.color} style={CELL_BASE_STYLE} />
          ))}
        </Pie>
      </PieChart>
    </div>
  );
});

DonutPieSvg.displayName = 'DonutPieSvg';

/**
 * Hardware-accelerated Donut Chart with fixed dimensions (zero ResizeObserver
 * layout thrashing) and CSS GPU compositor slice selection transitions.
 */
export const ReportsDonutChart = memo<ReportsDonutChartProps>(
  ({
    ariaLabel,
    centerLabel,
    amountColorClass,
    totalAmount,
    slices,
    activeSliceId,
    activeSlice,
    currency,
    language,
    isOled,
    onToggleSlice,
    onResetSlice,
  }) => {
    const rawId = useId();
    const stageId = useMemo(
      () => `donut-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`,
      [rawId]
    );

    const activeSliceIndex = useMemo(
      () => (activeSliceId ? slices.findIndex((s) => s.id === activeSliceId) : -1),
      [slices, activeSliceId]
    );

    const selectionStyles = useMemo(() => {
      if (activeSliceIndex < 0) return null;
      return `
        #${stageId} .recharts-pie-sector .recharts-sector {
          transform: scale(0.985);
          opacity: 0.38;
        }
        #${stageId} .recharts-pie-sector:nth-of-type(${activeSliceIndex + 1}) .recharts-sector {
          transform: scale(1.045);
          opacity: 1;
        }
      `;
    }, [stageId, activeSliceIndex]);

    const sliceCount = slices.length;

    return (
      <div className="my-2 flex flex-col items-center justify-center">
        <div
          id={stageId}
          className="w-[220px] h-[220px] mx-auto flex items-center justify-center relative"
        >
          {selectionStyles && <style>{selectionStyles}</style>}

          <DonutPieSvg
            ariaLabel={ariaLabel}
            slices={slices}
            onToggleSlice={onToggleSlice}
          />

          {/* Center Donut Readout Overlay */}
          <button
            type="button"
            onClick={onResetSlice}
            className="absolute inset-[42px] z-10 rounded-full flex flex-col items-center justify-center text-center px-2 focus:outline-none transition-all duration-200 ease-out cursor-pointer"
          >
            <span
              key={activeSliceId ?? 'total'}
              className="flex flex-col items-center justify-center w-full transition-all duration-200 ease-out animate-in fade-in zoom-in-95"
            >
              <span
                className={`text-[11px] font-bold uppercase tracking-wider truncate max-w-[120px] ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                }`}
              >
                {centerLabel}
              </span>
              <span className={`text-lg font-black tracking-tight mt-0.5 ${amountColorClass}`}>
                {formatCurrency(activeSlice ? activeSlice.amount : totalAmount, currency)}
              </span>
              <span
                className={`text-[11px] font-semibold mt-0.5 ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                }`}
              >
                {activeSlice
                  ? `${activeSlice.share.toFixed(1)}%`
                  : `100% • ${sliceCount} ${
                      language === 'pt-BR'
                        ? sliceCount === 1
                          ? 'categoria'
                          : 'categorias'
                        : sliceCount === 1
                        ? 'category'
                        : 'categories'
                    }`}
              </span>
            </span>
          </button>
        </div>
      </div>
    );
  }
);

ReportsDonutChart.displayName = 'ReportsDonutChart';
