import { AppLanguage, Transaction } from '../../types';
import { formatMonthLabel, formatShortMonthLabel } from '../format';
import { ComputedExportData, ExportPeriodMode } from './exportTypes';

export function cleanPdfText(str: string): string {
  return String(str || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [99, 102, 241];
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return [r, g, b];
}

export function resolvePeriodMetadata(
  periodMode: ExportPeriodMode,
  year: string,
  targetMonthPrefix: string,
  language: AppLanguage
): { periodTitle: string; filenameSlug: string } {
  const isPt = language === 'pt-BR';
  if (periodMode === 'monthly') {
    return {
      periodTitle: formatMonthLabel(targetMonthPrefix, language),
      filenameSlug: `mensal-${targetMonthPrefix}`,
    };
  }
  if (periodMode === 'annual') {
    return {
      periodTitle: isPt ? `Ano Completo de ${year}` : `Full Year ${year}`,
      filenameSlug: `anual-${year}`,
    };
  }
  return {
    periodTitle: isPt ? 'Todo o Histórico Registrado' : 'All Recorded History',
    filenameSlug: 'historico-completo',
  };
}

export function computePeriodNumDays(
  periodMode: ExportPeriodMode,
  year: string,
  month: string,
  inPeriodAllTypes: Transaction[]
): number {
  if (periodMode === 'monthly') {
    const y = Number(year);
    const m = Number(month);
    return new Date(y, m, 0).getDate() || 30;
  }
  if (periodMode === 'annual') {
    return 365;
  }
  if (inPeriodAllTypes.length > 0) {
    const first = inPeriodAllTypes[0].date;
    const last = inPeriodAllTypes[inPeriodAllTypes.length - 1].date;
    const diff = Math.max(1, new Date(last).getTime() - new Date(first).getTime());
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
  }
  return 30;
}

export function buildMonthlyAndDailySeries(
  periodMode: ExportPeriodMode,
  year: string,
  month: string,
  targetMonthPrefix: string,
  openingBalance: number,
  inPeriodAllTypes: Transaction[],
  language: AppLanguage
): {
  monthlySeries: ComputedExportData['monthlySeries'];
  dailySeries: ComputedExportData['dailySeries'];
} {
  const monthsList: string[] = [];
  if (periodMode === 'annual') {
    for (let m = 1; m <= 12; m++) {
      monthsList.push(`${year}-${String(m).padStart(2, '0')}`);
    }
  } else if (periodMode === 'all') {
    const set = new Set<string>();
    for (const tx of inPeriodAllTypes) {
      set.add(tx.date.slice(0, 7));
    }
    monthsList.push(...Array.from(set).sort());
  } else {
    monthsList.push(targetMonthPrefix);
  }

  let runningMonthBal = openingBalance;
  const monthlySeries = monthsList.map((mStr) => {
    let inc = 0;
    let exp = 0;
    let count = 0;
    for (const tx of inPeriodAllTypes) {
      if (tx.date.startsWith(mStr)) {
        count++;
        if (tx.type === 'income') inc += tx.amount;
        else exp += tx.amount;
      }
    }
    runningMonthBal += inc - exp;
    return {
      month: mStr,
      shortLabel: formatShortMonthLabel(mStr, language),
      fullLabel: formatMonthLabel(mStr, language),
      income: inc,
      expense: exp,
      net: inc - exp,
      closingBalance: runningMonthBal,
      count,
    };
  });

  const dailySeries: ComputedExportData['dailySeries'] = [];
  if (periodMode === 'monthly') {
    const y = Number(year);
    const m = Number(month);
    const daysInMonth = new Date(y, m, 0).getDate() || 30;
    let runBal = openingBalance;
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = `${targetMonthPrefix}-${String(d).padStart(2, '0')}`;
      let inc = 0;
      let exp = 0;
      for (const tx of inPeriodAllTypes) {
        if (tx.date === dayStr) {
          if (tx.type === 'income') inc += tx.amount;
          else exp += tx.amount;
        }
      }
      runBal += inc - exp;
      dailySeries.push({
        day: dayStr,
        label: String(d).padStart(2, '0'),
        income: inc,
        expense: exp,
        closingBalance: runBal,
      });
    }
  }

  return { monthlySeries, dailySeries };
}
