import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
  CircleDashed,
  MapPin,
  Zap,
  X,
} from 'lucide-react';
import { AppLanguage, AppTheme, FuelLog, FuelType } from '../types';
import {
  formatCurrency,
  formatMonthLabel,
  getCurrentMonthStr,
  getTodayDateStr,
} from '../utils/format';
import { TRANSLATIONS } from '../utils/i18n';
import { FuelLogModal } from './FuelLogModal';
import { AppIcon } from './icons';

const SWIPE_REVEAL_WIDTH = 100;
const SWIPE_SNAP_THRESHOLD = 45;
const SWIPE_MAX_DRAG = 125;

const formatShortNumericDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const day = parts[2].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[0].slice(-2);
    return `${day}/${month}/${year}`;
  }
  return dateStr;
};

interface FuelViewProps {
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  theme: AppTheme;
  tankCapacity: number;
  fuelLogs: FuelLog[];
  onSaveFuelLog: (data: {
    id?: string;
    date: string;
    odometer: number;
    pricePerLiter: number;
    totalCost: number;
    liters: number;
    fuelType: FuelType;
    stationName: string;
    isFullTank: boolean;
    notes?: string;
  }) => Promise<void>;
  onDeleteFuelLog: (id: string) => Promise<void>;
  onUpdateTankCapacity: (tankCapacity: number) => Promise<void>;
  openRefuelTrigger?: number;
  onModalOpenChange?: (open: boolean) => void;
}

interface EnrichedFuelLog extends FuelLog {
  distanceSinceLast: number | null;
  kmPerLiter: number | null;
  costPerKm: number | null;
}

interface SwipeableFuelRowProps {
  log: EnrichedFuelLog;
  currency: string;
  language: AppLanguage;
  isOpen: boolean;
  anyRowOpen: boolean;
  onSetOpenRow: (id: string | null) => void;
  onOpenEdit: (log: FuelLog) => void;
  onDeleteFuelLog: (id: string) => Promise<void>;
}

const SwipeableFuelRow: React.FC<SwipeableFuelRowProps> = ({
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
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const gestureRef = useRef<{
    startX: number;
    startY: number;
    initialOffset: number;
    lock: 'none' | 'horizontal' | 'vertical';
    currentOffset: number;
    active: boolean;
  }>({
    startX: 0,
    startY: 0,
    initialOffset: 0,
    lock: 'none',
    currentOffset: 0,
    active: false,
  });

  const lastSwipeTimeRef = useRef<number>(0);

  const clampSwipeOffset = (rawOffset: number): number => {
    if (rawOffset > 0) return 0;
    if (rawOffset < -SWIPE_REVEAL_WIDTH) {
      const extra = rawOffset + SWIPE_REVEAL_WIDTH;
      return Math.max(-SWIPE_MAX_DRAG, -SWIPE_REVEAL_WIDTH + extra * 0.25);
    }
    return rawOffset;
  };

  const finishSwipeGesture = () => {
    const g = gestureRef.current;
    if (!g.active) return;
    g.active = false;

    if (g.lock === 'horizontal') {
      lastSwipeTimeRef.current = Date.now();
      const finalOffset = g.currentOffset;
      if (g.initialOffset === 0) {
        if (finalOffset <= -SWIPE_SNAP_THRESHOLD) {
          onSetOpenRow(log.id);
        } else {
          onSetOpenRow(null);
        }
      } else {
        if (finalOffset > -SWIPE_REVEAL_WIDTH + 25) {
          onSetOpenRow(null);
        } else {
          onSetOpenRow(log.id);
        }
      }
    }

    g.lock = 'none';
    setIsDragging(false);
    setDragOffset(null);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (anyRowOpen && !isOpen) {
      onSetOpenRow(null);
    }
    const initial = isOpen ? -SWIPE_REVEAL_WIDTH : 0;
    gestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initialOffset: initial,
      lock: 'none',
      currentOffset: initial,
      active: true,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g.active || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - g.startX;
    const deltaY = touch.clientY - g.startY;

    if (g.lock === 'none') {
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        g.lock = 'vertical';
        g.active = false;
        return;
      }
      g.lock = 'horizontal';
      setIsDragging(true);
    }

    if (g.lock === 'horizontal') {
      const next = clampSwipeOffset(g.initialOffset + deltaX);
      g.currentOffset = next;
      setDragOffset(next);
    }
  };

  const handleTouchEnd = () => {
    finishSwipeGesture();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (anyRowOpen && !isOpen) {
      onSetOpenRow(null);
    }
    const initial = isOpen ? -SWIPE_REVEAL_WIDTH : 0;
    gestureRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialOffset: initial,
      lock: 'none',
      currentOffset: initial,
      active: true,
    };

    const handleWindowMouseMove = (ev: MouseEvent) => {
      const g = gestureRef.current;
      if (!g.active) return;
      const deltaX = ev.clientX - g.startX;
      const deltaY = ev.clientY - g.startY;

      if (g.lock === 'none') {
        if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          g.lock = 'vertical';
          g.active = false;
          return;
        }
        g.lock = 'horizontal';
        setIsDragging(true);
      }

      if (g.lock === 'horizontal') {
        const next = clampSwipeOffset(g.initialOffset + deltaX);
        g.currentOffset = next;
        setDragOffset(next);
      }
    };

    const handleWindowMouseUp = () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      finishSwipeGesture();
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  const handleRowClick = () => {
    if (Date.now() - lastSwipeTimeRef.current < 260) return;
    if (isOpen || anyRowOpen) {
      onSetOpenRow(null);
      return;
    }
    onOpenEdit(log);
  };

  const translateX = dragOffset !== null ? dragOffset : isOpen ? -SWIPE_REVEAL_WIDTH : 0;

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

