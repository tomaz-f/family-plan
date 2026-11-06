import React from 'react';
import { Layers, Minus, Plus } from 'lucide-react';
import { formatCurrency } from '../../utils/format';

const QUICK_INSTALLMENT_OPTIONS = [2, 3, 4, 5, 6, 10, 12, 18, 24];

interface RecurrenceAndInstallmentSectionProps {
  isOled: boolean;
  isInstallment: boolean;
  onChangeIsInstallment: (value: boolean) => void;
  installmentCount: number;
  onChangeInstallmentCount: React.Dispatch<React.SetStateAction<number>>;
  installmentBreakdown: {
    totalAmount: number;
    count: number;
    firstInstallmentAmount: number;
    regularInstallmentAmount: number;
    formattedEndMonth: string;
  };
  currency: string;
  notes: string;
  onChangeNotes: (value: string) => void;
}

export const RecurrenceAndInstallmentSection: React.FC<RecurrenceAndInstallmentSectionProps> = ({
  isOled,
  isInstallment,
  onChangeIsInstallment,
  installmentCount,
  onChangeInstallmentCount,
  installmentBreakdown,
  currency,
  notes,
  onChangeNotes,
}) => {
  return (
    <>
      {/* 5. Frequência / Parcelamento */}
      <div className="space-y-2.5">
        <label
          className={`block text-xs font-semibold uppercase tracking-wider ${
            isOled ? 'text-[#94A3B8]' : 'text-slate-600'
          }`}
        >
          Parcelamento
        </label>

        {/* Segmented Control: À Vista vs Parcelada */}
        <div
          className={`p-1 rounded-xl border flex gap-1 ${
            isOled ? 'bg-[#161B22] border-[#21262D]' : 'bg-[#F1F5F9] border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => onChangeIsInstallment(false)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${
              !isInstallment
                ? isOled
                  ? 'bg-[#0D1117] text-[#F8FAFC] shadow-xs'
                  : 'bg-white text-slate-900 shadow-xs'
                : isOled
                ? 'text-[#94A3B8] hover:text-[#F8FAFC]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            À Vista (1x)
          </button>
          <button
            type="button"
            onClick={() => onChangeIsInstallment(true)}
            className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 ${
              isInstallment
                ? isOled
                  ? 'bg-[#6E5440] text-[#F8FAFC] shadow-xs'
                  : 'bg-[#6E5440] text-white shadow-xs'
                : isOled
                ? 'text-[#94A3B8] hover:text-[#F8FAFC]'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={13} />
            <span>Parcelada</span>
          </button>
        </div>

        {/* Installment Controls */}
        {isInstallment && (
          <div
            className={`p-3.5 rounded-2xl border space-y-3 ${
              isOled ? 'bg-[#161B22]/50 border-[#21262D]' : 'bg-slate-50 border-slate-200'
            }`}
          >
            {/* Stepper Control */}
            <div className="flex items-center justify-between gap-3">
              <span
                className={`text-xs font-semibold ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-600'
                }`}
              >
                Número de parcelas:
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onChangeInstallmentCount((n) => Math.max(2, n - 1))}
                  disabled={installmentCount <= 2}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all active:scale-90 disabled:opacity-40 ${
                    isOled
                      ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]'
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <Minus size={14} />
                </button>

                <span
                  className={`w-12 text-center text-sm font-black ${
                    isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                  }`}
                >
                  {installmentCount}x
                </span>

                <button
                  type="button"
                  onClick={() => onChangeInstallmentCount((n) => Math.min(24, n + 1))}
                  disabled={installmentCount >= 24}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all active:scale-90 disabled:opacity-40 ${
                    isOled
                      ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]'
                      : 'bg-white border-slate-200 text-slate-800'
                  }`}
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>

            {/* Quick Select Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {QUICK_INSTALLMENT_OPTIONS.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onChangeInstallmentCount(opt)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
                    installmentCount === opt
                      ? isOled
                        ? 'bg-[#6E5440] border-[#6E5440] text-white shadow-2xs'
                        : 'bg-[#6E5440] border-[#6E5440] text-white shadow-2xs'
                      : isOled
                      ? 'bg-[#161B22] border-[#21262D] text-[#94A3B8] hover:border-[#30363D]'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  {opt}x
                </button>
              ))}
            </div>

            {/* Live Calculation Preview Banner */}
            <div
              className={`p-2.5 rounded-xl border flex flex-col gap-0.5 text-xs ${
                isOled
                  ? 'bg-[#0D1117] border-[#21262D] text-[#D0B595]'
                  : 'bg-white border-slate-200 text-[#6E5440]'
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span>
                  {installmentCount}x de{' '}
                  {formatCurrency(installmentBreakdown.regularInstallmentAmount, currency)}
                </span>
                <span>Total: {formatCurrency(installmentBreakdown.totalAmount, currency)}</span>
              </div>
              <span
                className={`text-[10px] ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                }`}
              >
                Última parcela na fatura de {installmentBreakdown.formattedEndMonth}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 6. Observações */}
      <div>
        <label
          className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${
            isOled ? 'text-[#94A3B8]' : 'text-slate-600'
          }`}
        >
          Observações
        </label>
        <input
          type="text"
          placeholder="Observações opcionais..."
          value={notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          className={`w-full h-11 px-3.5 rounded-xl border text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#6E5440] ${
            isOled
              ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]'
              : 'bg-[#F1F5F9] border-slate-200 text-slate-900'
          }`}
        />
      </div>
    </>
  );
};
