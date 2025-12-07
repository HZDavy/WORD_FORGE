
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { VocabularyItem } from '../types';
import { Shuffle, RotateCcw } from 'lucide-react';

interface Props {
  data: VocabularyItem[];
  initialRound?: number;
  onExit: () => void;
  onShuffle: () => void;
  onRestore: () => void;
  onSaveProgress: (round: number) => void;
}

interface Bubble {
  id: string; 
  uid: string; 
  text: string;
  type: 'word' | 'def';
  matched: boolean;
  status: 'default' | 'selected' | 'wrong' | 'success';
}

const ITEMS_PER_ROUND = 6; 

export const MatchingMode: React.FC<Props> = ({ data, initialRound = 0, onExit, onShuffle, onRestore, onSaveProgress }) => {
  // Filter Logic
  const [activeLevels, setActiveLevels] = useState<Set<number>>(new Set([0, 1, 2, 3]));
  
  const filteredData = useMemo(() => {
    return data.filter(item => activeLevels.has(item.level));
  }, [data, activeLevels]);

  const [round, setRound] = useState(initialRound);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isWait, setIsWait] = useState(false);

  const totalRounds = Math.ceil(filteredData.length / ITEMS_PER_ROUND);

  useEffect(() => {
    onSaveProgress(round);
  }, [round, onSaveProgress]);

  // Adjust round if filtered data shrinks
  useEffect(() => {
      if (round >= totalRounds && totalRounds > 0) {
          setRound(0);
      }
  }, [totalRounds, round]);

  const restart = () => {
      setRound(0);
      setSelectedId(null);
  };

  const toggleFilter = (level: number) => {
      setActiveLevels(prev => {
          const next = new Set(prev);
          if (next.has(level)) next.delete(level);
          else next.add(level);
          return next.size === 0 ? prev : next;
      });
      restart();
  };

  useEffect(() => {
    if (filteredData.length === 0) return;

    const start = round * ITEMS_PER_ROUND;
    const end = start + ITEMS_PER_ROUND;
    const slice = filteredData.slice(start, end);

    if (slice.length === 0) return;

    const wordBubbles: Bubble[] = slice.map(item => ({
      id: item.id,
      uid: item.id + '-w',
      text: item.word,
      type: 'word',
      matched: false,
      status: 'default'
    }));

    const defBubbles: Bubble[] = slice.map(item => {
      let defText = item.definition; 
      if (defText.length > 55) {
          defText = defText.substring(0, 52) + '...';
      }
      return {
        id: item.id,
        uid: item.id + '-d',
        text: defText,
        type: 'def',
        matched: false,
        status: 'default'
      };
    });

    const combined = [...wordBubbles, ...defBubbles].sort(() => Math.random() - 0.5);
    setBubbles(combined);
    setSelectedId(null);
  }, [round, filteredData]);

  const handleSelect = useCallback((uid: string) => {
    if (isWait) return;
    
    const clicked = bubbles.find(b => b.uid === uid);
    if (!clicked || clicked.matched) return;

    if (selectedId === uid) {
      setBubbles(prev => prev.map(b => b.uid === uid ? { ...b, status: 'default' } : b));
      setSelectedId(null);
      return;
    }

    if (!selectedId) {
      setSelectedId(uid);
      setBubbles(prev => prev.map(b => b.uid === uid ? { ...b, status: 'selected' } : b));
      return;
    }

    const first = bubbles.find(b => b.uid === selectedId);
    if (!first) return;

    if (first.id === clicked.id) {
      setBubbles(prev => prev.map(b => 
        (b.uid === first.uid || b.uid === clicked.uid) 
          ? { ...b, status: 'success', matched: true } 
          : b
      ));
      setSelectedId(null);

      const remaining = bubbles.filter(b => !b.matched && b.id !== clicked.id).length;
      if (remaining === 0) {
        setTimeout(() => {
          if (round < totalRounds - 1) {
            setRound(r => r + 1);
          }
        }, 1000); 
      }
    } else {
      setIsWait(true);
      setBubbles(prev => prev.map(b => 
        (b.uid === first.uid || b.uid === clicked.uid) 
          ? { ...b, status: 'wrong' } 
          : b
      ));

      setTimeout(() => {
        setBubbles(prev => prev.map(b => 
          (b.uid === first.uid || b.uid === clicked.uid) 
            ? { ...b, status: 'default' } 
            : b
        ));
        setSelectedId(null);
        setIsWait(false);
      }, 800);
    }
  }, [bubbles, selectedId, isWait, round, totalRounds]);

  useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
          if(e.code === 'Escape') onExit();
      }
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
  }, [onExit]);


  if (filteredData.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-center animate-game-pop-in">
              <h2 className="text-2xl font-bold text-monkey-sub mb-4">No cards in selected levels</h2>
              <div className="flex gap-2 justify-center">
                  {[0,1,2,3].map(l => (
                      <button key={l} onClick={() => toggleFilter(l)} className={`w-8 h-8 rounded border text-xs ${activeLevels.has(l) ? 'bg-[#3e4044] text-gray-200 border-monkey-sub/50' : 'bg-transparent text-monkey-sub border-monkey-sub/20'}`}>
                          {l}
                      </button>
                  ))}
              </div>
              <button onClick={onExit} className="mt-8 text-monkey-sub underline">Back</button>
          </div>
      );
  }

  if (round >= totalRounds && totalRounds > 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in-up">
              <h2 className="text-4xl font-bold text-monkey-main mb-4">全通关!</h2>
              <p className="mb-8 text-monkey-text">所有词汇配对完成。</p>
              <button onClick={onExit} className="px-6 py-2 border border-monkey-main text-monkey-main hover:bg-monkey-main hover:text-monkey-bg transition font-bold">Back to Menu</button>
          </div>
      )
  }

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center h-full pt-6 animate-game-pop-in">
      <div className="flex justify-between w-full mb-6 border-b border-monkey-sub/20 pb-2 px-4 items-center">
        <div className="flex flex-col gap-1">
            <div>
                <span className="text-monkey-main font-bold font-mono text-lg">Round {round + 1} / {totalRounds}</span>
                <span className="text-monkey-sub text-sm font-mono ml-4 hidden sm:inline">Select matching pairs</span>
            </div>
            {/* Filters */}
            <div className="flex gap-1 mt-1">
                {[0, 1, 2, 3].map(level => {
                    const isActive = activeLevels.has(level);
                    return (
                        <button 
                            key={level} 
                            onClick={() => toggleFilter(level)}
                            className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all ${
                                isActive 
                                    ? 'bg-[#3e4044] text-gray-200 border border-monkey-sub/50' 
                                    : 'bg-transparent text-monkey-sub hover:text-gray-300 border border-monkey-sub/20'
                            }`}
                        >
                            {level}
                        </button>
                    )
                })}
            </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => { restart(); onShuffle(); }} className="p-2 text-monkey-sub hover:text-monkey-main transition-colors" title="Shuffle"><Shuffle size={18} /></button>
            <button onClick={() => { restart(); onRestore(); }} className="p-2 text-monkey-sub hover:text-monkey-main transition-colors" title="Restore Order"><RotateCcw size={18} /></button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 md:gap-4 justify-center content-start flex-grow pb-10 pt-4 px-2 md:px-4 overflow-y-auto">
        {bubbles.map((b, idx) => {
           const isWord = b.type === 'word';
           
           // --- WRAPPER (Layout) ---
           // Fixed slot that strictly maintains the grid layout.
           // Handles entrance animations and Z-indexing for the 'Pop-out' effect.
           let wrapperClass = "relative flex items-center justify-center animate-pop-in max-w-full ";
           
           if (b.status === 'selected' || b.status === 'wrong' || b.status === 'success') {
               wrapperClass += "z-50 ";
           } else {
               wrapperClass += "z-0 ";
           }
           
           // Animate the wrapper for shake so layout doesn't break but the whole unit shakes
           if (b.status === 'wrong') {
               wrapperClass += "animate-shake ";
           }
           
           // --- INNER CARD (Visuals) ---
           // Handles the look and feel, plus transforms (scale/rotate).
           // Since it's inside the wrapper, transforms won't affect the wrapper's flow dimensions.
           let innerClass = "flex items-center justify-center text-center rounded-lg border-2 cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] select-none w-full h-full ";
           
           // Typography & Padding (Fixed to ensure consistent size in Wrapper)
           innerClass += "px-4 py-3 md:px-5 md:py-4 ";
           if (isWord) {
               innerClass += "text-base md:text-xl font-bold ";
           } else {
               innerClass += "text-sm md:text-base font-normal leading-relaxed ";
           }

           // State Styling
           if (b.status === 'default') {
               innerClass += "scale-100 ";
               if (isWord) {
                   innerClass += "border-monkey-sub/30 text-monkey-main hover:border-monkey-main hover:bg-monkey-bg/50 bg-[#252628] ";
               } else {
                   innerClass += "border-monkey-sub/30 text-gray-200 hover:border-white hover:text-white bg-[#3e4044] ";
               }
           } else if (b.status === 'selected') {
               // The POP: Significant scale, floating above others via Wrapper's z-index. Reduced scale to 1.1.
               // REMOVED SHADOW/GLOW for flat design.
               innerClass += "scale-110 border-monkey-main bg-monkey-main text-monkey-bg ";
           } else if (b.status === 'wrong') {
               innerClass += "scale-110 border-monkey-error bg-monkey-error text-white ";
           } else if (b.status === 'success') {
               innerClass += "animate-merge-success pointer-events-none "; 
           }

           return (
             <div
               key={b.uid}
               onClick={() => handleSelect(b.uid)}
               className={wrapperClass}
               style={{ 
                   animationDelay: b.status === 'default' ? `${idx * 40}ms` : '0ms'
               }}
             >
                <div className={innerClass}>
                    {b.text}
                </div>
             </div>
           )
        })}
      </div>
      
      {/* Keyboard Legend */}
      <div className="mb-2 text-[10px] text-monkey-sub/30 hidden md:block">
          <span>Esc: Exit</span>
      </div>
    </div>
  );
};
