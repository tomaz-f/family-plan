import React from 'react';
import { X } from 'lucide-react';
import { AppLanguage, AppTheme, FuelLog, FuelType } from '../types';
import { TRANSLATIONS } from '../utils/i18n';
import { AppIcon } from './icons';
import { FuelLogFormFields } from './fuel-modal/FuelLogFormFields';
import { useFuelLogForm } from './fuel-modal/useFuelLogForm';

export type { FuelLogFormFieldsProps } from './fuel-modal/FuelLogFormFields';
export type { SaveFuelLogPayload, UseFuelLogFormParams } from './fuel-modal/useFuelLogForm';

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

  const {
    date,
    setDate,
    fuelType,
    setFuelType,
    odometer,
    setOdometer,
    pricePerLiter,
    totalCost,
    liters,
    stationName,
    setStationName,
    isFullTank,
    setIsFullTank,
    tankInput,
    setTankInput,
    submitting,
    mouseDownTargetRef,
    handlePriceChange,
    handleTotalCostChange,
    handleLitersChange,
    handleSubmit,
  } = useFuelLogForm({
    isOpen,
    editingLog,
    tankCapacity,
    onClose,
    onSaveFuelLog,
    onUpdateTankCapacity,
  });

  if (!isOpen) return null;

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
          <FuelLogFormFields
            language={language}
            isOled={isOled}
            highestOdometer={highestOdometer}
            fuelType={fuelType}
            onChangeFuelType={setFuelType}
            isFullTank={isFullTank}
            onChangeIsFullTank={setIsFullTank}
            pricePerLiter={pricePerLiter}
            onPriceChange={handlePriceChange}
            totalCost={totalCost}
            onTotalCostChange={handleTotalCostChange}
            liters={liters}
            onLitersChange={handleLitersChange}
            odometer={odometer}
            onOdometerChange={setOdometer}
            tankInput={tankInput}
            onTankInputChange={setTankInput}
            date={date}
            onDateChange={setDate}
            stationName={stationName}
            onStationNameChange={setStationName}
          />

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
