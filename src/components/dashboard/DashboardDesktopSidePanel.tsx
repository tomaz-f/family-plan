import React, { useMemo } from 'react';
import { CreditCard as CreditCardIcon } from 'lucide-react';
import {
  AppLanguage,
  AppTheme,
  CreditCard,
  RecurringTemplate,
  Transaction,
} from '../../types';
import { formatCurrency, getTodayDateStr } from '../../utils/format';
import { aggregateBudgetRigidity } from '../../utils/reportAggregators';
import { computeCardsMetrics } from '../cards/cardStatementMath';
import { BudgetRigidityChart } from '../reports/BudgetRigidityChart';

export interface DashboardDesktopSidePanelProps {
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  theme: AppTheme;
  creditCards: CreditCard[];
  transactions: Transaction[];
  recurringTemplates: RecurringTemplate[];
  onNavigateTab: (tab: 'dashboard' | 'transactions' | 'cards' | 'fuel' | 'reports') => void;
}

export const DashboardDesktopSidePanel: React.FC<DashboardDesktopSidePanelProps> = React.memo(
  ({
    selectedMonth,
    currency,
    language,
    theme,
    creditCards,
    transactions,
    recurringTemplates,
    onNavigateTab,
  }) => {
    const isPt = language === 'pt-BR';
    const currentMonthStr = getTodayDateStr().slice(0, 7);

    const cardMetrics = useMemo(
      () => computeCardsMetrics(creditCards, transactions, currentMonthStr, selectedMonth),
      [creditCards, transactions, currentMonthStr, selectedMonth]
    );

    const rigiditySummary = useMemo(
      () => aggregateBudgetRigidity(transactions, creditCards, recurringTemplates, selectedMonth),
      [transactions, creditCards, recurringTemplates, selectedMonth]
    );

    return (
      <div className="space-y-4">
        <section
          aria-label={isPt ? 'Faturas dos Cartões' : 'Card Invoices'}
          className="rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#6E5440]/10 dark:bg-[#6E5440]/20 flex items-center justify-center shrink-0">
                <CreditCardIcon
                  size={18}
                  className="text-[#6E5440] dark:text-[#D0B595]"
                  aria-hidden="true"
                />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {isPt ? 'Faturas dos Cartões' : 'Card Invoices'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('cards')}
              style={{ touchAction: 'manipulation' }}
              className="min-h-[40px] px-2.5 py-1 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-slate-50 dark:bg-[#161B22] hover:bg-slate-100 dark:hover:bg-[#21262D] text-xs font-semibold text-[#6E5440] dark:text-[#D0B595] shrink-0 transition-colors cursor-pointer"
            >
              {isPt ? 'Ver cartões' : 'View cards'}
            </button>
          </div>

          {creditCards.length === 0 ? (
            <div className="rounded-xl bg-slate-50 dark:bg-[#161B22] border border-slate-200/70 dark:border-[#21262D] p-3.5 text-center space-y-2.5">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isPt ? 'Nenhum cartão cadastrado ainda.' : 'No credit cards added yet.'}
              </p>
              <button
                type="button"
                onClick={() => onNavigateTab('cards')}
                style={{ touchAction: 'manipulation' }}
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#6E5440] hover:bg-[#7E624B] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {isPt ? 'Cadastrar cartão' : 'Add card'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {cardMetrics.map((m) => {
                const fillColor =
                  m.usedPercentage >= 85
                    ? '#EF4444'
                    : m.usedPercentage >= 60
                    ? '#F59E0B'
                    : m.card.color || '#10B981';

                return (
                  <div key={m.card.id} className="space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: m.card.color || '#6E5440' }}
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                          {m.card.name}
                        </span>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white tabular-nums shrink-0">
                        {formatCurrency(m.selectedCycleTotal, currency)}
                      </span>
                    </div>

                    <div className="h-2 rounded-full bg-slate-100 dark:bg-[#161B22] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${m.usedPercentage}%`,
                          backgroundColor: fillColor,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="truncate">
                        {isPt ? 'Disponível:' : 'Available:'}{' '}
                        <span className="font-semibold tabular-nums">
                          {formatCurrency(m.availableLimit, currency)}
                        </span>
                      </span>
                      <span className="font-semibold tabular-nums shrink-0">
                        {m.usedPercentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <BudgetRigidityChart
          summary={rigiditySummary}
          currency={currency}
          language={language}
          isOled={theme === 'oled'}
          compact
        />
      </div>
    );
  }
);

DashboardDesktopSidePanel.displayName = 'DashboardDesktopSidePanel';
