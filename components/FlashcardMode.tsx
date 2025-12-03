import React, { useState, useEffect, useCallback } from 'react';
import { VocabularyItem } from '../types';
import { RefreshCw, Check, X } from 'lucide-react';

interface Props {
  data: VocabularyItem[];
  onExit: () => void;
}

export const FlashcardMode: React.FC<Props> = ({ data, onExit }) => {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCount, setKnownCount] = useState(0);

  const currentCard = data[index];
  const progress = Math.round(((index + 1) / data.length) * 100);

  const handleNext = useCallback(() => {
    if (index < data.length - 1) {
      setIsFlipped(false);
      setTimeout(() => setIndex(prev => prev + 1), 150);
    }
  }, [index, data.length]);

  const handlePrev = useCallback(() => {
    if (index > 0) {
      setIsFlipped(false);
      setTimeout(() => setIndex(prev => prev - 1), 150);
    }
  }, [index]);

  const handleFlip = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  const handleMarkKnown = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setKnownCount(prev => prev + 1);
    handleNext();
  }, [handleNext]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault(); // Prevent scrolling
        handleFlip();
      } else if (e.code === 'ArrowRight') {
        handleNext();
      } else if (e.code === 'ArrowLeft') {
        handlePrev();
      } else if (e.code === 'ArrowUp' || e.code === 'Enter') {
        handleMarkKnown();
      } else if (e.code === 'Escape') {
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleNext, handlePrev, handleMarkKnown, onExit]);

  if (!currentCard) return null;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto h-full">
      {/* Header Stats */}
      <div className="w-full flex justify-between text-monkey-sub text-sm mb-4 font-mono">
        <span>{index + 1} / {data.length}</span>
        <span>已掌握: {knownCount}</span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full h-1 bg-monkey-sub/30 rounded-full mb-8">
        <div 
          className="h-full bg-monkey-main transition-all duration-300 rounded-full" 
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card Container */}
      <div 
        className="relative w-full h-80 cursor-pointer perspective-1000 group"
        onClick={handleFlip}
      >
        <div className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${isFlipped ? 'rotate-y-180' : ''}`}>
          
          {/* Front */}
          <div className="absolute w-full h-full backface-hidden bg-[#2c2e31] border border-monkey-sub/20 rounded-xl flex flex-col items-center justify-center p-8 shadow-xl">
            <span className="text-monkey-sub text-xs uppercase tracking-widest mb-4">Word</span>
            <h2 className="text-4xl font-bold text-monkey-main text-center break-all">{currentCard.word}</h2>
            <p className="absolute bottom-4 text-monkey-sub/50 text-xs">Press Space to Flip</p>
          </div>

          {/* Back */}
          <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-[#2c2e31] border border-monkey-main/20 rounded-xl flex flex-col items-center justify-center p-8 shadow-xl">
             <span className="text-monkey-sub text-xs uppercase tracking-widest mb-4">Definition</span>
            <p className="text-2xl text-monkey-text text-center leading-relaxed overflow-y-auto max-h-full">{currentCard.definition}</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-6 mt-10">
        <button 
          onClick={handlePrev}
          disabled={index === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-transparent border border-monkey-sub text-monkey-sub hover:text-monkey-text hover:border-monkey-text disabled:opacity-30 transition-all"
        >
          ← Prev
        </button>

        <button 
          onClick={(e) => { e.stopPropagation(); handleFlip(); }}
          className="flex items-center gap-2 px-8 py-3 rounded-lg bg-monkey-sub/20 text-monkey-text hover:bg-monkey-sub/40 transition-all"
        >
          <RefreshCw size={18} /> Flip
        </button>

        <button 
          onClick={handleNext}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-transparent border border-monkey-sub text-monkey-sub hover:text-monkey-text hover:border-monkey-text disabled:opacity-30 transition-all"
        >
          Next →
        </button>
      </div>

      <div className="mt-8 text-xs text-monkey-sub/50 font-mono text-center">
        [Space] Flip • [Arrows] Nav • [Enter] Mark Known • [Esc] Menu
      </div>
    </div>
  );
};