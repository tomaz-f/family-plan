import { AppLanguage, CreditCard, FuelLog, RecurringTemplate, Transaction } from '../types';
import {
  computeInvoiceDueDate, formatMonthLabel, formatShortMonthLabel,
  getCurrentMonthStr, getInstallmentNumberForMonth, shiftMonth,
} from './format';
import { getTxInvoiceMonth } from '../components/reports/reportsCalculations';
import { formatShortNumericDate } from '../components/fuel/fuelMetrics';
import { calculateFuelMetrics, calculateWeightedAverageKmPerL } from './fuelCalculator';

export interface CashflowMonthPoint {
  month: string; label: string; fullLabel: string; income: number; expense: number; net: number;
}
export interface CashflowEvolutionSummary {
  points: CashflowMonthPoint[]; totalIncome: number; totalExpense: number; avgNet: number; currentPoint: CashflowMonthPoint;
}
export interface BalanceCurvePoint {
  month: string; label: string; fullLabel: string; balance: number; monthlyDelta: number; income: number; expense: number;
}
export interface BalanceCurveSummary {
  points: BalanceCurvePoint[]; currentBalance: number; startBalance: number; periodChange: number;
}
export interface InstallmentProjectionPoint {
  month: string; label: string; fullLabel: string; cardInstallments: number; accountInstallments: number;
  total: number; activeCount: number; deltaFromPrev: number; isReliefMonth: boolean; isPeakMonth: boolean;
}
export interface InstallmentProjectionSummary {
  points: InstallmentProjectionPoint[]; totalCommitted6m: number; currentMonthTotal: number; reliefMonthsCount: number; peakAmount: number;
}
export interface BurnRateDayPoint {
  day: number; dayLabel: string; actualCumulative: number | null; averageCumulative: number; dailyActual: number;
}
export interface BurnRateSummary {
  points: BurnRateDayPoint[]; currentSpend: number; referenceAtCurrentDay: number; historicalMonthlyAverage: number;
  paceDiffPct: number; isOverPace: boolean; referenceDay: number; daysInMonth: number;
}
export interface BudgetRigiditySummary {
  fixedAmount: number; variableAmount: number; totalBudgetBase: number; fixedPct: number; variablePct: number;
  fixedCount: number; variableCount: number; monthIncome: number; monthExpense: number;
}
export interface FuelChartPoint {
  id: string; label: string; fullDate: string; stationName: string; kmPerLiter: number | null;
  totalCost: number; liters: number; pricePerLiter: number; isFullTank: boolean;
}
export interface FuelEfficiencySummary {
  points: FuelChartPoint[]; avgKmPerLiter: number | null; totalSpend: number; totalLiters: number; hasData: boolean;
}

const r2 = (n: number): number => Number(n.toFixed(2));

function getUnsettledCardInvoicesForDueMonth(
  transactions: Transaction[],
  creditCards: CreditCard[],
  targetMonth: string
): { total: number; txs: Transaction[] } {
  if (!creditCards?.length) return { total: 0, txs: [] };
  let total = 0;
  const matchedTxs: Transaction[] = [];

  for (const card of creditCards) {
    const cardTxs = transactions.filter((tx) => tx.cardId === card.id && tx.type === 'expense');
    const cycles = new Set(cardTxs.map((tx) => getTxInvoiceMonth(tx, card)));
    for (const invMonth of cycles) {
      const settlementKey = `${card.id}__${invMonth}`;
      const settlementTx = transactions.find((tx) => tx.settledInvoiceKey === settlementKey);
      const dueDate = settlementTx?.date || computeInvoiceDueDate(invMonth, card.closingDay, card.dueDay);
      if (!dueDate.startsWith(targetMonth)) continue;
      const cycleTxs = cardTxs.filter((tx) => getTxInvoiceMonth(tx, card) === invMonth);
      matchedTxs.push(...cycleTxs);
      if (!settlementTx) total += cycleTxs.reduce((s, tx) => s + Number(tx.amount || 0), 0);
    }
  }
  return { total: r2(total), txs: matchedTxs };
}

