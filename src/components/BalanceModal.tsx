import React, { useState, useEffect } from 'react';
import { X, Landmark, CheckCircle2, SlidersHorizontal } from 'lucide-react';
import { AppLanguage } from '../types';
import { formatCurrency } from '../utils/format';
import { TRANSLATIONS } from '../utils/i18n';

interface BalanceModalProps {
  isOpen: boolean;
  currentBalance: number;
  initialBalance: number;
  currency: string;
  language: AppLanguage;
  onClose: () => void;
  onUpdateSettings: (payload: { initialBalance?: number; targetCurrentBalance?: number }) => Promise<void>;
}

export const BalanceModal: React.FC<BalanceModalProps> = ({
  isOpen,
  currentBalance,
  initialBalance,
  currency,
  language,
  onClose,
  onUpdateSettings,
}) => {
  const t = TRANSLATIONS[language];
  const [mode, setMode] = useState<'current' | 'initial'>('current');
  const [amountInput, setAmountInput] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setMode('current');
    const safeCurrent = typeof currentBalance === 'number' && !Number.isNaN(currentBalance) ? currentBalance : 0;
    setAmountInput(safeCurrent.toFixed(2));
    // Only reset when modal opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const handleModeSwitch = (nextMode: 'current' | 'initial') => {
    setMode(nextMode);
    const safeCurrent = typeof currentBalance === 'number' && !Number.isNaN(currentBalance) ? currentBalance : 0;
    const safeInitial = typeof initialBalance === 'number' && !Number.isNaN(initialBalance) ? initialBalance : 0;
    setAmountInput(nextMode === 'current' ? safeCurrent.toFixed(2) : safeInitial.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amountInput.replace(',', '.'));
    if (Number.isNaN(parsed)) return;

    setSaving(true);
    try {
      if (mode === 'current') {
        await onUpdateSettings({ targetCurrentBalance: parsed });
      } else {
        await onUpdateSettings({ initialBalance: parsed });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Landmark size={19} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{t.bankAccountBalanceTitle}</h2>
              <p className="text-xs text-slate-500">{t.syncWithRealBankSub}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => handleModeSwitch('current')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                mode === 'current'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 size={14} />
              {t.setCurrentBalanceTab}
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('initial')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                mode === 'initial'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal size={14} />
              {t.startingBaseBalanceTab}
            </button>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 leading-relaxed">
            {mode === 'current' ? t.currentBalanceExplain : t.initialBalanceExplain}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              {mode === 'current' ? t.exactCurrentBankBalanceLabel : t.startingBaseBalanceLabel}
            </label>
            <input
              type="number"
              step="0.01"
              required
              autoFocus
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="w-full text-2xl font-bold px-4 py-3 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              {t.currentRecordedBalance}:{' '}
              <span className="font-semibold text-slate-700">{formatCurrency(currentBalance, currency)}</span>
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50"
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold shadow-sm"
            >
              {saving ? t.updatingBtn : t.saveBalanceBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
