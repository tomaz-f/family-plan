import React, { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import {
  formatCompactNumber,
  formatCurrency,
  formatMonthLabel,
} from '../../utils/format';
import { FutureCommitmentsForecastProps } from './reportsTypes';
import { useFutureCommitmentsData } from './useFutureCommitmentsData';

/**
 * Previsão de Compromissos Futuros (Future Commitments Forecast)
 * Projects strictly contracted financial obligations across the next 6 rolling months
 * (Credit Card Invoices + Non-Card Account Installments + Fixed Recurring Expenses).
 */
export const FutureCommitmentsForecast: React.FC<FutureCommitmentsForecastProps> = ({
  selectedMonth,
  currency,
  language,
  theme = 'oled',
  creditCards = [],
  transactions,
  recurringTemplates = [],
}) => {
  const isOled = theme === 'oled';
  const [monthSelection, setMonthSelection] = useState<{ base: string; active: string }>({
    base: selectedMonth,
    active: selectedMonth,
  });
  const activeMonth =
    monthSelection.base === selectedMonth ? monthSelection.active : selectedMonth;
  const setActiveMonth = (month: string) =>
    setMonthSelection({ base: selectedMonth, active: month });

  const { projections, maxVal, avgMonthly, activeData } = useFutureCommitmentsData({
    selectedMonth,
    activeMonth,
    creditCards,
    transactions,
    recurringTemplates,
    language,
  });

  const gridLineClass = `border-b border-dashed ${isOled ? 'border-[#21262D]' : 'border-slate-200'}`;
  const pillBaseClass = `flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
    isOled
      ? 'bg-[#0D1117] text-slate-300 border-[#21262D]'
      : 'bg-white text-slate-700 border-slate-200/80'
  } dark:bg-[#0D1117] dark:text-slate-300 dark:border-[#21262D]`;

  return (
    <section
      className={`rounded-2xl border p-5 transition-colors ${
        isOled
          ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]'
          : 'bg-white border-[#E2E8F0] text-slate-900 shadow-xs'
      }`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isOled ? 'bg-[#161B22] text-slate-300' : 'bg-slate-100 text-slate-700'
            } dark:bg-[#161B22] dark:text-slate-300`}
          >
            <TrendingUp size={18} />
          </div>
          <div className="min-w-0">
            <h2
              className={`text-base font-bold tracking-tight truncate ${
                isOled ? 'text-white' : 'text-slate-900'
              } dark:text-white`}
            >
              {language === 'pt-BR' ? 'Compromissos Futuros' : 'Future Commitments'}
            </h2>
            <p
              className={`text-xs mt-0.5 truncate ${
                isOled ? 'text-slate-400' : 'text-slate-500'
              } dark:text-slate-400`}
            >
              {language === 'pt-BR'
                ? 'Próximos 6 meses contratados'
                : 'Next 6 contracted months'}
            </p>
          </div>
        </div>

        {/* Right metric pill: Monthly Average */}
        <div
          className={`px-2.5 py-1 rounded-full text-xs font-medium border shrink-0 ${
            isOled
              ? 'bg-[#161B22] text-slate-400 border-[#21262D]'
              : 'bg-slate-100 text-slate-600 border-slate-200/60'
          } dark:bg-[#161B22] dark:text-slate-400 dark:border-[#21262D]`}
        >
          {language === 'pt-BR'
            ? `Média: ${formatCurrency(avgMonthly, currency)}/mês`
            : `Avg: ${formatCurrency(avgMonthly, currency)}/mo`}
        </div>
      </div>

      {/* Vertical Stacked Bar Chart */}
      <div className="relative pt-6 pb-2">
        <div className="absolute inset-x-0 top-6 bottom-10 flex flex-col justify-between pointer-events-none opacity-40">
          <div className={gridLineClass} />
          <div className={gridLineClass} />
          <div className={gridLineClass} />
        </div>

        <div className="grid grid-cols-6 gap-1.5 sm:gap-2.5 items-end relative z-10">
          {projections.map((p) => {
            const isSelected = p.month === activeMonth;
            const barHeightPct =
              maxVal > 0 && p.totalCommitment > 0
                ? Math.max(10, Math.round((p.totalCommitment / maxVal) * 100))
                : 0;
            const invPct = p.totalCommitment > 0 ? (p.invoicesAmount / p.totalCommitment) * 100 : 0;
            const instPct =
              p.totalCommitment > 0 ? (p.installmentsAmount / p.totalCommitment) * 100 : 0;
            const recPct = p.totalCommitment > 0 ? (p.recurringAmount / p.totalCommitment) * 100 : 0;

            return (
              <button
                key={p.month}
                type="button"
                onClick={() => setActiveMonth(p.month)}
                className={`group flex flex-col items-center justify-end w-full focus:outline-none transition-all ${
                  isSelected ? 'scale-[1.02]' : 'hover:opacity-90'
                }`}
              >
                <span
                  className={`text-[10px] sm:text-[11px] font-extrabold mb-1.5 transition-colors truncate max-w-full ${
                    isSelected
                      ? isOled
                        ? 'text-[#F8FAFC]'
                        : 'text-slate-900'
                      : isOled
                      ? 'text-[#94A3B8]'
                      : 'text-slate-500'
                  }`}
                >
                  {formatCompactNumber(p.totalCommitment)}
                </span>

                <div
                  className={`w-full max-w-[42px] h-28 rounded-xl flex flex-col justify-end p-1 transition-all ${
                    isOled ? 'bg-[#161B22]' : 'bg-slate-100'
                  } ${isSelected ? 'ring-2 ring-[#6E5440] shadow-sm' : ''}`}
                >
                  {p.totalCommitment > 0 ? (
                    <div
                      style={{ height: `${barHeightPct}%` }}
                      className="w-full rounded-lg overflow-hidden flex flex-col justify-end transition-all duration-300"
                    >
                      {p.invoicesAmount > 0 && (
                        <div
                          style={{ height: `${invPct}%` }}
                          className="w-full bg-[#6366F1] transition-all"
                          title={`Faturas: ${formatCurrency(p.invoicesAmount, currency)}`}
                        />
                      )}
                      {p.installmentsAmount > 0 && (
                        <div
                          style={{ height: `${instPct}%` }}
                          className="w-full bg-[#F59E0B] transition-all"
                          title={`Parcelas em Conta: ${formatCurrency(p.installmentsAmount, currency)}`}
                        />
                      )}
                      {p.recurringAmount > 0 && (
                        <div
                          style={{ height: `${recPct}%` }}
                          className="w-full bg-[#6E5440] transition-all"
                          title={`Recorrências: ${formatCurrency(p.recurringAmount, currency)}`}
                        />
                      )}
                    </div>
                  ) : (
                    <div
                      className={`w-full h-1.5 rounded-full ${
                        isOled ? 'bg-[#21262D]' : 'bg-slate-200'
                      }`}
                    />
                  )}
                </div>

                <div className="mt-2 text-center">
                  <span
                    className={`block text-[11px] font-bold uppercase tracking-tight transition-colors ${
                      isSelected
                        ? isOled
                          ? 'text-[#F8FAFC]'
                          : 'text-slate-900'
                        : isOled
                        ? 'text-[#94A3B8]'
                        : 'text-slate-500'
                    }`}
                  >
                    {p.shortMonthLabel}
                  </span>
                  <span
                    className={`block text-[9px] font-medium transition-colors ${
                      isSelected
                        ? isOled
                          ? 'text-[#D0B595]'
                          : 'text-[#6E5440]'
                        : isOled
                        ? 'text-[#94A3B8]/60'
                        : 'text-slate-400'
                    }`}
                  >
                    {p.yearLabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Touch Interaction: Compact Breakdown Mini-Summary on Tap */}
      <div
        className={`mt-4 rounded-xl p-3.5 border transition-all ${
          isOled ? 'bg-[#161B22]/60 border-[#21262D]' : 'bg-slate-50 border-slate-200/80'
        } dark:bg-[#161B22]/60 dark:border-[#21262D]`}
      >
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span
            className={`text-xs font-bold capitalize ${
              isOled ? 'text-white' : 'text-slate-900'
            } dark:text-white`}
          >
            {formatMonthLabel(activeData.month, language)}
          </span>

          <div className="flex items-center gap-1.5">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                isOled ? 'text-slate-500' : 'text-slate-400'
              } dark:text-slate-500`}
            >
              {language === 'pt-BR' ? 'Total Contratado:' : 'Total Committed:'}
            </span>
            <span
              className={`text-sm font-bold ${
                isOled ? 'text-white' : 'text-slate-900'
              } dark:text-white`}
            >
              {formatCurrency(activeData.totalCommitment, currency)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <div className={pillBaseClass}>
            <span className="w-2 h-2 rounded-full bg-[#6366F1] shrink-0" />
            <span className={`text-[11px] font-normal ${isOled ? 'text-slate-400' : 'text-slate-500'}`}>
              {language === 'pt-BR' ? 'Faturas:' : 'Invoices:'}
            </span>
            <span className={`font-semibold text-[11px] ${isOled ? 'text-white' : 'text-slate-900'}`}>
              {formatCurrency(activeData.invoicesAmount, currency)}
            </span>
          </div>

          <div className={pillBaseClass}>
            <span className="w-2 h-2 rounded-full bg-[#F59E0B] shrink-0" />
            <span className={`text-[11px] font-normal ${isOled ? 'text-slate-400' : 'text-slate-500'}`}>
              {language === 'pt-BR' ? 'Parcelas:' : 'Installments:'}
            </span>
            <span className={`font-semibold text-[11px] ${isOled ? 'text-white' : 'text-slate-900'}`}>
              {formatCurrency(activeData.installmentsAmount, currency)}
            </span>
          </div>

          {activeData.recurringAmount > 0 && (
            <div className={pillBaseClass}>
              <span className="w-2 h-2 rounded-full bg-[#6E5440] shrink-0" />
              <span className={`text-[11px] font-normal ${isOled ? 'text-slate-400' : 'text-slate-500'}`}>
                {language === 'pt-BR' ? 'Recorrências:' : 'Recurring:'}
              </span>
              <span className={`font-semibold text-[11px] ${isOled ? 'text-white' : 'text-slate-900'}`}>
                {formatCurrency(activeData.recurringAmount, currency)}
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
