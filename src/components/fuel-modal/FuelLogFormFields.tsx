import React from 'react';
import { CheckCircle2, CircleDashed, MapPin } from 'lucide-react';
import { AppLanguage, FuelType } from '../../types';
import { TRANSLATIONS } from '../../utils/i18n';

export interface FuelLogFormFieldsProps {
  language: AppLanguage;
  isOled: boolean;
  highestOdometer: number | null;
  fuelType: FuelType;
  onChangeFuelType: (fuelType: FuelType) => void;
  isFullTank: boolean;
  onChangeIsFullTank: (isFullTank: boolean) => void;
  pricePerLiter: string;
  onPriceChange: (val: string) => void;
  totalCost: string;
  onTotalCostChange: (val: string) => void;
  liters: string;
  onLitersChange: (val: string) => void;
  odometer: string;
  onOdometerChange: (val: string) => void;
  tankInput: string;
  onTankInputChange: (val: string) => void;
  date: string;
  onDateChange: (val: string) => void;
  stationName: string;
  onStationNameChange: (val: string) => void;
}

export const FuelLogFormFields: React.FC<FuelLogFormFieldsProps> = ({
  language,
  isOled,
  highestOdometer,
  fuelType,
  onChangeFuelType,
  isFullTank,
  onChangeIsFullTank,
  pricePerLiter,
  onPriceChange,
  totalCost,
  onTotalCostChange,
  liters,
  onLitersChange,
  odometer,
  onOdometerChange,
  tankInput,
  onTankInputChange,
  date,
  onDateChange,
  stationName,
  onStationNameChange,
}) => {
  const t = TRANSLATIONS[language];

  return (
    <>
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
            onClick={() => onChangeFuelType('gasoline')}
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
            onClick={() => onChangeFuelType('ethanol')}
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
            onClick={() => onChangeIsFullTank(true)}
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
            onClick={() => onChangeIsFullTank(false)}
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
            onChange={(e) => onPriceChange(e.target.value)}
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
            onChange={(e) => onTotalCostChange(e.target.value)}
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
            onChange={(e) => onLitersChange(e.target.value)}
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
            onChange={(e) => onOdometerChange(e.target.value)}
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
            onChange={(e) => onTankInputChange(e.target.value)}
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
            onChange={(e) => onDateChange(e.target.value)}
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
            onChange={(e) => onStationNameChange(e.target.value)}
            className={`h-11 w-full pl-10 pr-3.5 py-2.5 rounded-xl border text-sm ${
              isOled ? 'bg-[#161B22] border-[#21262D] text-[#F8FAFC]' : 'bg-slate-50 border-slate-200 text-slate-900'
            }`}
          />
        </div>
      </div>
    </>
  );
};
