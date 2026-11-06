import React, { useState, useRef } from 'react';
import { AppLanguage, CreditCard } from '../../types';
import { AppIcon, resolveBankInfo } from '../icons';
import { formatCurrency } from '../../utils/format';
import { TRANSLATIONS } from '../../utils/i18n';
import { CardMetric, ConsolidatedLimits } from './cardStatementMath';
import { CardsGlobalLimitsBar } from './CardInvoiceHeaderAndActions';

export interface CreditCardCarouselProps {
  creditCards: CreditCard[]; cardsMetrics: CardMetric[]; consolidated: ConsolidatedLimits;
  activeIndex: number; setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  currency: string; language: AppLanguage; isOled: boolean;
  t: (typeof TRANSLATIONS)[AppLanguage];
  onOpenAddCard: () => void; onOpenManageCards: () => void;
}

export const CreditCardCarousel: React.FC<CreditCardCarouselProps> = ({
  creditCards, cardsMetrics, consolidated, activeIndex, setActiveIndex,
  currency, language, isOled, t, onOpenAddCard, onOpenManageCards,
}) => {
  const [carouselDragOffset, setCarouselDragOffset] = useState<number>(0);
  const [isCarouselDragging, setIsCarouselDragging] = useState<boolean>(false);
  const carouselTouchStartRef = useRef<{
    x: number; y: number; active: boolean; lock: 'none' | 'h' | 'v';
  }>({ x: 0, y: 0, active: false, lock: 'none' });

  const handleCarouselTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1 || creditCards.length <= 1) return;
    const touch = e.touches[0];
    carouselTouchStartRef.current = { x: touch.clientX, y: touch.clientY, active: true, lock: 'none' };
  };

  const handleCarouselTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const s = carouselTouchStartRef.current;
    if (!s.active || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - s.x;
    const deltaY = touch.clientY - s.y;

    if (s.lock === 'none') {
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        s.lock = 'v';
        s.active = false;
        return;
      }
      s.lock = 'h';
      setIsCarouselDragging(true);
    }

    if (s.lock === 'h') {
      if (e.cancelable) e.preventDefault();
      let damped = deltaX;
      if (activeIndex === 0 && deltaX > 0) damped = deltaX * 0.25;
      else if (activeIndex === creditCards.length - 1 && deltaX < 0) damped = deltaX * 0.25;
      setCarouselDragOffset(damped);
    }
  };

  const handleCarouselTouchEnd = () => {
    const s = carouselTouchStartRef.current;
    if (!s.active) return;
    s.active = false;
    if (s.lock === 'h') {
      const threshold = 45;
      if (carouselDragOffset < -threshold && activeIndex < creditCards.length - 1) setActiveIndex((prev) => prev + 1);
      else if (carouselDragOffset > threshold && activeIndex > 0) setActiveIndex((prev) => prev - 1);
    }
    s.lock = 'none';
    setIsCarouselDragging(false);
    setCarouselDragOffset(0);
  };

  const mouseDragRef = useRef<{ startX: number; active: boolean; hasMoved: boolean }>({
    startX: 0, active: false, hasMoved: false,
  });

  const handleCarouselMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (creditCards.length <= 1 || e.button !== 0) return;
    mouseDragRef.current = { startX: e.clientX, active: true, hasMoved: false };
    setIsCarouselDragging(true);
  };

  const handleCarouselMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mouseDragRef.current.active) return;
    const deltaX = e.clientX - mouseDragRef.current.startX;
    if (Math.abs(deltaX) > 4) mouseDragRef.current.hasMoved = true;
    let damped = deltaX;
    if (activeIndex === 0 && deltaX > 0) damped = deltaX * 0.25;
    else if (activeIndex === creditCards.length - 1 && deltaX < 0) damped = deltaX * 0.25;
    setCarouselDragOffset(damped);
  };

  const handleCarouselMouseUp = () => {
    if (!mouseDragRef.current.active) return;
    mouseDragRef.current.active = false;
    const threshold = 45;
    if (carouselDragOffset < -threshold && activeIndex < creditCards.length - 1) setActiveIndex((prev) => prev + 1);
    else if (carouselDragOffset > threshold && activeIndex > 0) setActiveIndex((prev) => prev - 1);
    setIsCarouselDragging(false);
    setCarouselDragOffset(0);
  };

  const handleCarouselClickCapture = (e: React.MouseEvent) => {
    if (mouseDragRef.current.hasMoved) {
      e.stopPropagation();
      e.preventDefault();
      mouseDragRef.current.hasMoved = false;
    }
  };

  if (creditCards.length === 0) {
    return (
      <div className={`p-8 rounded-2xl border border-dashed text-center space-y-3 ${
        isOled ? 'bg-[#0D1117] border-[#21262D]' : 'bg-white border-slate-300 shadow-xs'
      }`}>
        <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${
          isOled ? 'bg-[#161B22] text-[#D0B595]' : 'bg-slate-100 text-[#6E5440]'
        }`}>
          <AppIcon name="cartao" size={24} />
        </div>
        <p className={`text-sm font-semibold ${isOled ? 'text-[#F8FAFC]' : 'text-slate-900'}`}>
          {t.noCardsRegisteredYet || 'Nenhum cartão cadastrado'}
        </p>
        <p className={`text-xs max-w-sm mx-auto ${isOled ? 'text-[#94A3B8]' : 'text-slate-500'}`}>
          {t.noCardsRegisteredDesc || 'Adicione seus cartões para acompanhar limites, faturas e parcelas.'}
        </p>
        <button
          type="button"
          onClick={onOpenAddCard}
          className="px-4 py-2 rounded-xl bg-[#10B981] hover:bg-emerald-600 text-white text-xs font-semibold transition-colors active:scale-95 shadow-sm"
        >
          {language === 'pt-BR' ? 'Cadastrar cartão' : 'Add card'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative w-full max-w-[400px] mx-auto px-3.5 sm:px-4">
        <div
          className={`relative w-full overflow-hidden touch-pan-y rounded-2xl select-none ${
            creditCards.length > 1 ? (isCarouselDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
          }`}
          onTouchStart={handleCarouselTouchStart}
          onTouchMove={handleCarouselTouchMove}
          onTouchEnd={handleCarouselTouchEnd}
          onTouchCancel={handleCarouselTouchEnd}
          onMouseDown={handleCarouselMouseDown}
          onMouseMove={handleCarouselMouseMove}
          onMouseUp={handleCarouselMouseUp}
          onMouseLeave={handleCarouselMouseUp}
          onClickCapture={handleCarouselClickCapture}
        >
          <div
            className="flex w-full"
            style={{
              transform: `translate3d(calc(-${activeIndex * 100}% + ${carouselDragOffset}px), 0, 0)`,
              transition: isCarouselDragging ? 'none' : 'transform 260ms cubic-bezier(0.2, 0.8, 0.2, 1)',
              willChange: isCarouselDragging ? 'transform' : 'auto',
            }}
          >
            {creditCards.map((card) => {
              const metric = cardsMetrics.find((m) => m.card.id === card.id) || {
                usedLimit: 0, availableLimit: card.totalLimit, usedPercentage: 0,
                usedPercentFloat: 0, currentInvoiceTotal: 0, selectedCycleTotal: 0,
              };
              const bankInfo = resolveBankInfo(card);
              const brandBgColor =
                card.color && card.color !== '#6E5440'
                  ? card.color
                  : bankInfo.primaryColor || card.color || '#6E5440';

              return (
                <div key={card.id} className="w-full shrink-0">
                  <div
                    className={`relative rounded-2xl p-5 sm:p-6 min-h-[215px] sm:min-h-[225px] border-2 overflow-hidden flex flex-col justify-between transition-colors ${
                      isOled
                        ? 'bg-[#0D1117] shadow-xl text-[#F8FAFC]'
                        : 'bg-white shadow-lg shadow-slate-300/50 text-slate-900'
                    }`}
                    style={{ borderColor: card.color || brandBgColor }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm text-white"
                          style={{ backgroundColor: brandBgColor }}
                        >
                          <AppIcon name={bankInfo.iconName} size={22} color="#FFFFFF" />
                        </div>
                        <div className="min-w-0">
                          <h3 className={`text-sm sm:text-base font-bold truncate ${
                            isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                          }`}>
                            {card.name}
                          </h3>
                          {card.lastDigits && (
                            <span className={`text-[11px] font-mono block mt-0.5 ${
                              isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                            }`}>
                              •••• {card.lastDigits}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="my-auto py-3 space-y-2.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className={`text-[11px] uppercase font-bold tracking-wider ${
                          isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                        }`}>
                          Fatura Atual
                        </span>
                        <span className={`text-xl sm:text-2xl font-black tracking-tight ${
                          isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
                        }`}>
                          {formatCurrency(metric.selectedCycleTotal, currency)}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <div className={`h-2.5 w-full rounded-full overflow-hidden p-0.5 border ${
                          isOled ? 'bg-[#161B22] border-[#21262D]' : 'bg-slate-100 border-slate-200'
                        }`}>
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              metric.usedPercentage > 85
                                ? 'bg-[#EF4444]'
                                : metric.usedPercentage > 65
                                ? 'bg-[#F59E0B]'
                                : 'bg-[#10B981]'
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                metric.usedPercentFloat !== undefined
                                  ? metric.usedPercentFloat
                                  : metric.usedPercentage
                              )}%`,
                            }}
                          />
                        </div>

                        <div className={`flex items-center justify-between text-xs ${
                          isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                        }`}>
                          <span>
                            Disponível:{' '}
                            <strong className="text-[#10B981] font-semibold">
                              {formatCurrency(metric.availableLimit, currency)}
                            </strong>
                          </span>
                          <span>{metric.usedPercentage}% usado</span>
                        </div>
                      </div>
                    </div>

                    <div className={`pt-3 border-t flex items-center justify-between text-xs ${
                      isOled ? 'border-[#21262D] text-[#94A3B8]' : 'border-slate-200 text-slate-500'
                    }`}>
                      <div className="flex items-center gap-1.5 text-[11px] font-medium">
                        <span className={`px-2.5 py-1 rounded-lg border ${
                          isOled ? 'bg-[#161B22] border-[#21262D] text-[#E2E8F0]' : 'bg-slate-100 border-slate-200 text-slate-700'
                        }`}>
                          Fecha dia <strong>{card.closingDay}</strong> • Vence dia <strong>{card.dueDay}</strong>
                        </span>
                      </div>

                      <span className={`text-xs font-semibold ${
                        isOled ? 'text-[#E2E8F0]' : 'text-slate-700'
                      }`}>
                        Limite: {formatCurrency(card.totalLimit, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {creditCards.length > 1 && (
        <div className="flex justify-center items-center gap-1.5 py-1">
          {creditCards.map((card, idx) => (
            <button
              key={card.id}
              type="button"
              onClick={() => setActiveIndex(idx)}
              aria-label={`Ir para ${card.name}`}
              className={`transition-all duration-300 ${
                activeIndex === idx
                  ? 'w-4 h-1.5 rounded-full bg-[#6E5440]'
                  : isOled
                  ? 'w-1.5 h-1.5 rounded-full bg-[#21262D] hover:bg-[#475569]'
                  : 'w-1.5 h-1.5 rounded-full bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
        </div>
      )}

      <CardsGlobalLimitsBar
        isOled={isOled}
        language={language}
        currency={currency}
        consolidated={consolidated}
        onOpenManageCards={onOpenManageCards}
      />
    </div>
  );
};
