import { formatCurrency } from '../format';

/**
 * 4. Chart 3: Realized vs. Pending Commitments (Grouped Bar Chart)
 */
export function generateCommitmentsComparisonSvg(
  realizedIncome: number,
  pendingIncome: number,
  realizedExpense: number,
  pendingExpense: number,
  currency: string,
  isPt: boolean
): string {
  const totalInc = realizedIncome + pendingIncome;
  const totalExp = realizedExpense + pendingExpense;
  const maxVal = Math.max(totalInc, totalExp, 100);

  const barMaxW = 190;
  const incRealW = maxVal > 0 ? (realizedIncome / maxVal) * barMaxW : 0;
  const incPendW = maxVal > 0 ? (pendingIncome / maxVal) * barMaxW : 0;
  const expRealW = maxVal > 0 ? (realizedExpense / maxVal) * barMaxW : 0;
  const expPendW = maxVal > 0 ? (pendingExpense / maxVal) * barMaxW : 0;

  return `
    <svg viewBox="0 0 380 160" width="100%" height="160" xmlns="http://www.w3.org/2000/svg" style="display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <!-- Cluster 1: ENTRADAS -->
      <text x="15" y="20" font-size="9" font-weight="700" fill="#0F172A" letter-spacing="0.5">
        ${isPt ? 'RECEITAS TOTAIS' : 'TOTAL INFLOWS'}: ${formatCurrency(totalInc, currency)}
      </text>

      <!-- Realizadas -->
      <text x="85" y="42" text-anchor="end" font-size="7.5" font-weight="600" fill="#10B981">${isPt ? 'Realizadas' : 'Settled'}</text>
      <rect x="95" y="32" width="${barMaxW}" height="13" fill="#F1F5F9" rx="3" />
      <rect x="95" y="32" width="${Math.max(1, incRealW).toFixed(1)}" height="13" fill="#10B981" rx="3" />
      <text x="${(105 + incRealW).toFixed(1)}" y="42" font-size="7.5" font-weight="700" fill="#1E293B">
        ${formatCurrency(realizedIncome, currency)} (${totalInc > 0 ? ((realizedIncome / totalInc) * 100).toFixed(0) : 0}%)
      </text>

      <!-- A Receber -->
      <text x="85" y="62" text-anchor="end" font-size="7.5" font-weight="600" fill="#F59E0B">${isPt ? 'A Receber' : 'Pending'}</text>
      <rect x="95" y="52" width="${barMaxW}" height="13" fill="#F1F5F9" rx="3" />
      <rect x="95" y="52" width="${Math.max(1, incPendW).toFixed(1)}" height="13" fill="#F59E0B" rx="3" />
      <text x="${(105 + incPendW).toFixed(1)}" y="62" font-size="7.5" font-weight="700" fill="#1E293B">
        ${formatCurrency(pendingIncome, currency)} (${totalInc > 0 ? ((pendingIncome / totalInc) * 100).toFixed(0) : 0}%)
      </text>

      <line x1="15" y1="76" x2="365" y2="76" stroke="#E2E8F0" stroke-width="1" />

      <!-- Cluster 2: DESPESAS -->
      <text x="15" y="96" font-size="9" font-weight="700" fill="#0F172A" letter-spacing="0.5">
        ${isPt ? 'OBRIGAÇÕES TOTAIS' : 'TOTAL OBLIGATIONS'}: ${formatCurrency(totalExp, currency)}
      </text>

      <!-- Pagas -->
      <text x="85" y="118" text-anchor="end" font-size="7.5" font-weight="600" fill="#EF4444">${isPt ? 'Pagas' : 'Paid'}</text>
      <rect x="95" y="108" width="${barMaxW}" height="13" fill="#F1F5F9" rx="3" />
      <rect x="95" y="108" width="${Math.max(1, expRealW).toFixed(1)}" height="13" fill="#EF4444" rx="3" />
      <text x="${(105 + expRealW).toFixed(1)}" y="118" font-size="7.5" font-weight="700" fill="#1E293B">
        ${formatCurrency(realizedExpense, currency)} (${totalExp > 0 ? ((realizedExpense / totalExp) * 100).toFixed(0) : 0}%)
      </text>

      <!-- A Pagar -->
      <text x="85" y="138" text-anchor="end" font-size="7.5" font-weight="600" fill="#FB923C">${isPt ? 'A Pagar' : 'Due'}</text>
      <rect x="95" y="128" width="${barMaxW}" height="13" fill="#F1F5F9" rx="3" />
      <rect x="95" y="128" width="${Math.max(1, expPendW).toFixed(1)}" height="13" fill="#FB923C" rx="3" />
      <text x="${(105 + expPendW).toFixed(1)}" y="138" font-size="7.5" font-weight="700" fill="#1E293B">
        ${formatCurrency(pendingExpense, currency)} (${totalExp > 0 ? ((pendingExpense / totalExp) * 100).toFixed(0) : 0}%)
      </text>
    </svg>
  `;
}

/**
 * 5. Chart 4: Payment Channel Distribution (Cartão vs Conta Bancária / Dinheiro)
 */
