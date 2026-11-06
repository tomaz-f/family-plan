import { FuelLog } from '../../types';
import { getCurrentMonthStr } from '../../utils/format';

export interface EnrichedFuelLog extends FuelLog {
  distanceSinceLast: number | null;
  kmPerLiter: number | null;
  costPerKm: number | null;
}

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
}
