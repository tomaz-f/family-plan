import React, { useMemo } from 'react';
import { CalendarClock } from 'lucide-react';
import { formatCurrency } from '../../utils/format';
import { CategoryIcon } from '../CategoryIcon';
import { InstallmentExpenseTrackerProps } from './reportsTypes';
import {
  buildAmortizationTimeline,
  useInstallmentPlans,
} from './useInstallmentPlans';
import { InstallmentAmortizationChart } from './InstallmentAmortizationChart';

export const InstallmentExpenseTracker: React.FC<InstallmentExpenseTrackerProps> = ({
  transactions,
  categories,
  currency,
  language,
  selectedMonth = new Date().toISOString().slice(0, 7),
  theme = 'oled',
}) => {
  const isOled = theme === 'oled';
  const { installmentPlans, installmentSummary } = useInstallmentPlans(
    transactions,
    categories,
    language,
    selectedMonth
  );

  const amortizationTimeline = useMemo(
    () =>
      buildAmortizationTimeline(
        installmentPlans,
        installmentSummary.totalRemainingDebt,
        selectedMonth,
        language
      ),
    [installmentPlans, installmentSummary.totalRemainingDebt, selectedMonth, language]
  );

  return (
    <section
      className={`rounded-2xl border p-5 transition-colors ${
        isOled
          ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
          : 'bg-white border-[#E2E8F0] text-slate-900 shadow-xs'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isOled
                ? 'bg-[#161B22] text-slate-300'
                : 'bg-slate-100 text-slate-700'
            } dark:bg-[#161B22] dark:text-slate-300`}
          >
            <CalendarClock size={18} />
          </div>
          <div className="min-w-0">
            <h2
              className={`text-base font-bold tracking-tight truncate ${
                isOled ? 'text-white' : 'text-slate-900'
              } dark:text-white`}
            >
              {language === 'pt-BR' ? 'Parcelamentos em Conta' : 'Account Installments'}
            </h2>
            <p
              className={`text-xs mt-0.5 truncate ${
                isOled ? 'text-slate-400' : 'text-slate-500'
              } dark:text-slate-400`}
            >
              {language === 'pt-BR'
                ? 'Boletos, carnês e parcelamentos sem cartão'
                : 'Bills, payment books and non-card installments'}
            </p>
          </div>
        </div>

        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${
            isOled
              ? 'bg-[#161B22] text-slate-400 border-[#21262D]'
              : 'bg-slate-100 text-slate-600 border-slate-200/60'
          } dark:bg-[#161B22] dark:text-slate-400 dark:border-[#21262D]`}
        >
          {installmentSummary.activeCount}{' '}
          {language === 'pt-BR'
            ? installmentSummary.activeCount === 1
              ? 'ativa'
              : 'ativas'
            : installmentSummary.activeCount === 1
            ? 'active'
            : 'active'}
        </span>
      </div>

      {/* Top Metric Row (KPI Container) */}
      <div
        className={`grid grid-cols-2 gap-3 rounded-xl p-3.5 mb-4 border ${
          isOled
            ? 'bg-[#161B22]/60 border-[#21262D]'
            : 'bg-slate-50 border-slate-200/80'
        } dark:bg-[#161B22]/60 dark:border-[#21262D]`}
      >
        <div>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider block truncate ${
              isOled ? 'text-slate-500' : 'text-slate-400'
            } dark:text-slate-500`}
          >
            {language === 'pt-BR' ? 'Comprometido no Mês' : 'Committed This Month'}
          </span>
          <p className="text-sm font-bold text-[#EF4444] mt-0.5 tracking-tight truncate">
            -{formatCurrency(installmentSummary.monthlyCommitment, currency)}
          </p>
        </div>

        <div>
          <span
            className={`text-[10px] font-semibold uppercase tracking-wider block truncate ${
              isOled ? 'text-slate-500' : 'text-slate-400'
            } dark:text-slate-500`}
          >
            {language === 'pt-BR' ? 'Total Restante' : 'Total Remaining'}
          </span>
          <p
            className={`text-sm font-bold mt-0.5 tracking-tight truncate ${
              isOled ? 'text-white' : 'text-slate-900'
            } dark:text-white`}
          >
            {formatCurrency(installmentSummary.totalRemainingDebt, currency)}
          </p>
        </div>
      </div>

      {/* X/Y Amortization Chart & Tap-to-Inspect Interactive Breakdown */}
      <InstallmentAmortizationChart
        amortizationTimeline={amortizationTimeline}
        selectedMonth={selectedMonth}
        currency={currency}
        language={language}
        isOled={isOled}
      />

      {/* Individual Installment Rows */}
      {installmentPlans.length === 0 ? (
        <div
          className={`py-6 px-4 rounded-xl border text-center space-y-1 ${
            isOled ? 'bg-[#161B22]/40 border-[#21262D]' : 'bg-slate-50 border-slate-200/80'
          } dark:bg-[#161B22]/40 dark:border-[#21262D]`}
        >
          <p className={`text-xs font-semibold ${isOled ? 'text-white' : 'text-slate-900'} dark:text-white`}>
            {language === 'pt-BR'
              ? 'Nenhum parcelamento ativo em conta'
              : 'No active bank installment plans'}
          </p>
          <p className={`text-[11px] max-w-xs mx-auto ${isOled ? 'text-slate-400' : 'text-slate-500'} dark:text-slate-400`}>
            {language === 'pt-BR'
              ? 'Despesas parceladas no Pix, Boleto ou Conta Corrente aparecerão aqui.'
              : 'Expenses split into installments paid via Bank, Pix or Cash will be tracked here.'}
          </p>
        </div>
      ) : (
        <div>
          {installmentPlans.map((plan) => {
            const fillPct =
              plan.totalInstallments > 0
                ? Math.min(100, Math.max(0, (plan.currentInstallmentDisplay / plan.totalInstallments) * 100))
                : 0;

            return (
              <div
                key={plan.key}
                className={`rounded-xl p-3 mb-2 last:mb-0 border transition-colors ${
                  isOled
                    ? 'bg-[#161B22]/40 border-[#21262D]'
                    : 'bg-slate-50/70 border-slate-200/60'
                } dark:bg-[#161B22]/40 dark:border-[#21262D]`}
              >
                {/* Main info row */}
                <div className="flex items-center justify-between gap-2.5">
                  {/* Left Stack */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <CategoryIcon
                        icon={plan.categoryIcon}
                        color={plan.categoryColor}
                        size={14}
                        badgeSize="sm"
                      />
                      <h3
                        className={`font-semibold text-sm truncate ${
                          isOled ? 'text-white' : 'text-slate-900'
                        } dark:text-white`}
                      >
                        {plan.description}
                      </h3>
                    </div>

                    {/* Subtitle metadata */}
                    <div className="flex items-center gap-1.5 flex-wrap mt-1.5 pl-0.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                          isOled
                            ? 'bg-[#0D1117] text-slate-300 border-[#21262D]'
                            : 'bg-white text-slate-700 border-slate-200/80'
                        } dark:bg-[#0D1117] dark:text-slate-300 dark:border-[#21262D]`}
                      >
                        {plan.currentInstallmentDisplay}/{plan.totalInstallments}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                          isOled
                            ? 'bg-[#0D1117] text-slate-300 border-[#21262D]'
                            : 'bg-white text-slate-700 border-slate-200/80'
                        } dark:bg-[#0D1117] dark:text-slate-300 dark:border-[#21262D]`}
                      >
                        {plan.paymentMethod}
                      </span>

                      {plan.categoryName && (
                        <span
                          className={`text-xs truncate max-w-[100px] ${
                            isOled ? 'text-slate-400' : 'text-slate-500'
                          } dark:text-slate-400`}
                        >
                          {plan.categoryName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Stack (Right-aligned) */}
                  <div className="flex flex-col items-end text-right shrink-0">
                    <span className="font-bold text-sm text-[#EF4444] whitespace-nowrap">
                      -{formatCurrency(plan.monthlyAmount, currency)}/mês
                    </span>
                    <span
                      className={`text-xs mt-0.5 whitespace-nowrap ${
                        isOled ? 'text-slate-400' : 'text-slate-500'
                      } dark:text-slate-400`}
                    >
                      {formatCurrency(plan.remainingDebtAmount, currency)} rest. •{' '}
                      {plan.remainingInstallments}{' '}
                      {language === 'pt-BR'
                        ? plan.remainingInstallments === 1
                          ? 'mês'
                          : 'meses'
                        : plan.remainingInstallments === 1
                        ? 'mo'
                        : 'mos'}
                    </span>
                  </div>
                </div>

                {/* Emerald Green (#10B981) Installment Progress Bar */}
                <div
                  className={`h-1 w-full rounded-full overflow-hidden mt-2.5 ${
                    isOled ? 'bg-[#21262D]' : 'bg-slate-200'
                  } dark:bg-[#21262D]`}
                >
                  <div
                    className="h-full rounded-full bg-[#10B981] transition-all duration-300 ease-out"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
