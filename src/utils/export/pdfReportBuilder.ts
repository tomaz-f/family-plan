import { getMonthlyCardInvoiceExpenses } from '../../components/reports/reportsCalculations';
import { formatCurrency } from '../format';
import { getCategoryDisplayName } from '../i18n';
import {
  aggregateBalanceCurve,
  aggregateBudgetRigidity,
  aggregateCashflowEvolution,
  aggregateFuelEfficiency,
  aggregateInstallmentProjections,
  aggregateMonthlyBurnRate,
} from '../reportAggregators';
import { ExportFilterOptions } from './exportTypes';
import {
  escHtml,
  generateBalanceCurveSvg,
  generateCashflowEvolutionSvg,
  generateDonutChartSvg,
  generatePrumoLogoSvg,
  PdfDonutSlice,
} from './pdfChartSvgsPrimary';
import {
  generateBudgetRigiditySvg,
  generateBurnRateSvg,
  generateFuelEfficiencySvg,
  generateInstallmentProjectionSvg,
} from './pdfChartSvgsSecondary';
import { computeExportData } from './reportDataAggregator';

const PDF_PRINT_STYLES = `
  @page { size: A4 portrait; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { margin: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0F172A; background: #FFFFFF; font-size: 10px; line-height: 1.4; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #6E5440; padding-bottom: 10px; margin-bottom: 12px; }
  .brand { display: flex; align-items: center; gap: 10px; }
  .brand h1 { margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 0.12em; color: #0F172A; }
  .brand span { font-size: 9px; font-weight: 700; color: #6E5440; text-transform: uppercase; letter-spacing: 0.08em; }
  .meta { text-align: right; }
  .period-pill { display: inline-block; background: #6E5440; color: #FFFFFF; font-weight: 700; font-size: 10px; padding: 3px 10px; border-radius: 999px; margin-top: 2px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
  .kpi-card { border: 1px solid #E2E8F0; border-radius: 10px; padding: 8px 10px; background: #FFFFFF; break-inside: avoid; }
  .kpi-title { font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #64748B; }
  .kpi-val { font-size: 13px; font-weight: 900; margin-top: 3px; font-variant-numeric: tabular-nums; }
  .kpi-sub { font-size: 8px; font-weight: 600; color: #64748B; margin-top: 2px; font-variant-numeric: tabular-nums; }
  .charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 14px; }
  .chart-card { border: 1px solid #E2E8F0; border-radius: 12px; padding: 8px 10px; background: #FFFFFF; break-inside: avoid; page-break-inside: avoid; }
  .chart-hdr { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F1F5F9; padding-bottom: 4px; margin-bottom: 4px; }
  .chart-title { font-size: 9.5px; font-weight: 800; color: #0F172A; text-transform: uppercase; letter-spacing: 0.04em; }
  .chart-num { font-size: 8.5px; font-weight: 700; color: #6E5440; background: #F8FAFC; border: 1px solid #E2E8F0; padding: 1px 6px; border-radius: 999px; }
  .sec-title { font-size: 10.5px; font-weight: 800; text-transform: uppercase; color: #0F172A; border-left: 3px solid #6E5440; padding-left: 8px; margin: 14px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 9px; margin-bottom: 12px; }
  th { background: #6E5440; color: #FFFFFF; font-weight: 700; text-align: left; padding: 6px 8px; border: 1px solid #5C4534; }
  td { padding: 5px 8px; border: 1px solid #E2E8F0; color: #0F172A; }
  tr:nth-child(even) td { background: #F8FAFC; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  .num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
  .pos { color: #10B981; }
  .neg { color: #EF4444; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 8px; font-weight: 700; }
  .b-paid { background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; }
  .b-pend { background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A; }
`;

