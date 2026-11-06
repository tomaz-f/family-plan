import { jsPDF } from 'jspdf';
import { formatCurrency } from '../format';
import { cleanPdfText, hexToRgb } from './exportFormatHelpers';
import { ComputedExportData, ExportFilterOptions } from './exportTypes';
import {
  renderCashFlowChartCanvas,
  renderCategoryDonutChartCanvas,
} from './pdfCanvasCharts';

/**
 * Renders Page 1 of the jsPDF document (Header banner, 6 KPI summary cards,
 * side-by-side canvas charts, and Section 1 Expenses Breakdown table).
 * Returns the current vertical `y` position in mm.
 */
export function renderPdfPageOne(
  doc: jsPDF,
  opts: ExportFilterOptions,
  data: ComputedExportData
): number {
  const isPt = opts.language === 'pt-BR';
  const currency = opts.currency;
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

  const barChartDataUrl = renderCashFlowChartCanvas(data, opts.periodMode, currency, isPt);
  if (barChartDataUrl) {
    doc.addImage(barChartDataUrl, 'PNG', rightChartX + 2, y + 8, chartBoxW - 4, chartBoxH - 10);
  }

  y += chartBoxH + 7;

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

  return y;
}
