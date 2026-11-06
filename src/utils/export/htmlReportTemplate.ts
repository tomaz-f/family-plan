import { formatCurrency } from '../format';
import { ExportFilterOptions } from './exportTypes';
import {
  generateCashFlowSvg,
  generateCategoryDonutSvg,
  generateCommitmentsComparisonSvg,
  generatePaymentChannelsSvg,
  generatePrumoLogoSvg,
} from './htmlReportCharts';
import {
  buildExpenseRowsHtml,
  buildLedgerRowsHtml,
  REPORT_HTML_STYLES,
} from './htmlReportStyles';
import { computeExportData } from './reportDataAggregator';

export function generateReportHtml(opts: ExportFilterOptions, includeScreenBar = false): string {
  const data = computeExportData(opts);
  const isPt = opts.language === 'pt-BR';
  const currency = opts.currency;

  const fmtMoney = (v: number) => formatCurrency(v, currency);
  const logoSvg = generatePrumoLogoSvg();
  const donutSvg = generateCategoryDonutSvg(
    data.expenseByCategory,
    data.totalCategoryExpenses,
    currency,
    isPt
  );
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

  const expenseRowsHtml = buildExpenseRowsHtml(data.expenseByCategory, currency);
  const totalExpenseItems = data.expenseByCategory.reduce((sum, r) => sum + r.count, 0);
  const avgExpensePerItem =
    totalExpenseItems > 0 ? data.totalCategoryExpenses / totalExpenseItems : 0;

  const ledgerRowsHtml = buildLedgerRowsHtml(
    data.filteredTransactionsAsc,
    opts.categories,
    opts.language,
    currency
  );

  return `<!DOCTYPE html>
<html lang="${isPt ? 'pt-BR' : 'en'}">
<head>
  <meta charset="UTF-8">
  <title>Prumo - Demonstrativo Financeiro Mensal (${data.periodTitle})</title>
  <style>${REPORT_HTML_STYLES}</style>
</head>
<body>

  ${
    includeScreenBar
      ? `
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
  </div>`
      : ''
  }

  <div class="report-container">

    <!-- PAGE 1: HEADER, EXECUTIVE KPI GRID, PRIMARY CHARTS, CATEGORY BREAKDOWN -->
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

    <section class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-stripe" style="background-color: #64748B;"></div>
        <div class="kpi-label">SALDO INICIAL NO PERÍODO</div>
        <div class="kpi-value">${fmtMoney(data.openingBalance)}</div>
        <div class="kpi-sub">Saldo anterior acumulado</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-stripe" style="background-color: #10B981;"></div>
        <div class="kpi-label">TOTAL DE ENTRADAS (+)</div>
        <div class="kpi-value" style="color: #10B981;">+ ${fmtMoney(data.totalIncome)}</div>
        <div class="kpi-sub">A receber: ${fmtMoney(data.pendingIncome)} (${data.pendingIncomeCount} itens)</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-stripe" style="background-color: #EF4444;"></div>
        <div class="kpi-label">TOTAL DE DESPESAS (-)</div>
        <div class="kpi-value" style="color: #EF4444;">- ${fmtMoney(data.totalExpense)}</div>
        <div class="kpi-sub">A pagar: ${fmtMoney(data.pendingExpense)} (${data.pendingExpenseCount} itens)</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-stripe" style="background-color: ${data.netCashFlow >= 0 ? '#10B981' : '#EF4444'};"></div>
        <div class="kpi-label">RESULTADO LÍQUIDO</div>
        <div class="kpi-value" style="color: ${data.netCashFlow >= 0 ? '#10B981' : '#EF4444'};">
          ${data.netCashFlow >= 0 ? '+' : '-'} ${fmtMoney(Math.abs(data.netCashFlow))}
        </div>
        <div class="kpi-sub">${data.netCashFlow >= 0 ? 'Superávit operacional no mês' : 'Déficit operacional no mês'}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-stripe" style="background-color: #334155;"></div>
        <div class="kpi-label">SALDO EM CONTA / PROJETADO</div>
        <div class="kpi-value">${fmtMoney(data.closingBalance)}</div>
        <div class="kpi-sub">Projetado final: ${fmtMoney(data.projectedBalance)}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-stripe" style="background-color: #F59E0B;"></div>
        <div class="kpi-label">TAXA POUPADA / MÉDIA DIÁRIA</div>
        <div class="kpi-value">${data.savingsRate.toFixed(1)}% poupado</div>
        <div class="kpi-sub">Média diária: ${fmtMoney(data.avgDailyExpense)} / dia</div>
      </div>
    </section>

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
        ${
          data.expenseByCategory.length > 0
            ? `
          <tfoot>
            <tr class="totals-row">
              <td>TOTAL GERAL</td>
              <td class="text-center">${totalExpenseItems}</td>
              <td class="text-right" style="color:#EF4444;">${fmtMoney(data.totalCategoryExpenses)}</td>
              <td class="text-right">100.0%</td>
              <td class="text-right">${fmtMoney(avgExpensePerItem)}</td>
            </tr>
          </tfoot>
        `
            : ''
        }
      </table>
    </section>

    <footer class="page-footer">
      <span>Prumo • Gestão Financeira Pessoal</span>
      <span>${data.periodTitle} • Página 1</span>
    </footer>

    <!-- PAGE 2+: SECONDARY SVG CHARTS & DETAILED TRANSACTION STATEMENT -->
    <div class="page-break-before" style="margin-top: 14px;"></div>

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

    <footer class="page-footer">
      <span>Prumo • Gestão Financeira Pessoal</span>
      <span>${data.periodTitle}</span>
    </footer>

  </div>

</body>
</html>`;
}
