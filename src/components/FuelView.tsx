import React, { useState, useMemo, useEffect } from 'react';
import {
  Fuel,
  Plus,
  Gauge,
  Droplets,
  MapPin,
  TrendingUp,
  Compass,
  Pencil,
  Trash2,
  CheckCircle2,
  CircleDashed,
  Calendar,
  BarChart3,
  Activity,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts';
import { AppLanguage, AppTheme, FuelLog, FuelType } from '../types';
import {
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
  formatShortMonthLabel,
  getCurrentMonthStr,
  getTodayDateStr,
  shiftMonth,
} from '../utils/format';
import { TRANSLATIONS } from '../utils/i18n';

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
}

interface EnrichedFuelLog extends FuelLog {
  distanceSinceLast: number | null;
  kmPerLiter: number | null;
  costPerKm: number | null;
}

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
}) => {
  const t = TRANSLATIONS[language];
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [date, setDate] = useState(getTodayDateStr());
  const [fuelType, setFuelType] = useState<FuelType>('gasoline');
  const [odometer, setOdometer] = useState('');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [liters, setLiters] = useState('');
  const [stationName, setStationName] = useState('');
  const [isFullTank, setIsFullTank] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Tank size inline input
  const [tankInput, setTankInput] = useState(String(tankCapacity || 50));

  const gridStroke = theme === 'oled' ? '#21262D' : '#E2E8F0';
  const axisTickColor = theme === 'oled' ? '#94A3B8' : '#64748B';
  const tooltipStyle = useMemo(
    () => ({
      borderRadius: '12px',
      border: `1px solid ${theme === 'oled' ? '#21262D' : '#E2E8F0'}`,
      backgroundColor: theme === 'oled' ? '#0D1117' : '#FFFFFF',
      color: theme === 'oled' ? '#F8FAFC' : '#0F172A',
      fontSize: '12px',
    }),
    [theme]
  );

  // Enrich fuel logs in chronological order (by odometer asc, date asc)
  const enrichedLogsDesc = useMemo<EnrichedFuelLog[]>(() => {
    const sortedAsc = [...fuelLogs].sort(
      (a, b) => a.odometer - b.odometer || a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
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
          // True full-tank to full-tank consumption calculation (including any partial top-ups in between)
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
          // Segment estimate between consecutive refuelings
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

  // Smart auto-calculation when typing Price/L, Total Cost, or Liters
  const handlePriceChange = (val: string) => {
    setPricePerLiter(val);
    const p = parseFloat(val.replace(',', '.'));
    const c = parseFloat(totalCost.replace(',', '.'));
    const l = parseFloat(liters.replace(',', '.'));
    if (!Number.isNaN(p) && p > 0) {
      if (!Number.isNaN(c) && c > 0) {
        setLiters((c / p).toFixed(2));
      } else if (!Number.isNaN(l) && l > 0) {
        setTotalCost((p * l).toFixed(2));
      }
    }
  };

  const handleTotalCostChange = (val: string) => {
    setTotalCost(val);
    const c = parseFloat(val.replace(',', '.'));
    const p = parseFloat(pricePerLiter.replace(',', '.'));
    const l = parseFloat(liters.replace(',', '.'));
    if (!Number.isNaN(c) && c > 0) {
      if (!Number.isNaN(p) && p > 0) {
        setLiters((c / p).toFixed(2));
      } else if (!Number.isNaN(l) && l > 0) {
        setPricePerLiter((c / l).toFixed(3));
      }
    }
  };

  const handleLitersChange = (val: string) => {
    setLiters(val);
    const l = parseFloat(val.replace(',', '.'));
    const p = parseFloat(pricePerLiter.replace(',', '.'));
    const c = parseFloat(totalCost.replace(',', '.'));
    if (!Number.isNaN(l) && l > 0) {
      if (!Number.isNaN(p) && p > 0) {
        setTotalCost((p * l).toFixed(2));
      } else if (!Number.isNaN(c) && c > 0) {
        setPricePerLiter((c / l).toFixed(3));
      }
    }
  };

  const handleOpenNew = () => {
    setEditingId(null);
    setDate(getTodayDateStr());
    setFuelType('gasoline');
    setOdometer('');
    setPricePerLiter('');
    setTotalCost('');
    setLiters('');
    setStationName('');
    setIsFullTank(true);
    setShowForm(true);
  };

  useEffect(() => {
    if (openRefuelTrigger && openRefuelTrigger > 0) {
      handleOpenNew();
    }
  }, [openRefuelTrigger]);

  const handleOpenEdit = (log: FuelLog) => {
    setEditingId(log.id);
    setDate(log.date);
    setFuelType(log.fuelType);
    setOdometer(String(log.odometer));
    setPricePerLiter(String(log.pricePerLiter));
    setTotalCost(String(log.totalCost));
    setLiters(String(log.liters));
    setStationName(log.stationName || '');
    setIsFullTank(log.isFullTank);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const odo = parseFloat(odometer.replace(',', '.'));
    const price = parseFloat(pricePerLiter.replace(',', '.'));
    const cost = parseFloat(totalCost.replace(',', '.'));
    const lit = parseFloat(liters.replace(',', '.'));

    if (
      Number.isNaN(odo) ||
      Number.isNaN(price) ||
      Number.isNaN(cost) ||
      Number.isNaN(lit) ||
      price <= 0 ||
      cost <= 0 ||
      lit <= 0
    ) {
      return;
    }

    setSubmitting(true);
    try {
      await onSaveFuelLog({
        id: editingId || undefined,
        date,
        odometer: odo,
        pricePerLiter: price,
        totalCost: cost,
        liters: lit,
        fuelType,
        stationName: stationName.trim(),
        isFullTank,
      });
      setShowForm(false);
      setEditingId(null);
    } finally {
      setSubmitting(false);
    }
  };

  // Monthly & All-Time Metrics + Projections
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

    // Overall Car Efficiency (km/L) and Cost/km
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

    const avgCostPerKm =
      activeEffList.length > 0
        ? activeEffList.reduce((acc, l) => acc + (l.costPerKm || 0), 0) / activeEffList.length
        : null;

    // Estimated Full Tank Range (km) = Average km/L * Tank Capacity (L)
    const effectiveTankSize = tankCapacity > 0 ? tankCapacity : 50;
    const estimatedFullTankRange = avgKmPerLiter ? avgKmPerLiter * effectiveTankSize : null;

    // Monthly Spend Projection
    const currentMonthStr = getCurrentMonthStr();
    const [selYear, selMon] = selectedMonth.split('-').map(Number);
    const daysInSelectedMonth = new Date(selYear, selMon, 0).getDate();

    // Calculate historical monthly average fuel spend across months that have fuel logs
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
    let isCurrentMonthProjection = false;

    if (selectedMonth === currentMonthStr) {
      isCurrentMonthProjection = true;
      const todayDay = new Date().getDate();
      // If we have multiple fill-ups with dates, estimate daily cost burn rate
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
      avgCostPerKm,
      estimatedFullTankRange,
      effectiveTankSize,
      projectedMonthlySpend,
      isCurrentMonthProjection,
    };
  }, [enrichedLogsDesc, selectedMonth, tankCapacity, fuelLogs]);

  // 6-Month Fuel Spending & Liters Chart Data
  const sixMonthFuelChart = useMemo(() => {
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      months.push(shiftMonth(selectedMonth, -i));
    }

    return months.map((m) => {
      let spend = 0;
      let vol = 0;
      let dist = 0;
      for (const l of enrichedLogsDesc) {
        if (l.date.startsWith(m)) {
          spend += l.totalCost;
          vol += l.liters;
          if (l.distanceSinceLast) dist += l.distanceSinceLast;
        }
      }
      return {
        month: m,
        label: formatShortMonthLabel(m, language),
        Spend: Number(spend.toFixed(2)),
        Liters: Number(vol.toFixed(2)),
        Distance: Number(dist.toFixed(0)),
      };
    });
  }, [enrichedLogsDesc, selectedMonth, language]);

  // Efficiency & Price/L Evolution Chart Data (chronological)
  const efficiencyChartData = useMemo(() => {
    return [...enrichedLogsDesc]
      .reverse()
      .slice(-12)
      .map((l) => ({
        date: formatShortDate(l.date, language),
        kmPerLiter: l.kmPerLiter ? Number(l.kmPerLiter.toFixed(2)) : null,
        pricePerLiter: Number(l.pricePerLiter.toFixed(2)),
      }));
  }, [enrichedLogsDesc, language]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-500">
            <Fuel size={15} />
            {t.fuelHeaderBadge}
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">{t.fuelTitle}</h1>
          <p className="text-xs text-slate-500 max-w-2xl">{t.fuelSubtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Tank Capacity Setting */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
            <Droplets size={14} className="text-sky-500 shrink-0" />
            <span className="font-semibold text-slate-600">{t.tankSizeLabel}:</span>
            <input
              type="number"
              min="10"
              max="200"
              step="1"
              value={tankInput}
              onChange={(e) => setTankInput(e.target.value)}
              onBlur={() => {
                const parsed = parseFloat(tankInput);
                if (!Number.isNaN(parsed) && parsed > 0 && parsed !== tankCapacity) {
                  onUpdateTankCapacity(parsed);
                }
              }}
              className="w-14 px-2 py-1 rounded-lg border border-slate-200 text-center font-bold text-slate-900 bg-white"
            />
          </div>

          <button
            type="button"
            onClick={() => (showForm ? setShowForm(false) : handleOpenNew())}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-sm transition-all"
          >
            {showForm ? t.closeForm : t.newRefuelBtn}
          </button>
        </div>
      </div>

      {/* Add / Edit Refueling Modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
          onClick={() => {
            setShowForm(false);
            setEditingId(null);
          }}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="w-full max-w-2xl bg-white p-5 sm:p-6 rounded-t-3xl sm:rounded-2xl border border-amber-500/40 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Fuel size={18} className="text-amber-500" />
                  {editingId ? t.editRefuelTitle : t.newRefuelTitle}
                </h2>
                <span className="text-[11px] font-medium text-emerald-500">{t.autoExpenseNote}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

          {/* Fuel Type & Full/Partial Tank Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                {t.fuelTypeLabel}
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFuelType('gasoline')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    fuelType === 'gasoline'
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  ⛽ {t.fuelGasoline}
                </button>
                <button
                  type="button"
                  onClick={() => setFuelType('ethanol')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    fuelType === 'ethanol'
                      ? 'bg-emerald-500 text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  🌱 {t.fuelEthanol}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                {t.fillTypeLabel}
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setIsFullTank(true)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    isFullTank
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CheckCircle2 size={14} />
                  {t.fullTankLabel}
                </button>
                <button
                  type="button"
                  onClick={() => setIsFullTank(false)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    !isFullTank
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <CircleDashed size={14} />
                  {t.partialTankLabel}
                </button>
              </div>
            </div>
          </div>

          {/* Price per Liter, Total Cost, Liters (Auto-linked!), and Odometer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                {t.pricePerLiterLabel}
              </label>
              <input
                type="number"
                step="0.001"
                min="0.01"
                required
                placeholder="5.89"
                value={pricePerLiter}
                onChange={(e) => handlePriceChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                {t.totalCostLabel}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="250.00"
                value={totalCost}
                onChange={(e) => handleTotalCostChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                {t.litersLabel}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="42.44"
                value={liters}
                onChange={(e) => handleLitersChange(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-sky-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                {t.odometerLabel}
              </label>
              <input
                type="number"
                step="1"
                min="0"
                required
                placeholder={t.odometerPlaceholder}
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold"
              />
              {highestOdometer !== null && (
                <span className="block text-[11px] text-slate-400 mt-1">
                  {t.lastOdometerHint(highestOdometer)}
                </span>
              )}
            </div>
          </div>

          {/* Gas Station Name & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                {t.stationNameLabel}
              </label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder={t.stationPlaceholder}
                  value={stationName}
                  onChange={(e) => setStationName(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t.dateLabel}</label>
              <div className="relative">
                <Calendar size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100"
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-sm"
            >
              {submitting ? t.savingBtn : t.saveRefuelBtn}
            </button>
          </div>
          </form>
        </div>
      )}

      {/* 6 KPI REPORT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Monthly Fuel Spend */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t.monthlyFuelSpend} ({formatShortMonthLabel(selectedMonth, language)})
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <Fuel size={17} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-rose-500">
            {formatCurrency(metrics.monthSpend, currency)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {t.fillUpsCount(metrics.monthLogs.length)}
          </p>
        </div>

        {/* 2. Projected Monthly Fuel Spend */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t.projectedMonthlySpend}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <TrendingUp size={17} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {metrics.projectedMonthlySpend > 0
              ? formatCurrency(metrics.projectedMonthlySpend, currency)
              : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.isCurrentMonthProjection ? t.basedOnPace : t.historicalMonthAvg}
          </p>
        </div>

        {/* 3. Total Volume Purchased in Month */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t.monthlyVolume}
            </span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Droplets size={17} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-sky-500">
            {metrics.monthLiters.toFixed(2)} L
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {t.fuelGasoline}: {metrics.monthGasolineLiters.toFixed(1)}L • {t.fuelEthanol}:{' '}
            {metrics.monthEthanolLiters.toFixed(1)}L
          </p>
        </div>

        {/* 4. Distance Covered in Month */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t.monthlyDistance}
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
              <Gauge size={17} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {metrics.monthDistance.toLocaleString(language === 'pt-BR' ? 'pt-BR' : 'en-US')} km
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {highestOdometer !== null ? t.lastOdometerHint(highestOdometer) : '—'}
          </p>
        </div>

        {/* 5. Car Average Fuel Efficiency (km/L) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t.avgEfficiency}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Activity size={17} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-500">
            {metrics.avgKmPerLiter ? `${metrics.avgKmPerLiter.toFixed(2)} km/L` : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.avgCostPerKm
              ? `${t.costPerKmLabel}: ${formatCurrency(metrics.avgCostPerKm, currency)}/km`
              : language === 'pt-BR'
              ? 'Registre 2+ abastecimentos com odômetro'
              : 'Log 2+ fill-ups with odometer'}
          </p>
        </div>

        {/* 6. Estimated Range on a Full Tank */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {t.estimatedFullTankRange}
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Compass size={17} />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-slate-900">
            {metrics.estimatedFullTankRange
              ? `~${Math.round(metrics.estimatedFullTankRange).toLocaleString(
                  language === 'pt-BR' ? 'pt-BR' : 'en-US'
                )} km`
              : '—'}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {t.basedOnTankSize(metrics.effectiveTankSize)}
          </p>
        </div>
      </div>

      {/* CHARTS ROW */}
      {fuelLogs.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 6-Month Fuel Spend & Volume */}
          <div className="lg:col-span-6 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
              <BarChart3 size={18} className="text-amber-500" />
              {t.fuelMonthlyChartTitle}
            </h2>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sixMonthFuelChart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: axisTickColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: axisTickColor }} axisLine={false} tickLine={false} />
                  <RechartsTooltip
                    formatter={(value: number, name: string) => [
                      name === 'Spend' ? formatCurrency(Number(value), currency) : `${value} L`,
                      name === 'Spend' ? t.totalCostLabel : t.litersLabel,
                    ]}
                    contentStyle={tooltipStyle}
                  />
                  <Legend
                    formatter={(val) => (val === 'Spend' ? t.totalCostLabel : t.litersLabel)}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                  <Bar dataKey="Spend" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="Liters" fill="#0ea5e9" radius={[6, 6, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Efficiency (km/L) & Price/L Evolution */}
          <div className="lg:col-span-6 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/90 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
              <Activity size={18} className="text-emerald-500" />
              {t.fuelEfficiencyChartTitle}
            </h2>
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={efficiencyChartData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: axisTickColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: axisTickColor }} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={tooltipStyle} />
                  <Legend
                    formatter={(val) => (val === 'kmPerLiter' ? 'km/L' : t.pricePerLiterLabel)}
                    wrapperStyle={{ fontSize: '12px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="kmPerLiter"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    dot={{ r: 4 }}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="pricePerLiter"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* REFUELING HISTORY & DISTANCE BETWEEN FILL-UPS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{t.refuelingHistoryTitle}</h2>
          <span className="text-xs font-semibold text-slate-500">
            {t.fillUpsCount(enrichedLogsDesc.length)}
          </span>
        </div>

        {enrichedLogsDesc.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
              <Fuel size={24} />
            </div>
            <p className="text-sm font-bold text-slate-800">{t.noRefuelingsTitle}</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">{t.noRefuelingsDesc}</p>
            <button
              type="button"
              onClick={handleOpenNew}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold"
            >
              {t.newRefuelBtn}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {enrichedLogsDesc.map((log) => (
              <div
                key={log.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:px-5 gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                      log.fuelType === 'ethanol'
                        ? 'bg-emerald-500/15 text-emerald-500'
                        : 'bg-amber-500/15 text-amber-500'
                    }`}
                  >
                    <Fuel size={20} />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-900">
                        {log.stationName ||
                          (log.fuelType === 'ethanol' ? t.fuelEthanol : t.fuelGasoline)}
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
                      {log.kmPerLiter !== null && (
                        <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-500 text-[10px] font-bold">
                          ⚡ {t.efficiencyBadge(log.kmPerLiter.toFixed(2))}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-slate-500">
                      <span>{formatShortDate(log.date, language)}</span>
                      <span>•</span>
                      <span className="font-semibold text-slate-700">
                        {log.odometer.toLocaleString(language === 'pt-BR' ? 'pt-BR' : 'en-US')} km
                      </span>
                      <span>•</span>
                      {log.distanceSinceLast !== null ? (
                        <span className="font-semibold text-emerald-500">
                          {t.distanceTraveledBadge(log.distanceSinceLast)}
                        </span>
                      ) : (
                        <span className="text-slate-400">{t.firstOdometerBadge}</span>
                      )}
                      <span>•</span>
                      <span>
                        {log.liters.toFixed(2)} L × {formatCurrency(log.pricePerLiter, currency)}/L
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 pl-14 sm:pl-0 shrink-0">
                  <div className="text-right">
                    <span className="text-base font-extrabold text-rose-500 block">
                      -{formatCurrency(log.totalCost, currency)}
                    </span>
                    {log.costPerKm !== null && (
                      <span className="text-[11px] text-slate-400">
                        {formatCurrency(log.costPerKm, currency)}/km
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(log)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                      title={t.editTooltip}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteFuelLog(log.id)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                      title={t.deleteTooltip}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
