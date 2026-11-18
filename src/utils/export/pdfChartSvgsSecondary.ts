import { formatCompactNumber, formatCurrency } from '../format';
import {
  BudgetRigiditySummary,
  BurnRateSummary,
  FuelEfficiencySummary,
  InstallmentProjectionSummary,
} from '../reportAggregators';
import { escHtml } from './pdfChartSvgsPrimary';

/**
 * Chart 5: Projeção de Parcelamentos Futuros (6 Meses) — Red (#EF4444) commitment
 * bars + Emerald (#10B981) relief bars where installments drop off.
 */
export function generateInstallmentProjectionSvg(
  summary: InstallmentProjectionSummary,
  currency: string
): string {
  const pts = summary.points;
  const maxVal = Math.max(...pts.map((p) => p.total), 100);
  const chartLeft = 40;
  const chartRight = 328;
  const chartTop = 20;
  const chartBottom = 114;
  const chartH = chartBottom - chartTop;
  const slotW = (chartRight - chartLeft) / Math.max(pts.length, 1);

  const bars = pts
    .map((pt, i) => {
      const cx = chartLeft + i * slotW + slotW / 2;
      const barH = Math.max(2, (pt.total / maxVal) * chartH);
      const fill = pt.isReliefMonth ? '#10B981' : '#EF4444';
      const opacity = pt.isPeakMonth || pt.isReliefMonth ? '1' : '0.78';
      return `<g>
        <rect x="${(cx - 12).toFixed(1)}" y="${(chartBottom - barH).toFixed(1)}" width="24" height="${barH.toFixed(1)}" rx="3.5" fill="${fill}" fill-opacity="${opacity}"/>
        <text x="${cx.toFixed(1)}" y="${(chartBottom - barH - 4).toFixed(1)}" text-anchor="middle" font-size="7.5" font-weight="700" fill="${fill}">${escHtml(formatCompactNumber(pt.total))}</text>
        <text x="${cx.toFixed(1)}" y="${chartBottom + 13}" text-anchor="middle" font-size="8.5" font-weight="600" fill="#475569">${escHtml(pt.label)}</text>
      </g>`;
    })
    .join('');

  return `<svg viewBox="0 0 340 144" width="100%" height="140">
    <line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="#CBD5E1"/>
    ${bars}
    <text x="${chartRight}" y="11" text-anchor="end" font-size="8" font-weight="700" fill="#EF4444">Total 6m: ${escHtml(formatCurrency(summary.totalCommitted6m, currency))}</text>
  </svg>`;
}

/**
 * Chart 6: Ritmo de Gastos no Mês (Burn Rate) — Solid Red (#EF4444) cumulative
 * current spend vs dashed Slate (#64748B) historical average curve.
 */
