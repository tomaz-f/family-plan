import React, { useState, useMemo, useEffect } from 'react';
import { AppLanguage, AppTheme, FuelLog, FuelType } from '../types';
import { FuelLogModal } from './FuelLogModal';
import { FuelHistorySection } from './fuel/FuelHistorySection';
import {
  computeFuelMetrics,
  enrichFuelLogs,
  getHighestOdometer,
} from './fuel/fuelMetrics';
import { FuelStatsSection } from './fuel/FuelStatsSection';

export { FuelStatsSection } from './fuel/FuelStatsSection';
export { FuelHistorySection, SwipeableFuelRow } from './fuel/FuelHistorySection';
export type { EnrichedFuelLog, FuelMetricsSummary } from './fuel/fuelMetrics';
export type { FuelStatsSectionProps } from './fuel/FuelStatsSection';
export type {
  FuelHistorySectionProps,
  SwipeableFuelRowProps,
} from './fuel/FuelHistorySection';

export interface FuelViewProps {
  selectedMonth: string;
  currency: string;
  language: AppLanguage;
  theme: AppTheme;
  tankCapacity: number;
  fuelLogs: FuelLog[];
  onSaveFuelLog: (data: {
    id?: string;
    date: string;
    odometer: number;
    pricePerLiter: number;
    totalCost: number;
    liters: number;
    fuelType: FuelType;
    stationName: string;
    isFullTank: boolean;
    notes?: string;
  }) => Promise<void>;
  onDeleteFuelLog: (id: string) => Promise<void>;
  onUpdateTankCapacity: (tankCapacity: number) => Promise<void>;
  openRefuelTrigger?: number;
  onModalOpenChange?: (open: boolean) => void;
}

export const FuelView: React.FC<FuelViewProps> = ({
  selectedMonth,
  currency,
  language,
  theme,
  tankCapacity,
  fuelLogs,
  onSaveFuelLog,
  onDeleteFuelLog,
  onUpdateTankCapacity,
  openRefuelTrigger,
  onModalOpenChange,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  useEffect(() => {
    onModalOpenChange?.(showForm);
  }, [showForm, onModalOpenChange]);

  // Click outside to dismiss any open swipe row
  useEffect(() => {
    if (!openRowId) return;
    const handleDocClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(`[data-swipe-row-id="${openRowId}"]`)) {
        setOpenRowId(null);
      }
    };
    window.addEventListener('touchstart', handleDocClick);
    window.addEventListener('mousedown', handleDocClick);
    return () => {
      window.removeEventListener('touchstart', handleDocClick);
      window.removeEventListener('mousedown', handleDocClick);
    };
  }, [openRowId]);

  // Enrich fuel logs in chronological order (by odometer asc, date asc)
  const enrichedLogsDesc = useMemo(() => enrichFuelLogs(fuelLogs), [fuelLogs]);

  const highestOdometer = useMemo(() => getHighestOdometer(fuelLogs), [fuelLogs]);

  const handleOpenNew = () => {
    setEditingLog(null);
    setShowForm(true);
  };

  useEffect(() => {
    if (openRefuelTrigger && openRefuelTrigger > 0) {
      handleOpenNew();
    }
  }, [openRefuelTrigger]);

  const handleOpenEdit = (log: FuelLog) => {
    setEditingLog(log);
    setShowForm(true);
  };

  // Consolidated Key Metrics
  const metrics = useMemo(
    () => computeFuelMetrics(enrichedLogsDesc, selectedMonth, tankCapacity, fuelLogs),
    [enrichedLogsDesc, selectedMonth, tankCapacity, fuelLogs]
  );

  return (
    <div className="space-y-4">
      {/* 1. SINGLE UNIFIED FUEL METRICS CARD (Clean 2x3 / 3-column Responsive Grid) */}
      <FuelStatsSection
        selectedMonth={selectedMonth}
        currency={currency}
        language={language}
        metrics={metrics}
        onOpenNew={handleOpenNew}
      />

      {/* 2. REFUELING HISTORY LIST (Swipeable Mobile Architecture) */}
      <FuelHistorySection
        enrichedLogsDesc={enrichedLogsDesc}
        currency={currency}
        language={language}
        openRowId={openRowId}
        onSetOpenRow={setOpenRowId}
        onOpenNew={handleOpenNew}
        onOpenEdit={handleOpenEdit}
        onDeleteFuelLog={onDeleteFuelLog}
      />

      {/* 3. REFUELING MODAL */}
      <FuelLogModal
        isOpen={showForm}
        editingLog={editingLog}
        highestOdometer={highestOdometer}
        tankCapacity={tankCapacity}
        language={language}
        theme={theme}
        onClose={() => {
          setShowForm(false);
          setEditingLog(null);
        }}
        onSaveFuelLog={async (data) => {
          await onSaveFuelLog({
            ...data,
            stationName: data.stationName || '',
          });
          setShowForm(false);
          setEditingLog(null);
        }}
        onUpdateTankCapacity={onUpdateTankCapacity}
      />
    </div>
  );
};
