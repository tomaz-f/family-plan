import React, { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  CalendarClock,
  Check,
  ChevronDown,
  CreditCard,
  Fuel,
  PieChart,
  Scale,
  TrendingUp,
} from 'lucide-react';
import { AppLanguage } from '../../types';
import { REPORT_SLIDES } from './reportsTypes';

export interface ReportsQuickSelectorBarProps {
  activeSlideIndex: number;
  language: AppLanguage;
  isOled: boolean;
  onSelectSlide: (index: number) => void;
}

const SLIDE_ICONS = [
  PieChart,
  CreditCard,
  BarChart3,
  TrendingUp,
  CalendarClock,
  Activity,
  Scale,
  Fuel,
] as const;

const ReportsQuickSelectorBarComponent: React.FC<ReportsQuickSelectorBarProps> = ({
  activeSlideIndex,
  language,
  isOled,
  onSelectSlide,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isPt = language === 'pt-BR';

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const activeSlide = REPORT_SLIDES[activeSlideIndex] ?? REPORT_SLIDES[0];
  const ActiveIcon = SLIDE_ICONS[activeSlide.index] ?? PieChart;
  const activeTitle = isPt ? activeSlide.labelPt : activeSlide.labelEn;

  return (
    <div className="flex items-center justify-between gap-2 w-full mb-2.5 relative">
      <div
        className="flex items-center gap-1.5"
        role="tablist"
        aria-label={isPt ? 'Navegação dos relatórios' : 'Report navigation'}
      >
        {REPORT_SLIDES.map((slide) => {
          const isActive = slide.index === activeSlideIndex;
          const label = isPt ? slide.labelPt : slide.labelEn;
          return (
            <button
              key={slide.index}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={label}
              onClick={() => onSelectSlide(slide.index)}
              className={
                isActive
                  ? 'w-4 h-2 rounded-full bg-[#10B981] transition-all duration-300 cursor-pointer'
                  : `w-1.5 h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      isOled
                        ? 'bg-[#21262D] hover:bg-slate-700'
                        : 'bg-slate-300 hover:bg-slate-400'
                    }`
              }
            />
          );
        })}
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 ml-1 tabular-nums">
          {activeSlideIndex + 1}/{REPORT_SLIDES.length}
        </span>
      </div>

      <div className="ml-auto relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          onClick={() => setIsOpen((prev) => !prev)}
          className="h-9 px-3 rounded-xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] hover:bg-slate-50 dark:hover:bg-[#161B22] shadow-sm flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer select-none"
        >
          <ActiveIcon size={14} className="text-[#10B981] shrink-0" />
          <span className="truncate max-w-[145px]">{activeTitle}</span>
          <ChevronDown
            size={14}
            className={`text-slate-400 shrink-0 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              aria-hidden="true"
              onClick={() => setIsOpen(false)}
            />
            <div
              role="menu"
              aria-label={isPt ? 'Selecionar relatório' : 'Select report'}
              className="absolute right-0 top-full mt-1.5 z-50 w-64 max-w-[calc(100vw-24px)] p-1.5 rounded-2xl border border-slate-200/80 dark:border-[#21262D] bg-white dark:bg-[#0D1117] shadow-xl flex flex-col gap-0.5"
            >
              {REPORT_SLIDES.map((slide) => {
                const isActive = slide.index === activeSlideIndex;
                const SlideIcon = SLIDE_ICONS[slide.index] ?? PieChart;
                const label = isPt ? slide.labelPt : slide.labelEn;
                return (
                  <button
                    key={slide.index}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSelectSlide(slide.index);
                      setIsOpen(false);
                    }}
                    className={`w-full px-2.5 py-2 rounded-xl flex items-center gap-2 text-left text-xs transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-emerald-500/10 text-[#10B981] font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-[#161B22] font-medium'
                    }`}
                  >
                    <SlideIcon
                      size={15}
                      className={`shrink-0 ${
                        isActive ? 'text-[#10B981]' : 'text-slate-400 dark:text-slate-500'
                      }`}
                    />
                    <span className="flex-1 truncate">{label}</span>
                    {isActive && <Check size={14} className="text-[#10B981] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const ReportsQuickSelectorBar = React.memo(ReportsQuickSelectorBarComponent);
