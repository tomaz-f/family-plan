import { useMemo } from 'react';
import {
  AppLanguage,
  CreditCard,
  RecurringTemplate,
  Transaction,
} from '../../types';
import {
  computeInvoiceDueDate,
  formatShortMonthLabel,
  getInstallmentNumberForMonth,
  shiftMonth,
} from '../../utils/format';
import { MonthCommitmentProjection } from './reportsTypes';
import { getTxInvoiceMonth } from './reportsCalculations';

export function useFutureCommitmentsData(params: {
  selectedMonth: string;
  activeMonth: string;
  creditCards: CreditCard[];
  transactions: Transaction[];
  recurringTemplates: RecurringTemplate[];
  language: AppLanguage;
}) {
  const {
    selectedMonth,
    activeMonth,
    creditCards,
    transactions,
    recurringTemplates,
    language,
  } = params;

  const projectionMonths = useMemo(() => {
    return [0, 1, 2, 3, 4, 5].map((delta) => shiftMonth(selectedMonth, delta));
  }, [selectedMonth]);

  const projections: MonthCommitmentProjection[] = useMemo(() => {
    return projectionMonths.map((targetMonth) => {
      // 1. Credit Card Invoices due in targetMonth
      let invoicesAmount = 0;
      let invoicesCount = 0;
      const processedCycles = new Set<string>();

      if (creditCards && creditCards.length > 0) {
        for (const card of creditCards) {
          const cardTxs = transactions.filter((tx) => tx.cardId === card.id && tx.type === 'expense');
          const cycles = new Set<string>();
          for (const tx of cardTxs) {
            cycles.add(getTxInvoiceMonth(tx, card));
          }
          for (const sTx of transactions) {
            if (sTx.settledInvoiceKey && sTx.settledInvoiceKey.startsWith(`${card.id}__`)) {
              const invMonth = sTx.settledInvoiceKey.split('__')[1];
              if (invMonth) cycles.add(invMonth);
            }
          }

          for (const invMonth of cycles) {
            const cycleKey = `${card.id}__${invMonth}`;
            if (processedCycles.has(cycleKey)) continue;

            const settlementTx = transactions.find((t) => t.settledInvoiceKey === cycleKey);
            const dueDate =
              settlementTx?.date || computeInvoiceDueDate(invMonth, card.closingDay, card.dueDay);
            const dueMonth = dueDate.slice(0, 7);

            if (dueMonth === targetMonth) {
              processedCycles.add(cycleKey);
              const cycleTotal =
                settlementTx && settlementTx.amount > 0
                  ? Number(settlementTx.amount || 0)
                  : cardTxs
                      .filter((tx) => getTxInvoiceMonth(tx, card) === invMonth)
                      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

              if (cycleTotal > 0) {
                invoicesAmount += cycleTotal;
                invoicesCount += 1;
              }
            }
          }
        }
      }

      // 2. Non-Card Account Installments due in targetMonth
      let installmentsAmount = 0;
      let installmentsCount = 0;

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

      for (const [, txList] of groups.entries()) {
        txList.sort((a, b) => (a.installmentCurrent || 1) - (b.installmentCurrent || 1));
        const repTx = txList[0];
        const totalInstallments = Math.max(...txList.map((t) => t.installmentTotal || 0), 2);
        const monthlyAmount = txList.find((t) => t.amount > 0)?.amount || repTx.amount;

        const txInMonth = txList.find((t) => t.date.slice(0, 7) === targetMonth);
        if (txInMonth) {
          if (Number(txInMonth.amount || 0) > 0) {
            installmentsAmount += Number(txInMonth.amount || 0);
            installmentsCount += 1;
          }
        } else {
          const repMonth = repTx.date.slice(0, 7);
          const repCur = repTx.installmentCurrent || 1;
          const seriesStartMonth = shiftMonth(repMonth, -(repCur - 1));
          const instNumForTarget = getInstallmentNumberForMonth(seriesStartMonth, targetMonth);

          if (
            instNumForTarget !== null &&
            instNumForTarget >= 1 &&
            instNumForTarget <= totalInstallments
          ) {
            const existingPaid = txList.find(
              (t) =>
                (t.installmentCurrent === instNumForTarget || t.date.slice(0, 7) === targetMonth) &&
                (t.status || 'paid') === 'paid'
            );
            if (!existingPaid && monthlyAmount > 0) {
              installmentsAmount += monthlyAmount;
              installmentsCount += 1;
            }
          }
        }
      }

      // 3. Fixed Recurring Expenses scheduled for targetMonth
      let recurringAmount = 0;
      let recurringCount = 0;

      if (recurringTemplates && recurringTemplates.length > 0) {
        for (const tpl of recurringTemplates) {
          if (!tpl.active || tpl.type !== 'expense') continue;

          if (tpl.isInstallment && tpl.totalInstallments && tpl.startMonth) {
            const instNum = getInstallmentNumberForMonth(tpl.startMonth, targetMonth);
            if (instNum !== null && instNum >= 1 && instNum <= tpl.totalInstallments) {
              const hasTxInMonth = transactions.some(
                (tx) => tx.recurringId === tpl.id && tx.date.startsWith(targetMonth)
              );
              if (!hasTxInMonth && tpl.amount > 0) {
                recurringAmount += Number(tpl.amount || 0);
                recurringCount += 1;
              }
            }
          } else if (!tpl.isInstallment) {
            const txInMonth = transactions.find(
              (tx) => tx.recurringId === tpl.id && tx.date.startsWith(targetMonth)
            );
            if (txInMonth) {
              if (Number(txInMonth.amount || 0) > 0) {
                recurringAmount += Number(txInMonth.amount || 0);
                recurringCount += 1;
              }
            } else {
              if (Number(tpl.amount || 0) > 0) {
                recurringAmount += Number(tpl.amount || 0);
                recurringCount += 1;
              }
            }
          }
        }
      }

      const invRounded = Number(invoicesAmount.toFixed(2));
      const instRounded = Number(installmentsAmount.toFixed(2));
      const recRounded = Number(recurringAmount.toFixed(2));
      const totalCommitment = Number((invRounded + instRounded + recRounded).toFixed(2));

      const [y] = targetMonth.split('-');
      const shortMonthLabel = formatShortMonthLabel(targetMonth, language).slice(0, 3);
      const yearLabel = `'${y.slice(2)}`;

      return {
        month: targetMonth,
        shortMonthLabel,
        yearLabel,
        invoicesAmount: invRounded,
        installmentsAmount: instRounded,
        recurringAmount: recRounded,
        totalCommitment,
        invoicesCount,
        installmentsCount,
        recurringCount,
      };
    });
  }, [projectionMonths, creditCards, transactions, recurringTemplates, language]);

  const { maxVal, avgMonthly } = useMemo(() => {
    const total = projections.reduce((s, p) => s + p.totalCommitment, 0);
    const max = Math.max(...projections.map((p) => p.totalCommitment), 1);
    const avg = total / 6;
    return {
      maxVal: max,
      avgMonthly: Number(avg.toFixed(2)),
    };
  }, [projections]);

  const activeData = useMemo(() => {
    return (
      projections.find((p) => p.month === activeMonth) ||
      projections[0] || {
        month: selectedMonth,
        shortMonthLabel: '',
        yearLabel: '',
        invoicesAmount: 0,
        installmentsAmount: 0,
        recurringAmount: 0,
        totalCommitment: 0,
        invoicesCount: 0,
        installmentsCount: 0,
        recurringCount: 0,
      }
    );
  }, [projections, activeMonth, selectedMonth]);

  return {
    projections,
    maxVal,
    avgMonthly,
    activeData,
  };
}
