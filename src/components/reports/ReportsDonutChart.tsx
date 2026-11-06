import React from 'react';
import { AppLanguage } from '../../types';
import { formatCurrency } from '../../utils/format';
import {
  CategorySliceItem,
  ComputedDonutArc,
  DONUT_CENTER,
  DONUT_RADIUS,
  DONUT_STROKE_WIDTH,
  DONUT_SVG_SIZE,
} from './reportsTypes';

interface ReportsDonutChartProps {
  ariaLabel: string;
  centerLabel: string;
  amountColorClass: string;
  totalAmount: number;
  sliceCount: number;
  computedArcs: ComputedDonutArc[];
  activeSliceId: string | null;
  activeSlice: CategorySliceItem | null;
  donutAnimPhase: 'init' | 'drawing' | 'done';
  currency: string;
  language: AppLanguage;
  isOled: boolean;
  onToggleSlice: (sliceId: string) => void;
  onResetSlice: () => void;
}

export const ReportsDonutChart: React.FC<ReportsDonutChartProps> = ({
  ariaLabel,
  centerLabel,
  amountColorClass,
  totalAmount,
  sliceCount,
  computedArcs,
  activeSliceId,
  activeSlice,
  donutAnimPhase,
  currency,
  language,
  isOled,
  onToggleSlice,
  onResetSlice,
}) => {
  return (
    <div className="flex flex-col items-center justify-center my-2">
      <div className="relative w-60 h-60 flex items-center justify-center">
        <svg
          viewBox={`0 0 ${DONUT_SVG_SIZE} ${DONUT_SVG_SIZE}`}
          className="w-full h-full -rotate-90 overflow-visible"
          role="img"
          aria-label={ariaLabel}
        >
          {/* Base track ring */}
          <circle
            cx={DONUT_CENTER}
            cy={DONUT_CENTER}
            r={DONUT_RADIUS}
            fill="none"
            stroke={isOled ? '#161B22' : '#E2E8F0'}
            strokeWidth={DONUT_STROKE_WIDTH}
          />

          {/* Proportional Category Slices */}
          {computedArcs.map((arc) => {
            const isSelected = activeSliceId === arc.id;
            const isDimmed = activeSliceId !== null && !isSelected;

            const currentOffset =
              donutAnimPhase === 'init' ? arc.startOffset : arc.dashOffset;

            const transitionStyle =
              donutAnimPhase === 'drawing'
                ? `stroke-dashoffset ${arc.animDuration}ms cubic-bezier(0.16, 1, 0.3, 1) ${arc.animDelay}ms, stroke-width 240ms ease-out, opacity 240ms ease-out`
                : 'stroke-width 240ms ease-out, opacity 240ms ease-out';

            return (
              <circle
                key={arc.id}
                cx={DONUT_CENTER}
                cy={DONUT_CENTER}
                r={DONUT_RADIUS}
                fill="none"
                stroke={arc.color}
                strokeWidth={isSelected ? DONUT_STROKE_WIDTH + 6 : DONUT_STROKE_WIDTH}
                strokeDasharray={arc.strokeDasharray}
                strokeDashoffset={currentOffset}
                strokeLinecap="butt"
                onClick={() => onToggleSlice(arc.id)}
                className="cursor-pointer"
                style={{
                  opacity: isDimmed ? 0.3 : 1,
                  transition: transitionStyle,
                }}
              />
            );
          })}
        </svg>

        {/* Center Donut Readout */}
        <button
          type="button"
          onClick={onResetSlice}
          className={`absolute inset-12 rounded-full flex flex-col items-center justify-center text-center px-2 focus:outline-none transition-all duration-500 ease-out ${
            donutAnimPhase === 'init' ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}
        >
          <span
            className={`text-[11px] font-bold uppercase tracking-wider truncate max-w-[130px] ${
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
        </button>
      </div>
    </div>
  );
};
