import React, { useState, useEffect } from 'react';
import { VocabularyItem } from '../types';
import { Eye, EyeOff, Bookmark, BookmarkCheck } from 'lucide-react';

interface Props {
  data: VocabularyItem[];
  onExit: () => void;
  onToggleMark: (id: string) => void;
}

export const WordListMode: React.FC<Props> = ({ data, onExit, onToggleMark }) => {
  const [showAllDefs, setShowAllDefs] = useState(false);
  const [visibleDefs, setVisibleDefs] = useState<Set<string>>(new Set());
  const [isBulkToggling, setIsBulkToggling] = useState(false);

  // Toggle global visibility with animation
  const toggleAll = () => {
    setIsBulkToggling(true); // Enable animation for bulk action
    setShowAllDefs(!showAllDefs);
    setVisibleDefs(new Set()); 
  };

  // Toggle individual visibility instantly
  const toggleIndividual = (id: string) => {
    setIsBulkToggling(false); // Disable animation for snappy individual toggle
    setVisibleDefs(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
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
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-monkey-sub/20 bg-monkey-bg sticky top-0 z-10 py-2">
        <div>
            <h2 className="text-2xl font-bold text-monkey-main">Word List</h2>
            <p className="text-xs text-monkey-sub">{data.length} words total</p>
        </div>
        
        <div className="flex gap-4">
            <button 
                onClick={toggleAll}
                className="flex items-center gap-2 px-4 py-2 rounded bg-[#2c2e31] border border-monkey-sub/30 hover:border-monkey-main text-monkey-text transition-colors text-sm font-mono active:scale-95"
            >
                {showAllDefs ? <EyeOff size={16}/> : <Eye size={16}/>}
                {showAllDefs ? 'Hide All' : 'Reveal All'}
            </button>
            <button onClick={onExit} className="text-monkey-sub hover:text-monkey-text text-sm underline">Exit</button>
        </div>
      </div>

      {/* List */}
      <div className="flex-grow overflow-y-auto pb-20 pr-2 custom-scrollbar">
        <div className="grid grid-cols-[auto_1fr_2fr] gap-x-6 gap-y-2 items-center">
            {/* Table Header */}
            <div className="text-xs text-monkey-sub font-bold uppercase tracking-wider mb-2 text-center">Mark</div>
            <div className="text-xs text-monkey-sub font-bold uppercase tracking-wider mb-2">Word</div>
            <div className="text-xs text-monkey-sub font-bold uppercase tracking-wider mb-2">Definition</div>

            {/* Rows */}
            {data.map((item, idx) => {
                const isDefVisible = showAllDefs || visibleDefs.has(item.id);

                return (
                    <React.Fragment key={item.id}>
                        {/* Checkbox Column */}
                        <div className="py-3 border-b border-monkey-sub/10 flex justify-center">
                            <button 
                                onClick={() => onToggleMark(item.id)}
                                className={`transition-colors ${item.marked ? 'text-monkey-main' : 'text-monkey-sub/30 hover:text-monkey-sub'}`}
                            >
                                {item.marked ? <BookmarkCheck size={20} fill="#e2b714" className="text-monkey-bg" /> : <Bookmark size={20} />}
                            </button>
                        </div>

                        {/* Word Column */}
                        <div className="py-3 border-b border-monkey-sub/10 font-bold text-lg text-monkey-text select-text">
                            {item.word}
                        </div>

                        {/* Definition Column */}
                        <div 
                            className="py-3 border-b border-monkey-sub/10 cursor-pointer relative group flex items-center"
                            onClick={() => toggleIndividual(item.id)}
                        >
                            <span 
                              className={`
                                rounded px-2 py-1 leading-normal block w-full
                                ${isDefVisible 
                                  ? 'bg-transparent text-monkey-sub' 
                                  : 'bg-[#3f4145] text-transparent select-none hover:bg-[#4a4c50]' 
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