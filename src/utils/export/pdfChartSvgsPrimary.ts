import { formatCompactNumber, formatCurrency } from '../format';
import {
  BalanceCurveSummary,
  CashflowEvolutionSummary,
} from '../reportAggregators';

export interface PdfDonutSlice {
  id: string;
  name: string;
  color: string;
  amount: number;
  count: number;
  share: number;
}

export function escHtml(val: string | number | null | undefined): string {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function generatePrumoLogoSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="6 2 20 33" width="28" height="34">
    <defs>
      <linearGradient id="pdfIronL" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#7E624B"/><stop offset="50%" stop-color="#9C7F6A"/><stop offset="100%" stop-color="#6E5440"/>
      </linearGradient>
      <linearGradient id="pdfIronD" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#4A3728"/><stop offset="100%" stop-color="#24170E"/>
      </linearGradient>
    </defs>
    <line x1="16" y1="2" x2="16" y2="8" stroke="#D0B595" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="16" cy="7.8" rx="2.4" ry="1.8" fill="#8C7051"/>
    <circle cx="16" cy="12" r="3.2" fill="none" stroke="url(#pdfIronL)" stroke-width="1.8"/>
    <ellipse cx="16" cy="15.8" rx="3" ry="1" fill="url(#pdfIronL)"/>
    <path d="M 16 16.4 L 8 19.2 L 16 19.2 Z" fill="url(#pdfIronL)"/>
    <path d="M 16 16.4 L 16 19.2 L 24 19.2 Z" fill="url(#pdfIronD)"/>
    <path d="M 8 19.2 L 16 33.2 L 16 19.2 Z" fill="url(#pdfIronL)"/>
    <path d="M 16 19.2 L 16 33.2 L 24 19.2 Z" fill="url(#pdfIronD)"/>
  </svg>`;
}

/**
 * Generates a vector Donut Chart + Legend SVG used for Chart 1 (Categorias Gerais)
 * and Chart 2 (Gastos no Cartão).
 */
export function generateDonutChartSvg(
  slices: PdfDonutSlice[],
  totalAmount: number,
  centerLabel: string,
  currency: string,
  emptyLabel: string
): string {
  const cx = 72;
  const cy = 72;
  const r = 52;
  const circumference = 2 * Math.PI * r;

  if (!slices.length || totalAmount <= 0) {
    return `<svg viewBox="0 0 340 144" width="100%" height="140">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#E2E8F0" stroke-width="18"/>
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="9" font-weight="700" fill="#94A3B8">${escHtml(formatCurrency(0, currency))}</text>
      <text x="215" y="75" text-anchor="middle" font-size="10" font-weight="600" fill="#64748B">${escHtml(emptyLabel)}</text>
    </svg>`;
  }

  let acc = 0;
  const gap = slices.length > 1 ? 2 : 0;
  const arcs = slices.map((s) => {
    const frac = Math.max(0, s.amount / totalAmount);
    const len = Math.max(1.5, frac * circumference - gap);
    const offset = circumference * (1 - acc);
    acc += frac;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${escHtml(s.color)}" stroke-width="18" stroke-dasharray="${len.toFixed(2)} ${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
  });

  const topSlices = slices.slice(0, 5);
  const legendItems = topSlices
    .map((s, idx) => {
      const y = 26 + idx * 23;
      const nameTrunc = s.name.length > 18 ? `${s.name.slice(0, 17)}…` : s.name;
      return `<g>
        <circle cx="152" cy="${y - 3}" r="4.5" fill="${escHtml(s.color)}"/>
        <text x="162" y="${y}" font-size="9.5" font-weight="600" fill="#0F172A">${escHtml(nameTrunc)}</text>
        <text x="332" y="${y}" text-anchor="end" font-size="9" font-weight="700" fill="#334155">${escHtml(formatCurrency(s.amount, currency))} (${s.share.toFixed(0)}%)</text>
      </g>`;
    })
    .join('');

  return `<svg viewBox="0 0 340 144" width="100%" height="140">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#F1F5F9" stroke-width="18"/>
    ${arcs.join('')}
    <text x="${cx}" y="${cy - 5}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#64748B">${escHtml(centerLabel.toUpperCase())}</text>
    <text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="10" font-weight="800" fill="#0F172A">${escHtml(formatCurrency(totalAmount, currency))}</text>
    ${legendItems}
  </svg>`;
}

/**
 * Chart 3: Evolução Mensal (6 Meses) — Grouped Emerald (#10B981) vs Red (#EF4444)
 * bars + subtle net balance line.
 */
export function generateCashflowEvolutionSvg(
  summary: CashflowEvolutionSummary,
  currency: string
): string {
  const pts = summary.points;
  const maxVal = Math.max(...pts.flatMap((p) => [p.income, p.expense]), 100);
  const chartLeft = 40;
  const chartRight = 328;
  const chartTop = 18;
  const chartBottom = 114;
  const chartH = chartBottom - chartTop;
  const slotW = (chartRight - chartLeft) / Math.max(pts.length, 1);

  const gridLines = [0, 0.5, 1]
    .map((ratio) => {
      const y = chartBottom - ratio * chartH;
      const val = maxVal * ratio;
      return `<line x1="${chartLeft}" y1="${y}" x2="${chartRight}" y2="${y}" stroke="#E2E8F0" stroke-dasharray="3 3"/>
        <text x="${chartLeft - 5}" y="${y + 3}" text-anchor="end" font-size="8" fill="#64748B">${escHtml(formatCompactNumber(val))}</text>`;
    })
    .join('');

  const netPoints: string[] = [];
  const bars = pts
    .map((pt, i) => {
      const cx = chartLeft + i * slotW + slotW / 2;
      const incH = Math.max(2, (pt.income / maxVal) * chartH);
      const expH = Math.max(2, (pt.expense / maxVal) * chartH);
      const netClamped = Math.max(0, Math.min(maxVal, pt.income - pt.expense + maxVal * 0.5));
      const netY = chartBottom - (netClamped / maxVal) * chartH;
      netPoints.push(`${cx.toFixed(1)},${netY.toFixed(1)}`);

      return `<g>
        <rect x="${(cx - 11).toFixed(1)}" y="${(chartBottom - incH).toFixed(1)}" width="10" height="${incH.toFixed(1)}" rx="2.5" fill="#10B981"/>
        <rect x="${(cx + 1).toFixed(1)}" y="${(chartBottom - expH).toFixed(1)}" width="10" height="${expH.toFixed(1)}" rx="2.5" fill="#EF4444"/>
        <text x="${cx.toFixed(1)}" y="${chartBottom + 13}" text-anchor="middle" font-size="8.5" font-weight="600" fill="#475569">${escHtml(pt.label)}</text>
      </g>`;
    })
    .join('');

  return `<svg viewBox="0 0 340 144" width="100%" height="140">
    ${gridLines}
    ${bars}
    <polyline fill="none" stroke="#64748B" stroke-width="1.8" points="${netPoints.join(' ')}"/>
    <text x="${chartRight}" y="11" text-anchor="end" font-size="8" font-weight="700" fill="#64748B">Média líq.: ${escHtml(formatCurrency(summary.avgNet, currency))}</text>
  </svg>`;
}

/**
 * Chart 4: Curva de Evolução do Saldo — Emerald (#10B981) monotone curve with gradient fill.
 */
export function generateBalanceCurveSvg(
  summary: BalanceCurveSummary,
  currency: string
): string {
  const pts = summary.points;
  const vals = pts.map((p) => p.balance);
  const minVal = Math.min(...vals, 0);
  const maxVal = Math.max(...vals, minVal + 100);
  const span = Math.max(maxVal - minVal, 1);

  const chartLeft = 42;
  const chartRight = 326;
  const chartTop = 20;
  const chartBottom = 114;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;

  const coords = pts.map((p, i) => {
    const x = chartLeft + (pts.length > 1 ? (i / (pts.length - 1)) * chartW : chartW / 2);
    const y = chartBottom - ((p.balance - minVal) / span) * chartH;
    return { x, y, label: p.label, val: p.balance };
  });

  const linePts = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPts = `${coords[0]?.x.toFixed(1) ?? chartLeft},${chartBottom} ${linePts} ${coords[coords.length - 1]?.x.toFixed(1) ?? chartRight},${chartBottom}`;

  const dotsAndLabels = coords
    .map(
      (c) => `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="3" fill="#10B981" stroke="#FFFFFF" stroke-width="1.5"/>
      <text x="${c.x.toFixed(1)}" y="${chartBottom + 13}" text-anchor="middle" font-size="8.5" font-weight="600" fill="#475569">${escHtml(c.label)}</text>`
    )
    .join('');

  return `<svg viewBox="0 0 340 144" width="100%" height="140">
    <defs>
      <linearGradient id="pdfBalGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#10B981" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#10B981" stop-opacity="0.0"/>
      </linearGradient>
    </defs>
    <line x1="${chartLeft}" y1="${chartTop}" x2="${chartRight}" y2="${chartTop}" stroke="#E2E8F0" stroke-dasharray="3 3"/>
    <line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="#CBD5E1"/>
    <text x="${chartLeft - 5}" y="${chartTop + 3}" text-anchor="end" font-size="8" fill="#64748B">${escHtml(formatCompactNumber(maxVal))}</text>
    <text x="${chartLeft - 5}" y="${chartBottom}" text-anchor="end" font-size="8" fill="#64748B">${escHtml(formatCompactNumber(minVal))}</text>
    <polygon points="${areaPts}" fill="url(#pdfBalGrad)"/>
    <polyline fill="none" stroke="#10B981" stroke-width="2.4" points="${linePts}"/>
    ${dotsAndLabels}
    <text x="${chartRight}" y="12" text-anchor="end" font-size="8.5" font-weight="800" fill="#10B981">Atual: ${escHtml(formatCurrency(summary.currentBalance, currency))}</text>
  </svg>`;
}
