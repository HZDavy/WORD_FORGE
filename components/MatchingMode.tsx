import React, { useState, useEffect, useCallback } from 'react';
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
  const [round, setRound] = useState(initialRound);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isWait, setIsWait] = useState(false);

  const totalRounds = Math.ceil(data.length / ITEMS_PER_ROUND);

  useEffect(() => {
    onSaveProgress(round);
  }, [round, onSaveProgress]);

  const restart = () => {
      setRound(0);
      setSelectedId(null);
  };

  useEffect(() => {
    const start = round * ITEMS_PER_ROUND;
    const end = start + ITEMS_PER_ROUND;
    const slice = data.slice(start, end);

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
      let defText = item.definition.replace(/;/g, ' '); 
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
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center h-full pt-6 animate-game-pop-in">
      <div className="flex justify-between w-full mb-6 border-b border-monkey-sub/20 pb-2 px-4 items-center">
        <div>
            <span className="text-monkey-main font-bold font-mono text-lg">Round {round + 1} / {totalRounds}</span>
            <span className="text-monkey-sub text-sm font-mono ml-4 hidden sm:inline">Select matching pairs</span>
        </div>
        <div className="flex gap-2">
            <button onClick={() => { restart(); onShuffle(); }} className="p-2 text-monkey-sub hover:text-monkey-main transition-colors" title="Shuffle"><Shuffle size={18} /></button>
            <button onClick={() => { restart(); onRestore(); }} className="p-2 text-monkey-sub hover:text-monkey-main transition-colors" title="Restore Order"><RotateCcw size={18} /></button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 md:gap-4 justify-center content-start flex-grow pb-10 px-2 md:px-4 overflow-y-auto">
        {bubbles.map((b, idx) => {
           if (b.matched && b.status !== 'success') return null; 
           
           let baseClass = "px-3 py-3 md:px-5 md:py-4 rounded-lg border-2 cursor-pointer font-bold transition-all duration-300 select-none animate-pop-in max-w-full md:max-w-[400px] break-words ";
           
           if (b.status === 'default') {
               if (b.type === 'word') {
                   baseClass += "border-monkey-sub/30 text-monkey-main hover:border-monkey-main hover:bg-monkey-bg/50 bg-[#252628] text-base md:text-xl";
               } else {
                   baseClass += "border-monkey-sub/30 text-gray-200 hover:border-white hover:text-white bg-[#3e4044] text-sm md:text-base font-normal leading-relaxed";
               }
           } else if (b.status === 'selected') {
               baseClass += "border-monkey-main bg-monkey-main text-monkey-bg scale-105 z-10 text-sm md:text-base";
           } else if (b.status === 'wrong') {
               baseClass += "border-monkey-error bg-monkey-error text-white animate-shake text-sm md:text-base";
           } else if (b.status === 'success') {
               baseClass += "animate-merge-success pointer-events-none z-20 text-sm md:text-base"; 
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
      
      {/* Keyboard Legend */}
      <div className="mb-2 text-[10px] text-monkey-sub/30 hidden md:block">
          <span>Esc: Exit</span>
      </div>
    </div>
  );
};