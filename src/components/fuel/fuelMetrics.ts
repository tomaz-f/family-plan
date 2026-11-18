import { FuelLog } from '../../types';
import { getCurrentMonthStr } from '../../utils/format';
import {
  CalculatedFuelEntry,
  calculateFuelMetrics,
  calculateWeightedAverageKmPerL,
} from '../../utils/fuelCalculator';

export type EnrichedFuelLog = CalculatedFuelEntry;

export interface FuelMetricsSummary {
  monthLogs: EnrichedFuelLog[];
  monthSpend: number;
  monthLiters: number;
  monthGasolineLiters: number;
  monthEthanolLiters: number;
  monthDistance: number;
  avgKmPerLiter: number | null;
  estimatedFullTankRange: number | null;
  effectiveTankSize: number;
  projectedMonthlySpend: number;
}

export const formatShortNumericDate = (dateStr: string): string => {
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

export function enrichFuelLogs(fuelLogs: FuelLog[]): EnrichedFuelLog[] {
  return calculateFuelMetrics(fuelLogs).entriesDesc;
}

export function getHighestOdometer(fuelLogs: FuelLog[]): number | null {
  if (fuelLogs.length === 0) return null;
  return Math.max(...fuelLogs.map((f) => f.odometer));
}

export function computeFuelMetrics(
  enrichedLogsDesc: EnrichedFuelLog[],
  selectedMonth: string,
  tankCapacity: number,
  fuelLogs: FuelLog[]
): FuelMetricsSummary {
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

  const monthCompletedCycles = monthLogs.filter(
    (l) =>
      l.consumptionKmPerL !== null &&
      l.cycleDistance !== null &&
      l.cycleLiters !== null
  );

  const monthWeightedAvg = calculateWeightedAverageKmPerL(monthCompletedCycles);

  const latestPriorCompleted = enrichedLogsDesc.find(
    (l) => l.consumptionKmPerL !== null && l.date.slice(0, 7) <= selectedMonth
  );
  const latestOverallCompleted = enrichedLogsDesc.find(
    (l) => l.consumptionKmPerL !== null
  );

  const avgKmPerLiter =
    monthWeightedAvg ??
    latestPriorCompleted?.consumptionKmPerL ??
    latestOverallCompleted?.consumptionKmPerL ??
    null;

  const effectiveTankSize = tankCapacity > 0 ? tankCapacity : 54;
  const estimatedFullTankRange =
    avgKmPerLiter !== null ? avgKmPerLiter * effectiveTankSize : null;

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
}
