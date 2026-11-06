import { AppLanguage, Category } from '../../types';
import { formatCurrency, formatShortDate } from '../format';
import { getCategoryDisplayName } from '../i18n';
import { ComputedExportData } from './exportTypes';

export const REPORT_HTML_STYLES = `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 portrait; margin: 12mm 12mm 15mm 12mm; }
    body, #prumo-pdf-print-container {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1E293B;
      background: #FFFFFF;
      font-size: 10px;
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .no-print { display: block; }
    @media print {
      .no-print { display: none !important; }
      body { background: #FFFFFF; }
      .page-break-before { page-break-before: always; break-before: page; }
      .avoid-break { page-break-inside: avoid; break-inside: avoid; }
      thead { display: table-header-group; }
      tr { page-break-inside: avoid; break-inside: avoid; }
    }
    .report-container { width: 100%; max-width: 186mm; margin: 0 auto; padding: 10px 0; }

    /* Screen Action Bar */
    .screen-bar {
      position: sticky; top: 0; z-index: 9999;
      background: #0F172A; color: #FFFFFF;
      padding: 10px 18px; display: flex; align-items: center; justify-content: space-between;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 8px; margin-bottom: 16px;
    }
    .screen-bar button {
      cursor: pointer; border: none; border-radius: 6px;
      font-size: 12px; font-weight: 700; padding: 8px 14px; transition: all 0.2s;
    }
    .btn-print { background: #10B981; color: #FFFFFF; }
    .btn-print:hover { background: #059669; }
    .btn-close { background: #334155; color: #E2E8F0; }
    .btn-close:hover { background: #475569; }

    /* Brand Header */
    .brand-header {
      display: flex; justify-content: space-between; align-items: center;
      border-bottom: 2px solid #1E293B; padding-bottom: 10px; margin-bottom: 14px;
    }
    .brand-logo-group { display: flex; align-items: center; gap: 10px; }
    .brand-text h1 { font-size: 20px; font-weight: 900; letter-spacing: 2px; color: #1E293B; line-height: 1; }
    .brand-text span {
      font-size: 7.5px; font-weight: 700; letter-spacing: 1.5px; color: #64748B;
      text-transform: uppercase; display: block; margin-top: 2px;
    }
    .header-meta { text-align: right; }
    .header-meta h2 { font-size: 12px; font-weight: 800; color: #1E293B; text-transform: uppercase; letter-spacing: 0.5px; }
    .header-meta .period-tag { font-size: 10.5px; font-weight: 700; color: #10B981; margin-top: 2px; }
    .header-meta .gen-date { font-size: 7.5px; color: #94A3B8; margin-top: 2px; }

    /* 2x3 KPI Grid */
    .kpi-grid {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
      margin-bottom: 14px; page-break-inside: avoid; break-inside: avoid;
    }
    .kpi-card {
      background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px;
      padding: 7px 9px; position: relative; overflow: hidden;
    }
    .kpi-stripe { position: absolute; left: 0; top: 0; bottom: 0; width: 3.5px; }
    .kpi-label {
      font-size: 7px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.5px; color: #64748B; margin-bottom: 3px; padding-left: 2px;
    }
    .kpi-value { font-size: 12.5px; font-weight: 800; color: #0F172A; line-height: 1.2; padding-left: 2px; }
    .kpi-sub { font-size: 7px; font-weight: 500; color: #64748B; margin-top: 2.5px; padding-left: 2px; }

    /* Charts Row */
    .charts-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 10px;
      margin-bottom: 14px; page-break-inside: avoid; break-inside: avoid;
    }
    .chart-box {
      background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 6px;
      padding: 8px; page-break-inside: avoid; break-inside: avoid;
    }
    .chart-box-title {
      font-size: 8px; font-weight: 800; color: #1E293B; text-transform: uppercase;
      letter-spacing: 0.5px; margin-bottom: 6px; border-bottom: 1px solid #F1F5F9; padding-bottom: 3px;
    }

    /* Section Titles & Tables */
    .section-title {
      font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;
      color: #1E293B; margin-top: 12px; margin-bottom: 5px; display: flex; align-items: center; gap: 6px;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; break-inside: avoid; }
    th {
      background: #1E293B; color: #FFFFFF; font-size: 7.2px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.5px; padding: 4.5px 5px; text-align: left;
    }
    th.text-right, td.text-right { text-align: right; }
    th.text-center, td.text-center { text-align: center; }
    td { padding: 4px 5px; font-size: 7.5px; color: #334155; border-bottom: 1px solid #F1F5F9; }
    tr:nth-child(even) td { background-color: #F8FAFC; }
    .totals-row td {
      background: #F1F5F9 !important; font-weight: 800; color: #0F172A;
      border-top: 1.5px solid #CBD5E1; border-bottom: 2px solid #CBD5E1;
    }

    /* Badges */
    .badge {
      display: inline-flex; align-items: center; padding: 1.5px 4.5px;
      border-radius: 3px; font-size: 6.8px; font-weight: 700;
    }
    .badge-paid { background: rgba(16, 185, 129, 0.12); color: #059669; }
    .badge-pending { background: rgba(245, 158, 11, 0.12); color: #D97706; }
    .badge-invoice { background: rgba(110, 84, 64, 0.12); color: #6E5440; }
    .badge-inst { background: #E2E8F0; color: #475569; }

    /* Page Footer */
    .page-footer {
      display: flex; justify-content: space-between; align-items: center;
      border-top: 1px solid #E2E8F0; padding-top: 5px; margin-top: 10px;
      font-size: 7px; color: #94A3B8;
    }
`;

