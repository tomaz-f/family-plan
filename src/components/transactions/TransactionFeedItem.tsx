import React, { useState, useRef } from 'react';
import { Check, Clock, Pencil, Repeat, ThumbsUp, Trash2 } from 'lucide-react';
import { AppLanguage, Category, CreditCard, Transaction } from '../../types';
import { formatCurrency } from '../../utils/format';
import { getAdaptiveFeedFontSize } from '../../utils/currencyUtils';
import { getCategoryDisplayName, TRANSLATIONS } from '../../utils/i18n';
import { CategoryIcon } from '../CategoryIcon';
import { BankIcon } from '../icons';
import {
  SWIPE_MAX_DRAG, SWIPE_REVEAL_WIDTH, SWIPE_SNAP_THRESHOLD,
} from './transactionsViewMath';

export interface SwipeableTransactionRowProps {
  tx: Transaction; cat?: Category; cardObj?: CreditCard | null; currency: string;
  language: AppLanguage; isOpen: boolean; anyRowOpen: boolean;
  onSetOpenRow: (id: string | null) => void;
  onOpenEditModal: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => Promise<void>;
  onToggleTransactionStatus: (tx: Transaction) => Promise<void>;
}

const clampSwipeOffset = (rawOffset: number): number => {
  if (rawOffset > 0) return 0;
  if (rawOffset < -SWIPE_REVEAL_WIDTH) {
    const extra = rawOffset + SWIPE_REVEAL_WIDTH;
    return Math.max(-SWIPE_MAX_DRAG, -SWIPE_REVEAL_WIDTH + extra * 0.25);
  }
  return rawOffset;
};

