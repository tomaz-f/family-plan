import React from 'react';
import {
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { AppLanguage } from '../../types';
import { formatCurrency } from '../../utils/format';
import { getAdaptiveMiniCardFontSize } from '../../utils/currencyUtils';

export interface TransactionsHeroSummaryProps {
  language: AppLanguage;
  currency: string;
  effectiveBankBalance: number;
  effectiveStats: {
    income: number;
    expense: number;
    pendingIncome: number;
    pendingExpense: number;
  };
  isBalanceHidden: boolean;
  onOpenBalanceModal?: () => void;
  balanceCard?: React.ReactNode;
  hasMonthStats: boolean;
}

export const TransactionsHeroSummary: React.FC<TransactionsHeroSummaryProps> = ({
  language,
  currency,
  effectiveBankBalance,
  effectiveStats,
  isBalanceHidden,
  onOpenBalanceModal,
  balanceCard,
  hasMonthStats,
}) => {
  const projectedFinal =
    effectiveBankBalance + effectiveStats.pendingIncome - effectiveStats.pendingExpense;

  const formatUnsigned = (val: number): string => formatCurrency(Math.abs(val), currency);

  const saldoDisplay = isBalanceHidden ? 'R$ ••••••' : formatUnsigned(effectiveBankBalance);
  const balancoDisplay = isBalanceHidden ? 'R$ ••••••' : formatUnsigned(projectedFinal);
  const receitasDisplay = isBalanceHidden ? 'R$ ••••••' : formatUnsigned(effectiveStats.income);
  const despesasDisplay = isBalanceHidden ? 'R$ ••••••' : formatUnsigned(effectiveStats.expense);

  return (
    <>
      <div className="w-full flex flex-col gap-2.5 px-0 py-1">
        {/* Responsive 2x2 (Mobile) / 4-Column (Desktop) Mini-Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 lg:gap-4 w-full">
          {/* Mini-Bloco 1 (Row 1, Left) — Saldo */}
          <div
            role={onOpenBalanceModal ? 'button' : undefined}
            tabIndex={onOpenBalanceModal ? 0 : undefined}
            onClick={onOpenBalanceModal}
            onKeyDown={(e) => {
              if (onOpenBalanceModal && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onOpenBalanceModal();
              }
            }}
            title={
              onOpenBalanceModal
                ? language === 'pt-BR'
                  ? 'Ajustar saldo inicial'
                  : 'Adjust initial balance'
                : undefined
            }
            className={`p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] flex items-center gap-2.5 min-h-[82px] shadow-sm transition-colors min-w-0 ${
              onOpenBalanceModal ? 'cursor-pointer hover:bg-slate-50 dark:hover:bg-[#161B22]' : ''
            }`}
          >
            <span className="w-8 h-8 rounded-full bg-blue-500/10 dark:bg-blue-500/15 flex items-center justify-center shrink-0">
              <Wallet size={16} className="text-blue-600 dark:text-blue-400" />
            </span>
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate leading-none mb-1">
                {language === 'pt-BR' ? 'Saldo' : 'Balance'}
              </span>
              <span
                className={`${getAdaptiveMiniCardFontSize(saldoDisplay)} leading-none tracking-tight truncate text-slate-900 dark:text-slate-50`}
              >
                {saldoDisplay}
              </span>
            </div>
          </div>

          {/* Mini-Bloco 2 (Row 1, Right) — Balanço Mensal */}
          <div className="p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] flex items-center gap-2.5 min-h-[82px] shadow-sm transition-colors min-w-0">
            <span className="w-8 h-8 rounded-full bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Scale size={16} />
            </span>
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate leading-none mb-1">
                {language === 'pt-BR' ? 'Balanço Mensal' : 'Monthly Balance'}
              </span>
              <span
                className={`${getAdaptiveMiniCardFontSize(balancoDisplay)} leading-none tracking-tight truncate ${
                  projectedFinal >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-500 dark:text-red-400'
                }`}
              >
                {balancoDisplay}
              </span>
            </div>
          </div>

          {/* Mini-Bloco 3 (Row 2, Left) — Receitas */}
          <div className="p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] flex items-center gap-2.5 min-h-[82px] shadow-sm transition-colors min-w-0">
            <span className="w-8 h-8 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
              <TrendingUp size={16} className="text-[#10B981]" />
            </span>
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate leading-none mb-1">
                {language === 'pt-BR' ? 'Receitas' : 'Income'}
              </span>
              <span
                className={`${getAdaptiveMiniCardFontSize(receitasDisplay)} leading-none tracking-tight truncate text-emerald-600 dark:text-emerald-400`}
              >
                {receitasDisplay}
              </span>
              <span className="text-xs font-extrabold tracking-tight truncate mt-1 leading-none text-emerald-600/90 dark:text-emerald-400/90">
                {isBalanceHidden ? '+R$ ••••' : `+${formatUnsigned(effectiveStats.pendingIncome)}`}
              </span>
            </div>
          </div>

          {/* Mini-Bloco 4 (Row 2, Right) — Despesas */}
          <div className="p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] flex items-center gap-2.5 min-h-[82px] shadow-sm transition-colors min-w-0">
            <span className="w-8 h-8 rounded-full bg-red-500/10 dark:bg-red-500/15 flex items-center justify-center shrink-0">
              <TrendingDown size={16} className="text-[#EF4444]" />
            </span>
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 truncate leading-none mb-1">
                {language === 'pt-BR' ? 'Despesas' : 'Expenses'}
              </span>
              <span
                className={`${getAdaptiveMiniCardFontSize(despesasDisplay)} leading-none tracking-tight truncate text-red-500 dark:text-red-400`}
              >
                {despesasDisplay}
              </span>
              <span className="text-xs font-extrabold tracking-tight truncate mt-1 leading-none text-red-500/90 dark:text-red-400/90">
                {isBalanceHidden ? '-R$ ••••' : `-${formatUnsigned(effectiveStats.pendingExpense)}`}
              </span>
            </div>
          </div>
        </div>
      </div>

      {balanceCard && !hasMonthStats && balanceCard}
    </>
  );
};
