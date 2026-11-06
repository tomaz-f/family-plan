import { getCategoryDisplayName } from '../i18n';
import { computeExportData } from './reportDataAggregator';
import { ExportFilterOptions } from './exportTypes';

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
    const statusStr =
      tx.status === 'unpaid' ? (isPt ? 'Pendente' : 'Pending') : isPt ? 'Pago' : 'Paid';

    return [
      tx.date,
      tx.type === 'income' ? (isPt ? 'Entrada' : 'Income') : isPt ? 'Despesa' : 'Expense',
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