function computeMonthTotals(
  transactions: Transaction[],
  creditCards: CreditCard[],
  targetMonth: string
): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const tx of transactions) {
    if (tx.cardId || !tx.date.startsWith(targetMonth)) continue;
    const amt = Number(tx.amount || 0);
    if (amt <= 0) continue;
    if (tx.type === 'income') income += amt;
    else expense += amt;
  }
  expense += getUnsettledCardInvoicesForDueMonth(transactions, creditCards, targetMonth).total;
  return { income: r2(income), expense: r2(expense) };
}

export function aggregateCashflowEvolution(
  transactions: Transaction[],
  creditCards: CreditCard[],
  selectedMonth: string,
  language: AppLanguage
): CashflowEvolutionSummary {
  const months = [5, 4, 3, 2, 1, 0].map((d) => shiftMonth(selectedMonth, -d));
  const points: CashflowMonthPoint[] = months.map((m) => {
    const { income, expense } = computeMonthTotals(transactions, creditCards, m);
    return {
      month: m, label: formatShortMonthLabel(m, language).slice(0, 3),
      fullLabel: formatMonthLabel(m, language), income, expense, net: r2(income - expense),
    };
  });
  const totalIncome = r2(points.reduce((s, p) => s + p.income, 0));
  const totalExpense = r2(points.reduce((s, p) => s + p.expense, 0));
  const avgNet = r2((totalIncome - totalExpense) / points.length);
  const currentPoint = points[points.length - 1] || {
    month: selectedMonth, label: '', fullLabel: '', income: 0, expense: 0, net: 0,
  };
  return { points, totalIncome, totalExpense, avgNet, currentPoint };
}

export function aggregateBalanceCurve(
  transactions: Transaction[],
  creditCards: CreditCard[],
  initialBalance: number,
  selectedMonth: string,
  language: AppLanguage
): BalanceCurveSummary {
  const months = [5, 4, 3, 2, 1, 0].map((d) => shiftMonth(selectedMonth, -d));
  let runningBalance = Number(initialBalance || 0);
  for (const tx of transactions) {
    if (tx.cardId || tx.date.slice(0, 7) >= months[0]) continue;
    const amt = Number(tx.amount || 0);
    runningBalance += tx.type === 'income' ? amt : -amt;
  }
  const startBalance = r2(runningBalance);
  const points: BalanceCurvePoint[] = months.map((m) => {
    const { income, expense } = computeMonthTotals(transactions, creditCards, m);
    const monthlyDelta = r2(income - expense);
    runningBalance = r2(runningBalance + monthlyDelta);
    return {
      month: m, label: formatShortMonthLabel(m, language).slice(0, 3),
      fullLabel: formatMonthLabel(m, language), balance: runningBalance, monthlyDelta, income, expense,
    };
  });
  const currentBalance = points[points.length - 1]?.balance ?? startBalance;
  return { points, currentBalance, startBalance, periodChange: r2(currentBalance - startBalance) };
}

