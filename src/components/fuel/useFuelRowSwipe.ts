import React, { useState, useRef } from 'react';
import { FuelLog } from '../../types';

export const SWIPE_REVEAL_WIDTH = 100;
export const SWIPE_SNAP_THRESHOLD = 45;
export const SWIPE_MAX_DRAG = 125;

export interface UseFuelRowSwipeParams {
  log: FuelLog;
  isOpen: boolean;
  anyRowOpen: boolean;
  onSetOpenRow: (id: string | null) => void;
  onOpenEdit: (log: FuelLog) => void;
}

export function useFuelRowSwipe({
  log,
  isOpen,
  anyRowOpen,
  onSetOpenRow,
  onOpenEdit,
}: UseFuelRowSwipeParams) {
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const gestureRef = useRef<{
    startX: number;
    startY: number;
    initialOffset: number;
    lock: 'none' | 'horizontal' | 'vertical';
    currentOffset: number;
    active: boolean;
  }>({
    startX: 0,
    startY: 0,
    initialOffset: 0,
    lock: 'none',
    currentOffset: 0,
    active: false,
  });

  const lastSwipeTimeRef = useRef<number>(0);

  const clampSwipeOffset = (rawOffset: number): number => {
    if (rawOffset > 0) return 0;
    if (rawOffset < -SWIPE_REVEAL_WIDTH) {
      const extra = rawOffset + SWIPE_REVEAL_WIDTH;
      return Math.max(-SWIPE_MAX_DRAG, -SWIPE_REVEAL_WIDTH + extra * 0.25);
    }
    return rawOffset;
  };

  const finishSwipeGesture = () => {
    const g = gestureRef.current;
    if (!g.active) return;
    g.active = false;

    if (g.lock === 'horizontal') {
      lastSwipeTimeRef.current = Date.now();
      const finalOffset = g.currentOffset;
      if (g.initialOffset === 0) {
        if (finalOffset <= -SWIPE_SNAP_THRESHOLD) {
          onSetOpenRow(log.id);
        } else {
          onSetOpenRow(null);
        }
      } else {
        if (finalOffset > -SWIPE_REVEAL_WIDTH + 25) {
          onSetOpenRow(null);
        } else {
          onSetOpenRow(log.id);
        }
      }
    }

    g.lock = 'none';
    setIsDragging(false);
    setDragOffset(null);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (anyRowOpen && !isOpen) {
      onSetOpenRow(null);
    }
    const initial = isOpen ? -SWIPE_REVEAL_WIDTH : 0;
    gestureRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initialOffset: initial,
      lock: 'none',
      currentOffset: initial,
      active: true,
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

  const handleTouchEnd = () => {
    finishSwipeGesture();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (anyRowOpen && !isOpen) {
      onSetOpenRow(null);
    }
    const initial = isOpen ? -SWIPE_REVEAL_WIDTH : 0;
    gestureRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialOffset: initial,
      lock: 'none',
      currentOffset: initial,
      active: true,
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
    onOpenEdit(log);
  };

  const translateX = dragOffset !== null ? dragOffset : isOpen ? -SWIPE_REVEAL_WIDTH : 0;

  return {
    dragOffset,
    isDragging,
    translateX,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleRowClick,
  };
}
