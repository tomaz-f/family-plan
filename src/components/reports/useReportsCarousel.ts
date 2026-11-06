import React, { useState, useRef, useCallback, useEffect } from 'react';
import { VIRTUAL_SLIDE_MAP } from './reportsTypes';

export function useReportsCarousel() {
  // vIndex starts at 1 (logical Card 0: "Distribuição por Categoria - Fluxo de Caixa")
  const [vIndex, setVIndex] = useState<number>(1);
  const vIndexRef = useRef<number>(1);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const wasDraggedRef = useRef<boolean>(false);

  const gestureRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastTime: number;
    vx: number;
    lock: 'none' | 'h' | 'v';
  }>({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastTime: 0,
    vx: 0,
    lock: 'none',
  });

  const startGesture = useCallback((clientX: number, clientY: number) => {
    const curV = vIndexRef.current;
    if (curV === 0) {
      vIndexRef.current = 4;
      setVIndex(4);
    } else if (curV === 5) {
      vIndexRef.current = 1;
      setVIndex(1);
    }

    setIsAnimating(false);
    const now = performance.now();
    gestureRef.current = {
      active: true,
      startX: clientX,
      startY: clientY,
      lastX: clientX,
      lastTime: now,
      vx: 0,
      lock: 'none',
    };
    wasDraggedRef.current = false;
  }, []);

  const moveGesture = useCallback(
    (clientX: number, clientY: number, preventDefault?: () => void) => {
      const g = gestureRef.current;
      if (!g.active) return;

      const deltaX = clientX - g.startX;
      const deltaY = clientY - g.startY;

      if (g.lock === 'none') {
        if (Math.abs(deltaX) < 6 && Math.abs(deltaY) < 6) return;

        if (Math.abs(deltaY) >= Math.abs(deltaX)) {
          g.lock = 'v';
          g.active = false;
          setIsDragging(false);
          setDragOffset(0);
          return;
        }

        g.lock = 'h';
        wasDraggedRef.current = true;
        setIsAnimating(false);
        setIsDragging(true);
      }

      if (g.lock === 'h') {
        if (preventDefault) preventDefault();

        const now = performance.now();
        const dt = now - g.lastTime;
        if (dt > 0) {
          const instantVx = (clientX - g.lastX) / dt;
          g.vx = g.vx * 0.3 + instantVx * 0.7;
        }
        g.lastX = clientX;
        g.lastTime = now;

        setDragOffset(deltaX);
      }
    },
    []
  );

  const endGesture = useCallback(() => {
    const g = gestureRef.current;
    if (!g.active) return;
    g.active = false;

    if (g.lock === 'h') {
      const deltaX = g.lastX - g.startX;
      const now = performance.now();
      const effectiveVx = now - g.lastTime > 120 ? 0 : g.vx;

      const swipeThresholdPx = 50;
      const flickVelocityThreshold = 0.35;

      let nextV = vIndexRef.current;
      if (deltaX < -swipeThresholdPx || (effectiveVx < -flickVelocityThreshold && deltaX < -15)) {
        nextV = Math.min(VIRTUAL_SLIDE_MAP.length - 1, vIndexRef.current + 1);
      } else if (
        deltaX > swipeThresholdPx ||
        (effectiveVx > flickVelocityThreshold && deltaX > 15)
      ) {
        nextV = Math.max(0, vIndexRef.current - 1);
      }

      vIndexRef.current = nextV;
      setIsDragging(false);
      setIsAnimating(true);
      setVIndex(nextV);
      setDragOffset(0);
    }

    g.lock = 'none';
  }, []);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    startGesture(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    moveGesture(e.touches[0].clientX, e.touches[0].clientY, () => {
      if (e.cancelable) e.preventDefault();
    });
  };

  const handleTouchEnd = () => {
    endGesture();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    startGesture(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!gestureRef.current.active) return;
    moveGesture(e.clientX, e.clientY, () => {
      if (e.cancelable) e.preventDefault();
    });
  };

  const handleMouseUp = () => {
    endGesture();
  };

  const handleClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (wasDraggedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      wasDraggedRef.current = false;
    }
  };

  const handleTrackTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;

    if (vIndexRef.current === 5) {
      vIndexRef.current = 1;
      setIsAnimating(false);
      setVIndex(1);
    } else if (vIndexRef.current === 0) {
      vIndexRef.current = 4;
      setIsAnimating(false);
      setVIndex(4);
    } else {
      setIsAnimating(false);
    }
  };

  useEffect(() => {
    if (!isAnimating) return;
    const timer = setTimeout(() => {
      if (vIndexRef.current === 5) {
        vIndexRef.current = 1;
        setIsAnimating(false);
        setVIndex(1);
      } else if (vIndexRef.current === 0) {
        vIndexRef.current = 4;
        setIsAnimating(false);
        setVIndex(4);
      } else {
        setIsAnimating(false);
      }
    }, 365);
    return () => clearTimeout(timer);
  }, [isAnimating, vIndex]);

  const activeSlideIndex = VIRTUAL_SLIDE_MAP[vIndex] ?? 0;

  const handleSelectSlide = useCallback((targetLogicalIdx: number) => {
    const targetV = targetLogicalIdx + 1;
    if (vIndexRef.current === targetV) return;
    if (VIRTUAL_SLIDE_MAP[vIndexRef.current] === targetLogicalIdx) return;

    vIndexRef.current = targetV;
    setIsDragging(false);
    setIsAnimating(true);
    setVIndex(targetV);
    setDragOffset(0);
  }, []);

  return {
    vIndex,
    dragOffset,
    isDragging,
    isAnimating,
    activeSlideIndex,
    handleSelectSlide,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleClickCapture,
    handleTrackTransitionEnd,
  };
}