export function aggregateInstallmentProjections(
  transactions: Transaction[],
  creditCards: CreditCard[],
  recurringTemplates: RecurringTemplate[],
  selectedMonth: string,
  language: AppLanguage
): InstallmentProjectionSummary {
  const months = [0, 1, 2, 3, 4, 5].map((d) => shiftMonth(selectedMonth, d));
  const rawPoints = months.map((targetMonth) => {
    let cardInstallments = 0;
    let accountInstallments = 0;
    let activeCount = 0;

    for (const card of creditCards || []) {
      const cardTxs = transactions.filter(
        (tx) => tx.cardId === card.id && tx.type === 'expense' && (tx.installmentTotal || 0) > 1
      );
      for (const tx of cardTxs) {
        const dueDate = computeInvoiceDueDate(getTxInvoiceMonth(tx, card), card.closingDay, card.dueDay);
        if (dueDate.startsWith(targetMonth) && Number(tx.amount || 0) > 0) {
          cardInstallments += Number(tx.amount || 0);
          activeCount += 1;
        }
      }
    }

    for (const tx of transactions) {
      if (!tx.cardId && tx.type === 'expense' && (tx.installmentTotal || 0) > 1 && tx.date.startsWith(targetMonth)) {
        const amt = Number(tx.amount || 0);
        if (amt > 0) { accountInstallments += amt; activeCount += 1; }
      }
    }

    for (const tpl of recurringTemplates || []) {
      if (!tpl.active || tpl.type !== 'expense' || !tpl.isInstallment || !tpl.startMonth || !tpl.totalInstallments) continue;
      const instNum = getInstallmentNumberForMonth(tpl.startMonth, targetMonth);
      if (instNum !== null && instNum >= 1 && instNum <= tpl.totalInstallments) {
        const exists = transactions.some((tx) => tx.recurringId === tpl.id && tx.date.startsWith(targetMonth));
        if (!exists && Number(tpl.amount || 0) > 0) {
          accountInstallments += Number(tpl.amount || 0);
          activeCount += 1;
        }
      }
    }

    const cardR = r2(cardInstallments);
    const accR = r2(accountInstallments);
    return {
      month: targetMonth, label: formatShortMonthLabel(targetMonth, language).slice(0, 3),
      fullLabel: formatMonthLabel(targetMonth, language), cardInstallments: cardR,
      accountInstallments: accR, total: r2(cardR + accR), activeCount,
    };
  });

  const peakAmount = Math.max(...rawPoints.map((p) => p.total), 0);
  let reliefMonthsCount = 0;
  const points: InstallmentProjectionPoint[] = rawPoints.map((pt, idx) => {
    const prevTotal = idx > 0 ? rawPoints[idx - 1].total : pt.total;
    const deltaFromPrev = r2(pt.total - prevTotal);
    const isReliefMonth = idx > 0 && deltaFromPrev < -0.01;
    if (isReliefMonth) reliefMonthsCount += 1;
    return { ...pt, deltaFromPrev, isReliefMonth, isPeakMonth: peakAmount > 0 && pt.total === peakAmount };
  });

  return {
    points, totalCommitted6m: r2(points.reduce((s, p) => s + p.total, 0)),
    currentMonthTotal: points[0]?.total ?? 0, reliefMonthsCount, peakAmount,
  };
}

export function aggregateMonthlyBurnRate(
  transactions: Transaction[],
  creditCards: CreditCard[],
  selectedMonth: string
): BurnRateSummary {
  const [y, m] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate() || 30;
  const isCurrentMonth = selectedMonth === getCurrentMonthStr();
  const referenceDay = isCurrentMonth ? Math.min(new Date().getDate(), daysInMonth) : daysInMonth;

  const prevTotals = [1, 2, 3]
    .map((d) => computeMonthTotals(transactions, creditCards, shiftMonth(selectedMonth, -d)).expense)
    .filter((v) => v > 0);
  const curTotals = computeMonthTotals(transactions, creditCards, selectedMonth);
  const historicalMonthlyAverage =
    prevTotals.length > 0 ? r2(prevTotals.reduce((a, b) => a + b, 0) / prevTotals.length) : curTotals.expense;

  const dailyBuckets = new Array<number>(daysInMonth + 1).fill(0);
  for (const tx of transactions) {
    if (tx.cardId || tx.type !== 'expense' || !tx.date.startsWith(selectedMonth)) continue;
    const day = Math.min(Math.max(Number(tx.date.split('-')[2]) || 1, 1), daysInMonth);
    dailyBuckets[day] += Number(tx.amount || 0);
  }
  for (const tx of getUnsettledCardInvoicesForDueMonth(transactions, creditCards, selectedMonth).txs) {
    const rawDate = tx.purchaseDate || tx.date;
    const day = Math.min(Math.max(Number(rawDate.split('-')[2]) || 1, 1), daysInMonth);
    dailyBuckets[day] += Number(tx.amount || 0);
  }

  let runningActual = 0;
  const points: BurnRateDayPoint[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    runningActual = r2(runningActual + dailyBuckets[d]);
    points.push({
      day: d, dayLabel: String(d).padStart(2, '0'),
      actualCumulative: d <= referenceDay ? runningActual : null,
      averageCumulative: r2((historicalMonthlyAverage / daysInMonth) * d),
      dailyActual: r2(dailyBuckets[d]),
    });
  }

  const currentSpend = points[referenceDay - 1]?.actualCumulative ?? 0;
  const referenceAtCurrentDay = points[referenceDay - 1]?.averageCumulative ?? 0;
  const paceDiffPct =
    referenceAtCurrentDay > 0 ? Number((((currentSpend - referenceAtCurrentDay) / referenceAtCurrentDay) * 100).toFixed(1)) : 0;

  return {
    points, currentSpend, referenceAtCurrentDay, historicalMonthlyAverage, paceDiffPct,
    isOverPace: referenceAtCurrentDay > 0 && currentSpend > referenceAtCurrentDay * 1.03,
    referenceDay, daysInMonth,
  };
}

