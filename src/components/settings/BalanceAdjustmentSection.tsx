import React, { useState } from 'react';
import { Check, Landmark, SlidersHorizontal } from 'lucide-react';
import { AppLanguage, AppState } from '../../types';
import { formatCurrency } from '../../utils/format';
import { TRANSLATIONS } from '../../utils/i18n';
import { MobileSyncModalProps } from './settingsTypes';

interface BalanceAdjustmentSectionProps {
  state: AppState;
  language: AppLanguage;
  currentBankBalance?: number;
  onUpdateSettings: MobileSyncModalProps['onUpdateSettings'];
}

export const BalanceAdjustmentSection: React.FC<BalanceAdjustmentSectionProps> = ({
  state,
  language,
  currentBankBalance,
  onUpdateSettings,
}) => {
  const t = TRANSLATIONS[language];

  const [balanceMode, setBalanceMode] = useState<'current' | 'initial'>('current');
  const [balanceAmountInput, setBalanceAmountInput] = useState<string>(() => {
    const safeCurrent =
      typeof currentBankBalance === 'number' && !Number.isNaN(currentBankBalance)
        ? currentBankBalance
        : 0;
    return safeCurrent.toFixed(2);
  });
  const [savingBalance, setSavingBalance] = useState<boolean>(false);
  const [balanceSavedFeedback, setBalanceSavedFeedback] = useState<boolean>(false);

  const handleBalanceModeSwitch = (nextMode: 'current' | 'initial') => {
    setBalanceMode(nextMode);
    const safeCurrent =
      typeof currentBankBalance === 'number' && !Number.isNaN(currentBankBalance)
        ? currentBankBalance
        : 0;
    const safeInitial =
      typeof state.settings.initialBalance === 'number' &&
      !Number.isNaN(state.settings.initialBalance)
        ? state.settings.initialBalance
        : 0;
    setBalanceAmountInput(
      nextMode === 'current' ? safeCurrent.toFixed(2) : safeInitial.toFixed(2)
    );
  };

  const handleSaveBalanceSubScreen = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(balanceAmountInput.replace(',', '.'));
    if (Number.isNaN(parsed)) return;

    setSavingBalance(true);
    try {
      if (balanceMode === 'current') {
        await onUpdateSettings({ targetCurrentBalance: parsed });
      } else {
        await onUpdateSettings({ initialBalance: parsed });
      }
      setBalanceSavedFeedback(true);
      setTimeout(() => setBalanceSavedFeedback(false), 2500);
    } finally {
      setSavingBalance(false);
    }
  };

  return (
    <form
      onSubmit={handleSaveBalanceSubScreen}
      className="px-4 pt-5 pb-8 space-y-4 animate-fadeIn"
    >
      <div className="settings-group-card p-5 rounded-2xl bg-white border border-slate-200 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center shrink-0">
            <Landmark size={22} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">{t.bankAccountBalanceTitle}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{t.syncWithRealBankSub}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t.currentBankBalance}
            </span>
            <span className="block text-lg font-extrabold text-emerald-500 mt-1">
              {formatCurrency(currentBankBalance ?? 0, state.settings.currency)}
            </span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {t.startingBase}
            </span>
            <span className="block text-lg font-extrabold text-slate-900 mt-1">
              {formatCurrency(state.settings.initialBalance ?? 0, state.settings.currency)}
            </span>
          </div>
        </div>

        {/* Segmented Mode Switcher: Current Bank Balance vs Starting Base */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => handleBalanceModeSwitch('current')}
            className={`min-h-[42px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              balanceMode === 'current'
                ? 'bg-[#6E5440] text-[#FFFDF5] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Check size={14} />
            <span>{t.setCurrentBalanceTab}</span>
          </button>
          <button
            type="button"
            onClick={() => handleBalanceModeSwitch('initial')}
            className={`min-h-[42px] flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              balanceMode === 'initial'
                ? 'bg-[#6E5440] text-[#FFFDF5] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <SlidersHorizontal size={14} />
            <span>{t.startingBaseBalanceTab}</span>
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 leading-relaxed">
          {balanceMode === 'current' ? t.currentBalanceExplain : t.initialBalanceExplain}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            {balanceMode === 'current'
              ? t.exactCurrentBankBalanceLabel
              : t.startingBaseBalanceLabel}
          </label>
          <input
            type="number"
            step="0.01"
            required
            value={balanceAmountInput}
            onChange={(e) => setBalanceAmountInput(e.target.value)}
            className="w-full text-xl font-bold px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-900 focus:outline-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={savingBalance}
        className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold transition-all shadow-sm active:scale-95"
      >
        <Check size={16} />
        <span>{savingBalance ? t.updatingBtn : t.saveBalanceBtn}</span>
      </button>

      {balanceSavedFeedback && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
          <Check size={15} />
          <span>
            {language === 'pt-BR'
              ? 'Saldo atualizado e sincronizado com sucesso!'
              : 'Balance updated and synced successfully!'}
          </span>
        </div>
      )}
    </form>
  );
};
