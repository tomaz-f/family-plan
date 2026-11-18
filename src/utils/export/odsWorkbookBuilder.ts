import { enrichFuelLogs } from '../../components/fuel/fuelMetrics';
import { formatCurrency } from '../format';
import { getCategoryDisplayName } from '../i18n';
import { aggregateInstallmentProjections } from '../reportAggregators';
import { ExportFilterOptions } from './exportTypes';
import { computeExportData } from './reportDataAggregator';
import { buildZipArchiveBlob } from './zipArchiveBuilder';

function escXml(val: string | number | null | undefined): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function strCell(text: string | number, style = 'ceData'): string {
  return `<table:table-cell table:style-name="${style}" office:value-type="string"><text:p>${escXml(text)}</text:p></table:table-cell>`;
}

function numCell(val: number, currency: string, style?: string, isPlainNumber = false): string {
  const num = Number((val || 0).toFixed(2));
  const resolvedStyle =
    style || (isPlainNumber ? 'ceNum' : num < 0 ? 'ceCurrNeg' : num > 0 ? 'ceCurrPos' : 'ceData');
  const display = isPlainNumber ? num.toFixed(2).replace('.', ',') : formatCurrency(num, currency);
  return `<table:table-cell table:style-name="${resolvedStyle}" office:value-type="float" office:value="${num.toFixed(2)}"><text:p>${escXml(display)}</text:p></table:table-cell>`;
}

function formulaCell(formula: string, fallbackVal: number, currency: string): string {
  const num = Number((fallbackVal || 0).toFixed(2));
  const style = num < 0 ? 'ceCurrNeg' : 'ceCurrPos';
  return `<table:table-cell table:style-name="${style}" table:formula="of:${escXml(formula)}" office:value-type="float" office:value="${num.toFixed(2)}"><text:p>${escXml(formatCurrency(num, currency))}</text:p></table:table-cell>`;
}

function rowXml(cells: string[], rowStyle = 'roData'): string {
  return `<table:table-row table:style-name="${rowStyle}">${cells.join('')}</table:table-row>`;
}

const ODS_MANIFEST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.spreadsheet"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

const ODS_STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" office:version="1.2">
  <office:styles>
    <style:default-style style:family="table-cell">
      <style:text-properties style:font-name="Inter" fo:font-size="10pt" fo:color="#0F172A"/>
    </style:default-style>
  </office:styles>
