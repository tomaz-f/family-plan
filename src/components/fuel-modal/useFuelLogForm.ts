import React, { useState, useEffect, useRef } from 'react';
import { FuelLog, FuelType } from '../../types';
import { getTodayDateStr } from '../../utils/format';

export interface SaveFuelLogPayload {
  id?: string;
  date: string;
  odometer: number;
  pricePerLiter: number;
  totalCost: number;
  liters: number;
  fuelType: FuelType;
  isFullTank: boolean;
  stationName?: string;
}

export interface UseFuelLogFormParams {
  isOpen: boolean;
  editingLog?: FuelLog | null;
  tankCapacity: number;
  onClose: () => void;
  onSaveFuelLog: (data: SaveFuelLogPayload) => Promise<void>;
  onUpdateTankCapacity?: (cap: number) => void;
}

export function useFuelLogForm({
  isOpen,
  editingLog,
  tankCapacity,
  onClose,
  onSaveFuelLog,
  onUpdateTankCapacity,
}: UseFuelLogFormParams) {
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

  return {
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
  };
}
