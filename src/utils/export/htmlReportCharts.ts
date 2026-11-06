import { formatCurrency } from '../format';
import { ComputedExportData } from './exportTypes';

export {
  generateCommitmentsComparisonSvg,
  generatePaymentChannelsSvg,
} from './htmlReportSecondaryCharts';

/**
 * 1. Official Prumo Vector Plumb-Bob Logo SVG
 */
export function generatePrumoLogoSvg(): string {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="6 -2 20 37" width="26" height="36" style="overflow: visible; display: inline-block; vertical-align: middle;">
      <defs>
        <linearGradient id="prumoIronLight" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#7E624B" />
          <stop offset="45%" stop-color="#9C7F6A" />
          <stop offset="85%" stop-color="#6E5440" />
          <stop offset="100%" stop-color="#4A3728" />
        </linearGradient>
        <linearGradient id="prumoIronDark" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#3D2B1E" />
          <stop offset="50%" stop-color="#24170E" />
          <stop offset="100%" stop-color="#0F0A06" />
        </linearGradient>
        <linearGradient id="prumoRope" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#D0B595" />
          <stop offset="50%" stop-color="#E7CDAC" />
          <stop offset="100%" stop-color="#A68969" />
        </linearGradient>
      </defs>
      <g>
        <line x1="16" y1="-8" x2="16" y2="8" stroke="url(#prumoRope)" stroke-width="2.2" stroke-linecap="round" />
        <line x1="15" y1="-1" x2="17" y2="0" stroke="#846B4E" stroke-width="0.7" stroke-linecap="round" />
        <line x1="15" y1="2.5" x2="17" y2="3.5" stroke="#846B4E" stroke-width="0.7" stroke-linecap="round" />
        <ellipse cx="16" cy="7.8" rx="2.5" ry="1.9" fill="#8C7051" />
        <path d="M 14.2 7 C 14.6 8.8 17.4 8.8 17.8 7 Z" fill="#D0B595" />
        <circle cx="15.5" cy="7.9" r="0.8" fill="#5E4730" />
        <circle cx="16" cy="12" r="3.4" fill="none" stroke="url(#prumoIronLight)" stroke-width="1.9" />
        <ellipse cx="16" cy="15.6" rx="3.2" ry="1.1" fill="url(#prumoIronLight)" />
        <ellipse cx="16" cy="16.4" rx="2.4" ry="0.8" fill="url(#prumoIronDark)" />
        <path d="M 16 16.4 L 8 19.2 L 16 19.2 Z" fill="url(#prumoIronLight)" />
        <path d="M 16 16.4 L 16 19.2 L 24 19.2 Z" fill="url(#prumoIronDark)" />
        <path d="M 8 19.2 L 16 33.2 L 16 19.2 Z" fill="url(#prumoIronLight)" />
        <path d="M 16 19.2 L 16 33.2 L 24 19.2 Z" fill="url(#prumoIronDark)" />
        <circle cx="16" cy="33.2" r="0.75" fill="#FFFDF5" opacity="0.9" />
      </g>
    </svg>
  `;
}

/**
 * 2. Chart 1: Expenses by Category (Inline SVG Donut Chart with Center Label & Legend)
 */
export function generateCategoryDonutSvg(
  items: ComputedExportData['expenseByCategory'],
  totalExpense: number,
  currency: string,
  isPt: boolean
): string {
  if (items.length === 0 || totalExpense <= 0) {
    return `
      <svg viewBox="0 0 380 180" width="100%" height="180" xmlns="http://www.w3.org/2000/svg" style="display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <circle cx="190" cy="80" r="50" fill="none" stroke="#E2E8F0" stroke-width="20" />
        <text x="190" y="85" text-anchor="middle" font-size="10" font-weight="600" fill="#94A3B8">
          ${isPt ? 'Sem despesas registradas no período' : 'No expenses recorded in period'}
        </text>
      </svg>
    `;
  }

  const cx = 95;
  const cy = 90;
  const outerR = 75;
  const innerR = 48;

  const topItems = items.slice(0, 6);
  const otherAmount = items.slice(6).reduce((acc, i) => acc + i.amount, 0);
  const chartSlices =
    otherAmount > 0
      ? [
          ...topItems,
          {
            id: 'other',
            name: isPt ? 'Outras Categorias' : 'Other Categories',
            color: '#94A3B8',
            count: 0,
            amount: otherAmount,
            avg: 0,
            share: (otherAmount / totalExpense) * 100,
          },
        ]
      : topItems;

  let currentAngle = -Math.PI / 2;
  const paths: string[] = [];

  if (chartSlices.length === 1 || chartSlices[0].amount >= totalExpense) {
    const midR = (outerR + innerR) / 2;
    const strokeW = outerR - innerR;
    paths.push(`
      <circle cx="${cx}" cy="${cy}" r="${midR}" fill="none" stroke="${chartSlices[0].color}" stroke-width="${strokeW}" />
    `);
  } else {
    for (const slice of chartSlices) {
      const sliceAngle = (slice.amount / totalExpense) * Math.PI * 2;
      const endAngle = currentAngle + sliceAngle;

      const x1 = cx + outerR * Math.cos(currentAngle);
      const y1 = cy + outerR * Math.sin(currentAngle);
      const x2 = cx + outerR * Math.cos(endAngle);
      const y2 = cy + outerR * Math.sin(endAngle);
      const x3 = cx + innerR * Math.cos(endAngle);
      const y3 = cy + innerR * Math.sin(endAngle);
      const x4 = cx + innerR * Math.cos(currentAngle);
      const y4 = cy + innerR * Math.sin(currentAngle);

      const largeArc = sliceAngle > Math.PI ? 1 : 0;
      const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;

      paths.push(`
        <path d="${d}" fill="${slice.color}" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round" />
      `);
      currentAngle = endAngle;
    }
  }

  const legendItems = chartSlices
    .map((slice, idx) => {
      const y = 24 + idx * 24;
      const truncatedName = slice.name.length > 17 ? slice.name.slice(0, 16) + '…' : slice.name;
      return `
        <g>
          <circle cx="205" cy="${y}" r="4.5" fill="${slice.color}" />
          <text x="216" y="${y + 3.5}" font-size="8.5" font-weight="600" fill="#1E293B">${truncatedName}</text>
          <text x="375" y="${y + 3.5}" text-anchor="end" font-size="8.5" font-weight="700" fill="#475569">
            ${slice.share.toFixed(1)}% <tspan font-weight="400" fill="#94A3B8">(${formatCurrency(slice.amount, currency)})</tspan>
          </text>
        </g>
      `;
    })
    .join('');

  return `
    <svg viewBox="0 0 380 180" width="100%" height="180" xmlns="http://www.w3.org/2000/svg" style="display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      ${paths.join('')}
      <circle cx="${cx}" cy="${cy}" r="${innerR - 1}" fill="#FFFFFF" />
      <text x="${cx}" y="${cy - 7}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#64748B" letter-spacing="0.5">
        ${isPt ? 'TOTAL GASTO' : 'TOTAL SPENT'}
      </text>
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="11" font-weight="800" fill="#0F172A">
        ${formatCurrency(totalExpense, currency)}
      </text>
      ${legendItems}
    </svg>
  `;
}

/**
 * 3. Chart 2: Daily Cash Flow (Inline SVG Dual-Bar Chart)
 */
export function generateCashFlowSvg(
  dailySeries: ComputedExportData['dailySeries'],
  currency: string,
  isPt: boolean
): string {
  const chartL = 46;
  const chartR = 372;
  const chartT = 24;
  const chartB = 150;
  const chartW = chartR - chartL;
  const chartH = chartB - chartT;

  const maxVal = Math.max(...dailySeries.map((d) => Math.max(d.income, d.expense)), 100);

  const mag = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const niceMax = Math.ceil(maxVal / mag) * mag;

  const gridlines = [0, 0.33, 0.66, 1]
    .map((ratio) => {
      const y = chartB - chartH * ratio;
      const val = niceMax * ratio;
      const valStr = formatCurrency(val, currency).replace(/\s/g, '');
      return `
        <g>
          <line x1="${chartL}" y1="${y.toFixed(1)}" x2="${chartR}" y2="${y.toFixed(1)}" stroke="#E2E8F0" stroke-width="0.8" stroke-dasharray="3,3" />
          <text x="${chartL - 5}" y="${(y + 3).toFixed(1)}" text-anchor="end" font-size="7" font-weight="500" fill="#64748B">${valStr}</text>
        </g>
      `;
    })
    .join('');

  const numDays = Math.max(1, dailySeries.length);
  const slotW = chartW / numDays;
  const barW = Math.max(2, Math.min(5, (slotW - 1.5) / 2));

  const bars = dailySeries
    .map((d, idx) => {
      const xSlot = chartL + idx * slotW;
      const hIn = niceMax > 0 ? (d.income / niceMax) * chartH : 0;
      const yIn = chartB - hIn;
      const hOut = niceMax > 0 ? (d.expense / niceMax) * chartH : 0;
      const yOut = chartB - hOut;

      const dayNum = Number(d.label);
      const showLabel = dayNum === 1 || dayNum % 5 === 0 || idx === numDays - 1;

      return `
        <g>
          ${hIn > 0 ? `<rect x="${xSlot.toFixed(1)}" y="${yIn.toFixed(1)}" width="${barW.toFixed(1)}" height="${hIn.toFixed(1)}" fill="#10B981" rx="1" />` : ''}
          ${hOut > 0 ? `<rect x="${(xSlot + barW + 0.8).toFixed(1)}" y="${yOut.toFixed(1)}" width="${barW.toFixed(1)}" height="${hOut.toFixed(1)}" fill="#EF4444" rx="1" />` : ''}
          ${showLabel ? `<text x="${(xSlot + barW).toFixed(1)}" y="${chartB + 14}" text-anchor="middle" font-size="7" font-weight="600" fill="#64748B">${d.label}</text>` : ''}
        </g>
      `;
    })
    .join('');

  return `
    <svg viewBox="0 0 380 180" width="100%" height="180" xmlns="http://www.w3.org/2000/svg" style="display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Legend at Top -->
      <g transform="translate(240, 12)">
        <rect x="0" y="-7" width="8" height="8" rx="1.5" fill="#10B981" />
        <text x="12" y="0" font-size="8" font-weight="600" fill="#334155">${isPt ? 'Entradas (+)' : 'Inflows'}</text>
        <rect x="75" y="-7" width="8" height="8" rx="1.5" fill="#EF4444" />
        <text x="87" y="0" font-size="8" font-weight="600" fill="#334155">${isPt ? 'Saídas (-)' : 'Outflows'}</text>
      </g>
      ${gridlines}
      ${bars}
      <line x1="${chartL}" y1="${chartB}" x2="${chartR}" y2="${chartB}" stroke="#94A3B8" stroke-width="1" />
    </svg>
  `;
}
