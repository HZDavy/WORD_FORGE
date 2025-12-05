import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { VocabularyItem } from '../types';
import { ChevronUp, ArrowLeft, ArrowRight, Shuffle, RotateCcw } from 'lucide-react';

interface Props {
  data: VocabularyItem[];
  onExit: () => void;
  onUpdateLevel: (id: string, level: number) => void;
  onShuffle: () => void;
  onRestore: () => void;
}

export const FlashcardMode: React.FC<Props> = ({ data, onExit, onUpdateLevel, onShuffle, onRestore }) => {
  // Filter Logic
  const [activeLevels, setActiveLevels] = useState<Set<number>>(new Set([0, 1, 2, 3]));
  
  const filteredData = useMemo(() => {
    return data.filter(item => activeLevels.has(item.level));
  }, [data, activeLevels]);

  const [index, setIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  
  // Gesture State for Main Card
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const startX = useRef<number | null>(null);

  // Gesture State for Traffic Lights
  const lightStartX = useRef<number | null>(null);
  const lastLightUpdateX = useRef<number | null>(null);

  const currentCard = filteredData[index];
  const nextCard = filteredData[index + 1]; 

  useEffect(() => {
      if (index >= filteredData.length && filteredData.length > 0) {
          setIndex(0);
      }
  }, [filteredData.length, index]);

  const toggleFilter = (level: number) => {
      setActiveLevels(prev => {
          const next = new Set(prev);
          if (next.has(level)) next.delete(level);
          else next.add(level);
          return next.size === 0 ? prev : next;
      });
      setIndex(0);
  };

  // -- Grading Logic --
  const handleLevelClick = (e: React.MouseEvent, level: number) => {
    e.stopPropagation();
    if (currentCard) onUpdateLevel(currentCard.id, level);
  };

  const handleLightTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    lightStartX.current = e.touches[0].clientX;
    lastLightUpdateX.current = e.touches[0].clientX;
  };

  const handleLightTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (lastLightUpdateX.current === null || !currentCard) return;

    const currentX = e.touches[0].clientX;
    const diff = currentX - lastLightUpdateX.current;
    const THRESHOLD = 10; 

    if (Math.abs(diff) > THRESHOLD) {
        if (diff > 0) {
            // Moved Right
            if (currentCard.level < 3) {
                onUpdateLevel(currentCard.id, currentCard.level + 1);
                lastLightUpdateX.current = currentX; // Reset anchor
            }
        } else {
            // Moved Left
            if (currentCard.level > 0) {
                onUpdateLevel(currentCard.id, currentCard.level - 1);
                lastLightUpdateX.current = currentX; // Reset anchor
            }
        }
    }
  };

  const handleLightTouchEnd = (e: React.TouchEvent) => {
      e.stopPropagation();
      lightStartX.current = null;
      lastLightUpdateX.current = null;
  }

  // -- Navigation Logic --

  const handleNextData = useCallback(() => {
    if (index < filteredData.length - 1) {
      setIndex(prev => prev + 1);
      setIsRevealed(false);
    }
    setDragX(0);
    setExitDirection(null);
  }, [index, filteredData.length]);

  const handlePrevData = useCallback(() => {
    if (index > 0) {
      setIndex(prev => prev - 1);
      setIsRevealed(false);
    }
    setDragX(0);
    setExitDirection(null);
  }, [index]);

  const triggerSwipeAnimation = (direction: 'left' | 'right') => {
    setExitDirection(direction);
    setTimeout(() => {
        if (direction === 'left') handleNextData();
        else handlePrevData();
    }, 200); 
  };

  const toggleReveal = useCallback(() => {
    if (!isDragging && !exitDirection) {
      setIsRevealed(prev => !prev);
    }
  }, [isDragging, exitDirection]);

  // -- Card Gesture Handlers --

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
    const threshold = 50; 

    if (dragX < -threshold) {
      if (index < filteredData.length - 1) triggerSwipeAnimation('left');
      else setDragX(0);
    } else if (dragX > threshold) {
      if (index > 0) triggerSwipeAnimation('right');
      else setDragX(0);
    } else {
      setDragX(0);
    }
    startX.current = null;
  };

  // -- Keyboard Controls --
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault(); 
        toggleReveal();
      } else if (e.code === 'ArrowRight') {
        if (index < filteredData.length - 1) handleNextData();
      } else if (e.code === 'ArrowLeft') {
        if (index > 0) handlePrevData();
      } else if (e.code === 'Escape') {
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleReveal, handleNextData, handlePrevData, onExit, index, filteredData.length]);


  // -- Styles --
  const getSwipeStyle = () => {
    const rotate = dragX * 0.2; // Enhanced rotation
    if (exitDirection === 'left') return { transform: `translate3d(-120vw, 0, 0) rotate(-25deg)`, opacity: 0, transition: 'all 0.2s ease-in' };
    if (exitDirection === 'right') return { transform: `translate3d(120vw, 0, 0) rotate(25deg)`, opacity: 0, transition: 'all 0.2s ease-in' };
    return { 
      transform: `translate3d(${dragX}px, 0, 0) rotate(${rotate}deg)`, 
      transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
      opacity: 1
    };
  };

  // Background Card Dynamic Styles
  const progress = Math.min(Math.abs(dragX) / 300, 1);
  const bgScale = 0.95 + (progress * 0.05); // Scales from 0.95 to 1.0
  const bgOpacity = 0.5 + (progress * 0.5); // Opacity from 0.5 to 1.0

  if (filteredData.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-center">
              <h2 className="text-2xl font-bold text-monkey-sub mb-4">No cards in selected levels</h2>
              <div className="flex gap-2 justify-center">
                  {[0,1,2,3].map(l => (
                      <button key={l} onClick={() => toggleFilter(l)} className={`w-8 h-8 rounded border text-xs ${activeLevels.has(l) ? 'bg-[#3e4044] text-gray-200 border-monkey-sub/50' : 'bg-transparent text-monkey-sub border-monkey-sub/20'}`}>
                          {l}
                      </button>
                  ))}
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto h-full px-2 md:px-4 touch-none select-none py-2 md:py-6">
      
      {/* Top Controls: Filter & Shuffle */}
      <div className="w-full flex justify-between items-center mb-4 z-30">
        <div className="flex gap-1 md:gap-2">
            {[0, 1, 2, 3].map(level => {
                const isActive = activeLevels.has(level);
                return (
                    <button 
                        key={level} 
                        onClick={() => toggleFilter(level)}
                        className={`w-8 h-8 rounded flex items-center justify-center text-sm font-bold transition-all ${
                            isActive 
                                ? 'bg-[#3e4044] text-gray-200 border border-monkey-sub/50 shadow-md' 
                                : 'bg-transparent text-monkey-sub hover:text-gray-300 border border-monkey-sub/20'
                        }`}
                    >
                        {level}
                    </button>
                )
            })}
        </div>
        <div className="flex gap-2">
            <button onClick={() => { setIndex(0); onShuffle(); }} className="p-2 text-monkey-sub hover:text-monkey-main transition-colors" title="Shuffle"><Shuffle size={18} /></button>
            <button onClick={() => { setIndex(0); onRestore(); }} className="p-2 text-monkey-sub hover:text-monkey-main transition-colors" title="Restore Order"><RotateCcw size={18} /></button>
        </div>
      </div>

      {/* Stats */}
      <div className="w-full flex justify-between text-monkey-sub text-xs mb-2 font-mono">
        <span>{index + 1} / {filteredData.length}</span>
      </div>
      
      {/* Progress Bar */}
      <div className="w-full h-1 bg-monkey-sub/30 rounded-full mb-6">
        <div 
          className="h-full bg-monkey-main transition-all duration-300 rounded-full" 
          style={{ width: `${((index + 1) / filteredData.length) * 100}%` }}
        />
      </div>

      {/* Scene */}
      <div className="w-full relative flex-grow min-h-[40vh] md:h-96 md:flex-grow-0 flex items-center justify-center perspective-1000">
        
        {/* Background Card (Next) */}
        {nextCard && (
          <div 
            className="absolute w-full h-full z-0 pointer-events-none transition-transform duration-75"
            style={{ 
                transform: `scale(${bgScale}) translateY(12px)`, 
                opacity: bgOpacity 
            }}
          >
             <div className="w-full h-full bg-[#2c2e31] border border-monkey-sub/20 rounded-xl flex items-center justify-center shadow-2xl">
                <h2 className="text-3xl md:text-4xl font-bold text-monkey-main opacity-30 px-4 text-center">{nextCard.word}</h2>
             </div>
          </div>
        )}

        {/* Active Card Container */}
        <div 
            key={currentCard.id} 
            className="absolute w-full h-full z-10 touch-none origin-bottom"
            style={getSwipeStyle()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div className="w-full h-full relative bg-[#2c2e31] border border-monkey-sub/20 rounded-xl shadow-2xl overflow-hidden cursor-pointer group" onClick={toggleReveal}>
                
                {/* Traffic Light Grading (Top Left) */}
                <div 
                    className="absolute top-4 left-4 p-4 -ml-4 -mt-4 flex gap-1 z-30 touch-none" 
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={handleLightTouchStart}
                    onTouchMove={handleLightTouchMove}
                    onTouchEnd={handleLightTouchEnd}
                >
                    {[1, 2, 3].map(l => (
                         <div 
                            key={l}
                            onClick={(e) => handleLevelClick(e, l)}
                            className={`w-3 h-3 rounded-full border border-monkey-sub/50 cursor-pointer transition-transform ${currentCard.level >= l ? (currentCard.level === 3 ? 'bg-green-500 border-green-500' : 'bg-monkey-main border-monkey-main') : 'bg-transparent'}`}
                         ></div>
                    ))}
                </div>

                {/* Content Container */}
                <div className="relative w-full h-full flex flex-col items-center justify-center p-6 md:p-8 text-center">
                    
                    {/* Definition Layer (Static, Fades In, Moves Down) */}
                     <div 
                        className={`absolute flex flex-col items-center justify-center w-full px-2 md:px-6 transition-all duration-300 transform mt-5 ${isRevealed ? 'opacity-100 translate-y-8 md:translate-y-12' : 'opacity-0 translate-y-12'}`}
                     >
                        <div className="w-8 h-1 bg-monkey-sub/20 mb-3 rounded-full"></div>
                        <p className="text-lg md:text-xl text-gray-200 leading-relaxed max-h-[40vh] md:max-h-40 overflow-y-auto custom-scrollbar">{currentCard.definition}</p>
                    </div>

                    {/* English Word Layer (Slides Up) */}
                    <div 
                        className={`relative z-10 flex flex-col items-center justify-center transition-transform duration-300 cubic-bezier(0.34, 1.56, 0.64, 1) ${isRevealed ? '-translate-y-12 md:-translate-y-16' : 'translate-y-0'}`}
                    >
                        <span className="text-monkey-sub text-xs uppercase tracking-widest mb-4 opacity-50">Word</span>
                        <h2 className="text-3xl md:text-5xl font-bold text-monkey-main break-words max-w-full">{currentCard.word}</h2>
                    </div>

                </div>
            </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4 md:gap-6 mt-6 md:mt-12 z-20 w-full justify-center">
        <button 
          onClick={handlePrevData}
          disabled={index === 0}
          className="flex items-center gap-2 px-4 py-3 md:px-6 rounded-lg border border-monkey-sub/20 text-monkey-sub hover:text-monkey-text hover:border-monkey-text disabled:opacity-30 transition-all active:scale-95"
        >
          <ArrowLeft size={18} /> <span className="hidden md:inline">Prev</span>
        </button>

        <button 
          onClick={(e) => { e.stopPropagation(); toggleReveal(); }}
          className="flex items-center justify-center w-20 md:w-32 py-3 rounded-lg bg-monkey-sub/10 text-monkey-text hover:bg-monkey-sub/20 transition-all active:scale-95"
        >
          <ChevronUp 
            size={24} 
            className={`transition-transform duration-300 ${isRevealed ? 'rotate-180' : ''}`} 
          />
        </button>

        <button 
          onClick={handleNextData}
          disabled={index === filteredData.length - 1}
          className="flex items-center gap-2 px-4 py-3 md:px-6 rounded-lg border border-monkey-sub/20 text-monkey-sub hover:text-monkey-text hover:border-monkey-text disabled:opacity-30 transition-all active:scale-95"
        >
          <span className="hidden md:inline">Next</span> <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
};