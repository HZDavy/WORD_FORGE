
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { VocabularyItem } from '../types';
import { Eye, EyeOff, Shuffle, RotateCcw, LightbulbOff, AlertTriangle } from 'lucide-react';

interface Props {
  data: VocabularyItem[];
  onExit: () => void;
  onUpdateLevel: (id: string, level: number) => void;
  onResetLevels: () => void;
  onShuffle: () => void;
  onRestore: () => void;
}

export const WordListMode: React.FC<Props> = ({ data, onExit, onUpdateLevel, onResetLevels, onShuffle, onRestore }) => {
  const [showAllDefs, setShowAllDefs] = useState(false);
  const [visibleDefs, setVisibleDefs] = useState<Set<string>>(new Set());
  const [isBulkToggling, setIsBulkToggling] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  // Filter Logic
  const [activeLevels, setActiveLevels] = useState<Set<number>>(new Set([0, 1, 2, 3]));
  const lightSwipeStartX = useRef<number | null>(null);
  const lastLightUpdateX = useRef<number | null>(null);

  const filteredData = useMemo(() => {
    return data.filter(item => activeLevels.has(item.level));
  }, [data, activeLevels]);

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
  };

  const confirmReset = () => {
      // 1. Reset global data
      onResetLevels();
      // 2. Force filter to include Level 0 immediately so the list doesn't appear empty
      setActiveLevels(new Set([0, 1, 2, 3]));
      setShowResetConfirm(false);
  };

  const toggleAll = () => {
    setIsBulkToggling(true);
    setShowAllDefs(!showAllDefs);
    setVisibleDefs(new Set()); 
  };

  const toggleIndividual = (id: string) => {
    setIsBulkToggling(false);
    setVisibleDefs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleLevelClick = (e: React.MouseEvent, id: string, level: number) => {
      e.stopPropagation();
      onUpdateLevel(id, level);
  };
  
  const handleWordCycle = (item: VocabularyItem) => {
      const nextLevel = item.level >= 3 ? 0 : item.level + 1;
      onUpdateLevel(item.id, nextLevel);
  };

  const handleLightSwipeStart = (e: React.TouchEvent) => {
      lightSwipeStartX.current = e.touches[0].clientX;
      lastLightUpdateX.current = e.touches[0].clientX;
  };

  const handleLightSwipeMove = (e: React.TouchEvent, item: VocabularyItem) => {
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
  };

  const handleLightSwipeEnd = () => {
      lightSwipeStartX.current = null;
      lastLightUpdateX.current = null;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
       if (e.code === 'Escape') onExit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col h-full pt-4 relative">
      
      {/* Custom Confirmation Modal */}
      {showResetConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg">
          <div className="bg-[#2c2e31] border border-monkey-sub/30 p-6 rounded-xl shadow-2xl max-w-sm w-full animate-pop-in">
            <div className="flex items-center gap-3 text-monkey-error mb-4">
              <AlertTriangle size={24} />
              <h3 className="text-xl font-bold">Extinguish All?</h3>
            </div>
            <p className="text-monkey-sub mb-6">
              This will reset the grading level of ALL {data.length} words to 0. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded text-monkey-sub hover:text-monkey-text hover:bg-monkey-sub/10 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmReset}
                className="px-4 py-2 rounded bg-monkey-error text-white hover:bg-red-600 transition-colors font-bold"
              >
                Extinguish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header / Toolbar */}
      <div className="flex flex-col gap-4 mb-4 border-b border-monkey-sub/20 bg-monkey-bg sticky top-0 z-20 py-2">
        
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
                                ? 'bg-[#3e4044] text-gray-200 border border-monkey-sub/50 shadow-md' 
                                : 'bg-transparent text-monkey-sub hover:text-gray-300 border border-monkey-sub/20'
                        }`}
                    >
                        {level}
                    </button>
                ))}
            </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
            <button onClick={onShuffle} className="p-2 bg-[#2c2e31] rounded text-monkey-sub hover:text-monkey-main transition-colors" title="Shuffle"><Shuffle size={16}/></button>
            <button onClick={onRestore} className="p-2 bg-[#2c2e31] rounded text-monkey-sub hover:text-monkey-main transition-colors" title="Restore"><RotateCcw size={16}/></button>
            
            <div className="w-px h-6 bg-monkey-sub/20 mx-1"></div>
            
            <button 
                onClick={(e) => { e.stopPropagation(); handleResetClick(); }} 
                className="p-2 bg-[#2c2e31] rounded text-monkey-sub hover:text-monkey-error transition-colors" 
                title="Extinguish All Lights (Reset to Level 0)"
            >
                <LightbulbOff size={16}/>
            </button>

            <div className="flex-grow"></div>

            <button 
                onClick={toggleAll}
                className="flex items-center gap-2 px-4 py-2 rounded bg-[#2c2e31] border border-monkey-sub/30 hover:border-monkey-main text-monkey-text transition-colors text-sm font-mono active:scale-95"
            >
                {showAllDefs ? <EyeOff size={16}/> : <Eye size={16}/>}
                {showAllDefs ? 'Hide All' : 'Reveal All'}
            </button>
            <button onClick={onExit} className="ml-4 text-monkey-sub hover:text-monkey-text text-sm underline">Exit</button>
        </div>
      </div>

      {/* List */}
      <div className="flex-grow overflow-y-auto pb-20 pr-2 custom-scrollbar relative">
        <div className="grid grid-cols-[auto_1fr_2fr] gap-x-6 gap-y-2 items-center">
            {/* Table Header */}
            <div className="text-xs text-monkey-sub font-bold uppercase tracking-wider mb-2 text-center">Lvl</div>
            <div className="text-xs text-monkey-sub font-bold uppercase tracking-wider mb-2">Word</div>
            <div className="text-xs text-monkey-sub font-bold uppercase tracking-wider mb-2">Definition</div>

            {/* Rows */}
            {filteredData.map((item, idx) => {
                const isDefVisible = showAllDefs || visibleDefs.has(item.id);

                return (
                    <React.Fragment key={item.id}>
                        {/* Traffic Lights Column (Swipeable) */}
                        <div 
                            className="py-3 border-b border-monkey-sub/10 flex justify-center gap-1 touch-none cursor-ew-resize"
                            onTouchStart={handleLightSwipeStart}
                            onTouchMove={(e) => handleLightSwipeMove(e, item)}
                            onTouchEnd={handleLightSwipeEnd}
                        >
                             {[1, 2, 3].map(l => (
                                 <div 
                                    key={l}
                                    onClick={(e) => handleLevelClick(e, item.id, item.level === l ? l - 1 : l)}
                                    className={`w-2 h-2 rounded-full border border-monkey-sub/50 cursor-pointer transition-transform ${item.level >= l ? (item.level === 3 ? 'bg-green-500 border-green-500' : 'bg-monkey-main border-monkey-main') : 'bg-transparent'}`}
                                 ></div>
                             ))}
                        </div>

                        {/* Word Column (Click to Cycle) */}
                        <div 
                            className="py-3 border-b border-monkey-sub/10 font-bold text-lg text-monkey-text select-text cursor-pointer hover:text-white transition-colors"
                            onClick={() => handleWordCycle(item)}
                        >
                            {item.word}
                        </div>

                        {/* Definition Column (Redacted) */}
                        <div 
                            className="py-3 border-b border-monkey-sub/10 cursor-pointer relative group leading-relaxed"
                            onClick={() => toggleIndividual(item.id)}
                        >
                            <span 
                              className={`
                                rounded px-1
                                ${isDefVisible 
                                  ? 'bg-transparent text-gray-200' 
                                  : 'bg-[#3f4145] text-transparent select-none hover:bg-[#4a4c50] box-decoration-clone' 
                                }
                              `}
                              style={{
                                  transition: isBulkToggling ? 'background-color 0.3s ease, color 0.3s ease' : 'none',
                                  transitionDelay: isBulkToggling ? `${idx * 15}ms` : '0ms'
                              }}
                            >
                                {item.definition}
                            </span>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
      </div>
    </div>
  );
};
