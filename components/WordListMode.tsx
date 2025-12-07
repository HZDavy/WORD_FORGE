
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { VocabularyItem } from '../types';
import { Eye, EyeOff, Shuffle, RotateCcw, LightbulbOff, AlertTriangle, Keyboard, FileBadge } from 'lucide-react';

interface Props {
  data: VocabularyItem[];
  onExit: () => void;
  onUpdateLevel: (id: string, level: number) => void;
  onResetLevels: () => void;
  onShuffle: () => void;
  onRestore: () => void;
  onGetSourceName: (id: string) => string | undefined;
}

// Optimized Row Component
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
  onToggleDef
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
}) => {
  return (
      <div 
          id={`word-row-${idx}`}
          onClick={(e) => onRowClick(e, idx)} 
          className={`flex flex-col p-4 rounded-lg border md:rounded-none md:p-0 md:grid md:grid-cols-[60px_1fr_2fr] md:gap-x-6 md:items-center border-b md:border-b transition-colors cursor-pointer ${isSelected ? 'bg-monkey-main/10 border-monkey-main/30 md:bg-monkey-main/5 ring-1 ring-monkey-main/20' : 'bg-[#2c2e31] border-monkey-sub/10 md:bg-transparent md:border-monkey-sub/10'}`}
      >
          {/* Traffic Lights Column */}
          <div 
              className="flex justify-between items-center mb-2 md:mb-0 md:justify-center gap-1 touch-none cursor-ew-resize md:py-3"
              onTouchStart={(e) => onLightSwipeStart(e, idx)}
              onTouchMove={(e) => onLightSwipeMove(e, item)}
              onTouchEnd={onLightSwipeEnd}
          >
              <span className="text-xs text-monkey-sub font-bold uppercase md:hidden">Level</span>
               <div className="flex gap-1">
                  {[1, 2, 3].map(l => (
                      <div 
                          key={l}
                          onClick={(e) => onLevelClick(e, item.id, item.level === l ? l - 1 : l, idx)}
                          className={`w-3 h-3 md:w-2 md:h-2 rounded-full border border-monkey-sub/50 cursor-pointer transition-transform ${item.level >= l ? (item.level === 3 ? 'bg-green-500 border-green-500' : 'bg-monkey-main border-monkey-main') : 'bg-transparent'}`}
                      ></div>
                  ))}
               </div>
          </div>

          {/* Word Column */}
          <div 
              className="text-xl md:text-lg font-bold text-monkey-text select-text hover:text-white transition-colors mb-2 md:mb-0 md:py-3 flex flex-wrap items-center gap-2"
              onClick={(e) => { e.stopPropagation(); onWordCycle(e, item, idx); }}
          >
              {item.word}
              {sourceName && (
                  <span className="text-[10px] bg-monkey-sub/20 text-monkey-sub px-1.5 py-0.5 rounded font-normal align-middle truncate max-w-[120px]">
                      {sourceName}
                  </span>
              )}
          </div>

          {/* Definition Column */}
          <div 
              className="cursor-pointer relative group leading-relaxed md:py-3 min-h-[1.5em]"
              onClick={(e) => { e.stopPropagation(); onToggleDef(e, item.id, idx); }}
          >
              <span 
                className={`
                  rounded px-1
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
    // Custom comparison for performance
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
  const [showSelection, setShowSelection] = useState(false);
  const [isSelectionModeEnabled, setIsSelectionModeEnabled] = useState(false);
  
  const selectionTimerRef = useRef<number | null>(null);
  
  // Filter Logic
  const [activeLevels, setActiveLevels] = useState<Set<number>>(new Set([0, 1, 2, 3]));
  const lightSwipeStartX = useRef<number | null>(null);
  const lastLightUpdateX = useRef<number | null>(null);

  const filteredData = useMemo(() => {
    return data.filter(item => activeLevels.has(item.level));
  }, [data, activeLevels]);

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

  const wakeSelection = useCallback(() => {
      if (!isSelectionModeEnabled) return;
      
      setShowSelection(true);
      if (selectionTimerRef.current) {
          window.clearTimeout(selectionTimerRef.current);
      }
      selectionTimerRef.current = window.setTimeout(() => {
          setShowSelection(false);
      }, 3000); // Hide after 3 seconds
  }, [isSelectionModeEnabled]);

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
      // Wait for spring-out animation to finish
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
    
    if (isSelectionModeEnabled) {
        setSelectedIndex(idx);
        wakeSelection();
    }
  }, [isSelectionModeEnabled, wakeSelection]);

  const handleLevelClick = useCallback((e: React.MouseEvent, id: string, level: number, idx: number) => {
      e.stopPropagation();
      onUpdateLevel(id, level);
      if (isSelectionModeEnabled) {
        setSelectedIndex(idx);
        wakeSelection();
      }
  }, [onUpdateLevel, isSelectionModeEnabled, wakeSelection]);
  
  const handleWordCycle = useCallback((e: React.MouseEvent, item: VocabularyItem, idx: number) => {
      const nextLevel = item.level >= 3 ? 0 : item.level + 1;
      onUpdateLevel(item.id, nextLevel);
      
      if (isSelectionModeEnabled) {
        setSelectedIndex(idx);
        wakeSelection();
      }
  }, [onUpdateLevel, isSelectionModeEnabled, wakeSelection]);

  const handleLightSwipeStart = useCallback((e: React.TouchEvent, idx: number) => {
      lightSwipeStartX.current = e.touches[0].clientX;
      lastLightUpdateX.current = e.touches[0].clientX;
      if (isSelectionModeEnabled) {
          setSelectedIndex(idx);
          wakeSelection();
      }
  }, [isSelectionModeEnabled, wakeSelection]);

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

  const handleContainerClick = () => {
      setShowSelection(false);
  };

  const handleRowClick = useCallback((e: React.MouseEvent, index: number) => {
      e.stopPropagation(); 
      if (!isSelectionModeEnabled) return;
      setSelectedIndex(index);
      wakeSelection();
  }, [isSelectionModeEnabled, wakeSelection]);

  const toggleSelectionMode = () => {
      const newState = !isSelectionModeEnabled;
      setIsSelectionModeEnabled(newState);
      if (newState) {
          setShowSelection(true);
          wakeSelection();
      } else {
          setShowSelection(false);
      }
  };

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

       if (!isSelectionModeEnabled) return;

       if (e.code === 'ArrowDown') {
           e.preventDefault();
           wakeSelection();
           setSelectedIndex(prev => Math.min(prev + 1, filteredData.length - 1));
       } else if (e.code === 'ArrowUp') {
           e.preventDefault();
           wakeSelection();
           setSelectedIndex(prev => Math.max(prev - 1, 0));
       } else if (e.code === 'Space') {
           e.preventDefault();
           wakeSelection();
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
           wakeSelection();
           const item = filteredData[selectedIndex];
           if (item && item.level < 3) onUpdateLevel(item.id, item.level + 1);
       } else if (e.code === 'ArrowLeft') {
           e.preventDefault();
           wakeSelection();
           const item = filteredData[selectedIndex];
           if (item && item.level > 0) onUpdateLevel(item.id, item.level - 1);
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
    };
  }, [onExit, filteredData, selectedIndex, onUpdateLevel, wakeSelection, isSelectionModeEnabled, showResetConfirm]);

  // Scroll current item into view
  useEffect(() => {
      if (filteredData.length > 0 && showSelection && isSelectionModeEnabled) {
          const el = document.getElementById(`word-row-${selectedIndex}`);
          if (el) {
              el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
      }
  }, [selectedIndex, filteredData, showSelection, isSelectionModeEnabled]);

  return (
    <div 
        className="w-full max-w-4xl mx-auto flex flex-col h-full pt-4 relative animate-game-pop-in"
        onClick={handleContainerClick}
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
        className="flex flex-col gap-4 mb-4 border-b border-monkey-sub/20 bg-monkey-bg sticky top-0 z-20 py-2"
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
            <button onClick={() => { onShuffle(); setSelectedIndex(0); }} className="p-2 bg-[#2c2e31] rounded text-monkey-sub hover:text-monkey-main transition-colors" title="Shuffle"><Shuffle size={16}/></button>
            <button onClick={() => { onRestore(); setSelectedIndex(0); }} className="p-2 bg-[#2c2e31] rounded text-monkey-sub hover:text-monkey-main transition-colors" title="Restore"><RotateCcw size={16}/></button>
            
            <div className="w-px h-6 bg-monkey-sub/20 mx-1"></div>
            
            <button 
                onClick={(e) => { e.stopPropagation(); handleResetClick(); }} 
                className="p-2 bg-[#2c2e31] rounded text-monkey-sub hover:text-monkey-error transition-colors" 
                title="Extinguish All Lights (Reset to Level 0)"
            >
                <LightbulbOff size={16}/>
            </button>

            <button 
                onClick={toggleSelectionMode}
                className={`p-2 rounded transition-colors ${isSelectionModeEnabled ? 'bg-[#3e4044] text-gray-200' : 'bg-[#2c2e31] text-monkey-sub hover:text-monkey-text'}`}
                title="Toggle Keyboard/Selection Mode"
            >
                <Keyboard size={16} />
            </button>

            <button
                onClick={() => setShowSource(!showSource)}
                className={`p-2 rounded transition-colors ${showSource ? 'bg-[#3e4044] text-gray-200' : 'bg-[#2c2e31] text-monkey-sub hover:text-monkey-text'}`}
                title="Toggle Source File Display"
            >
                <FileBadge size={16} />
            </button>

            <div className="flex-grow"></div>

            <button 
                onClick={toggleAll}
                className="flex items-center gap-2 px-3 py-2 md:px-4 rounded bg-[#2c2e31] border border-monkey-sub/30 hover:border-monkey-main text-monkey-text transition-colors text-xs md:text-sm font-mono active:scale-95"
            >
                {showAllDefs ? <EyeOff size={16}/> : <Eye size={16}/>}
                <span className="hidden sm:inline">{showAllDefs ? 'Hide All' : 'Reveal All'}</span>
                <span className="sm:hidden">{showAllDefs ? 'Hide' : 'Reveal'}</span>
            </button>
            <button onClick={onExit} className="ml-2 md:ml-4 text-monkey-sub hover:text-monkey-text text-sm underline">Exit</button>
        </div>
      </div>

      {/* List */}
      <div className="flex-grow overflow-y-auto pb-20 pr-2 custom-scrollbar relative">
        <div className="flex flex-col gap-4 md:gap-0 md:block">
            {/* Table Header (Desktop Only) */}
            <div className="hidden md:grid grid-cols-[60px_1fr_2fr] gap-x-6 gap-y-2 items-center mb-2 pb-2 border-b border-monkey-sub/20">
                <div className="text-xs text-monkey-sub font-bold uppercase tracking-wider text-center">Lvl</div>
                <div className="text-xs text-monkey-sub font-bold uppercase tracking-wider">Word</div>
                <div className="text-xs text-monkey-sub font-bold uppercase tracking-wider">Definition</div>
            </div>

            {/* Rows */}
            {filteredData.length === 0 ? (
                <div className="text-center py-10 text-monkey-sub">No words found in selected levels.</div>
            ) : (
                filteredData.map((item, idx) => (
                    <WordRow
                        key={item.id}
                        item={item}
                        idx={idx}
                        isDefVisible={showAllDefs || visibleDefs.has(item.id)}
                        isSelected={isSelectionModeEnabled && showSelection && idx === selectedIndex}
                        showSource={showSource}
                        sourceName={showSource && item.sourceId ? onGetSourceName(item.sourceId) : undefined}
                        onRowClick={handleRowClick}
                        onLevelClick={handleLevelClick}
                        onWordCycle={handleWordCycle}
                        onToggleDef={toggleIndividual}
                        onLightSwipeStart={handleLightSwipeStart}
                        onLightSwipeMove={handleLightSwipeMove}
                        onLightSwipeEnd={handleLightSwipeEnd}
                    />
                ))
            )}
        </div>
      </div>
      
      {/* Legend */}
      {isSelectionModeEnabled && (
          <div className="mt-2 text-[10px] text-monkey-sub/30 flex gap-4 pointer-events-none hidden md:flex pb-2 animate-fade-in">
              <span>↑/↓: Nav</span>
              <span>Space: Reveal</span>
              <span>←/→: Adjust Level</span>
              <span>Esc: Exit</span>
          </div>
      )}
    </div>
  );
};
