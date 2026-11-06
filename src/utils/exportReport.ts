import { jsPDF } from 'jspdf';
import { AppLanguage, Category, FuelLog, Transaction } from '../types';
import { formatCurrency, formatMonthLabel, formatShortDate, formatShortMonthLabel } from './format';
import { getCategoryDisplayName } from './i18n';

export type ExportPeriodMode = 'monthly' | 'annual' | 'all';
export type ExportTypeFilter = 'all' | 'income' | 'expense';

export interface ExportFilterOptions {
  periodMode: ExportPeriodMode;
  year: string; // e.g. '2026'
  month: string; // e.g. '10' (01..12)
  typeFilter: ExportTypeFilter;
  familyName: string;
  currency: string;
  language: AppLanguage;
  initialBalance: number;
  categories: Category[];
  transactions: Transaction[];
  fuelLogs?: FuelLog[];
}

export interface ComputedExportData {
  periodTitle: string;
  filenameSlug: string;
  openingBalance: number;
  closingBalance: number;
  projectedBalance: number;
  totalIncome: number; // Realized income (paid)
  pendingIncome: number; // A receber (unpaid)
  incomeCount: number;
  pendingIncomeCount: number;
  totalExpense: number; // Realized expenses (paid)
  pendingExpense: number; // A pagar (unpaid)
  expenseCount: number;
  pendingExpenseCount: number;
  totalCategoryExpenses: number; // Sum of all expense obligations in period
  totalCategoryIncome: number; // Sum of all income in period
  netCashFlow: number;
  savingsRate: number;
  avgDailyExpense: number;
  numDays: number;
  largestExpense: Transaction | null;
  filteredTransactionsAsc: Array<Transaction & { runningBalance: number }>;
  filteredTransactionsDesc: Array<Transaction & { runningBalance: number }>;
  expenseByCategory: Array<{
    id: string;
    name: string;
    color: string;
    count: number;
    amount: number;
    avg: number;
    share: number;
  }>;
  incomeByCategory: Array<{
    id: string;
    name: string;
    color: string;
    count: number;
    amount: number;
    share: number;
  }>;
  monthlySeries: Array<{
    month: string;
    shortLabel: string;
    fullLabel: string;
    income: number;
    expense: number;
    net: number;
    closingBalance: number;
    count: number;
  }>;
  dailySeries: Array<{
    day: string;
    label: string;
    income: number;
    expense: number;
    closingBalance: number;
  }>;
  paymentChannels: {
    card: { amount: number; count: number; share: number };
    bankOrCash: { amount: number; count: number; share: number };
  };
}

