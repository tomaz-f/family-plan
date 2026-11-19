import React, { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { AppLanguage } from '../../types';
import { AppIcon } from '../icons';

interface VehicleFuelSettingsCardProps {
  tankCapacity: number;
  fuelLogsCount: number;
  language: AppLanguage;
  onUpdateTankCapacity: (capacity: number) => Promise<void>;
  onNavigateFuel?: () => void;
}

export const VehicleFuelSettingsCard: React.FC<VehicleFuelSettingsCardProps> = ({
  tankCapacity,
  fuelLogsCount,
  language,
  onUpdateTankCapacity,
  onNavigateFuel,
}) => {
  const isPt = language === 'pt-BR';
  const [capacityInput, setCapacityInput] = useState<string>(String(tankCapacity));
  const [saving, setSaving] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(capacityInput);
    if (Number.isNaN(parsed) || parsed < 10 || parsed > 300) return;

    setSaving(true);
    try {
      await onUpdateTankCapacity(Math.round(parsed));
      setSavedFeedback(true);
      setTimeout(() => setSavedFeedback(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const subtitleText = isPt
    ? `${fuelLogsCount} ${fuelLogsCount === 1 ? 'abastecimento registrado' : 'abastecimentos registrados'}`
    : `${fuelLogsCount} ${fuelLogsCount === 1 ? 'fill-up logged' : 'fill-ups logged'}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="settings-group-card p-4 rounded-2xl bg-white dark:bg-[#0D1117] border border-slate-200/80 dark:border-[#21262D] shadow-sm space-y-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
              <AppIcon name="posto-gasolina" size={20} />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {isPt ? 'Veículo e Combustível' : 'Vehicle & Fuel'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {subtitleText}
              </p>
            </div>
          </div>

          {onNavigateFuel && (
            <button
              type="button"
              onClick={onNavigateFuel}
              className="min-h-[44px] px-3 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-slate-50 dark:bg-[#161B22] hover:bg-slate-200/70 dark:hover:bg-[#21262D] text-xs font-bold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <span>{isPt ? 'Combustível' : 'Fuel'}</span>
              <ArrowRight size={14} className="shrink-0" />
            </button>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            {isPt ? 'Capacidade do Tanque (Litros)' : 'Tank Capacity (Liters)'}
          </label>
          <div className="flex items-center gap-2.5">
            <input
              type="number"
              min={10}
              max={300}
              step={1}
              required
              value={capacityInput}
              onChange={(e) => setCapacityInput(e.target.value)}
              className="flex-1 min-w-0 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#21262D] bg-slate-50 dark:bg-[#161B22] text-sm font-bold text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={saving}
              className="bg-[#6E5440] hover:bg-[#5c4534] text-white min-h-[44px] px-4 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0 cursor-pointer disabled:opacity-50"
            >
              {saving ? (isPt ? 'Salvando...' : 'Saving...') : isPt ? 'Salvar' : 'Save'}
            </button>
          </div>
        </div>
      </div>

      {savedFeedback && (
        <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 dark:text-emerald-400 text-xs font-bold flex items-center justify-center gap-2">
          <Check size={14} />
          <span>
            {isPt
              ? 'Capacidade do tanque atualizada!'
              : 'Tank capacity updated!'}
          </span>
        </div>
      )}
    </form>
  );
};
