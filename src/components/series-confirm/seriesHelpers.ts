import { AppLanguage, Transaction } from '../../types';
import { TRANSLATIONS } from '../../utils/i18n';

export type SeriesScope = 'single' | 'future';

export function isSameSeries(a: Transaction, b: Transaction): boolean {
  if (a.id === b.id) return true;
  if (a.recurringId && b.recurringId) {
    return a.recurringId === b.recurringId;
  }
  if (
    !a.recurringId &&
    !b.recurringId &&
    a.installmentTotal &&
    a.installmentTotal > 1 &&
    b.installmentTotal === a.installmentTotal
  ) {
    return (
      a.categoryId === b.categoryId &&
      a.cardId === b.cardId &&
      a.description.trim().toLowerCase() === b.description.trim().toLowerCase()
    );
  }
  return false;
}

export function isPartOfSeries(tx: Transaction, allTransactions: Transaction[]): boolean {
  if (tx.recurringId) return true;
  if (tx.installmentTotal && tx.installmentTotal > 1) return true;
  return allTransactions.some((other) => other.id !== tx.id && isSameSeries(tx, other));
}

export function getSubsequentPendingSeriesTransactions(
  target: Transaction,
  allTransactions: Transaction[]
): Transaction[] {
  return allTransactions.filter((candidate) => {
    if (candidate.id === target.id) return false;
    if (!isSameSeries(candidate, target)) return false;
    if ((candidate.status || 'paid') !== 'unpaid') return false;

    // For installment purchases, include all unpaid installments of the same purchase
    // that are at or after the current installment number
    if (target.installmentTotal && target.installmentTotal > 1) {
      const curTarget = target.installmentCurrent || 1;
      const curCand = candidate.installmentCurrent || 1;
      return curCand >= curTarget;
    }

    return candidate.date >= target.date;
  });
}

export interface SeriesModalCopy {
  modalTitle: string;
  singleChoiceTitle: string;
  singleChoiceSub: string;
  futureChoiceTitle: string;
  futureChoiceSub: string;
}

export function getSeriesModalCopy(
  mode: 'delete' | 'edit',
  isInstallment: boolean,
  language: AppLanguage,
  subsequentCount: number
): SeriesModalCopy {
  const t = TRANSLATIONS[language];

  const modalTitle = isInstallment
    ? mode === 'delete'
      ? (language === 'pt-BR' ? 'Excluir compra parcelada' : 'Delete installment purchase')
      : (language === 'pt-BR' ? 'Editar compra parcelada' : 'Edit installment purchase')
    : mode === 'delete'
      ? t.seriesDeletePromptTitle
      : t.seriesEditPromptTitle;

  const singleChoiceTitle = isInstallment
    ? mode === 'delete'
      ? (language === 'pt-BR' ? 'Excluir apenas esta parcela' : 'Delete only this installment')
      : (language === 'pt-BR' ? 'Alterar apenas esta parcela' : 'Edit only this installment')
    : mode === 'delete'
      ? t.seriesDeleteOnlyThisBtn
      : t.seriesEditOnlyThisBtn;

  const singleChoiceSub = isInstallment
    ? mode === 'delete'
      ? (language === 'pt-BR'
          ? 'Exclui exclusivamente esta parcela, mantendo as demais da fatura.'
          : 'Deletes only this installment, preserving other installments.')
      : (language === 'pt-BR'
          ? 'Aplica as alterações apenas a esta parcela específica.'
          : 'Applies changes only to this specific installment.')
    : mode === 'delete'
      ? t.seriesDeleteOnlyThisSub
      : t.seriesEditOnlyThisSub;

  const futureChoiceTitle = isInstallment
    ? mode === 'delete'
      ? (language === 'pt-BR' ? 'Excluir todas as parcelas restantes' : 'Delete all remaining installments')
      : (language === 'pt-BR' ? 'Alterar todas as parcelas restantes' : 'Edit all remaining installments')
    : mode === 'delete'
      ? t.seriesDeleteThisAndFutureBtn
      : t.seriesEditThisAndFutureBtn;

  const futureChoiceSub = isInstallment
    ? mode === 'delete'
      ? (language === 'pt-BR'
          ? (subsequentCount > 0
              ? `Exclui esta e mais ${subsequentCount} parcela(s) pendente(s) desta compra.`
              : 'Exclui todas as parcelas pendentes desta compra.')
          : `Deletes this and ${subsequentCount} remaining pending installment(s).`)
      : (language === 'pt-BR'
          ? `Aplica as alterações a esta e às próximas ${subsequentCount} parcelas.`
          : `Applies changes to this and next ${subsequentCount} installments.`)
    : mode === 'delete'
      ? t.seriesDeleteThisAndFutureSub(subsequentCount)
      : t.seriesEditThisAndFutureSub(subsequentCount);

  return {
    modalTitle,
    singleChoiceTitle,
    singleChoiceSub,
    futureChoiceTitle,
    futureChoiceSub,
  };
}