export function cleanPdfText(str: string): string {
  return String(str || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [99, 102, 241];
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return [r, g, b];
}

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

  const isPt = language === 'pt-BR';
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

  // Number of days in period
  let numDays = 30;
  if (periodMode === 'monthly') {
    const y = Number(year);
    const m = Number(month);
    numDays = new Date(y, m, 0).getDate() || 30;
  } else if (periodMode === 'annual') {
    numDays = 365;
  } else if (inPeriodAllTypes.length > 0) {
    const first = inPeriodAllTypes[0].date;
    const last = inPeriodAllTypes[inPeriodAllTypes.length - 1].date;
    const diff = Math.max(1, new Date(last).getTime() - new Date(first).getTime());
    numDays = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  const savingsRate = realizedIncome > 0 ? Math.max(0, ((realizedIncome - realizedExpense) / realizedIncome) * 100) : 0;
  const avgDailyExpense = numDays > 0 ? (realizedExpense + pendingExpense) / numDays : 0;

  // Category aggregations: include all expenses in the period (realized + pending card commitments)
  // so that category shares accurately reflect full expenditure and never show 0.0%
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

  // Monthly series (for context & annual mode)
  const monthsList: string[] = [];
  if (periodMode === 'annual') {
    for (let m = 1; m <= 12; m++) {
      monthsList.push(`${year}-${String(m).padStart(2, '0')}`);
    }
  } else if (periodMode === 'all') {
    const set = new Set<string>();
    for (const tx of inPeriodAllTypes) {
      set.add(tx.date.slice(0, 7));
    }
    monthsList.push(...Array.from(set).sort());
  } else {
    monthsList.push(targetMonthPrefix);
  }

  let runningMonthBal = openingBalance;
  const monthlySeries = monthsList.map((mStr) => {
    let inc = 0;
    let exp = 0;
    let count = 0;
    for (const tx of inPeriodAllTypes) {
      if (tx.date.startsWith(mStr)) {
        count++;
        if (tx.type === 'income') inc += tx.amount;
        else exp += tx.amount;
      }
    }
    runningMonthBal += inc - exp;
    return {
      month: mStr,
      shortLabel: formatShortMonthLabel(mStr, language),
      fullLabel: formatMonthLabel(mStr, language),
      income: inc,
      expense: exp,
      net: inc - exp,
      closingBalance: runningMonthBal,
      count,
    };
  });

  // Daily series (for Monthly mode chart)
  const dailySeries: ComputedExportData['dailySeries'] = [];
  if (periodMode === 'monthly') {
    const y = Number(year);
    const m = Number(month);
    const daysInMonth = new Date(y, m, 0).getDate() || 30;
    let runBal = openingBalance;
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${targetMonthPrefix}-${String(d).padStart(2, '0')}`;
      let inc = 0;
      let exp = 0;
      for (const tx of inPeriodAllTypes) {
        if (tx.date === dayStr) {
          if (tx.type === 'income') inc += tx.amount;
          else exp += tx.amount;
        }
      }
      runBal += inc - exp;
      dailySeries.push({
        day: dayStr,
        label: String(d).padStart(2, '0'),
        income: inc,
        expense: exp,
        closingBalance: runBal,
      });
    }
  }

  let periodTitle = '';
  let filenameSlug = '';
  if (periodMode === 'monthly') {
    periodTitle = formatMonthLabel(targetMonthPrefix, language);
    filenameSlug = `mensal-${targetMonthPrefix}`;
  } else if (periodMode === 'annual') {
    periodTitle = isPt ? `Ano Completo de ${year}` : `Full Year ${year}`;
    filenameSlug = `anual-${year}`;
  } else {
    periodTitle = isPt ? 'Todo o Histórico Registrado' : 'All Recorded History';
    filenameSlug = 'historico-completo';
  }

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

/**
 * Exports filtered account history + summary metrics to a UTF-8 CSV file.
 */
export function exportFilteredHistoryToCSV(opts: ExportFilterOptions): void {
  const data = computeExportData(opts);
  const isPt = opts.language === 'pt-BR';
  const catMap = new Map(opts.categories.map((c) => [c.id, c]));

  const escapeCsv = (val: string | number) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const summaryRows = isPt
    ? [
        ['DEMONSTRATIVO FINANCEIRO - PRUMO'],
        ['Período Filtrado', data.periodTitle],
        ['Saldo Inicial no Período', data.openingBalance.toFixed(2)],
        ['Total de Entradas (+)', data.totalIncome.toFixed(2)],
        ['Total de Despesas (-)', data.totalExpense.toFixed(2)],
        ['Resultado Líquido do Período', data.netCashFlow.toFixed(2)],
        ['Saldo Bancário Final', data.closingBalance.toFixed(2)],
        ['Saldo Projetado Final', data.projectedBalance.toFixed(2)],
        [],
      ]
    : [
        ['FINANCIAL STATEMENT - PRUMO'],
        ['Filtered Period', data.periodTitle],
        ['Opening Balance', data.openingBalance.toFixed(2)],
        ['Total Inputs (+)', data.totalIncome.toFixed(2)],
        ['Total Expenses (-)', data.totalExpense.toFixed(2)],
        ['Net Cash Flow', data.netCashFlow.toFixed(2)],
        ['Closing Bank Balance', data.closingBalance.toFixed(2)],
        ['Projected Closing Balance', data.projectedBalance.toFixed(2)],
        [],
      ];

  const headers = isPt
    ? [
        'Data',
        'Tipo',
        'Categoria',
        'Descrição',
        'Frequência / Parcela',
        'Status',
        'Valor',
        'Valor com Sinal',
        'Saldo Acumulado',
        'Observações',
      ]
    : [
        'Date',
        'Type',
        'Category',
        'Description',
        'Frequency / Installment',
        'Status',
        'Amount',
        'Signed Amount',
        'Running Balance',
        'Notes',
      ];

  const txRows = data.filteredTransactionsAsc.map((tx) => {
    const cat = catMap.get(tx.categoryId);
    const catName = getCategoryDisplayName(cat, opts.language) || tx.categoryId;
    let freq = tx.recurringId ? (isPt ? 'Fixa' : 'Recurring') : isPt ? 'Única' : 'One-time';
    if (tx.installmentTotal && tx.installmentTotal > 1) {
      freq = `${tx.installmentCurrent || 1}/${tx.installmentTotal}`;
    }
    const signedVal = tx.type === 'income' ? tx.amount : -tx.amount;
    const statusStr = tx.status === 'unpaid' ? (isPt ? 'Pendente' : 'Pending') : (isPt ? 'Pago' : 'Paid');

    return [
      tx.date,
      tx.type === 'income' ? (isPt ? 'Entrada' : 'Income') : (isPt ? 'Despesa' : 'Expense'),
      catName,
      tx.description,
      freq,
      statusStr,
      tx.amount.toFixed(2),
      signedVal.toFixed(2),
      tx.runningBalance.toFixed(2),
      tx.notes || '',
    ];
  });

  const allLines = [
    ...summaryRows.map((r) => r.map(escapeCsv).join(',')),
    headers.map(escapeCsv).join(','),
    ...txRows.map((r) => r.map(escapeCsv).join(',')),
  ];

  const csvContent = '\uFEFF' + allLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `prumo-${data.filenameSlug}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =============================================================================
// NATIVE INLINE SVG VECTOR CHARTS GENERATORS (ZERO EXTERNAL CANVAS DEPENDENCIES)
// =============================================================================

/**
 * 1. Official Prumo Vector Plumb-Bob Logo SVG
 */
export function generatePrumoLogoSvg(): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="6 -2 20 37" width="26" height="36" style="overflow: visible; display: inline-block; vertical-align: middle;">
      <defs>
        <linearGradient id="prumoIronLight" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#7E624B" />
          <stop offset="45%" stop-color="#9C7F6A" />
          <stop offset="85%" stop-color="#6E5440" />
          <stop offset="100%" stop-color="#4A3728" />
        </linearGradient>
        <linearGradient id="prumoIronDark" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#3D2B1E" />
          <stop offset="50%" stop-color="#24170E" />
          <stop offset="100%" stop-color="#0F0A06" />
        </linearGradient>
        <linearGradient id="prumoRope" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#D0B595" />
          <stop offset="50%" stop-color="#E7CDAC" />
          <stop offset="100%" stop-color="#A68969" />
        </linearGradient>
      </defs>
      <g>
        <line x1="16" y1="-8" x2="16" y2="8" stroke="url(#prumoRope)" stroke-width="2.2" stroke-linecap="round" />
        <line x1="15" y1="-1" x2="17" y2="0" stroke="#846B4E" stroke-width="0.7" stroke-linecap="round" />
        <line x1="15" y1="2.5" x2="17" y2="3.5" stroke="#846B4E" stroke-width="0.7" stroke-linecap="round" />
        <ellipse cx="16" cy="7.8" rx="2.5" ry="1.9" fill="#8C7051" />
        <path d="M 14.2 7 C 14.6 8.8 17.4 8.8 17.8 7 Z" fill="#D0B595" />
        <circle cx="15.5" cy="7.9" r="0.8" fill="#5E4730" />
        <circle cx="16" cy="12" r="3.4" fill="none" stroke="url(#prumoIronLight)" stroke-width="1.9" />
        <ellipse cx="16" cy="15.6" rx="3.2" ry="1.1" fill="url(#prumoIronLight)" />
        <ellipse cx="16" cy="16.4" rx="2.4" ry="0.8" fill="url(#prumoIronDark)" />
        <path d="M 16 16.4 L 8 19.2 L 16 19.2 Z" fill="url(#prumoIronLight)" />
        <path d="M 16 16.4 L 16 19.2 L 24 19.2 Z" fill="url(#prumoIronDark)" />
        <path d="M 8 19.2 L 16 33.2 L 16 19.2 Z" fill="url(#prumoIronLight)" />
        <path d="M 16 19.2 L 16 33.2 L 24 19.2 Z" fill="url(#prumoIronDark)" />
        <circle cx="16" cy="33.2" r="0.75" fill="#FFFDF5" opacity="0.9" />
      </g>
    </svg>
  `;
}

/**
 * 2. Chart 1: Expenses by Category (Inline SVG Donut Chart with Center Label & Legend)
 */
export function generateCategoryDonutSvg(
  items: ComputedExportData['expenseByCategory'],
  totalExpense: number,
  currency: string,
  isPt: boolean
): string {
  if (items.length === 0 || totalExpense <= 0) {
    return `
      <svg viewBox="0 0 380 180" width="100%" height="180" xmlns="http://www.w3.org/2000/svg" style="display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <circle cx="190" cy="80" r="50" fill="none" stroke="#E2E8F0" stroke-width="20" />
        <text x="190" y="85" text-anchor="middle" font-size="10" font-weight="600" fill="#94A3B8">
          ${isPt ? 'Sem despesas registradas no período' : 'No expenses recorded in period'}
        </text>
      </svg>
    `;
  }

  const cx = 95;
  const cy = 90;
  const outerR = 75;
  const innerR = 48;

  // Take top 6 categories, group the remainder into "Outras"
  const topItems = items.slice(0, 6);
  const otherAmount = items.slice(6).reduce((acc, i) => acc + i.amount, 0);
  const chartSlices =
    otherAmount > 0
      ? [
          ...topItems,
          {
            id: 'other',
            name: isPt ? 'Outras Categorias' : 'Other Categories',
            color: '#94A3B8',
            count: 0,
            amount: otherAmount,
            avg: 0,
            share: (otherAmount / totalExpense) * 100,
          },
        ]
      : topItems;

  let currentAngle = -Math.PI / 2;
  const paths: string[] = [];

  if (chartSlices.length === 1 || chartSlices[0].amount >= totalExpense) {
    const midR = (outerR + innerR) / 2;
    const strokeW = outerR - innerR;
    paths.push(`
      <circle cx="${cx}" cy="${cy}" r="${midR}" fill="none" stroke="${chartSlices[0].color}" stroke-width="${strokeW}" />
    `);
  } else {
    for (const slice of chartSlices) {
      const sliceAngle = (slice.amount / totalExpense) * Math.PI * 2;
      const endAngle = currentAngle + sliceAngle;

      const x1 = cx + outerR * Math.cos(currentAngle);
      const y1 = cy + outerR * Math.sin(currentAngle);
      const x2 = cx + outerR * Math.cos(endAngle);
      const y2 = cy + outerR * Math.sin(endAngle);
      const x3 = cx + innerR * Math.cos(endAngle);
      const y3 = cy + innerR * Math.sin(endAngle);
      const x4 = cx + innerR * Math.cos(currentAngle);
      const y4 = cy + innerR * Math.sin(currentAngle);

      const largeArc = sliceAngle > Math.PI ? 1 : 0;
      const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;

      paths.push(`
        <path d="${d}" fill="${slice.color}" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round" />
      `);
      currentAngle = endAngle;
    }
  }

  // Right-side Vector Legend
  const legendItems = chartSlices
    .map((slice, idx) => {
      const y = 24 + idx * 24;
      const truncatedName = slice.name.length > 17 ? slice.name.slice(0, 16) + '…' : slice.name;
      return `
        <g>
          <circle cx="205" cy="${y}" r="4.5" fill="${slice.color}" />
          <text x="216" y="${y + 3.5}" font-size="8.5" font-weight="600" fill="#1E293B">${truncatedName}</text>
          <text x="375" y="${y + 3.5}" text-anchor="end" font-size="8.5" font-weight="700" fill="#475569">
            ${slice.share.toFixed(1)}% <tspan font-weight="400" fill="#94A3B8">(${formatCurrency(slice.amount, currency)})</tspan>
          </text>
        </g>
      `;
    })
    .join('');

  return `
    <svg viewBox="0 0 380 180" width="100%" height="180" xmlns="http://www.w3.org/2000/svg" style="display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      ${paths.join('')}
      <circle cx="${cx}" cy="${cy}" r="${innerR - 1}" fill="#FFFFFF" />
      <text x="${cx}" y="${cy - 7}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#64748B" letter-spacing="0.5">
        ${isPt ? 'TOTAL GASTO' : 'TOTAL SPENT'}
      </text>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="11" font-weight="800" fill="#0F172A">
        ${formatCurrency(totalExpense, currency)}
      </text>
      ${legendItems}
    </svg>
  `;
}

/**
 * 3. Chart 2: Daily Cash Flow (Inline SVG Dual-Bar Chart)
 */
export function generateCashFlowSvg(
  dailySeries: ComputedExportData['dailySeries'],
  currency: string,
  isPt: boolean
): string {
  const chartL = 46;
  const chartR = 372;
  const chartT = 24;
  const chartB = 150;
  const chartW = chartR - chartL;
  const chartH = chartB - chartT;

  const maxVal = Math.max(
    ...dailySeries.map((d) => Math.max(d.income, d.expense)),
    100
  );

  const mag = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const niceMax = Math.ceil(maxVal / mag) * mag;

  // 4 Horizontal Gridlines with Currency Markers
  const gridlines = [0, 0.33, 0.66, 1]
    .map((ratio) => {
      const y = chartB - chartH * ratio;
      const val = niceMax * ratio;
      const valStr = formatCurrency(val, currency).replace(/\s/g, '');
      return `
        <g>
          <line x1="${chartL}" y1="${y.toFixed(1)}" x2="${chartR}" y2="${y.toFixed(1)}" stroke="#E2E8F0" stroke-width="0.8" stroke-dasharray="3,3" />
          <text x="${chartL - 5}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="7" font-weight="500" fill="#64748B">${valStr}</text>
        </g>
      `;
    })
    .join('');

  const numDays = Math.max(1, dailySeries.length);
  const slotW = chartW / numDays;
  const barW = Math.max(2, Math.min(5, (slotW - 1.5) / 2));

  const bars = dailySeries
    .map((d, idx) => {
      const xSlot = chartL + idx * slotW;
      const hIn = niceMax > 0 ? (d.income / niceMax) * chartH : 0;
      const yIn = chartB - hIn;
      const hOut = niceMax > 0 ? (d.expense / niceMax) * chartH : 0;
      const yOut = chartB - hOut;

      const dayNum = Number(d.label);
      const showLabel = dayNum === 1 || dayNum % 5 === 0 || idx === numDays - 1;

      return `
        <g>
          ${hIn > 0 ? `<rect x="${xSlot.toFixed(1)}" y="${yIn.toFixed(1)}" width="${barW.toFixed(1)}" height="${hIn.toFixed(1)}" fill="#10B981" rx="1" />` : ''}
          ${hOut > 0 ? `<rect x="${(xSlot + barW + 0.8).toFixed(1)}" y="${yOut.toFixed(1)}" width="${barW.toFixed(1)}" height="${hOut.toFixed(1)}" fill="#EF4444" rx="1" />` : ''}
          ${showLabel ? `<text x="${(xSlot + barW).toFixed(1)}" y="${chartB + 14}" text-anchor="middle" font-size="7" font-weight="600" fill="#64748B">${d.label}</text>` : ''}
        </g>
      `;
    })
    .join('');

  return `
    <svg viewBox="0 0 380 180" width="100%" height="180" xmlns="http://www.w3.org/2000/svg" style="display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Legend at Top -->
      <g transform="translate(240, 12)">
        <rect x="0" y="-7" width="8" height="8" rx="1.5" fill="#10B981" />
        <text x="12" y="0" font-size="8" font-weight="600" fill="#334155">${isPt ? 'Entradas (+)' : 'Inflows'}</text>
        <rect x="75" y="-7" width="8" height="8" rx="1.5" fill="#EF4444" />
        <text x="87" y="0" font-size="8" font-weight="600" fill="#334155">${isPt ? 'Saídas (-)' : 'Outflows'}</text>
      </g>
      ${gridlines}
      ${bars}
      <line x1="${chartL}" y1="${chartB}" x2="${chartR}" y2="${chartB}" stroke="#94A3B8" stroke-width="1" />
    </svg>
  `;
}

/**
 * 4. Chart 3: Realized vs. Pending Commitments (Grouped Bar Chart)
 */
export function generateCommitmentsComparisonSvg(
  realizedIncome: number,
  pendingIncome: number,
  realizedExpense: number,
  pendingExpense: number,
  currency: string,
  isPt: boolean
): string {
  const totalInc = realizedIncome + pendingIncome;
  const totalExp = realizedExpense + pendingExpense;
  const maxVal = Math.max(totalInc, totalExp, 100);

  const barMaxW = 190;
  const incRealW = maxVal > 0 ? (realizedIncome / maxVal) * barMaxW : 0;
  const incPendW = maxVal > 0 ? (pendingIncome / maxVal) * barMaxW : 0;
  const expRealW = maxVal > 0 ? (realizedExpense / maxVal) * barMaxW : 0;
  const expPendW = maxVal > 0 ? (pendingExpense / maxVal) * barMaxW : 0;

  return `
    <svg viewBox="0 0 380 160" width="100%" height="160" xmlns="http://www.w3.org/2000/svg" style="display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Cluster 1: ENTRADAS -->
      <text x="15" y="20" font-size="9" font-weight="700" fill="#0F172A" letter-spacing="0.5">
        ${isPt ? 'RECEITAS TOTAIS' : 'TOTAL INFLOWS'}: ${formatCurrency(totalInc, currency)}
      </text>

      <!-- Realizadas -->
      <text x="85" y="42" text-anchor="end" font-size="7.5" font-weight="600" fill="#10B981">${isPt ? 'Realizadas' : 'Settled'}</text>
      <rect x="95" y="32" width="${barMaxW}" height="13" fill="#F1F5F9" rx="3" />
      <rect x="95" y="32" width="${Math.max(1, incRealW).toFixed(1)}" height="13" fill="#10B981" rx="3" />
      <text x="${(105 + incRealW).toFixed(1)}" y="42" font-size="7.5" font-weight="700" fill="#1E293B">
        ${formatCurrency(realizedIncome, currency)} (${totalInc > 0 ? ((realizedIncome / totalInc) * 100).toFixed(0) : 0}%)
      </text>

      <!-- A Receber -->
      <text x="85" y="62" text-anchor="end" font-size="7.5" font-weight="600" fill="#F59E0B">${isPt ? 'A Receber' : 'Pending'}</text>
      <rect x="95" y="52" width="${barMaxW}" height="13" fill="#F1F5F9" rx="3" />
      <rect x="95" y="52" width="${Math.max(1, incPendW).toFixed(1)}" height="13" fill="#F59E0B" rx="3" />
      <text x="${(105 + incPendW).toFixed(1)}" y="62" font-size="7.5" font-weight="700" fill="#1E293B">
        ${formatCurrency(pendingIncome, currency)} (${totalInc > 0 ? ((pendingIncome / totalInc) * 100).toFixed(0) : 0}%)
      </text>

      <line x1="15" y1="76" x2="365" y2="76" stroke="#E2E8F0" stroke-width="1" />

      <!-- Cluster 2: DESPESAS -->
      <text x="15" y="96" font-size="9" font-weight="700" fill="#0F172A" letter-spacing="0.5">
        ${isPt ? 'OBRIGAÇÕES TOTAIS' : 'TOTAL OBLIGATIONS'}: ${formatCurrency(totalExp, currency)}
      </text>

      <!-- Pagas -->
      <text x="85" y="118" text-anchor="end" font-size="7.5" font-weight="600" fill="#EF4444">${isPt ? 'Pagas' : 'Paid'}</text>
      <rect x="95" y="108" width="${barMaxW}" height="13" fill="#F1F5F9" rx="3" />
      <rect x="95" y="108" width="${Math.max(1, expRealW).toFixed(1)}" height="13" fill="#EF4444" rx="3" />
      <text x="${(105 + expRealW).toFixed(1)}" y="118" font-size="7.5" font-weight="700" fill="#1E293B">
        ${formatCurrency(realizedExpense, currency)} (${totalExp > 0 ? ((realizedExpense / totalExp) * 100).toFixed(0) : 0}%)
      </text>

      <!-- A Pagar -->
      <text x="85" y="138" text-anchor="end" font-size="7.5" font-weight="600" fill="#FB923C">${isPt ? 'A Pagar' : 'Due'}</text>
      <rect x="95" y="128" width="${barMaxW}" height="13" fill="#F1F5F9" rx="3" />
      <rect x="95" y="128" width="${Math.max(1, expPendW).toFixed(1)}" height="13" fill="#FB923C" rx="3" />
      <text x="${(105 + expPendW).toFixed(1)}" y="138" font-size="7.5" font-weight="700" fill="#1E293B">
        ${formatCurrency(pendingExpense, currency)} (${totalExp > 0 ? ((pendingExpense / totalExp) * 100).toFixed(0) : 0}%)
      </text>
    </svg>
  `;
}

/**
 * 5. Chart 4: Payment Channel Distribution (Cartão vs Conta Bancária / Dinheiro)
 */
export function generatePaymentChannelsSvg(
  cardAmount: number,
  cardCount: number,
  bankAmount: number,
  bankCount: number,
  currency: string,
  isPt: boolean
): string {
  const total = cardAmount + bankAmount;
  const cardShare = total > 0 ? (cardAmount / total) * 100 : 0;
  const bankShare = total > 0 ? (bankAmount / total) * 100 : 0;

  const cx = 85;
  const cy = 80;
  const outerR = 60;
  const innerR = 38;

  let paths = '';
  if (total <= 0) {
    paths = `<circle cx="${cx}" cy="${cy}" r="${(outerR + innerR) / 2}" fill="none" stroke="#E2E8F0" stroke-width="${outerR - innerR}" />`;
  } else if (cardAmount <= 0) {
    paths = `<circle cx="${cx}" cy="${cy}" r="${(outerR + innerR) / 2}" fill="none" stroke="#0284C7" stroke-width="${outerR - innerR}" />`;
  } else if (bankAmount <= 0) {
    paths = `<circle cx="${cx}" cy="${cy}" r="${(outerR + innerR) / 2}" fill="none" stroke="#6E5440" stroke-width="${outerR - innerR}" />`;
  } else {
    const cardAngle = (cardAmount / total) * Math.PI * 2;
    const startA = -Math.PI / 2;
    const endA = startA + cardAngle;

    const x1 = cx + outerR * Math.cos(startA);
    const y1 = cy + outerR * Math.sin(startA);
    const x2 = cx + outerR * Math.cos(endA);
    const y2 = cy + outerR * Math.sin(endA);
    const x3 = cx + innerR * Math.cos(endA);
    const y3 = cy + innerR * Math.sin(endA);
    const x4 = cx + innerR * Math.cos(startA);
    const y4 = cy + innerR * Math.sin(startA);
    const large1 = cardAngle > Math.PI ? 1 : 0;

    const dCard = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerR} ${outerR} 0 ${large1} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${innerR} ${innerR} 0 ${large1} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;

    const x5 = cx + outerR * Math.cos(startA + Math.PI * 2);
    const y5 = cy + outerR * Math.sin(startA + Math.PI * 2);
    const x6 = cx + innerR * Math.cos(startA + Math.PI * 2);
    const y6 = cy + innerR * Math.sin(startA + Math.PI * 2);
    const bankAngle = Math.PI * 2 - cardAngle;
    const large2 = bankAngle > Math.PI ? 1 : 0;

    const dBank = `M ${x2.toFixed(2)} ${y2.toFixed(2)} A ${outerR} ${outerR} 0 ${large2} 1 ${x5.toFixed(2)} ${y5.toFixed(2)} L ${x6.toFixed(2)} ${y6.toFixed(2)} A ${innerR} ${innerR} 0 ${large2} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`;

    paths = `
      <path d="${dCard}" fill="#6E5440" stroke="#FFFFFF" stroke-width="2" />
      <path d="${dBank}" fill="#0284C7" stroke="#FFFFFF" stroke-width="2" />
    `;
  }

  return `
    <svg viewBox="0 0 380 160" width="100%" height="160" xmlns="http://www.w3.org/2000/svg" style="display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      ${paths}
      <circle cx="${cx}" cy="${cy}" r="${innerR - 1}" fill="#FFFFFF" />
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="7" font-weight="700" fill="#64748B">${isPt ? 'TOTAL' : 'TOTAL'}</text>
      <text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="9" font-weight="800" fill="#0F172A">${formatCurrency(total, currency)}</text>

      <!-- Details Card 1: Fatura Cartão -->
      <g transform="translate(165, 26)">
        <rect x="0" y="0" width="200" height="44" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" rx="6" />
        <rect x="0" y="0" width="4" height="44" fill="#6E5440" rx="2" />
        <circle cx="16" cy="15" r="5" fill="#6E5440" />
        <text x="28" y="17" font-size="8.5" font-weight="700" fill="#1E293B">${isPt ? 'Fatura Cartão / Cartão de Crédito' : 'Credit Card Charges'}</text>
        <text x="28" y="34" font-size="10.5" font-weight="800" fill="#6E5440">${formatCurrency(cardAmount, currency)}</text>
        <text x="190" y="34" text-anchor="end" font-size="8" font-weight="600" fill="#64748B">${cardShare.toFixed(1)}% (${cardCount} itens)</text>
      </g>

      <!-- Details Card 2: Conta Bancária / Dinheiro -->
      <g transform="translate(165, 88)">
        <rect x="0" y="0" width="200" height="44" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" rx="6" />
        <rect x="0" y="0" width="4" height="44" fill="#0284C7" rx="2" />
        <circle cx="16" cy="15" r="5" fill="#0284C7" />
        <text x="28" y="17" font-size="8.5" font-weight="700" fill="#1E293B">${isPt ? 'Conta Corrente / Dinheiro / Pix' : 'Direct Account / Cash'}</text>
        <text x="28" y="34" font-size="10.5" font-weight="800" fill="#0284C7">${formatCurrency(bankAmount, currency)}</text>
        <text x="190" y="34" text-anchor="end" font-size="8" font-weight="600" fill="#64748B">${bankShare.toFixed(1)}% (${bankCount} itens)</text>
      </g>
    </svg>
  `;
}

// =============================================================================
// STANDALONE A4 PORTRAIT HTML DOCUMENT GENERATOR (PRINT & PDF ENGINE)
// =============================================================================

export function generateReportHtml(opts: ExportFilterOptions, includeScreenBar = false): string {
  const data = computeExportData(opts);
  const isPt = opts.language === 'pt-BR';
  const currency = opts.currency;
  const catMap = new Map(opts.categories.map((c) => [c.id, c]));

  const fmtMoney = (v: number) => formatCurrency(v, currency);
  const logoSvg = generatePrumoLogoSvg();
  const donutSvg = generateCategoryDonutSvg(data.expenseByCategory, data.totalCategoryExpenses, currency, isPt);
  const cashFlowSvg = generateCashFlowSvg(data.dailySeries, currency, isPt);
  const commitmentsSvg = generateCommitmentsComparisonSvg(
    data.totalIncome,
    data.pendingIncome,
    data.totalExpense,
    data.pendingExpense,
    currency,
    isPt
  );
  const channelsSvg = generatePaymentChannelsSvg(
    data.paymentChannels.card.amount,
    data.paymentChannels.card.count,
    data.paymentChannels.bankOrCash.amount,
    data.paymentChannels.bankOrCash.count,
    currency,
    isPt
  );

  const genDateStr = new Date().toLocaleDateString(isPt ? 'pt-BR' : 'en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const genTimeStr = new Date().toLocaleTimeString(isPt ? 'pt-BR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Category Breakdown Rows
  const expenseRowsHtml = data.expenseByCategory
    .map((row) => `
      <tr>
        <td>
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${row.color}; margin-right:6px; vertical-align:middle;"></span>
          <strong style="color:#0F172A;">${row.name}</strong>
        </td>
        <td class="text-center">${row.count}</td>
        <td class="text-right" style="color:#EF4444; font-weight:700;">${fmtMoney(row.amount)}</td>
        <td class="text-right">
          <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px;">
            <div style="width:40px; height:4px; background:#E2E8F0; border-radius:2px; overflow:hidden;">
              <div style="width:${Math.min(100, Math.max(2, row.share)).toFixed(1)}%; height:100%; background:${row.color};"></div>
            </div>
            <span style="font-weight:700; color:#334155; min-width:35px;">${row.share.toFixed(1)}%</span>
          </div>
        </td>
        <td class="text-right" style="color:#64748B;">${fmtMoney(row.avg)}</td>
      </tr>
    `)
    .join('');

  const totalExpenseItems = data.expenseByCategory.reduce((sum, r) => sum + r.count, 0);
  const avgExpensePerItem = totalExpenseItems > 0 ? data.totalCategoryExpenses / totalExpenseItems : 0;

  // Ledger Rows
  const ledgerRowsHtml = data.filteredTransactionsAsc
    .map((tx) => {
      const cat = catMap.get(tx.categoryId);
      const catName = getCategoryDisplayName(cat, opts.language) || tx.categoryId;
      const isInc = tx.type === 'income';
      const isUnpaid = tx.status === 'unpaid';

      let tagsStr = '';
      if (tx.settledInvoiceKey || /^fatura\b/i.test(tx.description)) {
        tagsStr += `<span class="badge badge-invoice">${isPt ? 'Fatura Cartão' : 'Card Invoice'}</span> `;
      }
      if (tx.installmentTotal && tx.installmentTotal > 1) {
        tagsStr += `<span class="badge badge-inst">${tx.installmentCurrent || 1}/${tx.installmentTotal}</span> `;
      }
      if (tx.recurringId && !tx.installmentTotal) {
        tagsStr += `<span class="badge badge-inst">${isPt ? 'Fixa' : 'Fixed'}</span> `;
      }

      const statusBadge = isUnpaid
        ? `<span class="badge badge-pending">${isPt ? 'Pendente' : 'Pending'}</span>`
        : `<span class="badge badge-paid">${isPt ? (isInc ? 'Recebido' : 'Pago') : 'Paid'}</span>`;

      return `
        <tr>
          <td style="white-space:nowrap; color:#64748B; font-weight:600;">${formatShortDate(tx.date, opts.language)}</td>
          <td><strong style="color:#0F172A;">${tx.description}</strong></td>
          <td style="color:#475569;">${catName}</td>
          <td>${tagsStr || '<span style="color:#CBD5E1;">—</span>'}</td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-right" style="font-weight:700; color:${isInc ? '#10B981' : '#EF4444'};">
            ${isInc ? '+' : '-'} ${fmtMoney(tx.amount)}
          </td>
          <td class="text-right" style="font-weight:600; color:#334155;">
            ${fmtMoney(tx.runningBalance)}
          </td>
        </tr>
      `;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="${isPt ? 'pt-BR' : 'en'}">
<head>
  <meta charset="UTF-8">
  <title>Prumo - Demonstrativo Financeiro Mensal (${data.periodTitle})</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 15mm 12mm;
    }
    body, #prumo-pdf-print-container {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1E293B;
      background: #FFFFFF;
      font-size: 10px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print {
      display: block;
    }
    @media print {
      .no-print {
        display: none !important;
      }
      body {
        background: #FFFFFF;
      }
      .page-break-before {
        page-break-before: always;
        break-before: page;
      }
      .avoid-break {
        page-break-inside: avoid;
        break-inside: avoid;
      }
      thead {
        display: table-header-group;
      }
      tr {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
    .report-container {
      width: 100%;
      max-width: 186mm;
      margin: 0 auto;
      padding: 10px 0;
    }

    /* Screen Action Bar */
    .screen-bar {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #0F172A;
      color: #FFFFFF;
      padding: 10px 18px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      border-radius: 8px;
      margin-bottom: 16px;
    }
    .screen-bar button {
      cursor: pointer;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      padding: 8px 14px;
      transition: all 0.2s;
    }
    .btn-print {
      background: #10B981;
      color: #FFFFFF;
    }
    .btn-print:hover {
      background: #059669;
    }
    .btn-close {
      background: #334155;
      color: #E2E8F0;
    }
    .btn-close:hover {
      background: #475569;
    }

    /* Brand Header */
    .brand-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #1E293B;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .brand-logo-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .brand-text h1 {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: 2px;
      color: #1E293B;
      line-height: 1;
    }
    .brand-text span {
      font-size: 7.5px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #64748B;
      text-transform: uppercase;
      display: block;
      margin-top: 2px;
    }
    .header-meta {
      text-align: right;
    }
    .header-meta h2 {
      font-size: 12px;
      font-weight: 800;
      color: #1E293B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .header-meta .period-tag {
      font-size: 10.5px;
      font-weight: 700;
      color: #10B981;
      margin-top: 2px;
    }
    .header-meta .gen-date {
      font-size: 7.5px;
      color: #94A3B8;
      margin-top: 2px;
    }

    /* 2x3 KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .kpi-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 7px 9px;
      position: relative;
      overflow: hidden;
    }
    .kpi-stripe {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3.5px;
    }
    .kpi-label {
      font-size: 7px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748B;
      margin-bottom: 3px;
      padding-left: 2px;
    }
    .kpi-value {
      font-size: 12.5px;
      font-weight: 800;
      color: #0F172A;
      line-height: 1.2;
      padding-left: 2px;
    }
    .kpi-sub {
      font-size: 7px;
      font-weight: 500;
      color: #64748B;
      margin-top: 2.5px;
      padding-left: 2px;
    }

    /* Charts Row */
    .charts-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 14px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .chart-box {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 8px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .chart-box-title {
      font-size: 8px;
      font-weight: 800;
      color: #1E293B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
      border-bottom: 1px solid #F1F5F9;
      padding-bottom: 3px;
    }

    /* Section Titles & Tables */
    .section-title {
      font-size: 9.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #1E293B;
      margin-top: 12px;
      margin-bottom: 5px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    thead {
      display: table-header-group;
    }
    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    th {
      background: #1E293B;
      color: #FFFFFF;
      font-size: 7.2px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 4.5px 5px;
      text-align: left;
    }
    th.text-right, td.text-right {
      text-align: right;
    }
    th.text-center, td.text-center {
      text-align: center;
    }
    td {
      padding: 4px 5px;
      font-size: 7.5px;
      color: #334155;
      border-bottom: 1px solid #F1F5F9;
    }
    tr:nth-child(even) td {
      background-color: #F8FAFC;
    }
    .totals-row td {
      background: #F1F5F9 !important;
      font-weight: 800;
      color: #0F172A;
      border-top: 1.5px solid #CBD5E1;
      border-bottom: 2px solid #CBD5E1;
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 1.5px 4.5px;
      border-radius: 3px;
      font-size: 6.8px;
      font-weight: 700;
    }
    .badge-paid {
      background: rgba(16, 185, 129, 0.12);
      color: #059669;
    }
    .badge-pending {
      background: rgba(245, 158, 11, 0.12);
      color: #D97706;
    }
    .badge-invoice {
      background: rgba(110, 84, 64, 0.12);
      color: #6E5440;
    }
    .badge-inst {
      background: #E2E8F0;
      color: #475569;
    }

    /* Page Footer */
    .page-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid #E2E8F0;
      padding-top: 5px;
      margin-top: 10px;
      font-size: 7px;
      color: #94A3B8;
    }
  </style>
</head>
<body>

  ${includeScreenBar ? `
  <!-- Screen Top Bar (Hidden in Print / Saved PDF) -->
  <div class="no-print report-container">
    <div class="screen-bar">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-weight:800; letter-spacing:1px; font-size:14px;">PRUMO</span>
        <span style="color:#94A3B8; font-size:12px;">• Demonstrativo Financeiro Mensal (${data.periodTitle})</span>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <button class="btn-print" onclick="window.print()">
          Imprimir / Salvar em PDF
        </button>
        <button class="btn-close" onclick="window.close()">
          Fechar
        </button>
      </div>
    </div>
  </div>` : ''}

  <div class="report-container">

    <!-- ========================================================================= -->
    <!-- PAGE 1: HEADER, EXECUTIVE KPI GRID, PRIMARY CHARTS, CATEGORY BREAKDOWN    -->
    <!-- ========================================================================= -->

    <!-- Header -->
    <header class="brand-header">
      <div class="brand-logo-group">
        ${logoSvg}
        <div class="brand-text">
          <h1>PRUMO</h1>
          <span>GESTÃO FINANCEIRA PESSOAL</span>
        </div>
      </div>
      <div class="header-meta">
        <h2>DEMONSTRATIVO FINANCEIRO MENSAL</h2>
        <div class="period-tag">${data.periodTitle}</div>
        <div class="gen-date">Gerado em: ${genDateStr} às ${genTimeStr}</div>
      </div>
    </header>

    <!-- Executive KPI Summary Cards (2 rows x 3 cols) -->
    <section class="kpi-grid">
      <!-- 1. Saldo Inicial -->
      <div class="kpi-card">
        <div class="kpi-stripe" style="background-color: #64748B;"></div>
        <div class="kpi-label">SALDO INICIAL NO PERÍODO</div>
        <div class="kpi-value">${fmtMoney(data.openingBalance)}</div>
        <div class="kpi-sub">Saldo anterior acumulado</div>
      </div>

      <!-- 2. Total de Entradas -->
      <div class="kpi-card">
        <div class="kpi-stripe" style="background-color: #10B981;"></div>
        <div class="kpi-label">TOTAL DE ENTRADAS (+)</div>
        <div class="kpi-value" style="color: #10B981;">+ ${fmtMoney(data.totalIncome)}</div>
        <div class="kpi-sub">A receber: ${fmtMoney(data.pendingIncome)} (${data.pendingIncomeCount} itens)</div>
      </div>

      <!-- 3. Total de Despesas -->
      <div class="kpi-card">
        <div class="kpi-stripe" style="background-color: #EF4444;"></div>
        <div class="kpi-label">TOTAL DE DESPESAS (-)</div>
        <div class="kpi-value" style="color: #EF4444;">- ${fmtMoney(data.totalExpense)}</div>
        <div class="kpi-sub">A pagar: ${fmtMoney(data.pendingExpense)} (${data.pendingExpenseCount} itens)</div>
      </div>

      <!-- 4. Resultado Líquido -->
      <div class="kpi-card">
        <div class="kpi-stripe" style="background-color: ${data.netCashFlow >= 0 ? '#10B981' : '#EF4444'};"></div>
        <div class="kpi-label">RESULTADO LÍQUIDO</div>
        <div class="kpi-value" style="color: ${data.netCashFlow >= 0 ? '#10B981' : '#EF4444'};">
          ${data.netCashFlow >= 0 ? '+' : '-'} ${fmtMoney(Math.abs(data.netCashFlow))}
        </div>
        <div class="kpi-sub">${data.netCashFlow >= 0 ? 'Superávit operacional no mês' : 'Déficit operacional no mês'}</div>
      </div>

      <!-- 5. Saldo Projetado / Final -->
      <div class="kpi-card">
        <div class="kpi-stripe" style="background-color: #334155;"></div>
        <div class="kpi-label">SALDO EM CONTA / PROJETADO</div>
        <div class="kpi-value">${fmtMoney(data.closingBalance)}</div>
        <div class="kpi-sub">Projetado final: ${fmtMoney(data.projectedBalance)}</div>
      </div>

      <!-- 6. Taxa de Poupança / Média Diária -->
      <div class="kpi-card">
        <div class="kpi-stripe" style="background-color: #F59E0B;"></div>
        <div class="kpi-label">TAXA POUPADA / MÉDIA DIÁRIA</div>
        <div class="kpi-value">${data.savingsRate.toFixed(1)}% poupado</div>
        <div class="kpi-sub">Média diária: ${fmtMoney(data.avgDailyExpense)} / dia</div>
      </div>
    </section>

    <!-- Primary Inline SVG Charts (Donut + Cash Flow) -->
    <section class="charts-row">
      <div class="chart-box">
        <div class="chart-box-title">GRÁFICO 1: DESPESAS POR CATEGORIA</div>
        ${donutSvg}
      </div>
      <div class="chart-box">
        <div class="chart-box-title">GRÁFICO 2: FLUXO DE CAIXA DIÁRIO NO MÊS</div>
        ${cashFlowSvg}
      </div>
    </section>

    <!-- Category Breakdown Table -->
    <section class="avoid-break">
      <div class="section-title">
        <span>1. DETALHAMENTO DE DESPESAS POR CATEGORIA</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Categoria</th>
            <th class="text-center">Lançamentos</th>
            <th class="text-right">Valor Total</th>
            <th class="text-right">Participação (%)</th>
            <th class="text-right">Média / Lanç.</th>
          </tr>
        </thead>
        <tbody>
          ${expenseRowsHtml || '<tr><td colspan="5" class="text-center" style="color:#94A3B8; padding:12px;">Nenhuma despesa no período</td></tr>'}
        </tbody>
        ${data.expenseByCategory.length > 0 ? `
          <tfoot>
            <tr class="totals-row">
              <td>TOTAL GERAL</td>
              <td class="text-center">${totalExpenseItems}</td>
              <td class="text-right" style="color:#EF4444;">${fmtMoney(data.totalCategoryExpenses)}</td>
              <td class="text-right">100.0%</td>
              <td class="text-right">${fmtMoney(avgExpensePerItem)}</td>
            </tr>
          </tfoot>
        ` : ''}
      </table>
    </section>

    <!-- Page 1 Footer -->
    <footer class="page-footer">
      <span>Prumo • Gestão Financeira Pessoal</span>
      <span>${data.periodTitle} • Página 1</span>
    </footer>

    <!-- ========================================================================= -->
    <!-- PAGE 2+: SECONDARY SVG CHARTS & DETAILED TRANSACTION STATEMENT            -->
    <!-- ========================================================================= -->
    <div class="page-break-before" style="margin-top: 14px;"></div>

    <!-- Secondary Page Header Banner -->
    <header class="brand-header" style="margin-top: 10px;">
      <div class="brand-logo-group">
        ${logoSvg}
        <div class="brand-text">
          <h1>PRUMO</h1>
          <span>GESTÃO FINANCEIRA PESSOAL</span>
        </div>
      </div>
      <div class="header-meta">
        <h2>EXTRATO COMPLETO & INDICADORES DE COMPROMISSO</h2>
        <div class="period-tag">${data.periodTitle}</div>
      </div>
    </header>

    <!-- Secondary Inline SVG Charts (Realized vs Pending & Payment Channels) -->
    <section class="charts-row">
      <div class="chart-box">
        <div class="chart-box-title">GRÁFICO 3: COMPROMISSOS REALIZADOS VS. PENDENTES</div>
        ${commitmentsSvg}
      </div>
      <div class="chart-box">
        <div class="chart-box-title">GRÁFICO 4: DISTRIBUIÇÃO POR CANAL DE PAGAMENTO</div>
        ${channelsSvg}
      </div>
    </section>

    <!-- Detailed Transaction Statement Table -->
    <section>
      <div class="section-title">
        <span>2. EXTRATO DETALHADO DE LANÇAMENTOS (${data.filteredTransactionsAsc.length} ITENS)</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 55px;">Data</th>
            <th>Descrição</th>
            <th>Categoria</th>
            <th>Tags / Parcelas</th>
            <th class="text-center">Status</th>
            <th class="text-right" style="width: 75px;">Valor</th>
            <th class="text-right" style="width: 75px;">Saldo Acum.</th>
          </tr>
        </thead>
        <tbody>
          ${ledgerRowsHtml || '<tr><td colspan="7" class="text-center" style="color:#94A3B8; padding:16px;">Nenhum lançamento registrado no período</td></tr>'}
        </tbody>
      </table>
    </section>

    <!-- Page Footer -->
    <footer class="page-footer">
      <span>Prumo • Gestão Financeira Pessoal</span>
      <span>${data.periodTitle}</span>
    </footer>

  </div>

</body>
</html>`;
}

/**
 * Renders a high-resolution Donut Chart onto an offscreen HTML5 Canvas and returns a PNG Data URL.
 */
function renderCategoryDonutChartCanvas(
  items: ComputedExportData['expenseByCategory'],
  totalExpense: number,
  currency: string,
  isPt: boolean
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 520;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // White card background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (items.length === 0 || totalExpense <= 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isPt ? 'Sem despesas no período' : 'No expenses in period',
      canvas.width / 2,
      canvas.height / 2
    );
    return canvas.toDataURL('image/png');
  }

  const cx = 230;
  const cy = 265;
  const outerR = 175;
  const innerR = 105;

  let startAngle = -Math.PI / 2;
  const topItems = items.slice(0, 8);
  const otherAmount = items.slice(8).reduce((acc, i) => acc + i.amount, 0);
  const chartSlices =
    otherAmount > 0
      ? [
          ...topItems,
          {
            id: 'other',
            name: isPt ? 'Outras' : 'Other',
            color: '#94a3b8',
            count: 0,
            amount: otherAmount,
            avg: 0,
            share: (otherAmount / totalExpense) * 100,
          },
        ]
      : topItems;

  for (const slice of chartSlices) {
    const sliceAngle = (slice.amount / totalExpense) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = slice.color;
    ctx.fill();

    // White separator stroke
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.stroke();

    startAngle += sliceAngle;
  }

  // Inner cutout for Donut
  ctx.beginPath();
  ctx.arc(cx, cy, innerR, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // Center text
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(isPt ? 'DESPESAS' : 'EXPENSES', cx, cy - 12);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(cleanPdfText(formatCurrency(totalExpense, currency)), cx, cy + 20);

  // Right-side Legend with percentages and values
  const legendX = 445;
  let legendY = 65;
  const rowH = 50;

  chartSlices.forEach((slice) => {
    // Color pill
    ctx.fillStyle = slice.color;
    ctx.beginPath();
    ctx.roundRect(legendX, legendY - 16, 22, 22, 6);
    ctx.fill();

    // Category Name
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    const truncName = slice.name.length > 20 ? slice.name.slice(0, 19) + '…' : slice.name;
    ctx.fillText(truncName, legendX + 34, legendY + 2);

    // Share & Amount
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${slice.share.toFixed(1)}%`, 880, legendY + 2);

    // Subtle progress bar under each legend item
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(legendX + 34, legendY + 12, 446, 7);
    ctx.fillStyle = slice.color;
    ctx.fillRect(legendX + 34, legendY + 12, Math.max(6, (slice.share / 100) * 446), 7);

    legendY += rowH;
  });

  return canvas.toDataURL('image/png');
}

/**
 * Renders a high-resolution Cash Flow Evolution Bar Chart (Monthly or Daily) onto an offscreen Canvas.
 */
function renderCashFlowChartCanvas(
  data: ComputedExportData,
  periodMode: ExportPeriodMode,
  currency: string,
  isPt: boolean
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 520;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Choose bars based on mode
  const points =
    periodMode === 'monthly'
      ? data.dailySeries
          .filter((d, i) => d.income > 0 || d.expense > 0 || i % 3 === 0)
          .slice(0, 16)
          .map((d) => ({
            label: d.label,
            income: d.income,
            expense: d.expense,
          }))
      : data.monthlySeries.slice(-12).map((m) => ({
          label: m.shortLabel,
          income: m.income,
          expense: m.expense,
        }));

  if (points.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isPt ? 'Sem dados no período' : 'No data in period', canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL('image/png');
  }

  // Legend at top right
  ctx.fillStyle = '#10b981';
  ctx.fillRect(540, 20, 20, 20);
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(isPt ? 'Entradas (+)' : 'Inputs (+)', 568, 36);

  ctx.fillStyle = '#f43f5e';
  ctx.fillRect(710, 20, 20, 20);
  ctx.fillStyle = '#334155';
  ctx.fillText(isPt ? 'Despesas (-)' : 'Expenses (-)', 738, 36);

  const chartLeft = 110;
  const chartRight = 870;
  const chartTop = 65;
  const chartBottom = 445;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;

  const maxVal = Math.max(
    100,
    ...points.map((p) => Math.max(p.income, p.expense))
  );

  // Horizontal grid lines (4 steps)
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1.5;
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.textAlign = 'right';

  for (let i = 0; i <= 4; i++) {
    const ratio = i / 4;
    const y = chartBottom - ratio * chartH;
    ctx.beginPath();
    ctx.moveTo(chartLeft, y);
    ctx.lineTo(chartRight, y);
    ctx.stroke();

    const val = maxVal * ratio;
    const shortVal =
      val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0);
    ctx.fillText(shortVal, chartLeft - 12, y + 5);
  }

  const groupW = chartW / points.length;
  const barW = Math.min(26, Math.max(8, groupW * 0.34));

  points.forEach((pt, idx) => {
    const groupCenter = chartLeft + idx * groupW + groupW / 2;

    // Income bar
    const incH = (pt.income / maxVal) * chartH;
    if (incH > 0) {
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.roundRect(groupCenter - barW - 2, chartBottom - Math.max(4, incH), barW, Math.max(4, incH), [4, 4, 0, 0]);
      ctx.fill();
    }

    // Expense bar
    const expH = (pt.expense / maxVal) * chartH;
    if (expH > 0) {
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.roundRect(groupCenter + 2, chartBottom - Math.max(4, expH), barW, Math.max(4, expH), [4, 4, 0, 0]);
      ctx.fill();
    }

    // X-Axis label
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(cleanPdfText(pt.label), groupCenter, chartBottom + 28);
  });

  return canvas.toDataURL('image/png');
}

/**
 * Generates and downloads a detailed multi-page PDF Financial Report with charts,
 * category breakdowns, commitments comparison, and full transaction ledger silently
 * in memory using direct jsPDF and offscreen canvas drawing.
 */
export function exportFilteredHistoryToPDF(opts: ExportFilterOptions): Promise<void> {
  const data = computeExportData(opts);
  const isPt = opts.language === 'pt-BR';
  const currency = opts.currency;
  const catMap = new Map(opts.categories.map((c) => [c.id, c]));

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 12;
  const contentWidth = pageWidth - margin * 2; // 186mm

  const fmtMoney = (v: number) => cleanPdfText(formatCurrency(v, currency));

  // =========================================================================
  // HEADER BANNER (Page 1)
  // =========================================================================
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 34, 'F');

  // Accent stripe (Prumo Brand Primary #6E5440)
  doc.setFillColor(110, 84, 64);
  doc.rect(0, 34, pageWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(cleanPdfText(`PRUMO — ${opts.familyName.toUpperCase()}`), margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(
    cleanPdfText(
      isPt
        ? 'DEMONSTRATIVO FINANCEIRO E RELATÓRIO DETALHADO DE CONTA'
        : 'FINANCIAL STATEMENT & DETAILED ACCOUNT REPORT'
    ),
    margin,
    21
  );

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(
    cleanPdfText(`${isPt ? 'Período' : 'Period'}: ${data.periodTitle}`),
    margin,
    29
  );

  // Right side timestamp
  const generatedStr = new Date().toLocaleDateString(isPt ? 'pt-BR' : 'en-US');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(
    cleanPdfText(`${isPt ? 'Gerado em' : 'Generated on'}: ${generatedStr}`),
    pageWidth - margin,
    29,
    { align: 'right' }
  );

  let y = 42;

  // =========================================================================
  // 6 EXECUTIVE KPI SUMMARY CARDS (2 rows x 3 cols)
  // =========================================================================
  const kpiCards = [
    {
      label: isPt ? 'SALDO INICIAL NO PERÍODO' : 'OPENING BALANCE',
      value: fmtMoney(data.openingBalance),
      sub: isPt ? 'Saldo anterior acumulado' : 'Prior balance brought forward',
      accent: [100, 116, 139] as [number, number, number],
    },
    {
      label: isPt ? 'TOTAL DE ENTRADAS (+)' : 'TOTAL INPUTS (+)',
      value: `+ ${fmtMoney(data.totalIncome)}`,
      sub: isPt ? `${data.incomeCount} lançamento(s)` : `${data.incomeCount} entry(s)`,
      accent: [16, 185, 129] as [number, number, number],
    },
    {
      label: isPt ? 'TOTAL DE DESPESAS (-)' : 'TOTAL EXPENSES (-)',
      value: `- ${fmtMoney(data.totalExpense)}`,
      sub: isPt ? `${data.expenseCount} lançamento(s)` : `${data.expenseCount} entry(s)`,
      accent: [244, 63, 94] as [number, number, number],
    },
    {
      label: isPt ? 'RESULTADO LÍQUIDO' : 'NET CASH FLOW',
      value: `${data.netCashFlow >= 0 ? '+' : '-'} ${fmtMoney(Math.abs(data.netCashFlow))}`,
      sub:
        data.netCashFlow >= 0
          ? isPt
            ? 'Superávit no período'
            : 'Positive surplus'
          : isPt
          ? 'Déficit no período'
          : 'Net deficit',
      accent: (data.netCashFlow >= 0 ? [16, 185, 129] : [244, 63, 94]) as [number, number, number],
    },
    {
      label: isPt ? 'SALDO BANCÁRIO FINAL' : 'CLOSING BANK BALANCE',
      value: fmtMoney(data.closingBalance),
      sub: isPt ? 'Saldo ao final do período' : 'Balance at end of period',
      accent: [79, 70, 229] as [number, number, number],
    },
    {
      label: isPt ? 'MÉDIA DIÁRIA / ECONOMIA' : 'DAILY AVG / SAVINGS RATE',
      value: `${fmtMoney(data.avgDailyExpense)}/${isPt ? 'dia' : 'day'}`,
      sub: isPt
        ? `Taxa Poupada: ${data.savingsRate.toFixed(1)}%`
        : `Savings Rate: ${data.savingsRate.toFixed(1)}%`,
      accent: [245, 158, 11] as [number, number, number],
    },
  ];

  const cardW = (contentWidth - 6) / 3;
  const cardH = 20;

  kpiCards.forEach((card, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const cx = margin + col * (cardW + 3);
    const cy = y + row * (cardH + 3);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, cy, cardW, cardH, 2, 2, 'FD');

    // Left colored stripe
    doc.setFillColor(card.accent[0], card.accent[1], card.accent[2]);
    doc.rect(cx, cy + 2, 1.5, cardH - 4, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(cleanPdfText(card.label), cx + 4, cy + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(cleanPdfText(card.value), cx + 4, cy + 12.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(cleanPdfText(card.sub), cx + 4, cy + 17.5);
  });

  y += cardH * 2 + 9;

  // =========================================================================
  // CHARTS SECTION (Side-by-Side Donut Chart & Cash Flow Bar Chart)
  // =========================================================================
  const chartBoxW = (contentWidth - 4) / 2;
  const chartBoxH = 62;

  // Left Chart Card: Expenses by Category Donut
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, chartBoxW, chartBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    cleanPdfText(
      isPt ? 'GRÁFICO 1: DESPESAS POR CATEGORIA' : 'CHART 1: EXPENSES BY CATEGORY'
    ),
    margin + 3.5,
    y + 6
  );

  const donutDataUrl = renderCategoryDonutChartCanvas(
    data.expenseByCategory,
    data.totalExpense,
    currency,
    isPt
  );
  if (donutDataUrl) {
    doc.addImage(donutDataUrl, 'PNG', margin + 2, y + 8, chartBoxW - 4, chartBoxH - 10);
  }

  // Right Chart Card: Cash Flow Evolution
  const rightChartX = margin + chartBoxW + 4;
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(rightChartX, y, chartBoxW, chartBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    cleanPdfText(
      opts.periodMode === 'monthly'
        ? isPt
          ? 'GRÁFICO 2: FLUXO DIÁRIO NO MÊS'
          : 'CHART 2: DAILY CASH FLOW IN MONTH'
        : isPt
        ? 'GRÁFICO 2: EVOLUÇÃO MENSAL (ENTRADAS X DESPESAS)'
        : 'CHART 2: MONTHLY EVOLUTION (INPUTS VS EXPENSES)'
    ),
    rightChartX + 3.5,
    y + 6
  );

  const barChartDataUrl = renderCashFlowChartCanvas(
    data,
    opts.periodMode,
    currency,
    isPt
  );
  if (barChartDataUrl) {
    doc.addImage(barChartDataUrl, 'PNG', rightChartX + 2, y + 8, chartBoxW - 4, chartBoxH - 10);
  }

  y += chartBoxH + 7;

  // Helper for page break check
  const ensureSpace = (neededMm: number) => {
    if (y + neededMm > pageHeight - 16) {
      doc.addPage();
      y = 16;
    }
  };

  // =========================================================================
  // SECTION 1: EXPENSES BREAKDOWN BY CATEGORY TABLE
  // =========================================================================
  if (data.expenseByCategory.length > 0) {
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(
      cleanPdfText(
        isPt
          ? '1. DETALHAMENTO DE DESPESAS POR CATEGORIA'
          : '1. EXPENSES BREAKDOWN BY CATEGORY'
      ),
      margin,
      y
    );
    y += 3;

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(isPt ? 'Categoria' : 'Category', margin + 3, y + 4.8);
    doc.text(isPt ? 'Qtd.' : 'Count', margin + 72, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Média / Lanç.' : 'Avg / Entry', margin + 105, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Total Gasto' : 'Total Spent', margin + 142, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Participação' : 'Share %', margin + contentWidth - 3, y + 4.8, {
      align: 'right',
    });
    y += 7;

    data.expenseByCategory.forEach((row, idx) => {
      ensureSpace(7.5);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 6.8, 'F');
      }

      const [r, g, b] = hexToRgb(row.color);
      doc.setFillColor(r, g, b);
      doc.circle(margin + 4.5, y + 3.4, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(cleanPdfText(row.name), margin + 8, y + 4.6);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(String(row.count), margin + 72, y + 4.6, { align: 'right' });
      doc.text(fmtMoney(row.avg), margin + 105, y + 4.6, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(225, 29, 72);
      doc.text(fmtMoney(row.amount), margin + 142, y + 4.6, { align: 'right' });

      // Visual share bar + %
      const barStartX = margin + 147;
      const maxBarW = 22;
      doc.setFillColor(226, 232, 240);
      doc.rect(barStartX, y + 2.3, maxBarW, 2.2, 'F');
      doc.setFillColor(r, g, b);
      doc.rect(barStartX, y + 2.3, Math.max(0.8, (row.share / 100) * maxBarW), 2.2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(51, 65, 85);
      doc.text(`${row.share.toFixed(1)}%`, margin + contentWidth - 3, y + 4.6, {
        align: 'right',
      });

      y += 6.8;
    });

    y += 6;
  }

  // =========================================================================
  // SECTION 2: INCOME BREAKDOWN BY SOURCE TABLE
  // =========================================================================
  if (data.incomeByCategory.length > 0) {
    ensureSpace(26);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(
      cleanPdfText(
        isPt
          ? '2. ENTRADAS DE DINHEIRO POR ORIGEM / CATEGORIA'
          : '2. INCOME BREAKDOWN BY SOURCE / CATEGORY'
      ),
      margin,
      y
    );
    y += 3;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(isPt ? 'Categoria de Entrada' : 'Income Source', margin + 3, y + 4.8);
    doc.text(isPt ? 'Qtd.' : 'Count', margin + 95, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Total Recebido' : 'Total Received', margin + 142, y + 4.8, {
      align: 'right',
    });
    doc.text(isPt ? 'Participação' : 'Share %', margin + contentWidth - 3, y + 4.8, {
      align: 'right',
    });
    y += 7;

    data.incomeByCategory.forEach((row, idx) => {
      ensureSpace(7.5);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 6.8, 'F');
      }

      const [r, g, b] = hexToRgb(row.color);
      doc.setFillColor(r, g, b);
      doc.circle(margin + 4.5, y + 3.4, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(cleanPdfText(row.name), margin + 8, y + 4.6);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(String(row.count), margin + 95, y + 4.6, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text(fmtMoney(row.amount), margin + 142, y + 4.6, { align: 'right' });

      doc.setTextColor(51, 65, 85);
      doc.text(`${row.share.toFixed(1)}%`, margin + contentWidth - 3, y + 4.6, {
        align: 'right',
      });

      y += 6.8;
    });

    y += 6;
  }

  // =========================================================================
  // SECTION 3: MONTHLY BREAKDOWN TABLE (For Annual / All-Time reports)
  // =========================================================================
  if (opts.periodMode !== 'monthly' && data.monthlySeries.length > 0) {
    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(
      cleanPdfText(
        isPt
          ? '3. RESUMO MENSAL E EVOLUÇÃO DO SALDO NO ANO'
          : '3. MONTH-BY-MONTH CASH FLOW & CLOSING BALANCE'
      ),
      margin,
      y
    );
    y += 3;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(isPt ? 'Mês' : 'Month', margin + 3, y + 4.8);
    doc.text(isPt ? 'Lanç.' : 'Items', margin + 52, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Entradas (+)' : 'Inputs (+)', margin + 88, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Despesas (-)' : 'Expenses (-)', margin + 124, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Resultado Mês' : 'Monthly Net', margin + 156, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Saldo Final' : 'Closing Bal.', margin + contentWidth - 3, y + 4.8, {
      align: 'right',
    });
    y += 7;

    data.monthlySeries.forEach((mRow, idx) => {
      ensureSpace(7);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 6.5, 'F');
      }

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.setTextColor(30, 41, 59);
      doc.text(cleanPdfText(mRow.fullLabel), margin + 3, y + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(String(mRow.count), margin + 52, y + 4.5, { align: 'right' });
      doc.text(fmtMoney(mRow.income), margin + 88, y + 4.5, { align: 'right' });
      doc.text(fmtMoney(mRow.expense), margin + 124, y + 4.5, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(mRow.net >= 0 ? 5 : 225, mRow.net >= 0 ? 150 : 29, mRow.net >= 0 ? 105 : 72);
      doc.text(
        `${mRow.net >= 0 ? '+' : '-'} ${fmtMoney(Math.abs(mRow.net))}`,
        margin + 156,
        y + 4.5,
        { align: 'right' }
      );

      doc.setTextColor(15, 23, 42);
      doc.text(fmtMoney(mRow.closingBalance), margin + contentWidth - 3, y + 4.5, {
        align: 'right',
      });

      y += 6.5;
    });

    y += 6;
  }

  // =========================================================================
  // SECTION 4: COMPLETE TRANSACTION HISTORY LEDGER
  // =========================================================================
  ensureSpace(25);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  const ledgerSectionNum = opts.periodMode !== 'monthly' ? '4' : '3';
  doc.text(
    cleanPdfText(
      isPt
        ? `${ledgerSectionNum}. EXTRATO DETALHADO DE LANÇAMENTOS (${data.filteredTransactionsAsc.length} ITENS)`
        : `${ledgerSectionNum}. DETAILED TRANSACTION LEDGER (${data.filteredTransactionsAsc.length} ITEMS)`
    ),
    margin,
    y
  );
  y += 3;

  const drawLedgerHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.setTextColor(255, 255, 255);
    doc.text(isPt ? 'Data' : 'Date', margin + 2.5, y + 4.8);
    doc.text(isPt ? 'Descrição' : 'Description', margin + 24, y + 4.8);
    doc.text(isPt ? 'Categoria' : 'Category', margin + 96, y + 4.8);
    doc.text(isPt ? 'Info / Obs.' : 'Details', margin + 128, y + 4.8);
    doc.text(isPt ? 'Valor' : 'Amount', margin + 161, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Saldo' : 'Balance', margin + contentWidth - 2.5, y + 4.8, {
      align: 'right',
    });
    y += 7;
  };

  drawLedgerHeader();

  data.filteredTransactionsAsc.forEach((tx, idx) => {
    if (y + 6.5 > pageHeight - 15) {
      doc.addPage();
      y = 16;
      drawLedgerHeader();
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y, contentWidth, 6.2, 'F');
    }

    const cat = catMap.get(tx.categoryId);
    const catName = getCategoryDisplayName(cat, opts.language) || tx.categoryId;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(71, 85, 105);
    doc.text(cleanPdfText(formatShortDate(tx.date, opts.language)), margin + 2.5, y + 4.3);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const descStr = cleanPdfText(tx.description);
    doc.text(descStr.length > 38 ? descStr.slice(0, 37) + '...' : descStr, margin + 24, y + 4.3);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    const cleanCat = cleanPdfText(catName);
    doc.text(cleanCat.length > 18 ? cleanCat.slice(0, 17) + '.' : cleanCat, margin + 96, y + 4.3);

    let extraInfo = tx.notes || '';
    if (tx.installmentTotal && tx.installmentTotal > 1) {
      extraInfo = `${tx.installmentCurrent || 1}/${tx.installmentTotal} ${extraInfo}`.trim();
    }
    const cleanExtra = cleanPdfText(extraInfo);
    doc.text(
      cleanExtra.length > 16 ? cleanExtra.slice(0, 15) + '.' : cleanExtra,
      margin + 128,
      y + 4.3
    );

    const isInc = tx.type === 'income';
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(isInc ? 5 : 225, isInc ? 150 : 29, isInc ? 105 : 72);
    doc.text(
      `${isInc ? '+' : '-'} ${fmtMoney(tx.amount)}`,
      margin + 161,
      y + 4.3,
      { align: 'right' }
    );

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(fmtMoney(tx.runningBalance), margin + contentWidth - 2.5, y + 4.3, {
      align: 'right',
    });

    y += 6.2;
  });

  // =========================================================================
  // PAGE NUMBERS & FOOTER ON ALL PAGES
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      cleanPdfText(`Prumo — ${opts.familyName} • ${data.periodTitle}`),
      margin,
      pageHeight - 5.5
    );
    doc.text(
      cleanPdfText(
        isPt ? `Página ${p} de ${totalPages}` : `Page ${p} of ${totalPages}`
      ),
      pageWidth - margin,
      pageHeight - 5.5,
      { align: 'right' }
    );
  }

  doc.save(`prumo-relatorio-${data.filenameSlug}.pdf`);
  return Promise.resolve();
}
