import { useMemo } from 'react';
import { AppLanguage, Category, Transaction } from '../../types';
import {
  formatMonthLabel,
  formatShortMonthLabel,
  shiftMonth,
} from '../../utils/format';
import { getCategoryDisplayName } from '../../utils/i18n';
import {
  AmortizationTimelinePoint,
  NonCardInstallmentPlan,
} from './reportsTypes';

/**
 * Installment Expense Tracker hook strictly filtered for NON-credit-card installments.
 * Credit card installments are monitored in the dedicated Credit Cards screen.
 */
export function useInstallmentPlans(
  transactions: Transaction[],
  categories: Category[],
  language: AppLanguage,
  selectedMonth: string = new Date().toISOString().slice(0, 7)
) {
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const installmentPlans = useMemo(() => {
    const nonCardInstTxs = transactions.filter(
      (tx) =>
        tx.type === 'expense' &&
        !tx.cardId &&
        !tx.settledInvoiceKey &&
        Boolean(tx.installmentTotal && tx.installmentTotal > 1)
    );

    const groups = new Map<string, Transaction[]>();
    for (const tx of nonCardInstTxs) {
      const groupKey =
        tx.recurringId ||
        `${tx.description.trim().toLowerCase()}__${tx.categoryId}__${tx.installmentTotal}`;
      const list = groups.get(groupKey) || [];
      list.push(tx);
      groups.set(groupKey, list);
    }

    const plans: NonCardInstallmentPlan[] = [];

    for (const [key, txList] of groups.entries()) {
      txList.sort((a, b) => (a.installmentCurrent || 1) - (b.installmentCurrent || 1));
      const repTx = txList[0];
      const cat = categoryMap.get(repTx.categoryId);

      const totalInstallments = Math.max(
        ...txList.map((t) => t.installmentTotal || 0),
        2
      );

      const monthlyAmount =
        txList.find((t) => t.amount > 0)?.amount || repTx.amount;

      const paidTxs = txList.filter((t) => (t.status ?? 'paid') === 'paid');
      const unpaidTxs = txList.filter((t) => t.status === 'unpaid');

      let paidInstallments: number;
      let remainingInstallments: number;
      let currentInstallmentDisplay: number;
      let remainingDebtAmount: number;

      if (unpaidTxs.length > 0) {
        remainingInstallments = unpaidTxs.length;
        remainingDebtAmount = Number(
          unpaidTxs.reduce((sum, t) => sum + Number(t.amount || 0), 0).toFixed(2)
        );
        const highestPaid =
          paidTxs.length > 0
            ? Math.max(...paidTxs.map((t) => t.installmentCurrent || 1))
            : 0;
        paidInstallments = Math.max(paidTxs.length, totalInstallments - remainingInstallments);

        const txInSelectedMonth = unpaidTxs.find((t) => t.date.slice(0, 7) === selectedMonth);
        if (txInSelectedMonth) {
          currentInstallmentDisplay = txInSelectedMonth.installmentCurrent || (highestPaid + 1);
        } else {
          currentInstallmentDisplay =
            unpaidTxs[0].installmentCurrent || Math.min(totalInstallments, highestPaid + 1);
        }
      } else {
        const highestCur = Math.max(...txList.map((t) => t.installmentCurrent || 1));
        if (repTx.status === 'unpaid') {
          paidInstallments = Math.max(0, highestCur - 1);
          remainingInstallments = Math.max(0, totalInstallments - paidInstallments);
          currentInstallmentDisplay = highestCur;
        } else {
          paidInstallments = Math.max(paidTxs.length, highestCur);
          remainingInstallments = Math.max(0, totalInstallments - paidInstallments);
          currentInstallmentDisplay = Math.min(totalInstallments, paidInstallments);
        }
        remainingDebtAmount = Number((remainingInstallments * monthlyAmount).toFixed(2));
      }

      if (remainingInstallments <= 0 || paidInstallments >= totalInstallments) {
        continue;
      }

      const combined = `${repTx.description} ${repTx.notes || ''}`.toLowerCase();
      let paymentMethod = language === 'pt-BR' ? 'Pix / Boleto' : 'Bank / Cash';
      if (combined.includes('boleto')) paymentMethod = 'Boleto';
      else if (combined.includes('pix')) paymentMethod = 'Pix';
      else if (combined.includes('debito') || combined.includes('débito')) paymentMethod = 'Débito';
      else if (combined.includes('dinheiro')) paymentMethod = 'Dinheiro';
      else if (combined.includes('transferência') || combined.includes('ted')) paymentMethod = 'TED / Pix';

      const totalAmount =
        repTx.totalPurchaseAmount && repTx.totalPurchaseAmount > 0
          ? repTx.totalPurchaseAmount
          : Number((monthlyAmount * totalInstallments).toFixed(2));
      const totalPaidAmount = Number(Math.max(0, totalAmount - remainingDebtAmount).toFixed(2));
      const progressPct =
        totalInstallments > 0 ? (currentInstallmentDisplay / totalInstallments) * 100 : 0;

      const txThisMonth = txList.find((t) => t.date.slice(0, 7) === selectedMonth);
      const isDueInSelectedMonth = Boolean(txThisMonth);
      const selectedMonthAmount = txThisMonth ? txThisMonth.amount : monthlyAmount;
      const installmentSchedule =
        unpaidTxs.length > 0
          ? unpaidTxs.map((t) => Number(Number(t.amount || 0).toFixed(2)))
          : Array.from({ length: remainingInstallments }, () => Number(monthlyAmount.toFixed(2)));

      plans.push({
        key,
        description: repTx.description,
        categoryId: repTx.categoryId,
        categoryName: cat ? getCategoryDisplayName(cat, language) : '',
        categoryColor: cat?.color || '#F97316',
        categoryIcon: cat?.icon || 'Layers',
        monthlyAmount,
        totalInstallments,
        paidInstallments,
        remainingInstallments,
        currentInstallmentDisplay,
        totalAmount,
        totalPaidAmount,
        remainingDebtAmount,
        progressPct,
        paymentMethod,
        isDueInSelectedMonth,
        selectedMonthAmount,
        installmentSchedule,
      });
    }

    return plans.sort((a, b) => b.remainingDebtAmount - a.remainingDebtAmount);
  }, [transactions, categoryMap, language, selectedMonth]);

  const installmentSummary = useMemo(() => {
    const activeCount = installmentPlans.length;
    const monthlyCommitment = installmentPlans.reduce((sum, p) => sum + p.selectedMonthAmount, 0);
    const totalRemainingDebt = installmentPlans.reduce((sum, p) => sum + p.remainingDebtAmount, 0);
    const totalPaid = installmentPlans.reduce((sum, p) => sum + p.totalPaidAmount, 0);

    return {
      activeCount,
      monthlyCommitment: Number(monthlyCommitment.toFixed(2)),
      totalRemainingDebt: Number(totalRemainingDebt.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
    };
  }, [installmentPlans]);

  return { installmentPlans, installmentSummary };
}

export function buildAmortizationTimeline(
  installmentPlans: NonCardInstallmentPlan[],
  totalRemainingDebt: number,
  selectedMonth: string,
  language: AppLanguage
): AmortizationTimelinePoint[] {
  if (installmentPlans.length === 0) return [];

  const maxMonths = Math.max(
    ...installmentPlans.map((p) => p.installmentSchedule.length),
    1
  );

  let runningRemaining = totalRemainingDebt;
  const points: AmortizationTimelinePoint[] = [];

  for (let k = 0; k < maxMonths; k++) {
    const month = shiftMonth(selectedMonth, k);
    let monthlyCommitment = 0;
    let activeCount = 0;

    for (const plan of installmentPlans) {
      const amt = plan.installmentSchedule[k] ?? 0;
      if (amt > 0) {
        monthlyCommitment += amt;
        activeCount += 1;
      }
    }

    monthlyCommitment = Number(monthlyCommitment.toFixed(2));
    runningRemaining =
      k === maxMonths - 1
        ? 0
        : Number(Math.max(0, runningRemaining - monthlyCommitment).toFixed(2));

    const shortRaw = formatShortMonthLabel(month, language).replace('.', '');
    const shortMonthLabel = shortRaw.charAt(0).toUpperCase() + shortRaw.slice(1);
    const yearLabel = `'${month.slice(2, 4)}`;
    const fullMonthRaw = formatMonthLabel(month, language);
    const fullMonthLabel =
      fullMonthRaw.charAt(0).toUpperCase() + fullMonthRaw.slice(1);

    points.push({
      index: k,
      month,
      shortMonthLabel,
      yearLabel,
      fullMonthLabel,
      monthlyCommitment,
      remainingBalance: runningRemaining,
      activeCount,
    });
  }

  return points;
}
