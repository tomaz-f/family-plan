import { AppLanguage, Transaction, Category } from '../types';
import { getCategoryDisplayName } from './i18n';

export const CURRENCIES = [
  { code: 'BRL', symbol: 'R$', label: 'Real Brasileiro (R$)', locale: 'pt-BR' },
  { code: 'USD', symbol: '$', label: 'US Dollar ($)', locale: 'en-US' },
  { code: 'EUR', symbol: '€', label: 'Euro (€)', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', label: 'British Pound (£)', locale: 'en-GB' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar (CA$)', locale: 'en-CA' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar (A$)', locale: 'en-AU' },
  { code: 'MXN', symbol: 'MX$', label: 'Mexican Peso ($)', locale: 'es-MX' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen (¥)', locale: 'ja-JP' },
];

export function formatCurrency(amount: number, currencyCode = 'USD'): string {
  const found = CURRENCIES.find((c) => c.code === currencyCode);
  const locale = found?.locale || 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: currencyCode === 'JPY' ? 0 : 2,
      maximumFractionDigits: currencyCode === 'JPY' ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function formatShortDate(dateStr: string, lang: AppLanguage = 'en'): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const locale = lang === 'pt-BR' ? 'pt-BR' : 'en-US';
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMonthLabel(monthStr: string, lang: AppLanguage = 'en'): string {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-').map(Number);
  if (!y || !m) return monthStr;
  const date = new Date(y, m - 1, 1);
  const locale = lang === 'pt-BR' ? 'pt-BR' : 'en-US';
  const raw = date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatShortMonthLabel(monthStr: string, lang: AppLanguage = 'en'): string {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-').map(Number);
  if (!y || !m) return monthStr;
  const date = new Date(y, m - 1, 1);
  const locale = lang === 'pt-BR' ? 'pt-BR' : 'en-US';
  const raw = date.toLocaleDateString(locale, { month: 'short', year: '2-digit' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function shiftMonth(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function getCurrentMonthStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function getTodayDateStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function formatMonthDay(monthStr: string, day: number): string {
  const [y, m] = monthStr.split('-').map(Number);
  const maxDay = new Date(y, m, 0).getDate() || 28;
  const clamped = Math.min(Math.max(1, day), maxDay);
  return `${monthStr}-${String(clamped).padStart(2, '0')}`;
}

/**
 * Smart Invoice Cycle Assignment:
 * - If purchaseDay < closingDay, assign first installment to purchaseDate's month (YYYY-MM).
 * - If purchaseDay >= closingDay, roll first installment to the subsequent month (shiftMonth(ym, 1)).
 */
export function computeCardFirstInvoiceMonth(
  purchaseDate: string,
  closingDay: number
): { invoiceMonth: string; rolledToNext: boolean } {
  const ym = (purchaseDate || getTodayDateStr()).slice(0, 7);
  const purchaseDay = Number((purchaseDate || '').split('-')[2]) || 1;
  if (purchaseDay < closingDay) {
    return { invoiceMonth: ym, rolledToNext: false };
  }
  return { invoiceMonth: shiftMonth(ym, 1), rolledToNext: true };
}

/**
 * Computes the due date (YYYY-MM-DD) for a credit card invoice cycle.
 * - If dueDay <= closingDay, due date falls into the subsequent month (shiftMonth(invoiceMonth, 1)).
 * - If dueDay > closingDay, due date falls within the same month (invoiceMonth).
 */
export function computeInvoiceDueDate(
  invoiceMonth: string,
  closingDay: number,
  dueDay: number
): string {
  const targetMonth = dueDay <= closingDay ? shiftMonth(invoiceMonth, 1) : invoiceMonth;
  return formatMonthDay(targetMonth, dueDay);
}

export function exportTransactionsToCSV(
  transactions: Transaction[],
  categories: Category[],
  filename = 'family-finance-report.csv',
  lang: AppLanguage = 'en'
) {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const headers =
    lang === 'pt-BR'
      ? ['Data', 'Tipo', 'Categoria', 'Descrição', 'Valor', 'Valor com Sinal', 'Observações']
      : ['Date', 'Type', 'Category', 'Description', 'Amount', 'Signed Amount', 'Notes'];

  const rows = transactions.map((tx) => {
    const cat = catMap.get(tx.categoryId);
    const categoryName = getCategoryDisplayName(cat, lang) || tx.categoryId;
    const signed = tx.type === 'income' ? tx.amount : -tx.amount;
    const escapeCsv = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;
    const typeLabel =
      lang === 'pt-BR'
        ? tx.type === 'income'
          ? 'Entrada'
          : 'Despesa'
        : tx.type === 'income'
        ? 'Input (Income)'
        : 'Expense';
    return [
      tx.date,
      typeLabel,
      escapeCsv(categoryName),
      escapeCsv(tx.description),
      tx.amount.toFixed(2),
      signed.toFixed(2),
      escapeCsv(tx.notes || ''),
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
