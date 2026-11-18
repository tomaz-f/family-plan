import { getCategoryDisplayName } from '../i18n';
import { computeExportData } from './reportDataAggregator';
import { ExportFilterOptions } from './exportTypes';

function formatCommaDecimal(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

function escapeCsvCell(val: string | number): string {
  const str = String(val ?? '').replace(/"/g, '""');
  return /[;"\r\n]/.test(str) ? `"${str}"` : str;
}

/**
 * Exports filtered financial statement to a UTF-8 with BOM (.csv) file
 * using semicolon (;) delimiter, comma decimal separator (-125,00), and
 * direct signed numbers (expenses negative, incomes positive).
 */
export function exportFilteredHistoryToCSV(opts: ExportFilterOptions): void {
  const data = computeExportData(opts);
  const isPt = opts.language === 'pt-BR';
  const catMap = new Map(opts.categories.map((c) => [c.id, c]));
  const cardMap = new Map((opts.creditCards || []).map((c) => [c.id, c]));

  const summaryRows: Array<Array<string | number>> = isPt
    ? [
        ['DEMONSTRATIVO FINANCEIRO - PRUMO', data.periodTitle],
        ['Saldo Inicial', formatCommaDecimal(data.openingBalance)],
        ['Entradas Consolidadas (+)', formatCommaDecimal(data.totalIncome)],
        ['Entradas Pendentes (+)', formatCommaDecimal(data.pendingIncome)],
        ['Despesas Consolidadas (-)', formatCommaDecimal(-Math.abs(data.totalExpense))],
        ['Despesas Pendentes (-)', formatCommaDecimal(-Math.abs(data.pendingExpense))],
        ['Saldo Consolidado', formatCommaDecimal(data.closingBalance)],
        ['Saldo Projetado Final', formatCommaDecimal(data.projectedBalance)],
        [],
      ]
    : [
        ['FINANCIAL STATEMENT - PRUMO', data.periodTitle],
        ['Opening Balance', formatCommaDecimal(data.openingBalance)],
        ['Consolidated Income (+)', formatCommaDecimal(data.totalIncome)],
        ['Pending Income (+)', formatCommaDecimal(data.pendingIncome)],
        ['Consolidated Expenses (-)', formatCommaDecimal(-Math.abs(data.totalExpense))],
        ['Pending Expenses (-)', formatCommaDecimal(-Math.abs(data.pendingExpense))],
        ['Consolidated Balance', formatCommaDecimal(data.closingBalance)],
        ['Projected Final Balance', formatCommaDecimal(data.projectedBalance)],
        [],
      ];

  const headers = isPt
    ? ['Data', 'Descrição', 'Categoria', 'Conta / Cartão', 'Status', 'Parcela', 'Valor']
    : ['Date', 'Description', 'Category', 'Account / Card', 'Status', 'Installment', 'Amount'];

  const txRows = data.filteredTransactionsAsc.map((tx) => {
    const cat = catMap.get(tx.categoryId);
    const catName = getCategoryDisplayName(cat, opts.language) || tx.categoryId;
    const cardName = tx.cardId ? cardMap.get(tx.cardId)?.name : null;
    const accountLabel = cardName
      ? `${isPt ? 'Cartão' : 'Card'}: ${cardName}`
      : isPt
      ? 'Conta Principal'
      : 'Main Account';

    const statusLabel =
      tx.status === 'unpaid'
        ? isPt
          ? 'Pendente'
          : 'Pending'
        : tx.type === 'income'
        ? isPt
          ? 'Recebido'
          : 'Received'
        : isPt
        ? 'Pago'
        : 'Paid';

    const parcelLabel =
      tx.installmentTotal && tx.installmentTotal > 1
        ? `${tx.installmentCurrent || 1}/${tx.installmentTotal}`
        : tx.isRecurring || tx.recurringId
        ? isPt
          ? 'Fixa'
          : 'Fixed'
        : '-';

    const signedAmount =
      tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount);

    return [
      tx.date,
      tx.description,
      catName,
      accountLabel,
      statusLabel,
      parcelLabel,
      formatCommaDecimal(signedAmount),
    ];
  });

  const allLines = [
    ...summaryRows.map((row) => row.map(escapeCsvCell).join(';')),
    headers.map(escapeCsvCell).join(';'),
    ...txRows.map((row) => row.map(escapeCsvCell).join(';')),
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