export const SwipeableTransactionRow: React.FC<SwipeableTransactionRowProps> = ({
  tx, cat, cardObj, currency, language, isOpen, anyRowOpen,
  onSetOpenRow, onOpenEditModal, onDeleteTransaction, onToggleTransactionStatus,
}) => {
  const t = TRANSLATIONS[language];
  const isUnpaid = tx.status === 'unpaid';
  const isInvoice = Boolean(tx.settledInvoiceKey || (tx.description && /^fatura\b/i.test(tx.description)));
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const gestureRef = useRef<{
    startX: number; startY: number; initialOffset: number;
    lock: 'none' | 'horizontal' | 'vertical'; currentOffset: number; active: boolean;
  }>({ startX: 0, startY: 0, initialOffset: 0, lock: 'none', currentOffset: 0, active: false });

  const lastSwipeTimeRef = useRef<number>(0);

  const finishSwipeGesture = () => {
    const g = gestureRef.current;
    if (!g.active) return;
    g.active = false;

    if (g.lock === 'horizontal') {
      lastSwipeTimeRef.current = Date.now();
      const finalOffset = g.currentOffset;
      if (g.initialOffset === 0) {
        onSetOpenRow(finalOffset <= -SWIPE_SNAP_THRESHOLD ? tx.id : null);
      } else {
        onSetOpenRow(finalOffset > -SWIPE_REVEAL_WIDTH + 35 ? null : tx.id);
      }
    }

    g.lock = 'none';
    setIsDragging(false);
    setDragOffset(null);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (anyRowOpen && !isOpen) onSetOpenRow(null);
    const initial = isOpen ? -SWIPE_REVEAL_WIDTH : 0;
    gestureRef.current = {
      startX: touch.clientX, startY: touch.clientY, initialOffset: initial,
      lock: 'none', currentOffset: initial, active: true,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g.active || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const deltaX = touch.clientX - g.startX;
    const deltaY = touch.clientY - g.startY;

    if (g.lock === 'none') {
      if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        g.lock = 'vertical';
        g.active = false;
        return;
      }
      g.lock = 'horizontal';
      setIsDragging(true);
    }

    if (g.lock === 'horizontal') {
      const next = clampSwipeOffset(g.initialOffset + deltaX);
      g.currentOffset = next;
      setDragOffset(next);
    }
  };

  const handleTouchEnd = () => finishSwipeGesture();

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (anyRowOpen && !isOpen) onSetOpenRow(null);
    const initial = isOpen ? -SWIPE_REVEAL_WIDTH : 0;
    gestureRef.current = {
      startX: e.clientX, startY: e.clientY, initialOffset: initial,
      lock: 'none', currentOffset: initial, active: true,
    };

    const handleWindowMouseMove = (ev: MouseEvent) => {
      const g = gestureRef.current;
      if (!g.active) return;
      const deltaX = ev.clientX - g.startX;
      const deltaY = ev.clientY - g.startY;

      if (g.lock === 'none') {
        if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          g.lock = 'vertical';
          g.active = false;
          return;
        }
        g.lock = 'horizontal';
        setIsDragging(true);
      }

      if (g.lock === 'horizontal') {
        const next = clampSwipeOffset(g.initialOffset + deltaX);
        g.currentOffset = next;
        setDragOffset(next);
      }
    };

    const handleWindowMouseUp = () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      finishSwipeGesture();
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  const handleRowClick = () => {
    if (Date.now() - lastSwipeTimeRef.current < 260) return;
    if (isOpen || anyRowOpen) {
      onSetOpenRow(null);
      return;
    }
    onOpenEditModal(tx);
  };

  const translateX = dragOffset !== null ? dragOffset : isOpen ? -SWIPE_REVEAL_WIDTH : 0;
  const formattedAmount = `${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount, currency)}`;

  return (
    <div data-swipe-row-id={tx.id} className="group relative overflow-hidden select-none">
      {/* Background Action Layer */}
      <div
        className="swipe-actions-layer absolute inset-y-0 right-0 flex items-center justify-end gap-2 pr-3 pl-2 z-0"
        style={{ width: `${SWIPE_REVEAL_WIDTH}px` }}
        aria-hidden={!isOpen && dragOffset === null}
      >
        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          onClick={(e) => { e.stopPropagation(); onSetOpenRow(null); onToggleTransactionStatus(tx); }}
          className="swipe-action-btn w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0"
          title={isUnpaid ? t.markAsPaidTooltip : t.markAsUnpaidTooltip}
        >
          {isUnpaid ? <Clock size={15} className="text-amber-500" /> : <ThumbsUp size={15} className="text-emerald-500" />}
        </button>

        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          onClick={(e) => { e.stopPropagation(); onSetOpenRow(null); onOpenEditModal(tx); }}
          className="swipe-action-btn w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0"
          title={t.editTooltip}
        >
          <Pencil size={15} />
        </button>

        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          onClick={(e) => { e.stopPropagation(); onSetOpenRow(null); onDeleteTransaction(tx.id); }}
          className="swipe-action-btn-danger w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 shrink-0"
          title={t.deleteTooltip}
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Foreground Content Layer */}
      <div
        role="button"
        tabIndex={0}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onContextMenu={(e) => {
          e.preventDefault();
          onSetOpenRow(isOpen ? null : tx.id);
        }}
        onClick={handleRowClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenEditModal(tx);
          } else if (e.key === 'ArrowLeft') {
            onSetOpenRow(tx.id);
          } else if (e.key === 'ArrowRight' || e.key === 'Escape') {
            onSetOpenRow(null);
          }
        }}
        style={{
          transform: `translate3d(${translateX}px, 0, 0)`,
          transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          willChange: isDragging || isOpen ? 'transform' : 'auto',
        }}
        className="swipe-foreground-layer relative z-10 flex items-center justify-between py-2.5 first:pt-1 last:pb-0 group-first:pt-1 group-last:pb-0 gap-3 transition-colors select-none cursor-pointer"
      >
        {/* Left Column: Icon Badge + Description & Status Badges */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0">
            {isInvoice ? (
              <BankIcon card={cardObj} name={tx.description} size={18} badgeSize="md" />
            ) : (
              <CategoryIcon icon={cat?.icon || 'Tag'} color={cat?.color || '#64748b'} size={18} badgeSize="md" />
            )}
          </div>

          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 truncate">
              {tx.description}
            </span>

            <div className="flex items-center gap-1.5 mt-1 min-w-0">
              {isInvoice ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#6E5440]/10 text-[#6E5440] dark:bg-[#161B22] dark:border dark:border-[#21262D] dark:text-[#D0B595] text-[11px] font-semibold shrink-0">
                  <span>{language === 'pt-BR' ? 'Fatura Cartão' : 'Card Invoice'}</span>
                </span>
              ) : (
                <>
                  {isUnpaid ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[11px] font-semibold shrink-0">
                      <Clock size={10} className="shrink-0" />
                      <span>{t.pendingBadge}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold shrink-0">
                      <Check size={10} className="shrink-0" />
                      <span>
                        {tx.type === 'income'
                          ? language === 'pt-BR' ? 'Recebido' : 'Received'
                          : t.paidBadge || 'Pago'}
                      </span>
                    </span>
                  )}

                  {tx.installmentTotal && tx.installmentTotal > 1 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#161B22] text-slate-600 dark:text-slate-300 dark:border dark:border-[#21262D] text-[11px] font-semibold shrink-0">
                      {tx.installmentCurrent || 1}/{tx.installmentTotal}
                    </span>
                  )}

                  {tx.recurringId && !tx.installmentTotal && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#161B22] text-slate-500 dark:text-slate-400 dark:border dark:border-[#21262D] text-[11px] font-semibold shrink-0">
                      <Repeat size={10} className="shrink-0" />
                      <span>{language === 'pt-BR' ? 'Fixa' : 'Fixed'}</span>
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Amount + Category Name */}
        <div className="flex flex-col items-end shrink-0 text-right">
          <span
            className={`${getAdaptiveFeedFontSize(formattedAmount)} leading-tight tracking-tight whitespace-nowrap text-right ${
              tx.type === 'income'
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-500 dark:text-red-400'
            }`}
          >
            {formattedAmount}
          </span>
          <span className="text-xs font-medium text-slate-400 dark:text-slate-500 max-w-[130px] truncate text-right mt-0.5">
            {getCategoryDisplayName(cat, language)}
          </span>
        </div>
      </div>
    </div>
  );
};