export const FuelView: React.FC<FuelViewProps> = ({
  selectedMonth,
  currency,
  language,
  theme,
  tankCapacity,
  fuelLogs,
  onSaveFuelLog,
  onDeleteFuelLog,
  onUpdateTankCapacity,
  openRefuelTrigger,
  onModalOpenChange,
}) => {
  const t = TRANSLATIONS[language];
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  useEffect(() => {
    onModalOpenChange?.(showForm);
  }, [showForm, onModalOpenChange]);

  // Click outside to dismiss any open swipe row
  useEffect(() => {
    if (!openRowId) return;
    const handleDocClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(`[data-swipe-row-id="${openRowId}"]`)) {
        setOpenRowId(null);
      }
    };
    window.addEventListener('touchstart', handleDocClick);
    window.addEventListener('mousedown', handleDocClick);
    return () => {
      window.removeEventListener('touchstart', handleDocClick);
      window.removeEventListener('mousedown', handleDocClick);
    };
  }, [openRowId]);

  // Enrich fuel logs in chronological order (by odometer asc, date asc)
  const enrichedLogsDesc = useMemo<EnrichedFuelLog[]>(() => {
    const sortedAsc = [...fuelLogs].sort(
      (a, b) =>
        a.odometer - b.odometer ||
        a.date.localeCompare(b.date) ||
        a.createdAt.localeCompare(b.createdAt)
    );

    const enrichedAsc: EnrichedFuelLog[] = [];
    let lastFullTankIndex = -1;

    for (let i = 0; i < sortedAsc.length; i++) {
      const current = sortedAsc[i];
      if (i === 0) {
        enrichedAsc.push({
          ...current,
          distanceSinceLast: null,
          kmPerLiter: null,
          costPerKm: null,
        });
        if (current.isFullTank) lastFullTankIndex = 0;
        continue;
      }

      const prev = sortedAsc[i - 1];
      const deltaKm = current.odometer - prev.odometer;
      const distanceSinceLast = deltaKm > 0 ? deltaKm : null;

      let kmPerLiter: number | null = null;
      let costPerKm: number | null = null;

      if (distanceSinceLast && current.liters > 0) {
        if (current.isFullTank && lastFullTankIndex >= 0) {
          const totalDistSinceFull = current.odometer - sortedAsc[lastFullTankIndex].odometer;
          let accumulatedLiters = 0;
          let accumulatedCost = 0;
          for (let j = lastFullTankIndex + 1; j <= i; j++) {
            accumulatedLiters += sortedAsc[j].liters;
            accumulatedCost += sortedAsc[j].totalCost;
          }
          if (totalDistSinceFull > 0 && accumulatedLiters > 0) {
            kmPerLiter = totalDistSinceFull / accumulatedLiters;
            costPerKm = accumulatedCost / totalDistSinceFull;
          }
        } else {
          kmPerLiter = distanceSinceLast / current.liters;
          costPerKm = current.totalCost / distanceSinceLast;
        }
      }

      if (current.isFullTank) {
        lastFullTankIndex = i;
      }

      enrichedAsc.push({
        ...current,
        distanceSinceLast,
        kmPerLiter,
        costPerKm,
      });
    }

    return enrichedAsc.reverse();
  }, [fuelLogs]);

  const highestOdometer = useMemo(() => {
    if (fuelLogs.length === 0) return null;
    return Math.max(...fuelLogs.map((f) => f.odometer));
  }, [fuelLogs]);

  const handleOpenNew = () => {
    setEditingLog(null);
    setShowForm(true);
  };

  useEffect(() => {
    if (openRefuelTrigger && openRefuelTrigger > 0) {
      handleOpenNew();
    }
  }, [openRefuelTrigger]);

  const handleOpenEdit = (log: FuelLog) => {
    setEditingLog(log);
    setShowForm(true);
  };

  // Consolidated Key Metrics
  const metrics = useMemo(() => {
    const monthLogs = enrichedLogsDesc.filter((l) => l.date.startsWith(selectedMonth));

    let monthSpend = 0;
    let monthLiters = 0;
    let monthGasolineLiters = 0;
    let monthEthanolLiters = 0;
    let monthDistance = 0;

    for (const l of monthLogs) {
      monthSpend += l.totalCost;
      monthLiters += l.liters;
      if (l.fuelType === 'gasoline') monthGasolineLiters += l.liters;
      else monthEthanolLiters += l.liters;
      if (l.distanceSinceLast && l.distanceSinceLast > 0) {
        monthDistance += l.distanceSinceLast;
      }
    }

    const logsWithEfficiency = enrichedLogsDesc.filter(
      (l) => l.kmPerLiter !== null && l.kmPerLiter > 0 && l.kmPerLiter < 60
    );

    const monthLogsWithEfficiency = monthLogs.filter(
      (l) => l.kmPerLiter !== null && l.kmPerLiter > 0 && l.kmPerLiter < 60
    );

    const activeEffList =
      monthLogsWithEfficiency.length > 0 ? monthLogsWithEfficiency : logsWithEfficiency;

    const avgKmPerLiter =
      activeEffList.length > 0
        ? activeEffList.reduce((acc, l) => acc + (l.kmPerLiter || 0), 0) / activeEffList.length
        : null;

    const effectiveTankSize = tankCapacity > 0 ? tankCapacity : 54;
    const estimatedFullTankRange = avgKmPerLiter ? avgKmPerLiter * effectiveTankSize : null;

    const currentMonthStr = getCurrentMonthStr();
    const [selYear, selMon] = selectedMonth.split('-').map(Number);
    const daysInSelectedMonth = new Date(selYear, selMon, 0).getDate();

    const monthTotalsMap = new Map<string, number>();
    for (const l of fuelLogs) {
      const m = l.date.slice(0, 7);
      monthTotalsMap.set(m, (monthTotalsMap.get(m) || 0) + l.totalCost);
    }
    const historicalAvgSpend =
      monthTotalsMap.size > 0
        ? Array.from(monthTotalsMap.values()).reduce((a, b) => a + b, 0) / monthTotalsMap.size
        : 0;

    let projectedMonthlySpend = monthSpend;
    if (selectedMonth === currentMonthStr) {
      const todayDay = new Date().getDate();
      if (monthSpend > 0) {
        const effectiveElapsedDays = Math.max(todayDay, 7);
        const paceProjection = (monthSpend / effectiveElapsedDays) * daysInSelectedMonth;
        projectedMonthlySpend = Math.max(monthSpend, paceProjection);
      } else {
        projectedMonthlySpend = historicalAvgSpend;
      }
    } else if (monthSpend === 0 && historicalAvgSpend > 0) {
      projectedMonthlySpend = historicalAvgSpend;
    }

    return {
      monthLogs,
      monthSpend,
      monthLiters,
      monthGasolineLiters,
      monthEthanolLiters,
      monthDistance,
      avgKmPerLiter,
      estimatedFullTankRange,
      effectiveTankSize,
      projectedMonthlySpend,
    };
  }, [enrichedLogsDesc, selectedMonth, tankCapacity, fuelLogs]);

  return (
    <div className="space-y-4">
      {/* 1. SINGLE UNIFIED FUEL METRICS CARD (Clean 2x3 / 3-column Responsive Grid) */}
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
            onClick={handleOpenNew}
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

      {/* 2. REFUELING HISTORY LIST (Swipeable Mobile Architecture) */}
      <div className="oled-main-card rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            {t.refuelingHistoryTitle}
          </h3>
          <span className="text-xs font-semibold text-slate-400">
            {t.fillUpsCount(enrichedLogsDesc.length)}
          </span>
        </div>

        {enrichedLogsDesc.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto">
              <AppIcon name="posto-gasolina" size={24} />
            </div>
            <p className="text-sm font-bold text-slate-800">{t.noRefuelingsTitle}</p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">{t.noRefuelingsDesc}</p>
            <button
              type="button"
              onClick={handleOpenNew}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold active:scale-95 transition-all shadow-xs"
            >
              <Plus size={14} className="mr-1" />
              {t.newRefuelBtn}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {enrichedLogsDesc.map((log) => (
              <SwipeableFuelRow
                key={log.id}
                log={log}
                currency={currency}
                language={language}
                isOpen={openRowId === log.id}
                anyRowOpen={openRowId !== null}
                onSetOpenRow={setOpenRowId}
                onOpenEdit={handleOpenEdit}
                onDeleteFuelLog={onDeleteFuelLog}
              />
            ))}
          </div>
        )}
      </div>

      {/* 3. REFUELING MODAL */}
      <FuelLogModal
        isOpen={showForm}
        editingLog={editingLog}
        highestOdometer={highestOdometer}
        tankCapacity={tankCapacity}
        language={language}
        theme={theme}
        onClose={() => {
          setShowForm(false);
          setEditingLog(null);
        }}
        onSaveFuelLog={async (data) => {
          await onSaveFuelLog({
            ...data,
            stationName: data.stationName || '',
          });
          setShowForm(false);
          setEditingLog(null);
        }}
        onUpdateTankCapacity={onUpdateTankCapacity}
      />
    </div>
  );
};
