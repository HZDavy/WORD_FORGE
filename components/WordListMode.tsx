import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { VocabularyItem } from '../types';
import { Eye, EyeOff, Shuffle, RotateCcw, LightbulbOff, AlertTriangle, FileBadge } from 'lucide-react';

interface Props {
  data: VocabularyItem[];
  onExit: () => void;
  onUpdateLevel: (id: string, level: number) => void;
  onResetLevels: () => void;
  onShuffle: () => void;
  onRestore: () => void;
  onGetSourceName: (id: string) => string | undefined;
}

const WordRow = React.memo(({ 
  item, 
  idx, 
  isDefVisible, 
  isSelected, 
  showSource, 
  sourceName,
  onRowClick,
  onLightSwipeStart,
  onLightSwipeMove,
  onLightSwipeEnd,
  onLevelClick,
  onWordCycle,
  onToggleDef,
  setRowHeight
}: {
  item: VocabularyItem;
  idx: number;
  isDefVisible: boolean;
  isSelected: boolean;
  showSource: boolean;
  sourceName?: string;
  onRowClick: (e: React.MouseEvent, idx: number) => void;
  onLightSwipeStart: (e: React.TouchEvent, idx: number) => void;
  onLightSwipeMove: (e: React.TouchEvent, item: VocabularyItem) => void;
  onLightSwipeEnd: () => void;
  onLevelClick: (e: React.MouseEvent, id: string, level: number, idx: number) => void;
  onWordCycle: (e: React.MouseEvent, item: VocabularyItem, idx: number) => void;
  onToggleDef: (e: React.MouseEvent, id: string, idx: number) => void;
  setRowHeight: (idx: number, height: number) => void;
}) => {
    const rowRef = useRef<HTMLDivElement>(null);

    // Dynamic height measurement
    useEffect(() => {
        if (!rowRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
                // Use borderBoxSize if available for better accuracy including padding/border
                const height = entry.borderBoxSize?.[0]?.blockSize || entry.contentRect.height;
                setRowHeight(idx, height);
            }
        });
        resizeObserver.observe(rowRef.current);
        return () => resizeObserver.disconnect();
    }, [idx, setRowHeight]);

    return (
      <div 
          ref={rowRef}
          id={`word-row-${idx}`}
          onClick={(e) => onRowClick(e, idx)} 
          className={`
            w-full box-border absolute top-0 left-0
            flex flex-col p-4 rounded-lg border md:rounded-none md:p-0 md:grid md:grid-cols-[60px_1fr_2fr] md:gap-x-6 md:items-center border-b md:border-b transition-colors cursor-pointer 
            ${isSelected ? 'bg-monkey-main/10 border-monkey-main/30 md:bg-monkey-main/5 ring-1 ring-monkey-main/20 z-10' : 'bg-[#2c2e31] border-monkey-sub/10 md:bg-transparent md:border-monkey-sub/10'}
          `}
      >
          {/* Traffic Lights Column - Pointer events removed from container to allow row click */}
          <div className="flex justify-between items-center mb-2 md:mb-0 md:justify-center gap-1 md:py-3 pointer-events-none">
              <span className="text-xs text-monkey-sub font-bold uppercase md:hidden">Level</span>
               {/* Inner Interactive Wrapper */}
               <div 
                  className="flex gap-1 pointer-events-auto cursor-ew-resize touch-none p-2 -m-2"
                  onTouchStart={(e) => { e.stopPropagation(); onLightSwipeStart(e, idx); }}
                  onTouchMove={(e) => { e.stopPropagation(); onLightSwipeMove(e, item); }}
                  onTouchEnd={(e) => { e.stopPropagation(); onLightSwipeEnd(); }}
               >
                  {[1, 2, 3].map(l => (
                      <div 
                          key={l}
                          onClick={(e) => { e.stopPropagation(); onLevelClick(e, item.id, item.level === l ? l - 1 : l, idx); }}
                          className={`w-3 h-3 md:w-2 md:h-2 rounded-full border border-monkey-sub/50 cursor-pointer transition-transform ${item.level >= l ? (item.level === 3 ? 'bg-green-500 border-green-500' : 'bg-monkey-main border-monkey-main') : 'bg-transparent'}`}
                      ></div>
                  ))}
               </div>
          </div>

          {/* Word Column */}
          <div 
              className="text-xl md:text-lg font-bold text-monkey-text select-text transition-colors mb-2 md:mb-0 md:py-3 flex flex-wrap items-center gap-2"
          >
              <span
                  className="cursor-pointer hover:text-white"
                  onClick={(e) => { e.stopPropagation(); onWordCycle(e, item, idx); }}
              >
                  {item.word}
              </span>
              {sourceName && (
                  <span className="text-[10px] bg-monkey-sub/20 text-monkey-sub px-1.5 py-0.5 rounded font-normal align-middle truncate max-w-[120px]">
                      {sourceName}
                  </span>
              )}
          </div>

          {/* Definition Column */}
          <div 
              className="leading-relaxed md:py-3 min-h-[1.5em] group"
          >
              <span 
                onClick={(e) => { e.stopPropagation(); onToggleDef(e, item.id, idx); }}
                className={`
                  rounded px-1 cursor-pointer
                  ${isDefVisible 
                    ? 'bg-transparent text-gray-200' 
                    : 'bg-[#3f4145] text-transparent select-none hover:bg-[#4a4c50] box-decoration-clone' 
                  }
                `}
              >
                  {item.definition}
              </span>
          </div>
      </div>
  );
}, (prev, next) => {
    return (
        prev.item === next.item && 
        prev.idx === next.idx &&
        prev.isDefVisible === next.isDefVisible &&
        prev.isSelected === next.isSelected &&
        prev.showSource === next.showSource &&
        prev.sourceName === next.sourceName
    );
});

