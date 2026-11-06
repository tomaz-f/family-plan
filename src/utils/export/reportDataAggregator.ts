import { Transaction } from '../../types';
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
  } = opts;

  const catMap = new Map(categories.map((c) => [c.id, c]));

  const targetMonthPrefix = `${year}-${month.padStart(2, '0')}`;
  const targetYearPrefix = `${year}-`;

  // Sort all transactions chronologically to compute accurate opening & running bank balances
  const allSortedAsc = [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });

  // Calculate opening balance carried forward prior to period
  let openingBalance = initialBalance;
  for (const tx of allSortedAsc) {
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

  // Transactions belonging to the period
  const inPeriodAllTypes: Array<Transaction & { runningBalance: number }> = [];
  let currentRunningBal = openingBalance;

  for (const tx of allSortedAsc) {
    const isInPeriod =
      periodMode === 'monthly'
        ? tx.date.startsWith(targetMonthPrefix)
        : periodMode === 'annual'
        ? tx.date.startsWith(targetYearPrefix)
        : true;

    if (isInPeriod) {
      const isUnpaid = tx.status === 'unpaid';
      const signed = isUnpaid ? 0 : tx.type === 'income' ? tx.amount : -tx.amount;
      currentRunningBal += signed;
      inPeriodAllTypes.push({
        ...tx,
        runningBalance: currentRunningBal,
      });
    }
  }

  const closingBalance = currentRunningBal;

  // Filtered by selected type if needed for ledger
  const filteredTransactionsAsc = inPeriodAllTypes.filter((tx) =>
    typeFilter === 'all' ? true : tx.type === typeFilter
  );
  const filteredTransactionsDesc = [...filteredTransactionsAsc].reverse();

  // Metrics breakdown: Realized vs Pending
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

  const totalIncome = realizedIncome;
  const totalExpense = realizedExpense;
  const netCashFlow = realizedIncome - realizedExpense;
  const projectedBalance = closingBalance + pendingIncome - pendingExpense;

  const numDays = computePeriodNumDays(periodMode, year, month, inPeriodAllTypes);
  const savingsRate =
    realizedIncome > 0 ? Math.max(0, ((realizedIncome - realizedExpense) / realizedIncome) * 100) : 0;
  const avgDailyExpense = numDays > 0 ? (realizedExpense + pendingExpense) / numDays : 0;

  // Category aggregations: include all expenses in the period (realized + pending card commitments)
  const expMap = new Map<string, { amount: number; count: number }>();
  const incMap = new Map<string, { amount: number; count: number }>();

  for (const tx of inPeriodAllTypes) {
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

  // Payment Channels: Credit Card vs Bank/Cash
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
