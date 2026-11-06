import { formatCurrency } from '../format';
import { cleanPdfText } from './exportFormatHelpers';
import { ComputedExportData, ExportPeriodMode } from './exportTypes';

/**
 * Renders a high-resolution Donut Chart onto an offscreen HTML5 Canvas and returns a PNG Data URL.
 */
export function renderCategoryDonutChartCanvas(
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
export function renderCashFlowChartCanvas(
  data: ComputedExportData,
  periodMode: ExportPeriodMode,
  _currency: string,
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
    ctx.fillText(
      isPt ? 'Sem dados no período' : 'No data in period',
      canvas.width / 2,
      canvas.height / 2
    );
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

  const maxVal = Math.max(100, ...points.map((p) => Math.max(p.income, p.expense)));

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
    const shortVal = val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0);
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
      ctx.roundRect(
        groupCenter - barW - 2,
        chartBottom - Math.max(4, incH),
        barW,
        Math.max(4, incH),
        [4, 4, 0, 0]
      );
      ctx.fill();
    }

    // Expense bar
    const expH = (pt.expense / maxVal) * chartH;
    if (expH > 0) {
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.roundRect(
        groupCenter + 2,
        chartBottom - Math.max(4, expH),
        barW,
        Math.max(4, expH),
        [4, 4, 0, 0]
      );
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
