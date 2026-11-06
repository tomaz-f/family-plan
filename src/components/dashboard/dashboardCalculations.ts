import { AppLanguage, Category, CreditCard, Transaction } from '../../types';
import {
  computeCardFirstInvoiceMonth,
  formatShortMonthLabel,
  shiftMonth,
} from '../../utils/format';

export function computeInstallmentCommitment(transactions: Transaction[]): number {
  const groups = new Map<
    string,
    {
      monthlyAmount: number;
      totalInstallments: number;
      paidCount: number;
      unpaidCount: number;
    }
  >();

  const instTransactions = transactions.filter(
    (tx) => tx.type === 'expense' && tx.installmentTotal && tx.installmentTotal > 1
  );

  for (const tx of instTransactions) {
    const groupKey =
      tx.recurringId ||
      `${tx.description.trim().toLowerCase()}__${tx.categoryId}__${tx.installmentTotal}`;
    const existing = groups.get(groupKey);
    const isPaid = (tx.status ?? 'paid') === 'paid';
    const totNum = tx.installmentTotal || 2;

    if (!existing) {
      groups.set(groupKey, {
        monthlyAmount: tx.amount,
        totalInstallments: totNum,
        paidCount: isPaid ? 1 : 0,
        unpaidCount: isPaid ? 0 : 1,
      });
    } else {
      if (isPaid) {
        existing.paidCount += 1;
      } else {
        existing.unpaidCount += 1;
      }
      if (totNum > existing.totalInstallments) {
        existing.totalInstallments = totNum;
      }
    }
  }

  let commitment = 0;
  for (const plan of groups.values()) {
    const remaining =
      plan.unpaidCount > 0
        ? plan.unpaidCount
        : Math.max(0, plan.totalInstallments - plan.paidCount);
    if (remaining > 0) {
      commitment += plan.monthlyAmount;
    }
  }

  return commitment;
}

export function computeOpenInvoicesTotal(
  creditCards: CreditCard[],
  transactions: Transaction[],
  monthTransactions: Transaction[],
  selectedMonth: string,
  categoryMap: Map<string, Category>
): number {
  let total = 0;
  const handledTxIds = new Set<string>();

  if (creditCards && creditCards.length > 0) {
    for (const card of creditCards) {
      const currentSettledKey = `${card.id}__${selectedMonth}`;
      const settlementTx = transactions.find((tx) => tx.settledInvoiceKey === currentSettledKey);
      const isSettled = Boolean(settlementTx && settlementTx.status === 'paid');

      if (!isSettled) {
        if (settlementTx && settlementTx.status === 'unpaid') {
          total += settlementTx.amount;
          handledTxIds.add(settlementTx.id);
        } else {
          const cardTxs = transactions.filter((tx) => tx.cardId === card.id);
          for (const tx of cardTxs) {
            const invMonth =
              tx.invoiceMonth ||
              computeCardFirstInvoiceMonth(tx.purchaseDate || tx.date, card.closingDay)
                .invoiceMonth;
            if (invMonth === selectedMonth) {
              total += tx.amount || 0;
              handledTxIds.add(tx.id);
            }
          }
        }
      }
    }
  }

  for (const tx of monthTransactions) {
    if (handledTxIds.has(tx.id)) continue;
    if (tx.status === 'unpaid' && tx.type === 'expense') {
      const cat = categoryMap.get(tx.categoryId);
      const isCardCat =
        cat &&
        (cat.icon === 'CreditCard' ||
          cat.name.toLowerCase().includes('fatura') ||
          cat.name.toLowerCase().includes('crédito') ||
          cat.name.toLowerCase().includes('credit'));
      const isCardDesc = tx.description.toLowerCase().includes('fatura');
      if (isCardCat || isCardDesc || tx.cardId) {
        total += tx.amount || 0;
      }
    }
  }

  return total;
}

export function computeSixMonthTrend(
  transactions: Transaction[],
  selectedMonth: string,
  language: AppLanguage
) {
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    months.push(shiftMonth(selectedMonth, -i));
  }

  return months.map((m) => {
    let inc = 0;
    let exp = 0;
    for (const tx of transactions) {
      if (tx.status === 'unpaid' || tx.cardId) continue;
      if (tx.date.startsWith(m)) {
        if (tx.type === 'income') inc += tx.amount;
        else exp += tx.amount;
      }
    }
    return {
      month: m,
      label: formatShortMonthLabel(m, language),
      Inputs: Number(inc.toFixed(2)),
      Expenses: Number(exp.toFixed(2)),
      Net: Number((inc - exp).toFixed(2)),
    };
  });
}

export function computeDailyTrendData(selectedMonth: string, monthTransactions: Transaction[]) {
  const [y, m] = selectedMonth.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const dailyMap = new Map<number, { expense: number; income: number }>();

  for (let d = 1; d <= daysInMonth; d++) {
    dailyMap.set(d, { expense: 0, income: 0 });
  }

  for (const tx of monthTransactions) {
    if (tx.status === 'unpaid' || tx.cardId) continue;
    const day = Number(tx.date.split('-')[2]);
    const entry = dailyMap.get(day);
    if (entry) {
      if (tx.type === 'expense') entry.expense += tx.amount;
      else entry.income += tx.amount;
    }
  }

  let cumulativeExpense = 0;
  const result = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const entry = dailyMap.get(d)!;
    cumulativeExpense += entry.expense;
    result.push({
      day: String(d).padStart(2, '0'),
      DailyExpense: Number(entry.expense.toFixed(2)),
      CumulativeExpense: Number(cumulativeExpense.toFixed(2)),
    });
  }
  return result;
}
