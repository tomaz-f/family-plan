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
  totalIncome: number;
  totalExpense: number;
  netCashFlow: number;
  savingsRate: number;
  avgDailyExpense: number;
  numDays: number;
  incomeCount: number;
  expenseCount: number;
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
}

function cleanPdfText(str: string): string {
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

  let openingBalance = initialBalance;
  const inPeriodAllTypes: Array<Transaction & { runningBalance: number }> = [];

  for (const tx of allSortedAsc) {
    const isBeforePeriod =
      periodMode === 'monthly'
        ? tx.date.slice(0, 7) < targetMonthPrefix
        : periodMode === 'annual'
        ? tx.date.slice(0, 4) < year
        : false;

    const isInPeriod =
      periodMode === 'monthly'
        ? tx.date.startsWith(targetMonthPrefix)
        : periodMode === 'annual'
        ? tx.date.startsWith(targetYearPrefix)
        : true;

    const isUnpaid = tx.status === 'unpaid';
    const signed = isUnpaid ? 0 : tx.type === 'income' ? tx.amount : -tx.amount;

    if (isBeforePeriod) {
      openingBalance += signed;
    } else if (isInPeriod) {
      const prevBal =
        inPeriodAllTypes.length > 0
          ? inPeriodAllTypes[inPeriodAllTypes.length - 1].runningBalance
          : openingBalance;
      inPeriodAllTypes.push({
        ...tx,
        runningBalance: prevBal + signed,
      });
    }
  }

  const closingBalance =
    inPeriodAllTypes.length > 0
      ? inPeriodAllTypes[inPeriodAllTypes.length - 1].runningBalance
      : openingBalance;

  const filteredTransactionsAsc = inPeriodAllTypes.filter((tx) =>
    typeFilter === 'all' ? true : tx.type === typeFilter
  );

  const filteredTransactionsDesc = [...filteredTransactionsAsc].reverse();

  let totalIncome = 0;
  let totalExpense = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let largestExpense: Transaction | null = null;

  for (const tx of filteredTransactionsAsc) {
    if (tx.status === 'unpaid') continue;
    if (tx.type === 'income') {
      totalIncome += tx.amount;
      incomeCount++;
    } else {
      totalExpense += tx.amount;
      expenseCount++;
      if (!largestExpense || tx.amount > largestExpense.amount) {
        largestExpense = tx;
      }
    }
  }

  const netCashFlow = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

  // Number of days in period
  let numDays = 30;
  if (periodMode === 'monthly') {
    const y = Number(year);
    const m = Number(month);
    numDays = new Date(y, m, 0).getDate() || 30;
  } else if (periodMode === 'annual') {
    numDays = 365;
  } else if (filteredTransactionsAsc.length > 0) {
    const first = filteredTransactionsAsc[0].date;
    const last = filteredTransactionsAsc[filteredTransactionsAsc.length - 1].date;
    const diff = Math.max(1, new Date(last).getTime() - new Date(first).getTime());
    numDays = Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
  }

  const avgDailyExpense = numDays > 0 ? totalExpense / numDays : 0;

  // Category aggregations
  const expMap = new Map<string, { amount: number; count: number }>();
  const incMap = new Map<string, { amount: number; count: number }>();

  for (const tx of filteredTransactionsAsc) {
    if (tx.type === 'expense') {
      const cur = expMap.get(tx.categoryId) || { amount: 0, count: 0 };
      expMap.set(tx.categoryId, { amount: cur.amount + tx.amount, count: cur.count + 1 });
    } else {
      const cur = incMap.get(tx.categoryId) || { amount: 0, count: 0 };
      incMap.set(tx.categoryId, { amount: cur.amount + tx.amount, count: cur.count + 1 });
    }
  }

  const expenseByCategory = Array.from(expMap.entries())
    .map(([id, data]) => {
      const cat = catMap.get(id);
      return {
        id,
        name: getCategoryDisplayName(cat, language) || id,
        color: cat?.color || '#6366f1',
        count: data.count,
        amount: data.amount,
        avg: data.count > 0 ? data.amount / data.count : 0,
        share: totalExpense > 0 ? (data.amount / totalExpense) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const incomeByCategory = Array.from(incMap.entries())
    .map(([id, data]) => {
      const cat = catMap.get(id);
      return {
        id,
        name: getCategoryDisplayName(cat, language) || id,
        color: cat?.color || '#10b981',
        count: data.count,
        amount: data.amount,
        share: totalIncome > 0 ? (data.amount / totalIncome) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Monthly series (for Annual & All-Time modes, or context in Monthly mode)
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
    totalIncome,
    totalExpense,
    netCashFlow,
    savingsRate,
    avgDailyExpense,
    numDays,
    incomeCount,
    expenseCount,
    largestExpense,
    filteredTransactionsAsc,
    filteredTransactionsDesc,
    expenseByCategory,
    incomeByCategory,
    monthlySeries,
    dailySeries,
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
        ['DEMONSTRATIVO FINANCEIRO - ' + opts.familyName.toUpperCase()],
        ['Período Filtrado', data.periodTitle],
        ['Saldo Inicial no Período', data.openingBalance.toFixed(2)],
        ['Total de Entradas (+)', data.totalIncome.toFixed(2)],
        ['Total de Despesas (-)', data.totalExpense.toFixed(2)],
        ['Resultado Líquido do Período', data.netCashFlow.toFixed(2)],
        ['Saldo Bancário Final', data.closingBalance.toFixed(2)],
        [],
      ]
    : [
        ['FINANCIAL STATEMENT - ' + opts.familyName.toUpperCase()],
        ['Filtered Period', data.periodTitle],
        ['Opening Balance', data.openingBalance.toFixed(2)],
        ['Total Inputs (+)', data.totalIncome.toFixed(2)],
        ['Total Expenses (-)', data.totalExpense.toFixed(2)],
        ['Net Cash Flow', data.netCashFlow.toFixed(2)],
        ['Closing Bank Balance', data.closingBalance.toFixed(2)],
        [],
      ];

  const headers = isPt
    ? [
        'Data',
        'Tipo',
        'Categoria',
        'Descrição',
        'Frequência / Parcela',
        'Dia Venc.',
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
        'Due Day',
        'Amount',
        'Signed Amount',
        'Running Balance',
        'Notes',
      ];

  const txRows = data.filteredTransactionsAsc.map((tx) => {
    const cat = catMap.get(tx.categoryId);
    const categoryName = getCategoryDisplayName(cat, opts.language) || tx.categoryId;
    const signed = tx.type === 'income' ? tx.amount : -tx.amount;
    const typeLabel = isPt
      ? tx.type === 'income'
        ? 'Entrada'
        : 'Despesa'
      : tx.type === 'income'
      ? 'Input (Income)'
      : 'Expense';

    let freqLabel = isPt ? 'Única' : 'One-time';
    if (tx.installmentTotal && tx.installmentTotal > 1) {
      freqLabel = isPt
        ? `Parcela ${tx.installmentCurrent || 1}/${tx.installmentTotal}`
        : `Installment ${tx.installmentCurrent || 1}/${tx.installmentTotal}`;
    } else if (tx.recurringId || tx.isRecurring) {
      freqLabel = isPt ? 'Fixa Mensal' : 'Monthly Recurring';
    }

    return [
      tx.date,
      escapeCsv(typeLabel),
      escapeCsv(categoryName),
      escapeCsv(tx.description),
      escapeCsv(freqLabel),
      tx.dueDay ? String(tx.dueDay) : '',
      tx.amount.toFixed(2),
      signed.toFixed(2),
      tx.runningBalance.toFixed(2),
      escapeCsv(tx.notes || ''),
    ].join(',');
  });

  const csvLines = [
    ...summaryRows.map((row) => row.map(escapeCsv).join(',')),
    headers.map(escapeCsv).join(','),
    ...txRows,
  ];

  const csvContent = '\uFEFF' + csvLines.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `familyplan-${data.filenameSlug}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
 * Renders a high-resolution Cash Flow Evolution Bar Chart (Monthly or Daily) onto a Canvas.
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
 * category breakdowns, monthly comparison, and full transaction ledger.
 */
export function exportFilteredHistoryToPDF(opts: ExportFilterOptions): void {
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

  // Accent stripe
  doc.setFillColor(99, 102, 241); // Indigo 500
  doc.rect(0, 34, pageWidth, 1.5, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(cleanPdfText(opts.familyName.toUpperCase()), margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text(
    cleanPdfText(
      isPt
        ? 'DEMONSTRATIVO FINANCEIRO E RELATORIO DETALHADO DE CONTA'
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
      label: isPt ? 'SALDO INICIAL NO PERIODO' : 'OPENING BALANCE',
      value: fmtMoney(data.openingBalance),
      sub: isPt ? 'Saldo anterior acumulado' : 'Prior balance brought forward',
      accent: [100, 116, 139] as [number, number, number],
    },
    {
      label: isPt ? 'TOTAL DE ENTRADAS (+)' : 'TOTAL INPUTS (+)',
      value: `+ ${fmtMoney(data.totalIncome)}`,
      sub: isPt ? `${data.incomeCount} lancamento(s)` : `${data.incomeCount} entry(s)`,
      accent: [16, 185, 129] as [number, number, number],
    },
    {
      label: isPt ? 'TOTAL DE DESPESAS (-)' : 'TOTAL EXPENSES (-)',
      value: `- ${fmtMoney(data.totalExpense)}`,
      sub: isPt ? `${data.expenseCount} lancamento(s)` : `${data.expenseCount} entry(s)`,
      accent: [244, 63, 94] as [number, number, number],
    },
    {
      label: isPt ? 'RESULTADO LIQUIDO' : 'NET CASH FLOW',
      value: `${data.netCashFlow >= 0 ? '+' : '-'} ${fmtMoney(Math.abs(data.netCashFlow))}`,
      sub:
        data.netCashFlow >= 0
          ? isPt
            ? 'Superavit no periodo'
            : 'Positive surplus'
          : isPt
          ? 'Deficit no periodo'
          : 'Net deficit',
      accent: (data.netCashFlow >= 0 ? [16, 185, 129] : [244, 63, 94]) as [number, number, number],
    },
    {
      label: isPt ? 'SALDO BANCARIO FINAL' : 'CLOSING BANK BALANCE',
      value: fmtMoney(data.closingBalance),
      sub: isPt ? 'Saldo ao final do periodo' : 'Balance at end of period',
      accent: [79, 70, 229] as [number, number, number],
    },
    {
      label: isPt ? 'MEDIA DIARIA / ECONOMIA' : 'DAILY AVG / SAVINGS RATE',
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
      isPt ? 'GRAFICO 1: DESPESAS POR CATEGORIA' : 'CHART 1: EXPENSES BY CATEGORY'
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
          ? 'GRAFICO 2: FLUXO DIARIO NO MES'
          : 'CHART 2: DAILY CASH FLOW IN MONTH'
        : isPt
        ? 'GRAFICO 2: EVOLUCAO MENSAL (ENTRADAS X DESPESAS)'
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
    doc.text(isPt ? 'Media / Lanc.' : 'Avg / Entry', margin + 105, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Total Gasto' : 'Total Spent', margin + 142, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Participacao' : 'Share %', margin + contentWidth - 3, y + 4.8, {
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
    doc.text(isPt ? 'Participacao' : 'Share %', margin + contentWidth - 3, y + 4.8, {
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
          ? '3. RESUMO MENSAL E EVOLUCAO DO SALDO NO ANO'
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
    doc.text(isPt ? 'Mes' : 'Month', margin + 3, y + 4.8);
    doc.text(isPt ? 'Lanc.' : 'Items', margin + 52, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Entradas (+)' : 'Inputs (+)', margin + 88, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Despesas (-)' : 'Expenses (-)', margin + 124, y + 4.8, { align: 'right' });
    doc.text(isPt ? 'Resultado Mes' : 'Monthly Net', margin + 156, y + 4.8, { align: 'right' });
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

      doc.setTextColor(5, 150, 105);
      doc.text(`+ ${fmtMoney(mRow.income)}`, margin + 88, y + 4.5, { align: 'right' });

      doc.setTextColor(225, 29, 72);
      doc.text(`- ${fmtMoney(mRow.expense)}`, margin + 124, y + 4.5, { align: 'right' });

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
        ? `${ledgerSectionNum}. EXTRATO DETALHADO DE LANCAMENTOS (${data.filteredTransactionsAsc.length} ITENS)`
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
    doc.text(isPt ? 'Descricao' : 'Description', margin + 24, y + 4.8);
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
      cleanPdfText(`FamilyPlan — ${opts.familyName} • ${data.periodTitle}`),
      margin,
      pageHeight - 5.5
    );
    doc.text(
      cleanPdfText(
        isPt ? `Pagina ${p} de ${totalPages}` : `Page ${p} of ${totalPages}`
      ),
      pageWidth - margin,
      pageHeight - 5.5,
      { align: 'right' }
    );
  }

  doc.save(`familyplan-relatorio-${data.filenameSlug}.pdf`);
}