</office:document-styles>`;

function buildAutomaticStylesXml(): string {
  return `<office:automatic-styles>
    <number:number-style style:name="N_BRL">
      <number:text>R$ </number:text>
      <number:number number:decimal-places="2" number:min-integer-digits="1" number:grouping="true"/>
    </number:number-style>
    <style:style style:name="coNarrow" style:family="table-column"><style:table-column-properties style:column-width="2.8cm"/></style:style>
    <style:style style:name="coMed" style:family="table-column"><style:table-column-properties style:column-width="4.2cm"/></style:style>
    <style:style style:name="coWide" style:family="table-column"><style:table-column-properties style:column-width="6.5cm"/></style:style>
    <style:style style:name="roHeader" style:family="table-row"><style:table-row-properties style:row-height="0.78cm"/></style:style>
    <style:style style:name="roData" style:family="table-row"><style:table-row-properties style:row-height="0.66cm"/></style:style>
    <style:style style:name="ceTitle" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#0D1117" fo:padding="0.16cm"/>
      <style:text-properties fo:color="#F8FAFC" fo:font-size="11pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="ceHeader" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#6E5440" fo:border="0.06pt solid #5C4534" fo:padding="0.14cm"/>
      <style:text-properties fo:color="#FFFFFF" fo:font-size="10pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="ceData" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#FFFFFF" fo:border="0.06pt solid #E2E8F0" fo:padding="0.12cm"/>
      <style:text-properties fo:color="#0F172A" fo:font-size="9.5pt"/>
    </style:style>
    <style:style style:name="ceZebra" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#F8FAFC" fo:border="0.06pt solid #E2E8F0" fo:padding="0.12cm"/>
      <style:text-properties fo:color="#0F172A" fo:font-size="9.5pt"/>
    </style:style>
    <style:style style:name="ceNum" style:family="table-cell">
      <style:table-cell-properties fo:background-color="#FFFFFF" fo:border="0.06pt solid #E2E8F0" fo:padding="0.12cm"/>
      <style:paragraph-properties fo:text-align="end"/>
      <style:text-properties fo:color="#334155" fo:font-size="9.5pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="ceCurrPos" style:family="table-cell" style:data-style-name="N_BRL">
      <style:table-cell-properties fo:background-color="#FFFFFF" fo:border="0.06pt solid #E2E8F0" fo:padding="0.12cm"/>
      <style:paragraph-properties fo:text-align="end"/>
      <style:text-properties fo:color="#10B981" fo:font-size="9.5pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="ceCurrNeg" style:family="table-cell" style:data-style-name="N_BRL">
      <style:table-cell-properties fo:background-color="#FFFFFF" fo:border="0.06pt solid #E2E8F0" fo:padding="0.12cm"/>
      <style:paragraph-properties fo:text-align="end"/>
      <style:text-properties fo:color="#EF4444" fo:font-size="9.5pt" fo:font-weight="bold"/>
    </style:style>
  </office:automatic-styles>`;
}

/**
 * Generates and downloads a native styled 4-sheet OpenDocument Spreadsheet (.ods)
 * with signed negative expense numbers and SUM formulas.
 */
export function exportFilteredHistoryToODS(opts: ExportFilterOptions): void {
  const data = computeExportData(opts);
  const isPt = opts.language === 'pt-BR';
  const cur = opts.currency;
  const catMap = new Map(opts.categories.map((c) => [c.id, c]));
  const cardMap = new Map((opts.creditCards || []).map((c) => [c.id, c]));
  const refMonth = `${opts.year}-${opts.month.padStart(2, '0')}`;
  const instSummary = aggregateInstallmentProjections(
    opts.transactions,
    opts.creditCards || [],
    opts.recurringTemplates || [],
    refMonth,
    opts.language
  );

  // Sheet 1: Resumo Executivo (Consolidado + Pendente + Total Projetado via =SUM formulas)
  const txCount = data.filteredTransactionsAsc.length;
  const sumFormula = txCount > 0 ? `=SUM([.G2:.G${txCount + 1}])` : '=0';
  const totalIncomeProj = Number((data.totalIncome + data.pendingIncome).toFixed(2));
  const totalExpenseProj = -Math.abs(Number((data.totalExpense + data.pendingExpense).toFixed(2)));
  const pendingNet = Number((data.pendingIncome - data.pendingExpense).toFixed(2));
  const projectedNet = Number((data.netCashFlow + pendingNet).toFixed(2));

  const sheet1Rows: string[] = [
    rowXml([strCell(`PRUMO — ${data.periodTitle}`, 'ceTitle'), strCell('', 'ceTitle'), strCell('', 'ceTitle'), strCell('', 'ceTitle')], 'roHeader'),
    rowXml([
      strCell(isPt ? 'Indicador Executivo' : 'Executive Metric', 'ceHeader'),
      strCell(isPt ? 'Consolidado (Pago / Recebido)' : 'Consolidated (Paid / Received)', 'ceHeader'),
      strCell(isPt ? 'Pendente (A Receber / A Pagar)' : 'Pending (Receivable / Payable)', 'ceHeader'),
      strCell(isPt ? 'Total Projetado no Período' : 'Projected Period Total', 'ceHeader'),
    ], 'roHeader'),
    rowXml([
      strCell(isPt ? 'Saldo Inicial' : 'Opening Balance'),
      numCell(data.openingBalance, cur),
      numCell(0, cur, 'ceData'),
      formulaCell('=SUM([.B3:.C3])', data.openingBalance, cur),
    ]),
    rowXml([
      strCell(isPt ? 'Entradas (+)' : 'Income (+)', 'ceZebra'),
      numCell(data.totalIncome, cur, 'ceCurrPos'),
      numCell(data.pendingIncome, cur, 'ceCurrPos'),
      formulaCell('=SUM([.B4:.C4])', totalIncomeProj, cur),
    ]),
    rowXml([
      strCell(isPt ? 'Despesas (-)' : 'Expenses (-)'),
      numCell(-Math.abs(data.totalExpense), cur, 'ceCurrNeg'),
      numCell(-Math.abs(data.pendingExpense), cur, 'ceCurrNeg'),
      formulaCell('=SUM([.B5:.C5])', totalExpenseProj, cur),
    ]),
    rowXml([
      strCell(isPt ? 'Resultado Líquido do Período' : 'Net Period Result', 'ceZebra'),
      formulaCell('=SUM([.B4:.B5])', data.netCashFlow, cur),
      formulaCell('=SUM([.C4:.C5])', pendingNet, cur),
      formulaCell('=SUM([.D4:.D5])', projectedNet, cur),
    ]),
    rowXml([
      strCell(isPt ? 'Saldo Final / Projetado' : 'Closing / Projected Balance'),
      formulaCell('=SUM([.B3:.B5])', data.closingBalance, cur),
      formulaCell('=SUM([.C3:.C5])', pendingNet, cur),
      formulaCell('=SUM([.B7:.C7])', data.projectedBalance, cur),
    ]),
    rowXml([strCell('', 'ceData'), strCell('', 'ceData'), strCell('', 'ceData'), strCell('', 'ceData')]),
    rowXml([
      strCell(isPt ? 'Categoria de Despesa' : 'Expense Category', 'ceHeader'),
      strCell(isPt ? 'Total (R$)' : 'Total', 'ceHeader'),
      strCell(isPt ? 'Participação (%)' : 'Share (%)', 'ceHeader'),
      strCell(isPt ? 'Lançamentos' : 'Entries', 'ceHeader'),
    ], 'roHeader'),
    ...data.expenseByCategory.map((cat, idx) =>
      rowXml([
        strCell(cat.name, idx % 2 ? 'ceZebra' : 'ceData'),
        numCell(-Math.abs(cat.amount), cur, 'ceCurrNeg'),
        strCell(`${cat.share.toFixed(1)}%`, idx % 2 ? 'ceZebra' : 'ceData'),
        numCell(cat.count, cur, 'ceNum', true),
      ])
    ),
  ];

  // Sheet 2: Lançamentos (Signed values)
  const sheet2Rows: string[] = [
    rowXml(
      (isPt
        ? ['Data', 'Descrição', 'Categoria', 'Conta / Cartão', 'Status', 'Parcela', 'Valor']
        : ['Date', 'Description', 'Category', 'Account / Card', 'Status', 'Installment', 'Amount']
      ).map((h) => strCell(h, 'ceHeader')),
      'roHeader'
    ),
    ...data.filteredTransactionsAsc.map((tx, idx) => {
      const cat = catMap.get(tx.categoryId);
      const catName = getCategoryDisplayName(cat, opts.language) || tx.categoryId;
      const cardName = tx.cardId ? cardMap.get(tx.cardId)?.name : null;
      const acc = cardName ? `Cartão: ${cardName}` : isPt ? 'Conta Principal' : 'Main Account';
      const st = tx.status === 'unpaid' ? (isPt ? 'Pendente' : 'Pending') : isPt ? 'Pago' : 'Paid';
      const parc =
        tx.installmentTotal && tx.installmentTotal > 1
          ? `${tx.installmentCurrent || 1}/${tx.installmentTotal}`
          : tx.isRecurring || tx.recurringId
          ? isPt ? 'Fixa' : 'Fixed'
          : '-';
      const signed = tx.type === 'expense' ? -Math.abs(tx.amount) : Math.abs(tx.amount);
      const cellStyle = idx % 2 ? 'ceZebra' : 'ceData';
      return rowXml([
        strCell(tx.date, cellStyle),
        strCell(tx.description, cellStyle),
        strCell(catName, cellStyle),
        strCell(acc, cellStyle),
        strCell(st, cellStyle),
        strCell(parc, cellStyle),
        numCell(signed, cur),
      ]);
    }),
    rowXml([
      strCell(isPt ? 'SOMA LÍQUIDA (=SUM)' : 'NET SUM (=SUM)', 'ceHeader'),
      strCell('', 'ceHeader'), strCell('', 'ceHeader'), strCell('', 'ceHeader'),
      strCell('', 'ceHeader'), strCell('', 'ceHeader'),
      formulaCell(sumFormula, data.netCashFlow, cur),
    ], 'roHeader'),
  ];

  // Sheet 3: Cartões e Parcelas
  const cardExpenses = opts.transactions.filter(
    (tx) => Boolean(tx.cardId) && tx.type === 'expense'
  );
  const sheet3Rows: string[] = [
    rowXml([strCell(isPt ? 'Mês Projetado' : 'Projected Month', 'ceHeader'), strCell(isPt ? 'Parcelas Cartão' : 'Card Installments', 'ceHeader'), strCell(isPt ? 'Parcelas Conta' : 'Account Installments', 'ceHeader'), strCell(isPt ? 'Total Comprometido' : 'Total Committed', 'ceHeader')], 'roHeader'),
    ...instSummary.points.map((pt, idx) =>
      rowXml([
        strCell(pt.fullLabel, idx % 2 ? 'ceZebra' : 'ceData'),
        numCell(-Math.abs(pt.cardInstallments), cur, 'ceCurrNeg'),
        numCell(-Math.abs(pt.accountInstallments), cur, 'ceCurrNeg'),
        numCell(-Math.abs(pt.total), cur, 'ceCurrNeg'),
      ])
    ),
    rowXml([strCell('', 'ceData'), strCell('', 'ceData'), strCell('', 'ceData'), strCell('', 'ceData')]),
    rowXml([strCell(isPt ? 'Data Compra' : 'Purchase Date', 'ceHeader'), strCell(isPt ? 'Descrição' : 'Description', 'ceHeader'), strCell(isPt ? 'Cartão / Parcela' : 'Card / Installment', 'ceHeader'), strCell(isPt ? 'Valor' : 'Amount', 'ceHeader')], 'roHeader'),
    ...cardExpenses.slice(0, 120).map((tx, idx) => {
      const cName = (tx.cardId && cardMap.get(tx.cardId)?.name) || 'Cartão';
      const parc = tx.installmentTotal && tx.installmentTotal > 1 ? ` (${tx.installmentCurrent || 1}/${tx.installmentTotal})` : '';
      const st = idx % 2 ? 'ceZebra' : 'ceData';
      return rowXml([
        strCell(tx.purchaseDate || tx.date, st),
        strCell(tx.description, st),
        strCell(`${cName}${parc}`, st),
        numCell(-Math.abs(tx.amount), cur, 'ceCurrNeg'),
      ]);
    }),
  ];

  // Sheet 4: Combustível
  const enrichedFuel = enrichFuelLogs(opts.fuelLogs || []);
  const sheet4Rows: string[] = [
    rowXml([strCell('Data', 'ceHeader'), strCell('Posto', 'ceHeader'), strCell('Odômetro (km)', 'ceHeader'), strCell('Litros', 'ceHeader'), strCell('Preço/L', 'ceHeader'), strCell('Km/L', 'ceHeader'), strCell('Custo Total', 'ceHeader')], 'roHeader'),
    ...enrichedFuel.map((log, idx) => {
      const st = idx % 2 ? 'ceZebra' : 'ceData';
      return rowXml([
        strCell(log.date, st),
        strCell(log.stationName || 'Posto', st),
        numCell(log.odometer, cur, 'ceNum', true),
        numCell(log.liters, cur, 'ceNum', true),
        numCell(log.pricePerLiter, cur, 'ceNum'),
        numCell(log.kmPerLiter || 0, cur, 'ceCurrPos', true),
        numCell(-Math.abs(log.totalCost), cur, 'ceCurrNeg'),
      ]);
    }),
  ];

  const contentXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:number="urn:oasis:names:tc:opendocument:xmlns:datastyle:1.0" xmlns:of="urn:oasis:names:tc:opendocument:xmlns:of:1.2" office:version="1.2">
  ${buildAutomaticStylesXml()}
  <office:body>
    <office:spreadsheet>
      <table:table table:name="Resumo Executivo">
        <table:table-column table:style-name="coWide"/><table:table-column table:style-name="coMed"/><table:table-column table:style-name="coMed"/><table:table-column table:style-name="coMed"/>
        ${sheet1Rows.join('')}
      </table:table>
      <table:table table:name="Lançamentos">
        <table:table-column table:style-name="coNarrow"/><table:table-column table:style-name="coWide"/><table:table-column table:style-name="coMed"/><table:table-column table:style-name="coMed"/><table:table-column table:style-name="coNarrow"/><table:table-column table:style-name="coNarrow"/><table:table-column table:style-name="coMed"/>
        ${sheet2Rows.join('')}
      </table:table>
      <table:table table:name="Cartões e Parcelas">
        <table:table-column table:style-name="coMed"/><table:table-column table:style-name="coWide"/><table:table-column table:style-name="coMed"/><table:table-column table:style-name="coMed"/>
        ${sheet3Rows.join('')}
      </table:table>
      <table:table table:name="Combustível">
        <table:table-column table:style-name="coNarrow"/><table:table-column table:style-name="coWide"/><table:table-column table:style-name="coNarrow"/><table:table-column table:style-name="coNarrow"/><table:table-column table:style-name="coNarrow"/><table:table-column table:style-name="coNarrow"/><table:table-column table:style-name="coMed"/>
        ${sheet4Rows.join('')}
      </table:table>
    </office:spreadsheet>
  </office:body>
</office:document-content>`;

  const blob = buildZipArchiveBlob([
    { path: 'mimetype', content: 'application/vnd.oasis.opendocument.spreadsheet' },
    { path: 'META-INF/manifest.xml', content: ODS_MANIFEST_XML },
    { path: 'styles.xml', content: ODS_STYLES_XML },
    { path: 'content.xml', content: contentXml },
  ]);

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `prumo-${data.filenameSlug}.ods`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
