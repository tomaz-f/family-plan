import { RecurringTemplate } from '../../types';
import { shiftMonth } from '../../utils/format';

export interface EvaluatedRecurringTemplate extends RecurringTemplate {
  isApplied: boolean;
  instNum: number | null;
  endMonth: string | null;
  isConcluded: boolean;
  isBeforeStart: boolean;
  remaining: number | null;
  isDueInSelectedMonth: boolean;
}

export function getInstallmentNumberForMonth(
  startMonth?: string | null,
  targetMonth?: string
): number | null {
  if (!startMonth || !targetMonth) return null;
  const [sy, sm] = startMonth.split('-').map(Number);
  const [ty, tm] = targetMonth.split('-').map(Number);
  if (!sy || !sm || !ty || !tm) return null;
  return (ty - sy) * 12 + (tm - sm) + 1;
}

export function evaluateRecurringTemplates(
  recurringTemplates: RecurringTemplate[],
  appliedInSelectedMonth: Set<string>,
  selectedMonth: string
): EvaluatedRecurringTemplate[] {
  return recurringTemplates.map((tpl) => {
    const isApplied = appliedInSelectedMonth.has(tpl.id);
    if (tpl.isInstallment && tpl.totalInstallments && tpl.startMonth) {
      const instNum = getInstallmentNumberForMonth(tpl.startMonth, selectedMonth) || 1;
      const endMonth = shiftMonth(tpl.startMonth, tpl.totalInstallments - 1);
      const isConcluded = instNum > tpl.totalInstallments;
      const isBeforeStart = instNum < 1;
      const remaining = Math.max(0, tpl.totalInstallments - instNum);
      return {
        ...tpl,
        isApplied,
        instNum,
        endMonth,
        isConcluded,
        isBeforeStart,
        remaining,
        isDueInSelectedMonth: tpl.active && !isConcluded && !isBeforeStart,
      };
    }
    return {
      ...tpl,
      isApplied,
      instNum: null,
      endMonth: null,
      isConcluded: false,
      isBeforeStart: false,
      remaining: null,
      isDueInSelectedMonth: tpl.active,
    };
  });
}