export function generatePaymentChannelsSvg(
  cardAmount: number,
  cardCount: number,
  bankAmount: number,
  bankCount: number,
  currency: string,
  isPt: boolean
): string {
  const total = cardAmount + bankAmount;
  const cardShare = total > 0 ? (cardAmount / total) * 100 : 0;
  const bankShare = total > 0 ? (bankAmount / total) * 100 : 0;

  const cx = 85;
  const cy = 80;
  const outerR = 60;
  const innerR = 38;

  let paths: string;
  if (total <= 0) {
    paths = `<circle cx="${cx}" cy="${cy}" r="${(outerR + innerR) / 2}" fill="none" stroke="#E2E8F0" stroke-width="${outerR - innerR}" />`;
  } else if (cardAmount <= 0) {
    paths = `<circle cx="${cx}" cy="${cy}" r="${(outerR + innerR) / 2}" fill="none" stroke="#0284C7" stroke-width="${outerR - innerR}" />`;
  } else if (bankAmount <= 0) {
    paths = `<circle cx="${cx}" cy="${cy}" r="${(outerR + innerR) / 2}" fill="none" stroke="#6E5440" stroke-width="${outerR - innerR}" />`;
  } else {
    const cardAngle = (cardAmount / total) * Math.PI * 2;
    const startA = -Math.PI / 2;
    const endA = startA + cardAngle;

    const x1 = cx + outerR * Math.cos(startA);
    const y1 = cy + outerR * Math.sin(startA);
    const x2 = cx + outerR * Math.cos(endA);
    const y2 = cy + outerR * Math.sin(endA);
    const x3 = cx + innerR * Math.cos(endA);
    const y3 = cy + innerR * Math.sin(endA);
    const x4 = cx + innerR * Math.cos(startA);
    const y4 = cy + innerR * Math.sin(startA);
    const large1 = cardAngle > Math.PI ? 1 : 0;

    const dCard = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerR} ${outerR} 0 ${large1} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${innerR} ${innerR} 0 ${large1} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;

    const x5 = cx + outerR * Math.cos(startA + Math.PI * 2);
    const y5 = cy + outerR * Math.sin(startA + Math.PI * 2);
    const x6 = cx + innerR * Math.cos(startA + Math.PI * 2);
    const y6 = cy + innerR * Math.sin(startA + Math.PI * 2);
    const bankAngle = Math.PI * 2 - cardAngle;
    const large2 = bankAngle > Math.PI ? 1 : 0;

    const dBank = `M ${x2.toFixed(2)} ${y2.toFixed(2)} A ${outerR} ${outerR} 0 ${large2} 1 ${x5.toFixed(2)} ${y5.toFixed(2)} L ${x6.toFixed(2)} ${y6.toFixed(2)} A ${innerR} ${innerR} 0 ${large2} 0 ${x3.toFixed(2)} ${y3.toFixed(2)} Z`;

    paths = `
      <path d="${dCard}" fill="#6E5440" stroke="#FFFFFF" stroke-width="2" />
      <path d="${dBank}" fill="#0284C7" stroke="#FFFFFF" stroke-width="2" />
    `;
  }

  return `
    <svg viewBox="0 0 380 160" width="100%" height="160" xmlns="http://www.w3.org/2000/svg" style="display: block; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      ${paths}
      <circle cx="${cx}" cy="${cy}" r="${innerR - 1}" fill="#FFFFFF" />
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="7" font-weight="700" fill="#64748B">${isPt ? 'TOTAL' : 'TOTAL'}</text>
      <text x="${cx}" y="${cy + 9}" text-anchor="middle" font-size="9" font-weight="800" fill="#0F172A">${formatCurrency(total, currency)}</text>

      <!-- Details Card 1: Fatura Cartão -->
      <g transform="translate(165, 26)">
        <rect x="0" y="0" width="200" height="44" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" rx="6" />
        <rect x="0" y="0" width="4" height="44" fill="#6E5440" rx="2" />
        <circle cx="16" cy="15" r="5" fill="#6E5440" />
        <text x="28" y="17" font-size="8.5" font-weight="700" fill="#1E293B">${isPt ? 'Fatura Cartão / Cartão de Crédito' : 'Credit Card Charges'}</text>
        <text x="28" y="34" font-size="10.5" font-weight="800" fill="#6E5440">${formatCurrency(cardAmount, currency)}</text>
        <text x="190" y="34" text-anchor="end" font-size="8" font-weight="600" fill="#64748B">${cardShare.toFixed(1)}% (${cardCount} itens)</text>
      </g>

      <!-- Details Card 2: Conta Bancária / Dinheiro -->
      <g transform="translate(165, 88)">
        <rect x="0" y="0" width="200" height="44" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1" rx="6" />
        <rect x="0" y="0" width="4" height="44" fill="#0284C7" rx="2" />
        <circle cx="16" cy="15" r="5" fill="#0284C7" />
        <text x="28" y="17" font-size="8.5" font-weight="700" fill="#1E293B">${isPt ? 'Conta Corrente / Dinheiro / Pix' : 'Direct Account / Cash'}</text>
        <text x="28" y="34" font-size="10.5" font-weight="800" fill="#0284C7">${formatCurrency(bankAmount, currency)}</text>
        <text x="190" y="34" text-anchor="end" font-size="8" font-weight="600" fill="#64748B">${bankShare.toFixed(1)}% (${bankCount} itens)</text>
      </g>
    </svg>
  `;
}
