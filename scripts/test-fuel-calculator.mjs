import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFuelMetrics,
  calculateWeightedAverageKmPerL,
} from '../src/utils/fuelCalculator.ts';

function makeLog(overrides) {
  return {
    id: overrides.id ?? 'log-1',
    date: overrides.date ?? '2026-10-01',
    odometer: overrides.odometer ?? 10000,
    pricePerLiter: overrides.pricePerLiter ?? 6.0,
    totalCost: overrides.totalCost ?? Number(((overrides.liters ?? 40) * (overrides.pricePerLiter ?? 6.0)).toFixed(2)),
    liters: overrides.liters ?? 40,
    fuelType: overrides.fuelType ?? 'gasoline',
    stationName: overrides.stationName ?? 'Posto Teste',
    isFullTank: overrides.isFullTank ?? true,
    createdAt: overrides.createdAt ?? `${overrides.date ?? '2026-10-01'}T10:00:00.000Z`,
  };
}

test('partial fill-up returns null km/L and rolls liters into next full tank (234 km / 47.46 L = 4.93 km/L)', () => {
  const logs = [
    makeLog({ id: 'base', date: '2026-10-01', odometer: 10000, liters: 40, isFullTank: true }),
    makeLog({ id: 'partial', date: '2026-10-10', odometer: 10220, liters: 7.04, isFullTank: false }),
    makeLog({ id: 'close', date: '2026-10-12', odometer: 10234, liters: 40.42, isFullTank: true }),
  ];

  const res = calculateFuelMetrics(logs);
  assert.equal(res.entriesAsc.length, 3);

  const [base, partial, close] = res.entriesAsc;
  assert.equal(base.distanceSinceLast, null);
  assert.equal(base.consumptionKmPerL, null);
  assert.equal(base.kmPerLiter, null);

  assert.equal(partial.distanceSinceLast, 220);
  assert.equal(partial.consumptionKmPerL, null);
  assert.equal(partial.kmPerLiter, null);
  assert.equal(partial.cycleDistance, null);
  assert.equal(partial.cycleLiters, null);

  assert.equal(close.distanceSinceLast, 14);
  assert.equal(close.cycleDistance, 234);
  assert.ok(Math.abs(close.cycleLiters - 47.46) < 1e-6);
  assert.ok(Math.abs(close.consumptionKmPerL - 234 / 47.46) < 1e-6);
  assert.equal(close.kmPerLiter, close.consumptionKmPerL);
  assert.equal(res.completedCyclesAsc.length, 1);
  assert.ok(Math.abs(res.weightedAvgKmPerL - 234 / 47.46) < 1e-6);
  assert.equal(res.latestCompletedKmPerL, close.consumptionKmPerL);
});

test('multiple consecutive partial fill-ups stay null and roll forward to closing full tank', () => {
  const logs = [
    makeLog({ id: 'f1', date: '2026-10-01', odometer: 20000, liters: 45, isFullTank: true }),
    makeLog({ id: 'p1', date: '2026-10-05', odometer: 20150, liters: 10, isFullTank: false }),
    makeLog({ id: 'p2', date: '2026-10-10', odometer: 20300, liters: 12, isFullTank: false }),
    makeLog({ id: 'f2', date: '2026-10-15', odometer: 20450, liters: 23, isFullTank: true }),
  ];

  const res = calculateFuelMetrics(logs);
  const [, p1, p2, f2] = res.entriesAsc;

  assert.equal(p1.distanceSinceLast, 150);
  assert.equal(p1.consumptionKmPerL, null);
  assert.equal(p2.distanceSinceLast, 150);
  assert.equal(p2.consumptionKmPerL, null);
  assert.equal(f2.cycleDistance, 450);
  assert.equal(f2.cycleLiters, 45);
  assert.equal(f2.consumptionKmPerL, 10);
});

