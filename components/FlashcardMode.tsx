import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VocabularyItem } from '../types';
import { RefreshCw, ArrowLeft, ArrowRight } from 'lucide-react';

interface Props {
  data: VocabularyItem[];
  onExit: () => void;
}

export const FlashcardMode: React.FC<Props> = ({ data, onExit }) => {
  const [index, setIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownCount, setKnownCount] = useState(0);
  
  // Gesture State
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  
  // Refs
  const startX = useRef<number | null>(null);
  
  const currentCard = data[index];
  const nextCard = data[index + 1]; 
  const progress = Math.round(((index + 1) / data.length) * 100);

  // -- Navigation Logic --

  const handleNextData = useCallback(() => {
    if (index < data.length - 1) {
      setIndex(prev => prev + 1);
      setIsFlipped(false);
    }
    // Reset visual state INSTANTLY after data swap
    setDragX(0);
    setExitDirection(null);
  }, [index, data.length]);

  const handlePrevData = useCallback(() => {
    if (index > 0) {
      setIndex(prev => prev - 1);
      setIsFlipped(false);
    }
    // Reset visual state INSTANTLY after data swap
    setDragX(0);
    setExitDirection(null);
  }, [index]);

  const triggerSwipeAnimation = (direction: 'left' | 'right') => {
    setExitDirection(direction);
    // Wait for animation to finish before swapping data
    setTimeout(() => {
        if (direction === 'left') handleNextData();
        else handlePrevData();
    }, 200); 
  };

  const goNext = useCallback(() => {
     // Button click: Instant switch
     if (index < data.length - 1) {
        handleNextData();
     }
  }, [handleNextData, index, data.length]);

  const goPrev = useCallback(() => {
     if (index > 0) {
        handlePrevData();
     }
  }, [handlePrevData, index]);

  const handleFlip = useCallback(() => {
    // Only allow flip if not currently swiping/exiting
    if (!isDragging && !exitDirection) {
      setIsFlipped(prev => !prev);
    }
  }, [isDragging, exitDirection]);

  const handleMarkKnown = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setKnownCount(prev => prev + 1);
    goNext(); 
  }, [goNext]);

  // -- Gesture Handlers --

  const handleTouchStart = (e: React.TouchEvent) => {
    if (exitDirection) return; 
    startX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || exitDirection) return;
    const currentX = e.touches[0].clientX;
    const delta = currentX - startX.current;
    setDragX(delta);
  };

  const handleTouchEnd = () => {
    if (startX.current === null || exitDirection) return;
    
    setIsDragging(false);
    const threshold = 80; 

    if (dragX < -threshold) {
      // Swipe Left -> Next
      if (index < data.length - 1) {
        triggerSwipeAnimation('left');
      } else {
        setDragX(0); // Bounce back if end of list
      }
    } else if (dragX > threshold) {
      // Swipe Right -> Prev
      if (index > 0) {
        triggerSwipeAnimation('right');
      } else {
        setDragX(0); // Bounce back if start of list
      }
    } else {
      setDragX(0); // Snap back
    }
    
    startX.current = null;
  };

  // -- Keyboard Controls --
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault(); 
        handleFlip();
      } else if (e.code === 'ArrowRight') {
        goNext();
      } else if (e.code === 'ArrowLeft') {
        goPrev();
      } else if (e.code === 'ArrowUp' || e.code === 'Enter') {
        handleMarkKnown();
      } else if (e.code === 'Escape') {
        onExit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, goNext, goPrev, handleMarkKnown, onExit]);


  // -- Render Helpers --

  const getSwipeContainerStyle = () => {
    if (exitDirection === 'left') {
      return { transform: `translateX(-120vw) rotate(-20deg)`, transition: 'transform 0.2s ease-in', opacity: 0 };
    }
    if (exitDirection === 'right') {
      return { transform: `translateX(120vw) rotate(20deg)`, transition: 'transform 0.2s ease-in', opacity: 0 };
    }
    
    // Normal swipe state
    const rotate = dragX * 0.05;
    return { 
      transform: `translateX(${dragX}px) rotate(${rotate}deg)`,
      transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
      cursor: isDragging ? 'grabbing' : 'grab',
      opacity: 1
    };
  };

  const getBgCardStyle = () => {
      if (isDragging && !exitDirection) {
        const maxDrag = 200; 
        const percentage = Math.min(Math.abs(dragX) / maxDrag, 1);
        const scale = 0.95 + (0.05 * percentage);
        const opacity = 0.5 + (0.5 * percentage);
        const translateY = 12 - (12 * percentage);
        return {
            transform: `scale(${scale}) translateY(${translateY}px)`,
            opacity: opacity,
            transition: 'none'
        };
      }
      if (exitDirection) {
        return {
          transform: `scale(1) translateY(0px)`,
          opacity: 1,
          transition: 'all 0.2s ease-in'
        };
      }
      return {
          transform: 'scale(0.95) translateY(12px)',
          opacity: 0.5,
          transition: 'all 0.3s ease'
      };
  };

  if (!currentCard) return null;

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto h-full px-4 overflow-hidden touch-none select-none">
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

      {/* 3D Scene Container */}
      <div className="w-full relative h-80 flex items-center justify-center perspective-1000">
        
        {/* Background Stack Card (Next Card) */}
        {nextCard && (
          <div 
            className="absolute w-full h-full z-0 flex items-center justify-center pointer-events-none"
            style={getBgCardStyle()}
          >
             <div className="w-full h-full bg-[#2c2e31] border border-monkey-sub/20 rounded-xl flex items-center justify-center p-8 shadow-2xl">
                <h2 className="text-4xl font-bold text-monkey-main text-center opacity-50">{nextCard.word}</h2>
             </div>
          </div>
        )}

        {/* Active Card Container (Handles Swipe X/Y) */}
        <div 
            className="absolute w-full h-full z-10 touch-none"
            style={getSwipeContainerStyle()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={handleFlip}
        >
            {/* Flip Container (Handles Rotate Y) */}
            <div className={`w-full h-full relative transition-transform duration-300 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                
                {/* Front Face */}
                <div className="absolute w-full h-full backface-hidden bg-[#2c2e31] border border-monkey-sub/20 rounded-xl flex flex-col items-center justify-center p-8 shadow-2xl">
                    <span className="text-monkey-sub text-xs uppercase tracking-widest mb-4">Word</span>
                    <h2 className="text-4xl font-bold text-monkey-main text-center break-all">{currentCard.word}</h2>
                    <p className="absolute bottom-4 text-monkey-sub/50 text-xs">Tap to Flip • Slide to Next</p>
                </div>

                {/* Back Face */}
                <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-[#2c2e31] border border-monkey-main/20 rounded-xl flex flex-col items-center justify-center p-8 shadow-2xl">
                    <span className="text-monkey-sub text-xs uppercase tracking-widest mb-2">Definition</span>
                    <h3 className="text-xl font-bold text-monkey-main mb-4">{currentCard.word}</h3>
                    <div className="w-8 h-1 bg-monkey-sub/20 mb-4 rounded-full"></div>
                    <p className="text-xl text-monkey-text text-center leading-relaxed overflow-y-auto max-h-40 scrollbar-hide">{currentCard.definition}</p>
                </div>
            </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-6 mt-12 z-20">
        <button 
          onClick={goPrev}
          disabled={index === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-transparent border border-monkey-sub text-monkey-sub hover:text-monkey-text hover:border-monkey-text disabled:opacity-30 transition-all active:scale-95"
        >
          <ArrowLeft size={18} /> Prev
        </button>

        <button 
          onClick={(e) => { e.stopPropagation(); handleFlip(); }}
          className="flex items-center gap-2 px-8 py-3 rounded-lg bg-monkey-sub/20 text-monkey-text hover:bg-monkey-sub/40 transition-all active:scale-95"
        >
          <RefreshCw size={18} /> Flip
        </button>

        <button 
          onClick={goNext}
          disabled={index === data.length - 1}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-transparent border border-monkey-sub text-monkey-sub hover:text-monkey-text hover:border-monkey-text disabled:opacity-30 transition-all active:scale-95"
        >
          Next <ArrowRight size={18} />
        </button>
      </div>

      <div className="mt-8 text-xs text-monkey-sub/50 font-mono text-center">
        [Swipe/Arrows] Nav • [Space] Flip • [Enter] Mark Known
      </div>
    </div>
  );
};