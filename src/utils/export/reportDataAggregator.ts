import { getTxInvoiceMonth } from '../../components/reports/reportsCalculations';
import { Transaction } from '../../types';
import { computeInvoiceDueDate } from '../format';
import { getCategoryDisplayName } from '../i18n';
import {
  buildMonthlyAndDailySeries,
  computePeriodNumDays,
  resolvePeriodMetadata,
} from './exportFormatHelpers';
import { ComputedExportData, ExportFilterOptions } from './exportTypes';

export function computeExportData(opts: ExportFilterOptions): ComputedExportData {
  const {
    periodMode,
    year,
    month,
    typeFilter,
    language,
    initialBalance,
    categories,
    transactions,
    creditCards = [],
  } = opts;

  const catMap = new Map(categories.map((c) => [c.id, c]));

  const targetMonthPrefix = `${year}-${month.padStart(2, '0')}`;
  const targetYearPrefix = `${year}-`;

  const matchesPeriod = (dateStr: string): boolean =>
    periodMode === 'monthly'
      ? dateStr.startsWith(targetMonthPrefix)
      : periodMode === 'annual'
      ? dateStr.startsWith(targetYearPrefix)
      : true;

  // Sort all transactions chronologically to compute accurate opening & running bank balances
  const allSortedAsc = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });

  // Calculate opening balance carried forward prior to period (strictly excluding raw cardId items)
  let openingBalance = Number(initialBalance || 0);
  for (const tx of allSortedAsc) {
    if (tx.cardId) continue;
    const isBeforePeriod =
      periodMode === 'monthly'
        ? tx.date.slice(0, 7) < targetMonthPrefix
        : periodMode === 'annual'
        ? tx.date.slice(0, 4) < year
        : false;

    if (isBeforePeriod && tx.status !== 'unpaid') {
      openingBalance += tx.type === 'income' ? tx.amount : -tx.amount;
    }
  }
  openingBalance = Number(openingBalance.toFixed(2));

  // Transactions belonging to the period
  const inPeriodAllTypes: Array<Transaction & { runningBalance: number }> = [];
  let currentRunningBal = openingBalance;

  for (const tx of allSortedAsc) {
    if (matchesPeriod(tx.date)) {
      const isUnpaid = tx.status === 'unpaid';
      // Raw cardId purchases do not directly mutate bank account balance (Fatura de Crédito does)
      const signed =
        isUnpaid || tx.cardId ? 0 : tx.type === 'income' ? tx.amount : -tx.amount;
      currentRunningBal = Number((currentRunningBal + signed).toFixed(2));
      inPeriodAllTypes.push({
        ...tx,
        runningBalance: currentRunningBal,
      });
    }
  }

  // Filtered by selected type if needed for ledger
  const filteredTransactionsAsc = inPeriodAllTypes.filter((tx) =>
    typeFilter === 'all' ? true : tx.type === typeFilter
  );
  const filteredTransactionsDesc = [...filteredTransactionsAsc].reverse();

  // Metrics breakdown: Realized (Consolidado) vs Pending (Pendente) aligned with DashboardView
  let realizedIncome = 0;
  let pendingIncome = 0;
  let incomeCount = 0;
  let pendingIncomeCount = 0;

  let realizedExpense = 0;
  let pendingExpense = 0;
  let expenseCount = 0;
  let pendingExpenseCount = 0;
  let largestExpense: Transaction | null = null;

  for (const tx of inPeriodAllTypes) {
    // Strictly exclude raw credit card swipes from bank account cashflow
    if (tx.cardId) continue;

    const isUnpaid = tx.status === 'unpaid';
    if (tx.type === 'income') {
      if (isUnpaid) {
        pendingIncome += tx.amount;
        pendingIncomeCount++;
      } else {
        realizedIncome += tx.amount;
        incomeCount++;
      }
    } else {
      if (isUnpaid) {
        pendingExpense += tx.amount;
        pendingExpenseCount++;
      } else {
        realizedExpense += tx.amount;
        expenseCount++;
      }
      if (!largestExpense || tx.amount > largestExpense.amount) {
        largestExpense = tx;
      }
    }
  }

  // Include unsettled credit card invoices due in the period that do not yet have a settledInvoiceKey bill row
  if (creditCards.length > 0) {
    for (const card of creditCards) {
      const cardTxs = transactions.filter((tx) => tx.cardId === card.id && tx.type === 'expense');
      const cycles = new Set(cardTxs.map((tx) => getTxInvoiceMonth(tx, card)));
      for (const invMonth of cycles) {
        const settlementKey = `${card.id}__${invMonth}`;
        const hasSettlementRow = transactions.some((tx) => tx.settledInvoiceKey === settlementKey);
        if (hasSettlementRow) continue;

        const dueDate = computeInvoiceDueDate(invMonth, card.closingDay, card.dueDay);
        if (!matchesPeriod(dueDate)) continue;

        const cycleUnpaidTotal = cardTxs
          .filter(
            (tx) => getTxInvoiceMonth(tx, card) === invMonth && (tx.status || 'paid') === 'unpaid'
          )
          .reduce((s, tx) => s + Number(tx.amount || 0), 0);

        if (cycleUnpaidTotal > 0) {
          pendingExpense += cycleUnpaidTotal;
          pendingExpenseCount += 1;
        }
      }
    }
  }

  const totalIncome = Number(realizedIncome.toFixed(2));
  const totalExpense = Number(realizedExpense.toFixed(2));
  pendingIncome = Number(pendingIncome.toFixed(2));
  pendingExpense = Number(pendingExpense.toFixed(2));

  const closingBalance = Number((openingBalance + totalIncome - totalExpense).toFixed(2));
  const netCashFlow = Number((totalIncome - totalExpense).toFixed(2));
  const projectedBalance = Number(
    (closingBalance + pendingIncome - pendingExpense).toFixed(2)
  );

  const numDays = computePeriodNumDays(periodMode, year, month, inPeriodAllTypes);
  const savingsRate =
    totalIncome > 0 ? Math.max(0, ((totalIncome - totalExpense) / totalIncome) * 100) : 0;
  const avgDailyExpense = numDays > 0 ? (totalExpense + pendingExpense) / numDays : 0;

  // Category aggregations (exclude raw cardId if settledInvoiceKey is used, or group non-card cashflow)
  const expMap = new Map<string, { amount: number; count: number }>();
  const incMap = new Map<string, { amount: number; count: number }>();

  for (const tx of inPeriodAllTypes) {
    if (tx.cardId) continue;
    if (tx.type === 'expense') {
      const cur = expMap.get(tx.categoryId) || { amount: 0, count: 0 };
      expMap.set(tx.categoryId, { amount: cur.amount + tx.amount, count: cur.count + 1 });
    } else {
      const cur = incMap.get(tx.categoryId) || { amount: 0, count: 0 };
      incMap.set(tx.categoryId, { amount: cur.amount + tx.amount, count: cur.count + 1 });
    }
  }

  const totalCategoryExpenses = Array.from(expMap.values()).reduce((sum, d) => sum + d.amount, 0);
  const totalCategoryIncome = Array.from(incMap.values()).reduce((sum, d) => sum + d.amount, 0);

  const expenseByCategory = Array.from(expMap.entries())
    .map(([id, data]) => {
      const cat = catMap.get(id);
      return {
        id,
        name: getCategoryDisplayName(cat, language) || id,
        color: cat?.color || '#64748B',
        count: data.count,
        amount: data.amount,
        avg: data.count > 0 ? data.amount / data.count : 0,
        share: totalCategoryExpenses > 0 ? (data.amount / totalCategoryExpenses) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const incomeByCategory = Array.from(incMap.entries())
    .map(([id, data]) => {
      const cat = catMap.get(id);
      return {
        id,
        name: getCategoryDisplayName(cat, language) || id,
        color: cat?.color || '#10B981',
        count: data.count,
        amount: data.amount,
        share: totalCategoryIncome > 0 ? (data.amount / totalCategoryIncome) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  let cardExpenseTotal = 0;
  let cardExpenseCount = 0;
  let bankExpenseTotal = 0;
  let bankExpenseCount = 0;

  for (const tx of inPeriodAllTypes) {
    if (tx.type === 'expense') {
      const isCard = Boolean(
        tx.cardId ||
          tx.settledInvoiceKey ||
          (tx.description && /^fatura\b/i.test(tx.description))
      );
      if (isCard) {
        cardExpenseTotal += tx.amount;
        cardExpenseCount++;
      } else {
        bankExpenseTotal += tx.amount;
        bankExpenseCount++;
      }
    }
  }

  const totalChannelExpenses = cardExpenseTotal + bankExpenseTotal;
  const paymentChannels = {
    card: {
      amount: cardExpenseTotal,
      count: cardExpenseCount,
      share: totalChannelExpenses > 0 ? (cardExpenseTotal / totalChannelExpenses) * 100 : 0,
    },
    bankOrCash: {
      amount: bankExpenseTotal,
      count: bankExpenseCount,
      share: totalChannelExpenses > 0 ? (bankExpenseTotal / totalChannelExpenses) * 100 : 0,
    },
  };

  const { monthlySeries, dailySeries } = buildMonthlyAndDailySeries(
    periodMode,
    year,
    month,
    targetMonthPrefix,
    openingBalance,
    inPeriodAllTypes,
    language
  );

  const { periodTitle, filenameSlug } = resolvePeriodMetadata(
    periodMode,
    year,
    targetMonthPrefix,
    language
  );

  return {
    periodTitle,
    filenameSlug,
    openingBalance,
    closingBalance,
    projectedBalance,
    totalIncome,
    pendingIncome,
    incomeCount,
    pendingIncomeCount,
    totalExpense,
    pendingExpense,
    expenseCount,
    pendingExpenseCount,
    totalCategoryExpenses,
    totalCategoryIncome,
    netCashFlow,
    savingsRate,
    avgDailyExpense,
    numDays,
    largestExpense,
    filteredTransactionsAsc,
    filteredTransactionsDesc,
    expenseByCategory,
    incomeByCategory,
    monthlySeries,
    dailySeries,
    paymentChannels,
  };
}
