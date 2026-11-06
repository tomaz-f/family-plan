import React from 'react';
import { Plus } from 'lucide-react';
import { AppLanguage, FuelLog } from '../../types';
import { TRANSLATIONS } from '../../utils/i18n';
import { AppIcon } from '../icons';
import { EnrichedFuelLog } from './fuelMetrics';
import { SwipeableFuelRow } from './SwipeableFuelRow';

export { SwipeableFuelRow } from './SwipeableFuelRow';
export type { SwipeableFuelRowProps } from './SwipeableFuelRow';

export interface FuelHistorySectionProps {
  enrichedLogsDesc: EnrichedFuelLog[];
  currency: string;
  language: AppLanguage;
  openRowId: string | null;
  onSetOpenRow: (id: string | null) => void;
  onOpenNew: () => void;
  onOpenEdit: (log: FuelLog) => void;
  onDeleteFuelLog: (id: string) => Promise<void>;
}

export const FuelHistorySection: React.FC<FuelHistorySectionProps> = ({
  enrichedLogsDesc,
  currency,
  language,
  openRowId,
  onSetOpenRow,
  onOpenNew,
  onOpenEdit,
  onDeleteFuelLog,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <div className="oled-main-card rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">
          {t.refuelingHistoryTitle}
        </h3>
        <span className="text-xs font-semibold text-slate-400">
          {t.fillUpsCount(enrichedLogsDesc.length)}
        </span>
      </div>

      {enrichedLogsDesc.length === 0 ? (
        <div className="py-12 px-4 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center mx-auto">
            <AppIcon name="posto-gasolina" size={24} />
          </div>
          <p className="text-sm font-bold text-slate-800">{t.noRefuelingsTitle}</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">{t.noRefuelingsDesc}</p>
          <button
            type="button"
            onClick={onOpenNew}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 text-xs font-bold active:scale-95 transition-all shadow-xs"
          >
            <Plus size={14} className="mr-1" />
            {t.newRefuelBtn}
          </button>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {enrichedLogsDesc.map((log) => (
            <SwipeableFuelRow
              key={log.id}
              log={log}
              currency={currency}
              language={language}
              isOpen={openRowId === log.id}
              anyRowOpen={openRowId !== null}
              onSetOpenRow={onSetOpenRow}
              onOpenEdit={onOpenEdit}
              onDeleteFuelLog={onDeleteFuelLog}
            />
          ))}
        </div>
      )}
    </div>
  );
};