test('pre-baseline partial fill-ups stay null and do not leak into the first completed cycle', () => {
  const logs = [
    makeLog({ id: 'pre-partial', date: '2026-09-01', odometer: 5000, liters: 20, isFullTank: false }),
    makeLog({ id: 'first-full', date: '2026-09-10', odometer: 5200, liters: 35, isFullTank: true }),
    makeLog({ id: 'second-full', date: '2026-09-20', odometer: 5600, liters: 40, isFullTank: true }),
  ];

  const res = calculateFuelMetrics(logs);
  const [prePartial, firstFull, secondFull] = res.entriesAsc;

  assert.equal(prePartial.consumptionKmPerL, null);
  assert.equal(firstFull.distanceSinceLast, 200);
  assert.equal(firstFull.consumptionKmPerL, null);
  assert.equal(secondFull.cycleDistance, 400);
  assert.equal(secondFull.cycleLiters, 40);
  assert.equal(secondFull.consumptionKmPerL, 10);
});

test('weighted average computes sum(cycleDistance) / sum(cycleLiters), not unweighted mean', () => {
  const logs = [
    makeLog({ id: 'f0', date: '2026-10-01', odometer: 1000, liters: 30, isFullTank: true }),
    makeLog({ id: 'f1', date: '2026-10-05', odometer: 1100, liters: 10, isFullTank: true }), // 10 km/L
    makeLog({ id: 'f2', date: '2026-10-15', odometer: 1500, liters: 20, isFullTank: true }), // 20 km/L
  ];

  const res = calculateFuelMetrics(logs);
  // Weighted: (100 + 400) / (10 + 20) = 500 / 30 = 16.6667 (NOT 15.0)
  assert.ok(Math.abs(res.weightedAvgKmPerL - 500 / 30) < 1e-6);
  assert.equal(res.latestCompletedKmPerL, 20);
  assert.ok(Math.abs(calculateWeightedAverageKmPerL(res.entriesDesc) - 500 / 30) < 1e-6);
});

test('unsorted logs produce identical chronological cycle metrics and desc ordering', () => {
  const ordered = [
    makeLog({ id: 'a', date: '2026-10-01', odometer: 10000, liters: 40, isFullTank: true }),
    makeLog({ id: 'b', date: '2026-10-10', odometer: 10220, liters: 7.04, isFullTank: false }),
    makeLog({ id: 'c', date: '2026-10-12', odometer: 10234, liters: 40.42, isFullTank: true }),
  ];
  const shuffled = [ordered[2], ordered[0], ordered[1]];

  const resOrdered = calculateFuelMetrics(ordered);
  const resShuffled = calculateFuelMetrics(shuffled);

  assert.deepEqual(resShuffled.entriesAsc, resOrdered.entriesAsc);
  assert.deepEqual(resShuffled.entriesDesc.map((e) => e.id), ['c', 'b', 'a']);
  assert.equal(resShuffled.weightedAvgKmPerL, resOrdered.weightedAvgKmPerL);
});

test('edge cases: empty input, duplicate odometer, zero liters, and >= 60 km/L outliers stay null', () => {
  const empty = calculateFuelMetrics([]);
  assert.deepEqual(empty.entriesAsc, []);
  assert.equal(empty.weightedAvgKmPerL, null);
  assert.equal(empty.latestCompletedKmPerL, null);

  const edgeLogs = [
    makeLog({ id: 'e1', date: '2026-10-01', odometer: 10000, liters: 40, isFullTank: true }),
    makeLog({ id: 'e2-dup-odo', date: '2026-10-02', odometer: 10000, liters: 5, isFullTank: true }),
    makeLog({ id: 'e3-zero-liters', date: '2026-10-03', odometer: 10100, liters: 0, isFullTank: true }),
    makeLog({ id: 'e4-outlier', date: '2026-10-04', odometer: 10800, liters: 10, isFullTank: true }), // 70 km/L >= 60
  ];

  const res = calculateFuelMetrics(edgeLogs);
  for (const entry of res.entriesAsc) {
    assert.equal(entry.consumptionKmPerL, null);
    assert.equal(entry.kmPerLiter, null);
  }
  assert.equal(res.weightedAvgKmPerL, null);
  assert.equal(res.latestCompletedKmPerL, null);
});
