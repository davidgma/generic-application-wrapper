import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface FiveRegionLayoutProps {
  topContent?: React.ReactNode;
  bottomContent?: React.ReactNode;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  middleContent?: React.ReactNode;
  initialTopHeight?: number;
  initialBottomHeight?: number;
  initialLeftWidth?: number;
  initialRightWidth?: number;
  topHeight?: number;
  bottomHeight?: number;
  leftWidth?: number;
  rightWidth?: number;
  onDimensionsChange?: (dims: { topHeight: number; bottomHeight: number; leftWidth: number; rightWidth: number }) => void;
  minTopHeight?: number;
  maxTopHeight?: number;
  minBottomHeight?: number;
  maxBottomHeight?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  minRightWidth?: number;
  maxRightWidth?: number;
  theme?: 'vs-dark' | 'vs-light';
  className?: string;
}

export const FiveRegionLayout: React.FC<FiveRegionLayoutProps> = ({
  topContent,
  bottomContent,
  leftContent,
  rightContent,
  middleContent,
  initialTopHeight = 96,
  initialBottomHeight = 28,
  initialLeftWidth = 280,
  initialRightWidth = 300,
  topHeight: controlledTopHeight,
  bottomHeight: controlledBottomHeight,
  leftWidth: controlledLeftWidth,
  rightWidth: controlledRightWidth,
  onDimensionsChange,
  minTopHeight = 40,
  maxTopHeight = 400,
  minBottomHeight = 20,
  maxBottomHeight = 300,
  minLeftWidth = 160,
  maxLeftWidth = 600,
  minRightWidth = 160,
  maxRightWidth = 600,
  theme = 'vs-dark',
  className = '',
}) => {
  const isDark = theme === 'vs-dark';

  // Heights and widths state
  const [topHeight, setTopHeight] = useState<number>(controlledTopHeight ?? initialTopHeight);
  const [bottomHeight, setBottomHeight] = useState<number>(controlledBottomHeight ?? initialBottomHeight);
  const [leftWidth, setLeftWidth] = useState<number>(controlledLeftWidth ?? initialLeftWidth);
  const [rightWidth, setRightWidth] = useState<number>(controlledRightWidth ?? initialRightWidth);

  useEffect(() => {
    if (controlledTopHeight !== undefined) setTopHeight(controlledTopHeight);
  }, [controlledTopHeight]);

  useEffect(() => {
    if (controlledBottomHeight !== undefined) setBottomHeight(controlledBottomHeight);
  }, [controlledBottomHeight]);

  useEffect(() => {
    if (controlledLeftWidth !== undefined) setLeftWidth(controlledLeftWidth);
  }, [controlledLeftWidth]);

  useEffect(() => {
    if (controlledRightWidth !== undefined) setRightWidth(controlledRightWidth);
  }, [controlledRightWidth]);

  // Active dragging handle state
  const [activeDrag, setActiveDrag] = useState<'top' | 'bottom' | 'left' | 'right' | null>(null);

  // Screen size check for mobile stack layout
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // References for mouse drag positioning
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startDimension: number;
  }>({ startX: 0, startY: 0, startDimension: 0 });

  // Start drag handlers
  const handleStartDragTop = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startX: 0, startY: clientY, startDimension: topHeight };
    setActiveDrag('top');
  }, [topHeight]);

  const handleStartDragBottom = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startX: 0, startY: clientY, startDimension: bottomHeight };
    setActiveDrag('bottom');
  }, [bottomHeight]);

  const handleStartDragLeft = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    dragRef.current = { startX: clientX, startY: 0, startDimension: leftWidth };
    setActiveDrag('left');
  }, [leftWidth]);

  const handleStartDragRight = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    dragRef.current = { startX: clientX, startY: 0, startDimension: rightWidth };
    setActiveDrag('right');
  }, [rightWidth]);

  // Global mousemove & mouseup listeners during dragging
  useEffect(() => {
    if (!activeDrag) return;

    const handlePointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;

      let nextTop = topHeight;
      let nextBottom = bottomHeight;
      let nextLeft = leftWidth;
      let nextRight = rightWidth;

      if (activeDrag === 'top') {
        const deltaY = clientY - dragRef.current.startY;
        nextTop = Math.max(minTopHeight, Math.min(maxTopHeight, dragRef.current.startDimension + deltaY));
        setTopHeight(nextTop);
      } else if (activeDrag === 'bottom') {
        const deltaY = dragRef.current.startY - clientY;
        nextBottom = Math.max(minBottomHeight, Math.min(maxBottomHeight, dragRef.current.startDimension + deltaY));
        setBottomHeight(nextBottom);
      } else if (activeDrag === 'left') {
        const deltaX = clientX - dragRef.current.startX;
        nextLeft = Math.max(minLeftWidth, Math.min(maxLeftWidth, dragRef.current.startDimension + deltaX));
        setLeftWidth(nextLeft);
      } else if (activeDrag === 'right') {
        const deltaX = dragRef.current.startX - clientX;
        nextRight = Math.max(minRightWidth, Math.min(maxRightWidth, dragRef.current.startDimension + deltaX));
        setRightWidth(nextRight);
      }

      onDimensionsChange?.({
        topHeight: nextTop,
        bottomHeight: nextBottom,
        leftWidth: nextLeft,
        rightWidth: nextRight,
      });
    };

    const handlePointerUp = () => {
      setActiveDrag(null);
    };

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [
    activeDrag,
    minTopHeight,
    maxTopHeight,
    minBottomHeight,
    maxBottomHeight,
    minLeftWidth,
    maxLeftWidth,
    minRightWidth,
    maxRightWidth,
  ]);

  // Handle dividers styling
  const dividerColor = isDark ? 'bg-slate-800 hover:bg-indigo-500/80 border-slate-700/60' : 'bg-slate-200 hover:bg-blue-400 border-slate-300';
  const activeDividerColor = isDark ? 'bg-indigo-500' : 'bg-blue-500';

  // Mobile layout: Stack areas in order Top, Left, Middle, Right, Bottom
  if (isMobile) {
    return (
      <div className={`flex flex-col w-full h-full min-h-0 overflow-y-auto ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'} ${className}`}>
        {topContent && <div className="w-full flex-shrink-0">{topContent}</div>}
        {leftContent && <div className="w-full flex-shrink-0 border-b border-slate-800">{leftContent}</div>}
        {middleContent && <div className="w-full flex-1 min-h-0">{middleContent}</div>}
        {rightContent && <div className="w-full flex-shrink-0 border-t border-slate-800">{rightContent}</div>}
        {bottomContent && <div className="w-full flex-shrink-0 border-t border-slate-800">{bottomContent}</div>}
      </div>
    );
  }

  // Desktop / Tablet Grid Layout
  return (
    <div
      className={`flex flex-col h-screen w-screen overflow-hidden select-text relative ${
        activeDrag ? 'select-none' : ''
      } ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'} ${className}`}
    >
      {/* 1. TOP AREA */}
      {topContent && (
        <div className="relative flex-shrink-0 flex flex-col w-full overflow-hidden" style={{ height: `${topHeight}px` }}>
          <div className="@container plugin-container flex-1 overflow-hidden">{topContent}</div>

          {/* Top-to-Bottom Horizontal Resize Handle */}
          <div
            onMouseDown={handleStartDragTop}
            onTouchStart={handleStartDragTop}
            className={`h-1.5 cursor-row-resize flex-shrink-0 transition-colors z-30 group relative flex items-center justify-center ${
              activeDrag === 'top' ? activeDividerColor : dividerColor
            }`}
            title="Drag to resize top panel height"
          >
            <div className={`w-8 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'bg-slate-400' : 'bg-slate-600'}`} />
          </div>
        </div>
      )}

      {/* 2. MIDDLE ROW (LEFT, MIDDLE, RIGHT) */}
      <div className="flex-1 flex flex-row overflow-hidden min-h-0 min-w-0 w-full relative">
        {/* LEFT AREA */}
        {leftContent && (
          <div
            className="relative flex-shrink-0 flex flex-row h-full overflow-hidden"
            style={{ width: `${leftWidth}px` }}
          >
            <div className="@container plugin-container flex-1 h-full overflow-hidden">{leftContent}</div>

            {/* Left-to-Middle Vertical Resize Handle */}
            <div
              onMouseDown={handleStartDragLeft}
              onTouchStart={handleStartDragLeft}
              className={`w-1.5 cursor-col-resize flex-shrink-0 transition-colors z-30 group relative flex items-center justify-center ${
                activeDrag === 'left' ? activeDividerColor : dividerColor
              }`}
              title="Drag to resize left panel width"
            >
              <div className={`h-8 w-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'bg-slate-400' : 'bg-slate-600'}`} />
            </div>
          </div>
        )}

        {/* MIDDLE AREA */}
        {middleContent && (
          <div className="flex-1 flex flex-col h-full min-w-0 min-h-0 overflow-hidden relative">
            <div className="@container plugin-container w-full h-full flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
              {middleContent}
            </div>
          </div>
        )}

        {/* RIGHT AREA */}
        {rightContent && (
          <div
            className="relative flex-shrink-0 flex flex-row h-full overflow-hidden"
            style={{ width: `${rightWidth}px` }}
          >
            {/* Right-to-Middle Vertical Resize Handle */}
            <div
              onMouseDown={handleStartDragRight}
              onTouchStart={handleStartDragRight}
              className={`w-1.5 cursor-col-resize flex-shrink-0 transition-colors z-30 group relative flex items-center justify-center ${
                activeDrag === 'right' ? activeDividerColor : dividerColor
              }`}
              title="Drag to resize right panel width"
            >
              <div className={`h-8 w-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'bg-slate-400' : 'bg-slate-600'}`} />
            </div>

            <div className="@container plugin-container flex-1 h-full overflow-hidden">{rightContent}</div>
          </div>
        )}
      </div>

      {/* 3. BOTTOM AREA */}
      {bottomContent && (
        <div className="relative flex-shrink-0 flex flex-col w-full overflow-hidden" style={{ height: `${bottomHeight}px` }}>
          {/* Bottom-to-Middle Horizontal Resize Handle */}
          <div
            onMouseDown={handleStartDragBottom}
            onTouchStart={handleStartDragBottom}
            className={`h-1.5 cursor-row-resize flex-shrink-0 transition-colors z-30 group relative flex items-center justify-center ${
              activeDrag === 'bottom' ? activeDividerColor : dividerColor
            }`}
            title="Drag to resize bottom panel height"
          >
            <div className={`w-8 h-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'bg-slate-400' : 'bg-slate-600'}`} />
          </div>

          <div className="@container plugin-container flex-1 overflow-hidden">{bottomContent}</div>
        </div>
      )}
    </div>
  );
};
