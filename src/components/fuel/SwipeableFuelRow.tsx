import React from 'react';
import { Pencil, Trash2, Zap } from 'lucide-react';
import { AppLanguage, FuelLog } from '../../types';
import { formatCurrency } from '../../utils/format';
import { TRANSLATIONS } from '../../utils/i18n';
import { AppIcon } from '../icons';
import { EnrichedFuelLog, formatShortNumericDate } from './fuelMetrics';
import { SWIPE_REVEAL_WIDTH, useFuelRowSwipe } from './useFuelRowSwipe';

export interface SwipeableFuelRowProps {
  log: EnrichedFuelLog;
  currency: string;
  language: AppLanguage;
  isOpen: boolean;
  anyRowOpen: boolean;
  onSetOpenRow: (id: string | null) => void;
  onOpenEdit: (log: FuelLog) => void;
  onDeleteFuelLog: (id: string) => Promise<void>;
}

export const SwipeableFuelRow: React.FC<SwipeableFuelRowProps> = ({
  log,
  currency,
  language,
  isOpen,
  anyRowOpen,
  onSetOpenRow,
  onOpenEdit,
  onDeleteFuelLog,
}) => {
  const t = TRANSLATIONS[language];
  const {
    dragOffset,
    isDragging,
    translateX,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleRowClick,
  } = useFuelRowSwipe({
    log,
    isOpen,
    anyRowOpen,
    onSetOpenRow,
    onOpenEdit,
  });

  return (
    <div
      data-swipe-row-id={log.id}
      className="relative overflow-hidden select-none"
    >
      {/* Background Action Layer (Revealed beneath on left-swipe) */}
      <div
        className="swipe-actions-layer absolute inset-y-0 right-0 flex items-center justify-end gap-2 pr-3 pl-2 z-0"
        style={{ width: `${SWIPE_REVEAL_WIDTH}px` }}
        aria-hidden={!isOpen && dragOffset === null}
      >
        {/* 1. Edit Refueling */}
        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          onClick={(e) => {
            e.stopPropagation();
            onSetOpenRow(null);
            onOpenEdit(log);
          }}
          className="swipe-action-btn w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0"
          title={t.editTooltip}
        >
          <Pencil size={15} />
        </button>

        {/* 2. Delete Refueling */}
        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          onClick={(e) => {
            e.stopPropagation();
            onSetOpenRow(null);
            onDeleteFuelLog(log.id);
          }}
          className="swipe-action-btn-danger w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0"
          title={t.deleteTooltip}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Foreground Content Layer (Swipeable surface card) */}
      <div
        role="button"
        tabIndex={0}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => {
          e.preventDefault();
          onSetOpenRow(isOpen ? null : log.id);
        }}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenEdit(log);
          } else if (e.key === 'ArrowLeft') {
            onSetOpenRow(log.id);
          } else if (e.key === 'ArrowRight' || e.key === 'Escape') {
            onSetOpenRow(null);
          }
        }}
        style={{
          transform: `translate3d(${translateX}px, 0, 0)`,
          transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          willChange: isDragging || isOpen ? 'transform' : 'auto',
        }}
        className="swipe-foreground-layer relative z-10 flex items-center justify-between p-3 sm:p-3.5 transition-colors gap-3 select-none cursor-pointer"
      >
        {/* Left/Center: Fuel Icon + Station, Badges & Efficiency */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
              log.fuelType === 'ethanol'
                ? 'bg-emerald-500/15 text-emerald-500'
                : 'bg-amber-500/15 text-amber-500'
            }`}
          >
            <AppIcon name="posto-gasolina" size={19} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-bold text-slate-900 truncate max-w-[170px] sm:max-w-xs">
                {log.stationName ||
                  (log.fuelType === 'ethanol'
                    ? language === 'pt-BR'
                      ? 'Posto • Etanol'
                      : 'Station • Ethanol'
                    : language === 'pt-BR'
                    ? 'Posto • Gasolina'
                    : 'Station • Gasoline')}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  log.fuelType === 'ethanol'
                    ? 'bg-emerald-500/15 text-emerald-500'
                    : 'bg-amber-500/15 text-amber-500'
                }`}
              >
                {log.fuelType === 'ethanol' ? t.fuelEthanol : t.fuelGasoline}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
                {log.isFullTank ? t.fullTankLabel : t.partialTankLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-0.5">
              <span className="font-semibold text-slate-700">
                {log.odometer.toLocaleString(language === 'pt-BR' ? 'pt-BR' : 'en-US')} km
              </span>
              {log.distanceSinceLast !== null && (
                <span>
                  • +{log.distanceSinceLast.toLocaleString(language === 'pt-BR' ? 'pt-BR' : 'en-US')} km
                </span>
              )}
              {log.kmPerLiter !== null && (
                <span className="font-bold text-emerald-500 flex items-center gap-0.5">
                  • <Zap size={11} className="inline shrink-0" /> {log.kmPerLiter.toFixed(2)} km/L
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Amount & Date strictly DD/MM/AA stacked vertically */}
        <div className="flex flex-col items-end justify-center text-right shrink-0">
          <span className="text-sm sm:text-base font-bold text-rose-500 block leading-tight">
            -{formatCurrency(log.totalCost, currency)}
          </span>
          <span className="text-xs text-slate-400 font-medium mt-0.5 block leading-tight">
            {formatShortNumericDate(log.date)}
          </span>
        </div>
      </div>
    </div>
  );
};
