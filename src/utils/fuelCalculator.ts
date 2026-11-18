import type { FuelLog } from '../types';

export const MAX_VALID_KM_PER_LITER = 60;

export interface CalculatedFuelEntry extends FuelLog {
  distanceSinceLast: number | null;
  cycleDistance: number | null;
  cycleLiters: number | null;
  cycleCost: number | null;
  consumptionKmPerL: number | null;
  kmPerLiter: number | null;
  costPerKm: number | null;
}

export interface FuelCalculationResult {
  entriesAsc: CalculatedFuelEntry[];
  entriesDesc: CalculatedFuelEntry[];
  completedCyclesAsc: CalculatedFuelEntry[];
  weightedAvgKmPerL: number | null;
  latestCompletedKmPerL: number | null;
}

export function calculateWeightedAverageKmPerL(
  entries: ReadonlyArray<
    Pick<CalculatedFuelEntry, 'consumptionKmPerL' | 'cycleDistance' | 'cycleLiters'>
  >
): number | null {
  let totalDistance = 0;
  let totalLiters = 0;

  for (const entry of entries) {
    if (
      entry.consumptionKmPerL !== null &&
      entry.cycleDistance !== null &&
      entry.cycleDistance > 0 &&
      entry.cycleLiters !== null &&
      entry.cycleLiters > 0
    ) {
      totalDistance += entry.cycleDistance;
      totalLiters += entry.cycleLiters;
    }
  }

  return totalLiters > 0 ? totalDistance / totalLiters : null;
}

/**
 * Computes fuel consumption using strict full-tank cycle accounting:
 * - Partial fill-ups record distance delta for reference, never compute km/L,
 *   and roll their liters/cost forward to the next confirmed full tank.
 * - First full tank establishes the odometer anchor (km/L = null).
 * - Subsequent full tanks close the cycle: cycleDistance / (accumulatedLiters + currentLiters).
 */
export function calculateFuelMetrics(
  fuelLogs: ReadonlyArray<FuelLog>
): FuelCalculationResult {
  const sortedAsc = [...fuelLogs].sort(
    (a, b) =>
      a.odometer - b.odometer ||
      a.date.localeCompare(b.date) ||
      a.createdAt.localeCompare(b.createdAt)
  );

  const entriesAsc: CalculatedFuelEntry[] = [];
  let lastFullTankOdometer: number | null = null;
  let accumulatedLiters = 0;
  let accumulatedCost = 0;

  for (let i = 0; i < sortedAsc.length; i++) {
    const current = sortedAsc[i];
    const prev = i > 0 ? sortedAsc[i - 1] : null;
    const deltaKm = prev ? current.odometer - prev.odometer : 0;
    const distanceSinceLast = prev && deltaKm > 0 ? deltaKm : null;

    let cycleDistance: number | null = null;
    let cycleLiters: number | null = null;
    let cycleCost: number | null = null;
    let consumptionKmPerL: number | null = null;
    let costPerKm: number | null = null;

    if (!current.isFullTank) {
      if (lastFullTankOdometer !== null) {
        if (current.liters > 0) accumulatedLiters += current.liters;
        if (current.totalCost > 0) accumulatedCost += current.totalCost;
      }
    } else {
      if (lastFullTankOdometer !== null) {
        const dist = current.odometer - lastFullTankOdometer;
        const liters = accumulatedLiters + (current.liters > 0 ? current.liters : 0);
        const cost = accumulatedCost + (current.totalCost > 0 ? current.totalCost : 0);

        if (dist > 0 && liters > 0) {
          const rawKmPerL = dist / liters;
          if (rawKmPerL > 0 && rawKmPerL < MAX_VALID_KM_PER_LITER) {
            cycleDistance = dist;
            cycleLiters = liters;
            cycleCost = cost;
            consumptionKmPerL = rawKmPerL;
            costPerKm = cost > 0 ? cost / dist : null;
          }
        }
      }

      accumulatedLiters = 0;
      accumulatedCost = 0;
      lastFullTankOdometer = current.odometer;
    }

    entriesAsc.push({
      ...current,
      distanceSinceLast,
      cycleDistance,
      cycleLiters,
      cycleCost,
      consumptionKmPerL,
      kmPerLiter: consumptionKmPerL,
      costPerKm,
    });
  }

  const completedCyclesAsc = entriesAsc.filter((e) => e.consumptionKmPerL !== null);
  const weightedAvgKmPerL = calculateWeightedAverageKmPerL(completedCyclesAsc);
  const latestCompletedKmPerL =
    completedCyclesAsc.length > 0
      ? completedCyclesAsc[completedCyclesAsc.length - 1].consumptionKmPerL
      : null;

  return {
    entriesAsc,
    entriesDesc: [...entriesAsc].reverse(),
    completedCyclesAsc,
    weightedAvgKmPerL,
    latestCompletedKmPerL,
  };
}
