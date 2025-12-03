import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { VocabularyItem } from '../types';

interface Props {
  data: VocabularyItem[];
  onExit: () => void;
}

interface Bubble {
  id: string; // The vocabulary ID (to match pairs)
  uid: string; // Unique ID for the bubble itself
  text: string;
  type: 'word' | 'def';
  matched: boolean;
  status: 'default' | 'selected' | 'wrong' | 'success';
}

const ITEMS_PER_ROUND = 6; 

export const MatchingMode: React.FC<Props> = ({ data, onExit }) => {
  const [round, setRound] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isWait, setIsWait] = useState(false);

  const totalRounds = Math.ceil(data.length / ITEMS_PER_ROUND);

  useEffect(() => {
    const start = round * ITEMS_PER_ROUND;
    const end = start + ITEMS_PER_ROUND;
    const slice = data.slice(start, end);

    if (slice.length === 0) return;

    // Word bubbles
    const wordBubbles: Bubble[] = slice.map(item => ({
      id: item.id,
      uid: item.id + '-w',
      text: item.word,
      type: 'word',
      matched: false,
      status: 'default'
    }));

    // Definition bubbles
    // FIX: Replaced .split(';')[0] with .replace() to show multiple meanings
    const defBubbles: Bubble[] = slice.map(item => {
      // Replace semicolons with spaces for clearer layout
      let defText = item.definition.replace(/;/g, ' '); 
      
      // Truncate if excessively long, but allow enough length for multiple meanings
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
  }, [round, data]);

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
      // MATCH
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
        }, 1000); // Wait for animation to finish
      }
    } else {
      // WRONG
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


  if (round >= totalRounds) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in-up">
              <h2 className="text-4xl font-bold text-monkey-main mb-4">全通关!</h2>
              <p className="mb-8 text-monkey-text">所有词汇配对完成。</p>
              <button onClick={onExit} className="px-6 py-2 border border-monkey-main text-monkey-main hover:bg-monkey-main hover:text-monkey-bg transition font-bold">Back to Menu</button>
          </div>
      )
  }

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center h-full pt-6">
      <div className="flex justify-between w-full mb-6 border-b border-monkey-sub/20 pb-2 px-4">
        <span className="text-monkey-main font-bold font-mono">Round {round + 1} / {totalRounds}</span>
        <span className="text-monkey-sub text-sm font-mono">Select matching pairs</span>
      </div>

      <div className="flex flex-wrap gap-4 justify-center content-start flex-grow pb-10 px-4">
        {bubbles.map((b, idx) => {
           // Keep rendered even if matched for animation duration, but disable interaction
           // If we removed it immediately, the exit animation might be cut off or layout shifts abruptly
           // We'll hide it via CSS after animation completes using logic if needed, but 'opacity-0' in animation handles visibility
           if (b.matched && b.status !== 'success') return null; // Only keep render if it just succeeded (animation playing) or we handle removal differently. 
           // ACTUALLY: The animation 'merge-success' ends with opacity: 0. 
           // We can keep it in DOM but it will be invisible.
           // However, layout shift? 
           // If we want layout shift (bubbles moving to fill gap), we should remove from DOM after timeout.
           // In handleSelect we wait 1000ms before next round, but for individual bubbles?
           // The simplest way for grid games is to keep the gap (invisible bubble).
           // If we want them to disappear and others to reflow, we need to remove from array.
           // But `b.matched` is true. Let's rely on opacity-0 for now to prevent jarring reflows mid-round.
           
           let baseClass = "px-5 py-4 rounded-lg border-2 cursor-pointer font-bold text-sm transition-all duration-300 select-none animate-pop-in max-w-[400px] break-words ";
           
           if (b.status === 'default') {
               if (b.type === 'word') {
                   baseClass += "border-monkey-sub/30 text-monkey-main hover:border-monkey-main hover:bg-monkey-bg/50 bg-[#252628] text-xl";
               } else {
                   // Definition style: Lighter, larger text
                   baseClass += "border-monkey-sub/30 text-gray-200 hover:border-white hover:text-white bg-[#3e4044] font-normal leading-relaxed";
               }
           } else if (b.status === 'selected') {
               baseClass += "border-monkey-main bg-monkey-main text-monkey-bg scale-105 shadow-lg z-10";
           } else if (b.status === 'wrong') {
               baseClass += "border-monkey-error bg-monkey-error text-white animate-shake";
           } else if (b.status === 'success') {
               // Use the new merge-success animation
               baseClass += "animate-merge-success pointer-events-none z-20"; 
           }

           return (
             <div
               key={b.uid}
               onClick={() => handleSelect(b.uid)}
               className={baseClass}
               style={{ animationDelay: b.status === 'default' ? `${idx * 40}ms` : '0ms' }}
             >
               {b.text}
             </div>
           )
        })}
      </div>
    </div>
  );
};