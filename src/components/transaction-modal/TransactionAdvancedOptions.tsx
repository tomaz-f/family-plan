import React from 'react';
import { Check, ChevronDown, Layers, Repeat } from 'lucide-react';
import { AppLanguage, CreditCard, TransactionType } from '../../types';
import { TRANSLATIONS } from '../../utils/i18n';
import { RecurrenceMode } from './transactionModalMath';

export interface TransactionAdvancedOptionsProps {
  isOled: boolean;
  language: AppLanguage;
  type: TransactionType;
  isMoreOptionsOpen: boolean;
  setIsMoreOptionsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  recurrenceMode: RecurrenceMode;
  setRecurrenceMode: (mode: RecurrenceMode) => void;
  dueDay: string;
  setDueDay: (val: string) => void;
  setDueDayManuallyEdited: (val: boolean) => void;
  installmentCurrent: string;
  setInstallmentCurrent: (val: string) => void;
  installmentTotal: string;
  setInstallmentTotal: (val: string) => void;
  parsedInstCur: number;
  parsedInstTot: number;
  parsedDueDay: number;
  concludingMonthLabel: string;
  selectedCard: CreditCard | null;
  notes: string;
  setNotes: (val: string) => void;
  t: (typeof TRANSLATIONS)[AppLanguage];
}

export const TransactionAdvancedOptions: React.FC<TransactionAdvancedOptionsProps> = ({
  isOled,
  language,
  type,
  isMoreOptionsOpen,
  setIsMoreOptionsOpen,
  recurrenceMode,
  setRecurrenceMode,
  dueDay,
  setDueDay,
  setDueDayManuallyEdited,
  installmentCurrent,
  setInstallmentCurrent,
  installmentTotal,
  setInstallmentTotal,
  parsedInstCur,
  parsedInstTot,
  parsedDueDay,
  concludingMonthLabel,
  selectedCard,
  notes,
  setNotes,
  t,
}) => {
  return (
    <div className="pt-0.5">
      <button
        type="button"
        onClick={() => setIsMoreOptionsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold transition-colors ${
          isOled ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <span>{language === 'pt-BR' ? 'Mais opções' : 'More options'}</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-200 ${isMoreOptionsOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isMoreOptionsOpen && (
        <div
          className={`mt-2 p-3 rounded-2xl border space-y-3 animate-fadeIn ${
            isOled ? 'bg-[#161B22]/50 border-[#21262D]' : 'bg-slate-50 border-slate-200'
          }`}
        >
          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              {language === 'pt-BR' ? 'Frequência' : 'Frequency'}
            </span>
            <div
              className={`grid grid-cols-3 gap-1 p-1 rounded-xl border ${
                isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => setRecurrenceMode('single')}
                className={`flex items-center justify-center gap-1 h-7 px-2 rounded-lg text-xs font-semibold transition-all ${
                  recurrenceMode === 'single'
                    ? isOled
                      ? 'bg-[#21262D] text-white shadow-2xs'
                      : 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Check size={12} />
                <span>{language === 'pt-BR' ? 'Única' : 'Single'}</span>
              </button>

              <button
                type="button"
                onClick={() => setRecurrenceMode('recurring')}
                className={`flex items-center justify-center gap-1 h-7 px-2 rounded-lg text-xs font-semibold transition-all ${
                  recurrenceMode === 'recurring'
                    ? isOled
                      ? 'bg-[#21262D] text-white shadow-2xs'
                      : 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Repeat size={12} />
                <span>{language === 'pt-BR' ? 'Fixa' : 'Fixed'}</span>
              </button>

              <button
                type="button"
                onClick={() => setRecurrenceMode('installment')}
                className={`flex items-center justify-center gap-1 h-7 px-2 rounded-lg text-xs font-semibold transition-all ${
                  recurrenceMode === 'installment'
                    ? isOled
                      ? 'bg-[#21262D] text-white shadow-2xs'
                      : 'bg-slate-800 text-white shadow-2xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers size={12} />
                <span>{language === 'pt-BR' ? 'Parcelada' : 'Installments'}</span>
              </button>
            </div>

            {recurrenceMode === 'recurring' && (
              <div
                className={`flex items-center justify-between gap-2 mt-2 px-3 py-1.5 rounded-xl border ${
                  isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200'
                }`}
              >
                <label className="text-xs font-medium text-slate-400">
                  {type === 'income' ? t.expectedDayShortLabel : t.dueDayShortLabel}:
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={dueDay}
                  onChange={(e) => {
                    setDueDay(e.target.value);
                    setDueDayManuallyEdited(true);
                  }}
                  className={`w-14 h-7 px-2 rounded-lg border text-center text-xs font-bold ${
                    isOled
                      ? 'bg-[#161B22] border-[#21262D] text-white'
                      : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>
            )}

            {recurrenceMode === 'installment' && (
              <div
                className={`space-y-2 mt-2 p-2.5 rounded-xl border ${
                  isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                  {[2, 3, 4, 6, 10, 12, 18, 24].map((n) => {
                    const active = parsedInstTot === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setInstallmentTotal(String(n))}
                        className={`py-1 px-2.5 rounded-lg text-[11px] font-bold border shrink-0 transition-all ${
                          active
                            ? isOled
                              ? 'bg-[#6E5440] text-white border-[#D0B595]/30'
                              : 'bg-[#6E5440] text-white border-transparent'
                            : isOled
                            ? 'bg-[#161B22] text-slate-400 border-[#21262D]'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {n}x
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                      {t.currentInstLabel}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="240"
                      value={installmentCurrent}
                      onChange={(e) => setInstallmentCurrent(e.target.value)}
                      className={`w-full h-8 px-2 rounded-lg border text-center text-xs font-bold ${
                        isOled
                          ? 'bg-[#161B22] border-[#21262D] text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                      {t.totalInstLabel}
                    </label>
                    <input
                      type="number"
                      min="2"
                      max="240"
                      value={installmentTotal}
                      onChange={(e) => setInstallmentTotal(e.target.value)}
                      className={`w-full h-8 px-2 rounded-lg border text-center text-xs font-bold ${
                        isOled
                          ? 'bg-[#161B22] border-[#21262D] text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                      {type === 'income' ? t.expectedDayShortLabel : t.dueDayShortLabel}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      disabled={Boolean(selectedCard)}
                      value={selectedCard ? selectedCard.dueDay : dueDay}
                      onChange={(e) => {
                        setDueDay(e.target.value);
                        setDueDayManuallyEdited(true);
                      }}
                      className={`w-full h-8 px-2 rounded-lg border text-center text-xs font-bold ${
                        selectedCard
                          ? isOled
                            ? 'bg-[#161B22]/50 border-[#21262D] text-slate-500'
                            : 'bg-slate-100 border-slate-200 text-slate-400'
                          : isOled
                          ? 'bg-[#161B22] border-[#21262D] text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-900'
                      }`}
                    />
                  </div>
                </div>

                <p className="text-[10px] text-slate-400 text-center">
                  {t.installmentHintSummary(
                    parsedInstCur,
                    parsedInstTot,
                    concludingMonthLabel,
                    parsedDueDay
                  )}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
              {language === 'pt-BR' ? 'Observações' : 'Notes'}
            </label>
            <input
              type="text"
              placeholder={t.notesPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`w-full h-9 px-3 rounded-xl border text-xs focus:outline-none transition-colors ${
                isOled
                  ? 'bg-[#0D1117] border-[#21262D] text-white placeholder:text-slate-500'
                  : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
};