export function aggregateBudgetRigidity(
  transactions: Transaction[],
  creditCards: CreditCard[],
  recurringTemplates: RecurringTemplate[],
  selectedMonth: string
): BudgetRigiditySummary {
  let fixedAmount = 0;
  let variableAmount = 0;
  let fixedCount = 0;
  let variableCount = 0;

  for (const tx of transactions) {
    if (tx.cardId || tx.type !== 'expense' || !tx.date.startsWith(selectedMonth) || tx.settledInvoiceKey) continue;
    const amt = Number(tx.amount || 0);
    if (amt <= 0) continue;
    if (tx.isRecurring || tx.recurringId || (tx.installmentTotal || 0) > 1) {
      fixedAmount += amt; fixedCount += 1;
    } else {
      variableAmount += amt; variableCount += 1;
    }
  }

  for (const tx of getUnsettledCardInvoicesForDueMonth(transactions, creditCards, selectedMonth).txs) {
    const amt = Number(tx.amount || 0);
    if (amt <= 0) continue;
    if ((tx.installmentTotal || 0) > 1) { fixedAmount += amt; fixedCount += 1; }
    else { variableAmount += amt; variableCount += 1; }
  }

  for (const tpl of recurringTemplates || []) {
    if (!tpl.active || tpl.type !== 'expense') continue;
    const hasRecorded = transactions.some((tx) => tx.recurringId === tpl.id && tx.date.startsWith(selectedMonth));
    if (!hasRecorded && Number(tpl.amount || 0) > 0) {
      fixedAmount += Number(tpl.amount || 0); fixedCount += 1;
    }
  }

  const { income: monthIncome, expense: monthExpense } = computeMonthTotals(transactions, creditCards, selectedMonth);
  const fixedR = r2(fixedAmount);
  const varR = r2(variableAmount);
  const totalBudgetBase = r2(fixedR + varR);
  const fixedPct = totalBudgetBase > 0 ? Number(((fixedR / totalBudgetBase) * 100).toFixed(1)) : 0;

  return {
    fixedAmount: fixedR, variableAmount: varR, totalBudgetBase, fixedPct,
    variablePct: totalBudgetBase > 0 ? Number((100 - fixedPct).toFixed(1)) : 0,
    fixedCount, variableCount, monthIncome, monthExpense,
  };
}

export function aggregateFuelEfficiency(fuelLogs: FuelLog[]): FuelEfficiencySummary {
  if (!fuelLogs?.length) {
    return { points: [], avgKmPerLiter: null, totalSpend: 0, totalLiters: 0, hasData: false };
  }
  const calc = calculateFuelMetrics(fuelLogs);
  const recentLogs = calc.entriesAsc.slice(-10);
  const points: FuelChartPoint[] = recentLogs.map((log, idx) => ({
    id: log.id || `fuel-${idx}`, label: formatShortNumericDate(log.date).slice(0, 5),
    fullDate: formatShortNumericDate(log.date), stationName: log.stationName || 'Posto',
    kmPerLiter: log.consumptionKmPerL !== null ? r2(log.consumptionKmPerL) : null,
    totalCost: r2(Number(log.totalCost || 0)), liters: r2(Number(log.liters || 0)),
    pricePerLiter: r2(Number(log.pricePerLiter || 0)), isFullTank: log.isFullTank,
  }));
  const rawAvg = calculateWeightedAverageKmPerL(recentLogs) ?? calc.latestCompletedKmPerL;
  const avgKmPerLiter = rawAvg !== null ? r2(rawAvg) : null;
  return {
    points, avgKmPerLiter,
    totalSpend: r2(points.reduce((s, p) => s + p.totalCost, 0)),
    totalLiters: r2(points.reduce((s, p) => s + p.liters, 0)),
    hasData: points.length > 0,
  };
}