function buildCardSlicesForMonth(opts: ExportFilterOptions, refMonth: string): { slices: PdfDonutSlice[]; total: number } {
  const cardTxs = getMonthlyCardInvoiceExpenses(opts.transactions, opts.creditCards || [], 'all', refMonth);
  const catMap = new Map(opts.categories.map((c) => [c.id, c]));
  const groups = new Map<string, { amount: number; count: number }>();
  let total = 0;

  for (const tx of cardTxs) {
    const amt = Number(tx.amount || 0);
    if (amt <= 0) continue;
    const cur = groups.get(tx.categoryId) || { amount: 0, count: 0 };
    groups.set(tx.categoryId, { amount: cur.amount + amt, count: cur.count + 1 });
    total += amt;
  }

  const slices: PdfDonutSlice[] = Array.from(groups.entries())
    .map(([id, g]) => {
      const cat = catMap.get(id);
      return {
        id,
        name: getCategoryDisplayName(cat, opts.language) || id,
        color: cat?.color || '#6E5440',
        amount: g.amount,
        count: g.count,
        share: total > 0 ? (g.amount / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  return { slices, total };
}

export function generateReportHtml(opts: ExportFilterOptions): string {
  const data = computeExportData(opts);
  const isPt = opts.language === 'pt-BR';
  const cur = opts.currency;
  const refMonth = `${opts.year}-${opts.month.padStart(2, '0')}`;
  const cards = opts.creditCards || [];
  const recurring = opts.recurringTemplates || [];
  const catMap = new Map(opts.categories.map((c) => [c.id, c]));
  const cardMap = new Map(cards.map((c) => [c.id, c]));

  const cardBreakdown = buildCardSlicesForMonth(opts, refMonth);
  const cashflowEvo = aggregateCashflowEvolution(opts.transactions, cards, refMonth, opts.language);
  const balanceCurve = aggregateBalanceCurve(opts.transactions, cards, opts.initialBalance, refMonth, opts.language);
  const instProj = aggregateInstallmentProjections(opts.transactions, cards, recurring, refMonth, opts.language);
  const burnRate = aggregateMonthlyBurnRate(opts.transactions, cards, refMonth);
  const rigidity = aggregateBudgetRigidity(opts.transactions, cards, recurring, refMonth);
  const fuelEff = aggregateFuelEfficiency(opts.fuelLogs || []);

  const svg1 = generateDonutChartSvg(
    data.expenseByCategory,
    data.totalCategoryExpenses,
    isPt ? 'Total Despesas' : 'Total Expenses',
    cur,
    isPt ? 'Sem despesas no período' : 'No expenses in period'
  );
  const svg2 = generateDonutChartSvg(
    cardBreakdown.slices,
    cardBreakdown.total,
    isPt ? 'Total Faturas' : 'Total Invoices',
    cur,
    isPt ? 'Sem faturas no mês' : 'No card invoices'
  );
  const svg3 = generateCashflowEvolutionSvg(cashflowEvo, cur);
  const svg4 = generateBalanceCurveSvg(balanceCurve, cur);
  const svg5 = generateInstallmentProjectionSvg(instProj, cur);
  const svg6 = generateBurnRateSvg(burnRate, cur, isPt);
  const svg7 = generateBudgetRigiditySvg(rigidity, cur, isPt);
  const svg8 = generateFuelEfficiencySvg(fuelEff, cur, isPt);

  const chartsList = [
    { num: '1/8', title: isPt ? 'Categorias Gerais' : 'General Categories', svg: svg1 },
    { num: '2/8', title: isPt ? 'Gastos no Cartão' : 'Card Spending', svg: svg2 },
    { num: '3/8', title: isPt ? 'Evolução Mensal (6 Meses)' : 'Monthly Evolution (6m)', svg: svg3 },
    { num: '4/8', title: isPt ? 'Curva de Evolução do Saldo' : 'Balance Evolution Curve', svg: svg4 },
    { num: '5/8', title: isPt ? 'Parcelamentos Futuros (6 Meses)' : 'Future Installments (6m)', svg: svg5 },
    { num: '6/8', title: isPt ? 'Ritmo de Gastos (Burn Rate)' : 'Monthly Burn Rate', svg: svg6 },
    { num: '7/8', title: isPt ? 'Rigidez do Orçamento (Fixos vs. Variáveis)' : 'Budget Rigidity', svg: svg7 },
    { num: '8/8', title: isPt ? 'Eficiência e Custo de Combustível' : 'Fuel Efficiency & Cost', svg: svg8 },
  ];

  const chartsGridHtml = chartsList
    .map(
      (c) => `<div class="chart-card">
        <div class="chart-hdr"><span class="chart-title">${escHtml(c.title)}</span><span class="chart-num">${c.num}</span></div>
        ${c.svg}
      </div>`
    )
    .join('');

  const catRowsHtml = data.expenseByCategory
    .map(
      (c) => `<tr>
        <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${escHtml(c.color)};margin-right:6px;"></span><strong>${escHtml(c.name)}</strong></td>
        <td class="num">${c.count}</td>
        <td class="num">${c.share.toFixed(1)}%</td>
        <td class="num neg">-${escHtml(formatCurrency(c.amount, cur))}</td>
      </tr>`
    )
    .join('');

  const txRowsHtml = data.filteredTransactionsAsc
    .map((tx) => {
      const cat = catMap.get(tx.categoryId);
      const catName = getCategoryDisplayName(cat, opts.language) || tx.categoryId;
      const cardName = tx.cardId ? cardMap.get(tx.cardId)?.name : null;
      const accountStr = cardName ? `Cartão: ${cardName}` : isPt ? 'Conta' : 'Account';
      const parc = tx.installmentTotal && tx.installmentTotal > 1 ? ` (${tx.installmentCurrent || 1}/${tx.installmentTotal})` : '';
      const isPend = tx.status === 'unpaid';
      const badgeCls = isPend ? 'badge b-pend' : 'badge b-paid';
      const badgeTxt = isPend ? (isPt ? 'Pendente' : 'Pending') : isPt ? 'Pago' : 'Paid';
      const signedStr = `${tx.type === 'expense' ? '-' : '+'}${formatCurrency(Math.abs(tx.amount), cur)}`;
      const valCls = tx.type === 'expense' ? 'num neg' : 'num pos';

      return `<tr>
        <td>${escHtml(tx.date)}</td>
        <td><strong>${escHtml(tx.description)}</strong>${escHtml(parc)}</td>
        <td>${escHtml(catName)}</td>
        <td>${escHtml(accountStr)}</td>
        <td><span class="${badgeCls}">${badgeTxt}</span></td>
        <td class="${valCls}">${escHtml(signedStr)}</td>
      </tr>`;
    })
    .join('');

  const nowStr = new Date().toLocaleString(isPt ? 'pt-BR' : 'en-US');

  return `<!DOCTYPE html>
<html lang="${isPt ? 'pt-BR' : 'en'}">
<head>
  <meta charset="UTF-8"/>
  <title>Prumo - ${escHtml(data.periodTitle)}</title>
  <style>${PDF_PRINT_STYLES}</style>
</head>
<body>
  <header class="header">
    <div class="brand">
      ${generatePrumoLogoSvg()}
      <div>
        <h1>PRUMO</h1>
        <span>${isPt ? 'Relatório Executivo e Analítico' : 'Executive Financial Report'}</span>
      </div>
    </div>
    <div class="meta">
      <div class="period-pill">${escHtml(data.periodTitle)}</div>
      <div style="font-size:8px;color:#64748B;margin-top:3px;">${isPt ? 'Gerado em' : 'Generated'}: ${escHtml(nowStr)}</div>
    </div>
  </header>

  <section class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">${isPt ? 'Saldo Inicial' : 'Opening Balance'}</div>
      <div class="kpi-val">${escHtml(formatCurrency(data.openingBalance, cur))}</div>
      <div class="kpi-sub">${isPt ? 'Saldo inicial do período' : 'Period starting balance'}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">${isPt ? 'Entradas (+)' : 'Income (+)'}</div>
      <div class="kpi-val pos">+${escHtml(formatCurrency(data.totalIncome, cur))}</div>
      <div class="kpi-sub pos">${isPt ? 'Pendente' : 'Pending'}: +${escHtml(formatCurrency(data.pendingIncome, cur))}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">${isPt ? 'Despesas (-)' : 'Expenses (-)'}</div>
      <div class="kpi-val neg">-${escHtml(formatCurrency(data.totalExpense, cur))}</div>
      <div class="kpi-sub neg">${isPt ? 'Pendente' : 'Pending'}: -${escHtml(formatCurrency(data.pendingExpense, cur))}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">${isPt ? 'Saldo Projetado' : 'Projected Balance'}</div>
      <div class="kpi-val" style="color:${data.projectedBalance >= 0 ? '#10B981' : '#EF4444'};">${escHtml(formatCurrency(data.projectedBalance, cur))}</div>
      <div class="kpi-sub">${isPt ? 'Consolidado' : 'Consolidated'}: ${escHtml(formatCurrency(data.closingBalance, cur))}</div>
    </div>
  </section>

  <div class="sec-title">${isPt ? '1. Painel Gráfico Completo (8 Indicadores)' : '1. Complete Visual Dashboard (8 Charts)'}</div>
  <section class="charts-grid">${chartsGridHtml}</section>

  <div class="sec-title">${isPt ? '2. Resumo por Categoria de Despesa' : '2. Expense Category Summary'}</div>
  <table>
    <thead>
      <tr>
        <th>${isPt ? 'Categoria' : 'Category'}</th>
        <th class="num">${isPt ? 'Qtd.' : 'Count'}</th>
        <th class="num">${isPt ? 'Part. (%)' : 'Share (%)'}</th>
        <th class="num">${isPt ? 'Total' : 'Total'}</th>
      </tr>
    </thead>
    <tbody>
      ${catRowsHtml || `<tr><td colspan="4" style="text-align:center;color:#94A3B8;">${isPt ? 'Nenhuma despesa registrada' : 'No expenses recorded'}</td></tr>`}
    </tbody>
  </table>

  <div class="sec-title">${isPt ? `3. Extrato Cronológico de Lançamentos (${data.filteredTransactionsAsc.length})` : `3. Chronological Statement (${data.filteredTransactionsAsc.length})`}</div>
  <table>
    <thead>
      <tr>
        <th style="width:68px;">${isPt ? 'Data' : 'Date'}</th>
        <th>${isPt ? 'Descrição' : 'Description'}</th>
        <th>${isPt ? 'Categoria' : 'Category'}</th>
        <th>${isPt ? 'Conta / Cartão' : 'Account / Card'}</th>
        <th style="width:64px;">Status</th>
        <th class="num" style="width:86px;">${isPt ? 'Valor' : 'Amount'}</th>
      </tr>
    </thead>
    <tbody>
      ${txRowsHtml || `<tr><td colspan="6" style="text-align:center;color:#94A3B8;">${isPt ? 'Nenhum lançamento no período' : 'No transactions in period'}</td></tr>`}
    </tbody>
  </table>
</body>
</html>`;
}

/**
 * Renders the self-contained HTML+SVG report inside an isolated offscreen iframe
 * and invokes native vector PDF print without touching the live React DOM.
 */
export function exportFilteredHistoryToPDF(opts: ExportFilterOptions): Promise<void> {
  return new Promise((resolve) => {
    const html = generateReportHtml(opts);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const cleanup = () => {
      setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1200);
      resolve();
    };

    const doc = iframe.contentWindow?.document;
    if (!doc || !iframe.contentWindow) {
      cleanup();
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        cleanup();
      }
    }, 220);
  });
}
