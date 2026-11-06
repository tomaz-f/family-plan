import React, { useState, useRef } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { AppLanguage, Category, Transaction } from '../../types';
import { CategoryIcon } from '../CategoryIcon';
import { formatCurrency } from '../../utils/format';
import { getCategoryDisplayName } from '../../utils/i18n';
import { formatShortNumericDate } from './cardStatementMath';

const INVOICE_SWIPE_WIDTH = 110;
const INVOICE_SWIPE_SNAP = 50;
const INVOICE_SWIPE_MAX = 130;

export interface SwipeableInvoiceItemProps {
  tx: Transaction;
  cat?: Category;
  currency: string;
  language: AppLanguage;
  isOled?: boolean;
  isOpen: boolean;
  anyRowOpen: boolean;
  onSetOpenRow: (id: string | null) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
}

export const SwipeableInvoiceItem: React.FC<SwipeableInvoiceItemProps> = ({
  tx, cat, currency, language, isOled = true, isOpen, anyRowOpen,
  onSetOpenRow, onEditTransaction, onDeleteTransaction,
}) => {
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const gestureRef = useRef<{
    startX: number; startY: number; initialOffset: number;
    lock: 'none' | 'horizontal' | 'vertical'; currentOffset: number; active: boolean;
  }>({ startX: 0, startY: 0, initialOffset: 0, lock: 'none', currentOffset: 0, active: false });

  const clampSwipeOffset = (rawOffset: number): number => {
    if (rawOffset > 0) return 0;
    if (rawOffset < -INVOICE_SWIPE_WIDTH) {
      const extra = rawOffset + INVOICE_SWIPE_WIDTH;
      return Math.max(-INVOICE_SWIPE_MAX, -INVOICE_SWIPE_WIDTH + extra * 0.25);
    }
    return rawOffset;
  };

  const finishSwipeGesture = () => {
    const g = gestureRef.current;
    if (!g.active) return;
    g.active = false;

    if (g.lock === 'horizontal') {
      const finalOffset = g.currentOffset;
      if (g.initialOffset === 0) {
        onSetOpenRow(finalOffset <= -INVOICE_SWIPE_SNAP ? tx.id : null);
      } else {
        onSetOpenRow(finalOffset > -INVOICE_SWIPE_WIDTH + 30 ? null : tx.id);
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
    const initial = isOpen ? -INVOICE_SWIPE_WIDTH : 0;
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
      if (e.cancelable) e.preventDefault();
      const clamped = clampSwipeOffset(g.initialOffset + deltaX);
      g.currentOffset = clamped;
      setDragOffset(clamped);
    }
  };

  const handleTouchEnd = () => finishSwipeGesture();

  const translateX = dragOffset !== null ? dragOffset : isOpen ? -INVOICE_SWIPE_WIDTH : 0;
  const hasInstallment = tx.installmentTotal && tx.installmentTotal > 1;

  return (
    <div className="relative overflow-hidden select-none rounded-xl group">
      <div
        className="swipe-actions-layer absolute inset-y-0 right-0 flex items-center justify-end gap-2 pr-3 z-0"
        style={{ width: `${INVOICE_SWIPE_WIDTH}px` }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSetOpenRow(null);
            onEditTransaction(tx);
          }}
          className="swipe-action-btn w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 shrink-0 shadow-xs"
          title="Editar compra"
        >
          <Pencil size={15} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSetOpenRow(null);
            onDeleteTransaction(tx);
          }}
          className="swipe-action-btn-danger w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 shrink-0 shadow-xs"
          title="Excluir compra"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={() => {
          if (isOpen) onSetOpenRow(null);
          else onEditTransaction(tx);
        }}
        style={{
          transform: `translate3d(${translateX}px, 0, 0)`,
          transition: isDragging ? 'none' : 'transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)',
          willChange: isDragging || isOpen ? 'transform' : 'auto',
        }}
        className={`swipe-foreground-layer relative z-10 flex items-center justify-between p-3 transition-colors gap-2.5 cursor-pointer border rounded-xl ${
          isOled
            ? 'bg-[#0D1117] border-[#21262D] hover:bg-[#161B22]/60'
            : 'bg-white border-slate-200 hover:bg-slate-50 shadow-xs'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <CategoryIcon
            icon={cat?.icon || 'Tag'}
            color={cat?.color || '#94A3B8'}
            size={16}
            badgeSize="md"
          />

          <div className="min-w-0 flex-1">
            <p className={`text-xs sm:text-sm font-semibold truncate leading-snug ${
              isOled ? 'text-[#F8FAFC]' : 'text-slate-900'
            }`}>
              {tx.description}
            </p>

            <div className={`flex items-center gap-1.5 flex-wrap text-[11px] mt-0.5 leading-none ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-500'
            }`}>
              <span className={`font-medium truncate max-w-[120px] ${
                isOled ? 'text-[#94A3B8]' : 'text-slate-600'
              }`}>
                {getCategoryDisplayName(cat, language)}
              </span>

              {hasInstallment && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${
                  isOled
                    ? 'bg-[#161B22] border-[#21262D] text-[#D0B595]'
                    : 'bg-slate-100 border-slate-200 text-slate-700'
                }`}>
                  {tx.installmentCurrent || 1}/{tx.installmentTotal}
                </span>
              )}

              {tx.notes && (
                <>
                  <span>•</span>
                  <span className={`italic truncate max-w-[120px] ${
                    isOled ? 'text-[#94A3B8]' : 'text-slate-500'
                  }`}>{tx.notes}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 pl-1">
          <div className="flex flex-col items-end justify-center text-right">
            <span className="text-sm font-semibold text-[#EF4444] whitespace-nowrap leading-tight">
              -{formatCurrency(tx.amount, currency)}
            </span>
            <span className={`text-xs mt-0.5 whitespace-nowrap leading-none ${
              isOled ? 'text-[#94A3B8]' : 'text-slate-500'
            }`}>
              {formatShortNumericDate(tx.purchaseDate || tx.date)}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditTransaction(tx);
              }}
              className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                isOled
                  ? 'bg-[#161B22] border-[#21262D] text-[#94A3B8] hover:text-[#F8FAFC]'
                  : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="Editar compra"
            >
              <Pencil size={12} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTransaction(tx);
              }}
              className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
                isOled
                  ? 'bg-[#161B22] border-[#21262D] text-[#EF4444] hover:bg-rose-500/20'
                  : 'bg-slate-100 border-slate-200 text-[#EF4444] hover:bg-rose-50'
              }`}
              title="Excluir compra"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface CardInvoiceItemsListProps {
  txs: Transaction[];
  categories: Category[];
  currency: string;
  language: AppLanguage;
  isOled: boolean;
  openRowId: string | null;
  onSetOpenRow: (id: string | null) => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (tx: Transaction) => void;
}

export const CardInvoiceItemsList: React.FC<CardInvoiceItemsListProps> = ({
  txs, categories, currency, language, isOled, openRowId,
  onSetOpenRow, onEditTransaction, onDeleteTransaction,
}) => {
  if (txs.length === 0) {
    return (
      <div className={`py-6 px-4 rounded-xl border text-center ${
        isOled ? 'bg-[#161B22]/50 border-[#21262D]' : 'bg-slate-50 border-slate-200'
      }`}>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          {language === 'pt-BR'
            ? 'Nenhuma compra lançada nesta fatura.'
            : 'No purchases recorded for this invoice.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {txs.map((tx) => {
        const cat = categories.find((c) => c.id === tx.categoryId);
        return (
          <SwipeableInvoiceItem
            key={tx.id}
            tx={tx}
            cat={cat}
            currency={currency}
            language={language}
            isOled={isOled}
            isOpen={openRowId === tx.id}
            anyRowOpen={openRowId !== null}
            onSetOpenRow={onSetOpenRow}
            onEditTransaction={onEditTransaction}
            onDeleteTransaction={onDeleteTransaction}
          />
        );
      })}
    </div>
  );
};