export function buildExpenseRowsHtml(
  expenseByCategory: ComputedExportData['expenseByCategory'],
  currency: string
): string {
  const fmtMoney = (v: number) => formatCurrency(v, currency);
  return expenseByCategory
    .map(
      (row) => `
      <tr>
        <td>
          <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${row.color}; margin-right:6px; vertical-align:middle;"></span>
          <strong style="color:#0F172A;">${row.name}</strong>
        </td>
        <td class="text-center">${row.count}</td>
        <td class="text-right" style="color:#EF4444; font-weight:700;">${fmtMoney(row.amount)}</td>
        <td class="text-right">
          <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px;">
            <div style="width:40px; height:4px; background:#E2E8F0; border-radius:2px; overflow:hidden;">
              <div style="width:${Math.min(100, Math.max(2, row.share)).toFixed(1)}%; height:100%; background:${row.color};"></div>
            </div>
            <span style="font-weight:700; color:#334155; min-width:35px;">${row.share.toFixed(1)}%</span>
          </div>
        </td>
        <td class="text-right" style="color:#64748B;">${fmtMoney(row.avg)}</td>
      </tr>
    `
    )
    .join('');
}

export function buildLedgerRowsHtml(
  filteredTransactionsAsc: ComputedExportData['filteredTransactionsAsc'],
  categories: Category[],
  language: AppLanguage,
  currency: string
): string {
  const isPt = language === 'pt-BR';
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const fmtMoney = (v: number) => formatCurrency(v, currency);

  return filteredTransactionsAsc
    .map((tx) => {
      const cat = catMap.get(tx.categoryId);
      const catName = getCategoryDisplayName(cat, language) || tx.categoryId;
      const isInc = tx.type === 'income';
      const isUnpaid = tx.status === 'unpaid';

      let tagsStr = '';
      if (tx.settledInvoiceKey || /^fatura\b/i.test(tx.description)) {
        tagsStr += `<span class="badge badge-invoice">${isPt ? 'Fatura Cartão' : 'Card Invoice'}</span> `;
      }
      if (tx.installmentTotal && tx.installmentTotal > 1) {
        tagsStr += `<span class="badge badge-inst">${tx.installmentCurrent || 1}/${tx.installmentTotal}</span> `;
      }
      if (tx.recurringId && !tx.installmentTotal) {
        tagsStr += `<span class="badge badge-inst">${isPt ? 'Fixa' : 'Fixed'}</span> `;
      }

      const statusBadge = isUnpaid
        ? `<span class="badge badge-pending">${isPt ? 'Pendente' : 'Pending'}</span>`
        : `<span class="badge badge-paid">${isPt ? (isInc ? 'Recebido' : 'Pago') : 'Paid'}</span>`;

      return `
        <tr>
          <td style="white-space:nowrap; color:#64748B; font-weight:600;">${formatShortDate(tx.date, language)}</td>
          <td><strong style="color:#0F172A;">${tx.description}</strong></td>
          <td style="color:#475569;">${catName}</td>
          <td>${tagsStr || '<span style="color:#CBD5E1;">—</span>'}</td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-right" style="font-weight:700; color:${isInc ? '#10B981' : '#EF4444'};">
            ${isInc ? '+' : '-'} ${fmtMoney(tx.amount)}
          </td>
          <td class="text-right" style="font-weight:600; color:#334155;">
            ${fmtMoney(tx.runningBalance)}
          </td>
        </tr>
      `;
    })
    .join('');
}
