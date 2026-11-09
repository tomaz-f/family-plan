import React, { useState, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AppLanguage } from '../../types';
import { shiftMonth } from '../../utils/format';

export interface MonthSelectorProps {
  selectedMonth: string;
  language: AppLanguage;
  onSelectMonth: React.Dispatch<React.SetStateAction<string>>;
}

const MONTHS_PT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

const MONTHS_EN = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const SWIPE_THRESHOLD = 45;

function formatPureMonthTitle(monthStr: string, lang: AppLanguage): string {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-').map(Number);
  if (!y || !m) return monthStr;
  const date = new Date(y, m - 1, 1);
  const locale = lang === 'pt-BR' ? 'pt-BR' : 'en-US';
  const raw = date.toLocaleDateString(locale, { month: 'long' });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  selectedMonth,
  language,
  onSelectMonth,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const activeYear = Number(selectedMonth.slice(0, 4)) || new Date().getFullYear();
  const activeMonthNum = Number(selectedMonth.slice(5, 7)) || new Date().getMonth() + 1;
  const [pickerYear, setPickerYear] = useState<number>(activeYear);
  const [slideOffset, setSlideOffset] = useState<number>(0);

  const gestureRef = useRef<{
    startX: number;
    startY: number;
    deltaX: number;
    active: boolean;
    wasDragged: boolean;
  }>({
    startX: 0,
    startY: 0,
    deltaX: 0,
    active: false,
    wasDragged: false,
  });

  const triggerMonthShift = (delta: number) => {
    setIsOpen(false);
    setSlideOffset(delta > 0 ? -10 : 10);
    onSelectMonth((prev) => shiftMonth(prev, delta));
    window.setTimeout(() => {
      setSlideOffset(0);
    }, 180);
  };

  const finishGesture = () => {
    const g = gestureRef.current;
    if (!g.active) return;
    g.active = false;
    const dx = g.deltaX;
    g.deltaX = 0;

    if (dx <= -SWIPE_THRESHOLD) {
      g.wasDragged = true;
      triggerMonthShift(1);
    } else if (dx >= SWIPE_THRESHOLD) {
      g.wasDragged = true;
      triggerMonthShift(-1);
    } else {
      setSlideOffset(0);
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLButtonElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    gestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      deltaX: 0,
      active: true,
      wasDragged: false,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLButtonElement>) => {
    const g = gestureRef.current;
    if (!g.active || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const dx = touch.clientX - g.startX;
    const dy = touch.clientY - g.startY;

    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
      g.active = false;
      setSlideOffset(0);
      return;
    }

    g.deltaX = dx;
    if (Math.abs(dx) >= 10) {
      g.wasDragged = true;
      setSlideOffset(Math.max(-18, Math.min(18, dx * 0.25)));
    }
  };

  const handleTouchEnd = () => {
    finishGesture();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    gestureRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      deltaX: 0,
      active: true,
      wasDragged: false,
    };

    const handleWindowMouseMove = (ev: MouseEvent) => {
      const g = gestureRef.current;
      if (!g.active) return;
      const dx = ev.clientX - g.startX;
      g.deltaX = dx;
      if (Math.abs(dx) >= 10) {
        g.wasDragged = true;
        setSlideOffset(Math.max(-18, Math.min(18, dx * 0.25)));
      }
    };

    const handleWindowMouseUp = () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      finishGesture();
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  const handlePillClick = () => {
    if (gestureRef.current.wasDragged) {
      gestureRef.current.wasDragged = false;
      return;
    }
    setIsOpen((prev) => {
      const next = !prev;
      if (next) setPickerYear(activeYear);
      return next;
    });
  };

  const monthLabels = language === 'pt-BR' ? MONTHS_PT : MONTHS_EN;

  return (
    <div className="relative flex items-center justify-center">
      <button
        type="button"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onClick={handlePillClick}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        style={{ touchAction: 'pan-y' }}
        className="h-10 px-5 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] shadow-sm flex items-center justify-center cursor-pointer cursor-grab active:cursor-grabbing select-none transition-all active:scale-95"
        title={
          language === 'pt-BR'
            ? 'Toque para escolher mês/ano ou deslize para navegar'
            : 'Tap to pick month/year or swipe to navigate'
        }
      >
        <span
          style={{ transform: `translateX(${slideOffset}px)` }}
          className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight transition-transform duration-200"
        >
          {formatPureMonthTitle(selectedMonth, language)}
        </span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setIsOpen(false)}
          />

          <div
            role="dialog"
            aria-label={language === 'pt-BR' ? 'Selecionar mês e ano' : 'Select month and year'}
            className="absolute top-full mt-2 z-50 w-72 -translate-x-1/2 left-1/2 p-3 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] shadow-xl backdrop-blur-md"
          >
            {/* Popover Header: Year Navigator */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-[#21262D]/60">
              <button
                type="button"
                onClick={() => setPickerYear((y) => y - 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#161B22] transition-colors cursor-pointer"
                aria-label={language === 'pt-BR' ? 'Ano anterior' : 'Previous year'}
              >
                <ChevronLeft size={16} />
              </button>

              <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100 select-none">
                {pickerYear}
              </span>

              <button
                type="button"
                onClick={() => setPickerYear((y) => y + 1)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#161B22] transition-colors cursor-pointer"
                aria-label={language === 'pt-BR' ? 'Próximo ano' : 'Next year'}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Popover Body: 12-Month Grid */}
            <div className="grid grid-cols-3 gap-1.5">
              {monthLabels.map((label, idx) => {
                const monthNumber = idx + 1;
                const isSelected = pickerYear === activeYear && monthNumber === activeMonthNum;
                const targetMonthStr = `${pickerYear}-${String(monthNumber).padStart(2, '0')}`;

                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      onSelectMonth(targetMonthStr);
                      setIsOpen(false);
                    }}
                    className={
                      isSelected
                        ? 'bg-[#6E5440] text-white font-bold rounded-xl py-2 text-xs shadow-sm cursor-pointer'
                        : 'bg-slate-50 dark:bg-[#161B22] hover:bg-slate-100 dark:hover:bg-[#21262D] text-slate-700 dark:text-slate-300 font-semibold rounded-xl py-2 text-xs transition-colors cursor-pointer'
                    }
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
