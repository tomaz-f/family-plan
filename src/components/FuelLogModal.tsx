import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, CircleDashed, MapPin } from 'lucide-react';
import { AppLanguage, AppTheme, FuelLog, FuelType } from '../types';
import { getTodayDateStr } from '../utils/format';
import { TRANSLATIONS } from '../utils/i18n';
import { AppIcon } from './icons';

export interface FuelLogModalProps {
  isOpen: boolean;
  editingLog?: FuelLog | null;
  highestOdometer?: number | null;
  tankCapacity: number;
  language: AppLanguage;
  theme: AppTheme;
  onClose: () => void;
  onSaveFuelLog: (data: {
    id?: string;
    date: string;
    odometer: number;
    pricePerLiter: number;
    totalCost: number;
    liters: number;
    fuelType: FuelType;
    isFullTank: boolean;
    stationName?: string;
  }) => Promise<void>;
  onUpdateTankCapacity?: (cap: number) => void;
}

export const FuelLogModal: React.FC<FuelLogModalProps> = ({
  isOpen,
  editingLog,
  highestOdometer = null,
  tankCapacity,
  language,
  theme,
  onClose,
  onSaveFuelLog,
  onUpdateTankCapacity,
}) => {
  const t = TRANSLATIONS[language];
  const isOled = theme === 'oled';

  const [date, setDate] = useState<string>(getTodayDateStr());
  const [fuelType, setFuelType] = useState<FuelType>('gasoline');
  const [odometer, setOdometer] = useState<string>('');
  const [pricePerLiter, setPricePerLiter] = useState<string>('');
  const [totalCost, setTotalCost] = useState<string>('');
  const [liters, setLiters] = useState<string>('');
  const [stationName, setStationName] = useState<string>('');
  const [isFullTank, setIsFullTank] = useState<boolean>(true);
  const [tankInput, setTankInput] = useState<string>(String(tankCapacity || 54));
  const [submitting, setSubmitting] = useState<boolean>(false);

  const prevIsOpenRef = useRef<boolean>(false);
  const prevEditingIdRef = useRef<string | null | undefined>(undefined);
  const mouseDownTargetRef = useRef<EventTarget | null>(null);

  useEffect(() => {
    if (!isOpen) {
      prevIsOpenRef.current = false;
      return;
    }

    const currentEditingId = editingLog?.id || null;
    const isOpening = !prevIsOpenRef.current;
    const isTargetChanged = prevEditingIdRef.current !== currentEditingId;

    if (!isOpening && !isTargetChanged) {
      // Modal is already open and target hasn't changed; strictly preserve active user input
      return;
    }

    prevIsOpenRef.current = true;
    prevEditingIdRef.current = currentEditingId;

    if (editingLog) {
      setDate(editingLog.date);
      setFuelType(editingLog.fuelType);
      setOdometer(String(editingLog.odometer));
      setPricePerLiter(String(editingLog.pricePerLiter));
      setTotalCost(String(editingLog.totalCost));
      setLiters(String(editingLog.liters));
      setStationName(editingLog.stationName || '');
      setIsFullTank(editingLog.isFullTank);
      setTankInput(String(tankCapacity || 54));
    } else {
      setDate(getTodayDateStr());
      setFuelType('gasoline');
      setOdometer('');
      setPricePerLiter('');
      setTotalCost('');
      setLiters('');
      setStationName('');
      setIsFullTank(true);
      setTankInput(String(tankCapacity || 54));
    }
  }, [isOpen, editingLog, tankCapacity]);

  if (!isOpen) return null;

  const handlePriceChange = (val: string) => {
    setPricePerLiter(val);
    const p = parseFloat(val.replace(',', '.'));
    const l = parseFloat(liters.replace(',', '.'));
    const c = parseFloat(totalCost.replace(',', '.'));
    if (!Number.isNaN(p) && p > 0) {
      if (!Number.isNaN(l) && l > 0) {
        setTotalCost((p * l).toFixed(2));
      } else if (!Number.isNaN(c) && c > 0) {
        setLiters((c / p).toFixed(2));
      }
    }
  };

  const handleTotalCostChange = (val: string) => {
    setTotalCost(val);
    const c = parseFloat(val.replace(',', '.'));
    const p = parseFloat(pricePerLiter.replace(',', '.'));
    const l = parseFloat(liters.replace(',', '.'));
    if (!Number.isNaN(c) && c > 0) {
      if (!Number.isNaN(p) && p > 0) {
        setLiters((c / p).toFixed(2));
      } else if (!Number.isNaN(l) && l > 0) {
        setPricePerLiter((c / l).toFixed(3));
      }
    }
  };

  const handleLitersChange = (val: string) => {
    setLiters(val);
    const l = parseFloat(val.replace(',', '.'));
    const p = parseFloat(pricePerLiter.replace(',', '.'));
    const c = parseFloat(totalCost.replace(',', '.'));
    if (!Number.isNaN(l) && l > 0) {
      if (!Number.isNaN(p) && p > 0) {
        setTotalCost((p * l).toFixed(2));
      } else if (!Number.isNaN(c) && c > 0) {
        setPricePerLiter((c / l).toFixed(3));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const odo = parseFloat(odometer.replace(',', '.'));
    const price = parseFloat(pricePerLiter.replace(',', '.'));
    const cost = parseFloat(totalCost.replace(',', '.'));
    const lit = parseFloat(liters.replace(',', '.'));
    const tankSizeParsed = parseFloat(tankInput.replace(',', '.'));

    if (
      Number.isNaN(odo) ||
      Number.isNaN(price) ||
      Number.isNaN(cost) ||
      Number.isNaN(lit) ||
      price <= 0 ||
      cost <= 0 ||
      lit <= 0
    ) {
      return;
    }

    setSubmitting(true);
    try {
      if (!Number.isNaN(tankSizeParsed) && tankSizeParsed >= 10 && tankSizeParsed <= 300) {
        if (tankSizeParsed !== tankCapacity && onUpdateTankCapacity) {
          onUpdateTankCapacity(tankSizeParsed);
        }
      }

      await onSaveFuelLog({
        id: editingLog?.id,
        date,
        odometer: odo,
        pricePerLiter: price,
        totalCost: cost,
        liters: lit,
        fuelType,
        isFullTank,
        stationName: stationName.trim() || undefined,
      });

      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-fadeIn"
      onMouseDown={(e) => {
        mouseDownTargetRef.current = e.target;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownTargetRef.current === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`tx-compact-modal w-[92%] max-w-[420px] mx-auto rounded-2xl shadow-2xl border overflow-hidden max-h-[85vh] flex flex-col ${
          isOled ? 'bg-[#0D1117] border-[#21262D] text-[#F8FAFC]' : 'bg-white border-slate-200 text-slate-900'
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b shrink-0 ${
          isOled ? 'border-[#21262D]' : 'border-slate-100'
        }`}>
          <div className="flex items-center gap-2">
            <AppIcon name="posto-gasolina" size={17} className="text-amber-500 shrink-0" />
            <h2 className={`text-sm sm:text-base font-bold tracking-tight ${
              isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
            }`}>
              {editingLog ? t.editRefuelTitle : t.newRefuelTitle}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-1.5 rounded-full transition-colors ${
              isOled ? 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#161B22]' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
            aria-label={t.cancelBtn}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto no-scrollbar">
          {/* Fuel Type Selector: Segmented Pill */}
          <div>
            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1.5 ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-400'
            }`}>
              {t.fuelTypeLabel}
            </label>
            <div className={`grid grid-cols-2 gap-1.5 p-1 rounded-xl border ${
              isOled ? 'bg-[#161B22] border-[#21262D]' : 'bg-slate-100 border-slate-200/60'
            }`}>
              <button
                type="button"
                onClick={() => setFuelType('gasoline')}
                className={`h-9 flex items-center justify-center gap-1.5 py-1 px-3 rounded-lg text-xs font-bold transition-all ${
                  fuelType === 'gasoline'
                    ? 'bg-[#F59E0B] text-slate-950 shadow-xs'
                    : isOled ? 'text-[#94A3B8] hover:text-[#F8FAFC]' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>⛽ {t.fuelGasoline}</span>
              </button>
              <button
                type="button"
                onClick={() => setFuelType('ethanol')}
                className={`h-9 flex items-center justify-center gap-1.5 py-1 px-3 rounded-lg text-xs font-bold transition-all ${
                  fuelType === 'ethanol'
                    ? 'bg-[#10B981] text-white shadow-xs'
                    : isOled ? 'text-[#94A3B8] hover:text-[#F8FAFC]' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <span>🌱 {t.fuelEthanol}</span>
              </button>
            </div>
          </div>

          {/* Fill Type Selector: Segmented Pill */}
          <div>
            <label className={`block text-[11px] font-bold uppercase tracking-wider mb-1.5 ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-400'
            }`}>
              {t.fillTypeLabel}
            </label>
            <div className={`grid grid-cols-2 gap-1.5 p-1 rounded-xl border ${
              isOled ? 'bg-[#161B22] border-[#21262D]' : 'bg-slate-100 border-slate-200/60'
            }`}>
              <button
                type="button"
                onClick={() => setIsFullTank(true)}
                className={`h-9 flex items-center justify-center gap-1.5 py-1 px-3 rounded-lg text-xs font-bold transition-all ${
                  isFullTank
                    ? 'bg-[#6E5440] text-[#FFFDF5] shadow-xs'
                    : isOled ? 'text-[#94A3B8] hover:text-[#F8FAFC]' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <CheckCircle2 size={13} />
                <span>{t.fullTankLabel}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsFullTank(false)}
                className={`h-9 flex items-center justify-center gap-1.5 py-1 px-3 rounded-lg text-xs font-bold transition-all ${
                  !isFullTank
                    ? 'bg-[#6E5440] text-[#FFFDF5] shadow-xs'
                    : isOled ? 'text-[#94A3B8] hover:text-[#F8FAFC]' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <CircleDashed size={13} />
                <span>{t.partialTankLabel}</span>
              </button>
            </div>
          </div>

          {/* Row 1: Preço/L & Valor Total */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-400'
              }`}>
                {t.pricePerLiterLabel}
              </label>
              <input
                type="number"
                step="0.001"
                min="0.01"
                required
                placeholder="5.89"
                value={pricePerLiter}
                onChange={(e) => handlePriceChange(e.target.value)}
                className={`h-11 w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold ${
                  isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-400'
              }`}>
                {t.totalCostLabel}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="250.00"
                value={totalCost}
                onChange={(e) => handleTotalCostChange(e.target.value)}
                className={`h-11 w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold ${
                  isOled ? 'bg-[#161B22] border-[#21262D] text-rose-400' : 'bg-slate-50 border-slate-200 text-rose-500'
                }`}
              />
            </div>
          </div>

          {/* Row 2: Litros & Odômetro */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-400'
              }`}>
                {t.litersLabel}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="42.44"
                value={liters}
                onChange={(e) => handleLitersChange(e.target.value)}
                className={`h-11 w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold ${
                  isOled ? 'bg-[#161B22] border-[#21262D] text-sky-400' : 'bg-slate-50 border-slate-200 text-sky-500'
                }`}
              />
            </div>
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-400'
              }`}>
                {t.odometerLabel}
              </label>
              <input
                type="number"
                step="1"
                min="0"
                required
                placeholder={t.odometerPlaceholder}
                value={odometer}
                onChange={(e) => setOdometer(e.target.value)}
                className={`h-11 w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold ${
                  isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
              {highestOdometer !== null && (
                <span className={`block text-[10px] mt-1 truncate ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-400'
                }`}>
                  {t.lastOdometerHint(highestOdometer)}
                </span>
              )}
            </div>
          </div>

          {/* Row 3: Capacidade do Tanque (Litros) & Data */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className={`block text-[11px] font-semibold mb-1 truncate ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-400'
              }`}>
                {language === 'pt-BR'
                  ? 'Capacidade Tanque (L)'
                  : 'Tank Capacity (L)'}
              </label>
              <input
                type="number"
                min="10"
                max="300"
                step="1"
                required
                placeholder="54"
                value={tankInput}
                onChange={(e) => setTankInput(e.target.value)}
                className={`h-11 w-full px-3.5 py-2.5 rounded-xl border text-sm font-bold ${
                  isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-400'
              }`}>
                {t.dateLabel}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`h-11 w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium ${
                  isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
          </div>

          {/* Row 4: Posto de Combustível */}
          <div>
            <label className={`block text-[11px] font-semibold mb-1 ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-400'
            }`}>
              {t.stationNameLabel}
            </label>
            <div className="relative">
              <MapPin
                size={16}
                className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                  isOled ? 'text-[#94A3B8]' : 'text-slate-400'
                }`}
              />
              <input
                type="text"
                placeholder={t.stationPlaceholder}
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                className={`h-11 w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm ${
                  isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>
          </div>

          {/* Compact Footer Actions */}
          <div className={`flex items-center gap-2 pt-2 border-t shrink-0 ${
            isOled ? 'border-[#21262D]' : 'border-slate-100'
          }`}>
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 h-11 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-colors active:scale-95 ${
                isOled
                  ? 'border-[#21262D] bg-[#161B22] text-[#94A3B8] hover:bg-[#21262D]'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.cancelBtn}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`flex-1 h-11 py-2.5 px-3 rounded-xl text-xs font-bold shadow-xs transition-colors active:scale-95 ${
                isOled
                  ? 'bg-[#6E5440] hover:bg-[#7E624B] text-white'
                  : 'bg-slate-900 text-white hover:bg-slate-800'
              }`}
            >
              {submitting ? t.savingBtn : t.saveRefuelBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
