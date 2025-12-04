
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { VocabularyItem } from '../types';
import { Eye, EyeOff, Shuffle, RotateCcw, LightbulbOff } from 'lucide-react';

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
  
  // Filter Logic
  const [activeLevels, setActiveLevels] = useState<Set<number>>(new Set([0, 1, 2, 3]));
  const lightSwipeStartX = useRef<number | null>(null);

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
  };

  const handleLightSwipeEnd = (e: React.TouchEvent, item: VocabularyItem) => {
      if (lightSwipeStartX.current === null) return;
      const endX = e.changedTouches[0].clientX;
      const diff = endX - lightSwipeStartX.current;
      
      if (Math.abs(diff) > 20) {
          if (diff > 0) {
              onUpdateLevel(item.id, Math.min(3, item.level + 1));
          } else {
              onUpdateLevel(item.id, Math.max(0, item.level - 1));
          }
      }
      lightSwipeStartX.current = null;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
       if (e.code === 'Escape') onExit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col h-full pt-4">
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
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold border transition-colors ${activeLevels.has(level) ? 'bg-[#4b4d50] border-[#646669] text-gray-200' : 'bg-transparent border-monkey-sub/20 text-monkey-sub/50'}`}
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
            
            <button onClick={onResetLevels} className="p-2 bg-[#2c2e31] rounded text-monkey-sub hover:text-monkey-error transition-colors" title="Extinguish All Lights"><LightbulbOff size={16}/></button>

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
                            className="py-3 border-b border-monkey-sub/10 flex justify-center gap-1 touch-pan-y"
                            onTouchStart={handleLightSwipeStart}
                            onTouchEnd={(e) => handleLightSwipeEnd(e, item)}
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
                                  ? 'bg-transparent text-monkey-sub' 
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