export function generateBurnRateSvg(
  summary: BurnRateSummary,
  currency: string,
  isPt: boolean
): string {
  const pts = summary.points;
  const maxVal = Math.max(
    summary.currentSpend,
    summary.historicalMonthlyAverage,
    ...pts.map((p) => Math.max(p.actualCumulative ?? 0, p.averageCumulative)),
    100
  );
  const chartLeft = 40;
  const chartRight = 326;
  const chartTop = 20;
  const chartBottom = 114;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;

  const avgPolyline = pts
    .map((p, i) => {
      const x = chartLeft + (pts.length > 1 ? (i / (pts.length - 1)) * chartW : 0);
      const y = chartBottom - (p.averageCumulative / maxVal) * chartH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const actualPolyline = pts
    .filter((p) => p.actualCumulative !== null)
    .map((p) => {
      const i = p.day - 1;
      const x = chartLeft + (pts.length > 1 ? (i / (pts.length - 1)) * chartW : 0);
      const y = chartBottom - ((p.actualCumulative ?? 0) / maxVal) * chartH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const statusText = summary.isOverPace
    ? isPt
      ? 'Acima da média'
      : 'Above average'
    : isPt
    ? 'Dentro do ritmo'
    : 'On track';
  const statusColor = summary.isOverPace ? '#EF4444' : '#10B981';

  return `<svg viewBox="0 0 340 144" width="100%" height="140">
    <line x1="${chartLeft}" y1="${chartTop}" x2="${chartRight}" y2="${chartTop}" stroke="#E2E8F0" stroke-dasharray="3 3"/>
    <line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="#CBD5E1"/>
    <text x="${chartLeft - 5}" y="${chartTop + 3}" text-anchor="end" font-size="8" fill="#64748B">${escHtml(formatCompactNumber(maxVal))}</text>
    <text x="${chartLeft}" y="${chartBottom + 13}" font-size="8" fill="#64748B">Dia 01</text>
    <text x="${chartRight}" y="${chartBottom + 13}" text-anchor="end" font-size="8" fill="#64748B">Dia ${summary.daysInMonth}</text>
    <polyline fill="none" stroke="#64748B" stroke-width="1.8" stroke-dasharray="4 4" points="${avgPolyline}"/>
    ${actualPolyline ? `<polyline fill="none" stroke="#EF4444" stroke-width="2.4" points="${actualPolyline}"/>` : ''}
    <text x="${chartRight}" y="12" text-anchor="end" font-size="8.5" font-weight="800" fill="${statusColor}">${escHtml(statusText)} (${escHtml(formatCurrency(summary.currentSpend, currency))})</text>
  </svg>`;
}

/**
 * Chart 7: Rigidez do Orçamento (Fixos vs. Variáveis) — Proportional horizontal
 * split bar (Fixed Red #EF4444 vs Variable Emerald #10B981) + summary blocks.
 */
export function generateBudgetRigiditySvg(
  summary: BudgetRigiditySummary,
  currency: string,
  isPt: boolean
): string {
  const barX = 16;
  const barW = 308;
  const fixedRatio = summary.totalBudgetBase > 0 ? summary.fixedPct / 100 : 0.5;
  const fixedW = Math.max(28, Math.min(barW - 28, barW * fixedRatio));
  const varW = Math.max(24, barW - fixedW - 4);

  return `<svg viewBox="0 0 340 144" width="100%" height="140">
    <rect x="${barX}" y="16" width="${fixedW.toFixed(1)}" height="24" rx="5" fill="#EF4444"/>
    <text x="${(barX + fixedW / 2).toFixed(1)}" y="31" text-anchor="middle" font-size="9" font-weight="800" fill="#FFFFFF">${summary.fixedPct.toFixed(0)}%</text>
    <rect x="${(barX + fixedW + 4).toFixed(1)}" y="16" width="${varW.toFixed(1)}" height="24" rx="5" fill="#10B981"/>
    <text x="${(barX + fixedW + 4 + varW / 2).toFixed(1)}" y="31" text-anchor="middle" font-size="9" font-weight="800" fill="#FFFFFF">${summary.variablePct.toFixed(0)}%</text>

    <rect x="16" y="54" width="148" height="72" rx="8" fill="#FEF2F2" stroke="#FECACA"/>
    <text x="26" y="72" font-size="8.5" font-weight="700" fill="#991B1B">${isPt ? 'FIXOS E PARCELAS' : 'FIXED & INSTALLMENTS'}</text>
    <text x="26" y="94" font-size="11.5" font-weight="800" fill="#EF4444">-${escHtml(formatCurrency(summary.fixedAmount, currency))}</text>
    <text x="26" y="112" font-size="8" font-weight="600" fill="#64748B">${summary.fixedPct.toFixed(1)}% • ${summary.fixedCount} itens</text>

    <rect x="176" y="54" width="148" height="72" rx="8" fill="#ECFDF5" stroke="#A7F3D0"/>
    <text x="186" y="72" font-size="8.5" font-weight="700" fill="#065F46">${isPt ? 'VARIÁVEIS / FLEXÍVEIS' : 'VARIABLE / FLEXIBLE'}</text>
    <text x="186" y="94" font-size="11.5" font-weight="800" fill="#10B981">-${escHtml(formatCurrency(summary.variableAmount, currency))}</text>
    <text x="186" y="112" font-size="8" font-weight="600" fill="#64748B">${summary.variablePct.toFixed(1)}% • ${summary.variableCount} itens</text>
  </svg>`;
}

/**
 * Chart 8: Eficiência e Custo de Combustível — Dual-line km/L (#10B981) and R$ (#EF4444)
 * SVG with empty-state card fallback when no fuel logs exist.
 */
export function generateFuelEfficiencySvg(
  summary: FuelEfficiencySummary,
  currency: string,
  isPt: boolean
): string {
  if (!summary.hasData || summary.points.length === 0) {
    return `<svg viewBox="0 0 340 144" width="100%" height="140">
      <rect x="16" y="18" width="308" height="108" rx="10" fill="#F8FAFC" stroke="#E2E8F0" stroke-dasharray="4 4"/>
      <text x="170" y="66" text-anchor="middle" font-size="10" font-weight="700" fill="#475569">${isPt ? 'Sem registros de abastecimento no período' : 'No fuel logs recorded'}</text>
      <text x="170" y="84" text-anchor="middle" font-size="8.5" fill="#94A3B8">${isPt ? 'Registre abastecimentos na aba Combustível para exibir km/L e custo.' : 'Add fuel logs in the Fuel tab to display km/L and cost.'}</text>
    </svg>`;
  }

  const pts = summary.points;
  const maxEff = Math.max(...pts.map((p) => p.kmPerLiter), 15);
  const maxCost = Math.max(...pts.map((p) => p.totalCost), 100);
  const chartLeft = 36;
  const chartRight = 304;
  const chartTop = 22;
  const chartBottom = 112;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;

  const effCoords = pts.map((p, i) => {
    const x = chartLeft + (pts.length > 1 ? (i / (pts.length - 1)) * chartW : chartW / 2);
    const y = chartBottom - (p.kmPerLiter / maxEff) * chartH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const costCoords = pts.map((p, i) => {
    const x = chartLeft + (pts.length > 1 ? (i / (pts.length - 1)) * chartW : chartW / 2);
    const y = chartBottom - (p.totalCost / maxCost) * chartH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `<svg viewBox="0 0 340 144" width="100%" height="140">
    <line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="#CBD5E1"/>
    <polyline fill="none" stroke="#EF4444" stroke-width="2" points="${costCoords.join(' ')}"/>
    <polyline fill="none" stroke="#10B981" stroke-width="2.4" points="${effCoords.join(' ')}"/>
    <text x="${chartLeft}" y="13" font-size="8.5" font-weight="800" fill="#10B981">${summary.avgKmPerLiter ? `${summary.avgKmPerLiter.toFixed(1)} km/L méd.` : 'km/L'}</text>
    <text x="${chartRight}" y="13" text-anchor="end" font-size="8.5" font-weight="800" fill="#EF4444">Total: -${escHtml(formatCurrency(summary.totalSpend, currency))}</text>
  </svg>`;
}