export const WordListMode: React.FC<Props> = ({ data, onExit, onUpdateLevel, onResetLevels, onShuffle, onRestore, onGetSourceName }) => {
  const [showAllDefs, setShowAllDefs] = useState(false);
  const [visibleDefs, setVisibleDefs] = useState<Set<string>>(new Set());
  
  // Display Options
  const [showSource, setShowSource] = useState(false);

  // Modal State
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isClosingModal, setIsClosingModal] = useState(false);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [usingKeyboard, setUsingKeyboard] = useState(false);
  
  // Filter Logic
  const [activeLevels, setActiveLevels] = useState<Set<number>>(new Set([0, 1, 2, 3]));
  const lightSwipeStartX = useRef<number | null>(null);
  const lastLightUpdateX = useRef<number | null>(null);

  const filteredData = useMemo(() => {
    return data.filter(item => activeLevels.has(item.level));
  }, [data, activeLevels]);

  // Virtualization State
  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(800);
  const rowHeights = useRef<{[key: number]: number}>({});
  
  // Force update when heights change to re-calculate offsets
  const [, forceUpdate] = useState({});

  useEffect(() => {
      // Reset heights when data changes to prevent layout issues
      rowHeights.current = {};
  }, [filteredData]);

  useEffect(() => {
      if (!parentRef.current) return;
      const resizeObserver = new ResizeObserver((entries) => {
          for (let entry of entries) {
              setContainerHeight(entry.contentRect.height);
          }
      });
      resizeObserver.observe(parentRef.current);
      return () => resizeObserver.disconnect();
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const setRowHeight = useCallback((index: number, height: number) => {
      if (rowHeights.current[index] !== height) {
          rowHeights.current[index] = height;
          forceUpdate({});
      }
  }, []);

  // Calculate Virtual Items
  const isMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
  const gap = isMobile ? 16 : 0; // 16px gap on mobile (gap-4), 0 on desktop
  
  let currentOffset = 0;
  const virtualItems = [];
  let startIndex = -1;
  let endIndex = -1;
  
  // Buffer height to render outside visible area
  const buffer = 500; 

  for (let i = 0; i < filteredData.length; i++) {
      // Use measured height or estimate (150 for mobile card, 60 for desktop row)
      const height = rowHeights.current[i] || (isMobile ? 150 : 60);
      
      const top = currentOffset;
      const bottom = top + height;

      if (bottom >= scrollTop - buffer && top <= scrollTop + containerHeight + buffer) {
          if (startIndex === -1) startIndex = i;
          endIndex = i;
          virtualItems.push({
              index: i,
              offsetTop: top,
              item: filteredData[i]
          });
      }
      
      currentOffset += height + gap;
  }
  
  const totalHeight = currentOffset + 80; // Extra padding at bottom

  // Clamp index if list shrinks
  useEffect(() => {
     if (selectedIndex >= filteredData.length && filteredData.length > 0) {
         setSelectedIndex(Math.max(0, filteredData.length - 1));
     }
  }, [filteredData.length]);

  // Handle explicit reset when changing filters
  useEffect(() => {
      setSelectedIndex(0);
  }, [activeLevels]);

  const toggleFilter = (level: number) => {
    setActiveLevels(prev => {
        const next = new Set(prev);
        if (next.has(level)) next.delete(level);
        else next.add(level);
        if (next.size === 0) return prev; 
        return next;
    });
  };

  const handleResetClick = () => {
      setShowResetConfirm(true);
      setIsClosingModal(false);
  };

  const handleCloseModal = () => {
      setIsClosingModal(true);
      setTimeout(() => {
          setShowResetConfirm(false);
          setIsClosingModal(false);
      }, 400); 
  };

  const confirmReset = () => {
      onResetLevels();
      setActiveLevels(new Set([0, 1, 2, 3]));
      handleCloseModal();
  };

  const toggleAll = useCallback(() => {
    setShowAllDefs(prev => !prev);
    setVisibleDefs(new Set()); 
  }, []);

  const toggleIndividual = useCallback((e: React.MouseEvent, id: string, idx: number) => {
    setVisibleDefs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleLevelClick = useCallback((e: React.MouseEvent, id: string, level: number, idx: number) => {
      // Keyboard selection logic handled by stopPropagation in row
      onUpdateLevel(id, level);
  }, [onUpdateLevel]);
  
  const handleWordCycle = useCallback((e: React.MouseEvent, item: VocabularyItem, idx: number) => {
      const nextLevel = item.level >= 3 ? 0 : item.level + 1;
      onUpdateLevel(item.id, nextLevel);
  }, [onUpdateLevel]);

  const handleLightSwipeStart = useCallback((e: React.TouchEvent, idx: number) => {
      lightSwipeStartX.current = e.touches[0].clientX;
      lastLightUpdateX.current = e.touches[0].clientX;
  }, []);

  const handleLightSwipeMove = useCallback((e: React.TouchEvent, item: VocabularyItem) => {
      if (lastLightUpdateX.current === null) return;
      const currentX = e.touches[0].clientX;
      const diff = currentX - lastLightUpdateX.current;
      const THRESHOLD = 10; 

      if (Math.abs(diff) > THRESHOLD) {
          if (diff > 0) {
              // Right
              if (item.level < 3) {
                  onUpdateLevel(item.id, item.level + 1);
                  lastLightUpdateX.current = currentX;
              }
          } else {
              // Left
              if (item.level > 0) {
                  onUpdateLevel(item.id, item.level - 1);
                  lastLightUpdateX.current = currentX;
              }
          }
      }
  }, [onUpdateLevel]);

  const handleLightSwipeEnd = useCallback(() => {
      lightSwipeStartX.current = null;
      lastLightUpdateX.current = null;
  }, []);

  const handleRowClick = useCallback((e: React.MouseEvent, index: number) => {
      // This is now reachable because inner elements stop propagation
      e.stopPropagation(); 
      setSelectedIndex(index);
      setUsingKeyboard(true); 
  }, []);

  // Global Interaction Listener (Mouse vs Keyboard)
  useEffect(() => {
      const handleUserInteraction = (e: Event) => {
          if (e.type === 'mousemove') {
             setUsingKeyboard(false);
          }
      };
      
      window.addEventListener('mousemove', handleUserInteraction);
      return () => {
          window.removeEventListener('mousemove', handleUserInteraction);
      }
  }, []);

  // Keyboard Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
       if (e.code === 'Escape') {
           if (showResetConfirm) {
               handleCloseModal();
           } else {
               onExit();
           }
           return;
       }
       
       // Filters
       if (e.key === '`' || e.key === '~' || e.code === 'Backquote') toggleFilter(0);
       if (e.key === '1') toggleFilter(1);
       if (e.key === '2') toggleFilter(2);
       if (e.key === '3') toggleFilter(3);

       // Toolbar Shortcuts
       if (e.key === '4') { onShuffle(); setSelectedIndex(0); }
       if (e.key === '5') { onRestore(); setSelectedIndex(0); }
       if (e.key === '6') handleResetClick();
       if (e.key === '7') setShowSource(prev => !prev);
       if (e.key === '8') toggleAll();

       // Navigation
       if (e.code === 'ArrowDown') {
           e.preventDefault();
           setUsingKeyboard(true);
           setSelectedIndex(prev => Math.min(prev + 1, filteredData.length - 1));
       } else if (e.code === 'ArrowUp') {
           e.preventDefault();
           setUsingKeyboard(true);
           setSelectedIndex(prev => Math.max(prev - 1, 0));
       } else if (e.code === 'Space') {
           e.preventDefault();
           setUsingKeyboard(true);
           const item = filteredData[selectedIndex];
           if (item) {
               setVisibleDefs(prev => {
                   const next = new Set(prev);
                   if (next.has(item.id)) next.delete(item.id);
                   else next.add(item.id);
                   return next;
               });
           }
       } else if (e.code === 'ArrowRight') {
           e.preventDefault();
           setUsingKeyboard(true);
           const item = filteredData[selectedIndex];
           if (item && item.level < 3) onUpdateLevel(item.id, item.level + 1);
       } else if (e.code === 'ArrowLeft') {
           e.preventDefault();
           setUsingKeyboard(true);
           const item = filteredData[selectedIndex];
           if (item && item.level > 0) onUpdateLevel(item.id, item.level - 1);
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onExit, filteredData, selectedIndex, onUpdateLevel, showResetConfirm, toggleAll]);

  // Scroll current item into view if not visible (simplified auto-scroll)
  useEffect(() => {
      if (filteredData.length > 0 && usingKeyboard && parentRef.current) {
         // Logic to auto-scroll virtual list is complex, for now we rely on user scrolling or minimal behavior
         // Proper auto-scroll needs to know offsets. We have offsets in 'virtualItems' but only for rendered ones.
         // We can calculate offset of selectedIndex roughly.
         const heightEstimate = isMobile ? 150 : 60;
         const estimatedTop = selectedIndex * heightEstimate; // Rough fallback
         const measuredTop = rowHeights.current[selectedIndex] !== undefined 
            ? Object.entries(rowHeights.current)
                .filter(([k]) => parseInt(k) < selectedIndex)
                .reduce((acc, [, h]) => acc + h + gap, 0)
            : estimatedTop;
         
         const parent = parentRef.current;
         if (measuredTop < parent.scrollTop) {
             parent.scrollTo({ top: measuredTop, behavior: 'smooth' });
         } else if (measuredTop + heightEstimate > parent.scrollTop + parent.clientHeight) {
             parent.scrollTo({ top: measuredTop - parent.clientHeight + heightEstimate + 50, behavior: 'smooth' });
         }
      }
  }, [selectedIndex, filteredData, usingKeyboard, isMobile, gap]);

  return (
    <div 
        className="w-full max-w-4xl mx-auto flex flex-col h-full pt-4 relative animate-game-pop-in"
        onClick={() => setUsingKeyboard(false)}
    >
      {/* Confirmation Modal */}
      {showResetConfirm && createPortal(
        <div 
            className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm touch-none transition-opacity duration-300 ${isClosingModal ? 'opacity-0' : 'opacity-100'}`}
            onClick={(e) => { e.stopPropagation(); handleCloseModal(); }}
        >
          <div 
            className={`bg-[#2c2e31] border border-monkey-sub/30 p-6 rounded-xl max-w-sm w-full mx-4 ${isClosingModal ? 'animate-spring-out' : 'animate-spring-in'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-monkey-error mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-xl font-bold">Extinguish All?</h3>
            </div>
            <p className="text-monkey-sub mb-6">
              This will reset the grading level of ALL {data.length} words to 0. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={(e) => { e.stopPropagation(); handleCloseModal(); }}
                className="px-4 py-2 rounded text-monkey-sub hover:text-monkey-text hover:bg-monkey-sub/10 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); confirmReset(); }}
                className="px-4 py-2 rounded bg-monkey-error text-white hover:bg-red-600 transition-colors font-bold"
              >
                Extinguish
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Header / Toolbar */}
      <div 
        className="flex flex-col gap-4 mb-4 border-b border-monkey-sub/20 bg-monkey-bg sticky top-0 z-20 py-2 shrink-0"
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-2xl font-bold text-monkey-main">Word List</h2>
                <p className="text-xs text-monkey-sub">{filteredData.length} words visible</p>
            </div>
            
            <div className="flex gap-2">
                {[0, 1, 2, 3].map(level => (
                    <button 
                        key={level} 
                        onClick={() => toggleFilter(level)}
                        className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-all ${
                            activeLevels.has(level) 
                                ? 'bg-[#3e4044] text-gray-200 border border-monkey-sub/50' 
                                : 'bg-transparent text-monkey-sub hover:text-gray-300 border border-monkey-sub/20'
                        }`}
                    >
                        {level}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
            <button onClick={() => { onShuffle(); setSelectedIndex(0); }} className="p-2 bg-[#2c2e31] rounded text-monkey-sub hover:text-monkey-main transition-colors" title="Shuffle (4)"><Shuffle size={16}/></button>
            <button onClick={() => { onRestore(); setSelectedIndex(0); }} className="p-2 bg-[#2c2e31] rounded text-monkey-sub hover:text-monkey-main transition-colors" title="Restore (5)"><RotateCcw size={16}/></button>
            
            <div className="w-px h-6 bg-monkey-sub/20 mx-1"></div>
            
            <button 
                onClick={(e) => { e.stopPropagation(); handleResetClick(); }} 
                className="p-2 bg-[#2c2e31] rounded text-monkey-sub hover:text-monkey-error transition-colors" 
                title="Extinguish All Lights (6)"
            >
                <LightbulbOff size={16}/>
            </button>

            <button
                onClick={() => setShowSource(!showSource)}
                className={`p-2 rounded transition-colors ${showSource ? 'bg-[#3e4044] text-gray-200' : 'bg-[#2c2e31] text-monkey-sub hover:text-monkey-text'}`}
                title="Toggle Source File Display (7)"
            >
                <FileBadge size={16} />
            </button>

            <div className="flex-grow"></div>

            <button 
                onClick={toggleAll}
                className="flex items-center gap-2 px-3 py-2 md:px-4 rounded bg-[#2c2e31] border border-monkey-sub/30 hover:border-monkey-main text-monkey-text transition-colors text-xs md:text-sm font-mono active:scale-95"
                title="Toggle Definitions (8)"
            >
                {showAllDefs ? <EyeOff size={16}/> : <Eye size={16}/>}
                <span className="hidden sm:inline">{showAllDefs ? 'Hide All' : 'Reveal All'}</span>
                <span className="sm:hidden">{showAllDefs ? 'Hide' : 'Reveal'}</span>
            </button>
            <button onClick={onExit} className="ml-2 md:ml-4 text-monkey-sub hover:text-monkey-text text-sm underline">Exit</button>
        </div>
      </div>

      {/* List Header (Desktop Only) */}
      <div className="hidden md:grid grid-cols-[60px_1fr_2fr] gap-x-6 gap-y-2 items-center mb-2 pb-2 border-b border-monkey-sub/20 px-2 shrink-0">
          <div className="text-xs text-monkey-sub font-bold uppercase tracking-wider text-center">Lvl</div>
          <div className="text-xs text-monkey-sub font-bold uppercase tracking-wider">Word</div>
          <div className="text-xs text-monkey-sub font-bold uppercase tracking-wider">Definition</div>
      </div>

      {/* Virtualized List Container */}
      <div 
        ref={parentRef}
        onScroll={handleScroll}
        className="flex-grow overflow-y-auto custom-scrollbar relative w-full px-2"
        style={{ contain: 'strict' }}
      >
        <div style={{ height: `${totalHeight}px`, position: 'relative', width: '100%' }}>
            {filteredData.length === 0 ? (
                <div className="text-center py-10 text-monkey-sub absolute w-full">No words found in selected levels.</div>
            ) : (
                virtualItems.map(({ index, offsetTop, item }) => (
                    <div
                        key={item.id}
                        style={{ transform: `translateY(${offsetTop}px)` }}
                        className="absolute w-full top-0 left-0"
                    >
                        <WordRow
                            item={item}
                            idx={index}
                            isDefVisible={showAllDefs || visibleDefs.has(item.id)}
                            isSelected={usingKeyboard && index === selectedIndex}
                            showSource={showSource}
                            sourceName={showSource && item.sourceId ? onGetSourceName(item.sourceId) : undefined}
                            onRowClick={handleRowClick}
                            onLevelClick={handleLevelClick}
                            onWordCycle={handleWordCycle}
                            onToggleDef={toggleIndividual}
                            onLightSwipeStart={handleLightSwipeStart}
                            onLightSwipeMove={handleLightSwipeMove}
                            onLightSwipeEnd={handleLightSwipeEnd}
                            setRowHeight={setRowHeight}
                        />
                    </div>
                ))
            )}
        </div>
      </div>
      
      {/* Legend */}
      {usingKeyboard && (
          <div className="mt-2 text-[10px] text-monkey-sub/30 flex gap-4 pointer-events-none hidden md:flex pb-2 animate-fade-in shrink-0">
              <span>↑/↓: Nav</span>
              <span>Space: Reveal</span>
              <span>←/→: Adjust Level</span>
              <span>Esc: Exit</span>
          </div>
      )}
    </div>
  );
};