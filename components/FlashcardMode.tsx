

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { VocabularyItem } from '../types';
import { ArrowLeft, ArrowRight, Shuffle, RotateCcw, Eye, EyeOff, FileBadge } from 'lucide-react';

interface Props {
  data: VocabularyItem[];
  initialIndex?: number;
  onExit: () => void;
  onUpdateLevel: (id: string, level: number) => void;
  onShuffle: () => void;
  onRestore: () => void;
  onSaveProgress: (index: number) => void;
  onGetSourceName: (id: string) => string | undefined;
}

export const FlashcardMode: React.FC<Props> = ({ data, initialIndex = 0, onExit, onUpdateLevel, onShuffle, onRestore, onSaveProgress, onGetSourceName }) => {
  // Filter Logic
  const [activeLevels, setActiveLevels] = useState<Set<number>>(new Set([0, 1, 2, 3]));
  
  const filteredData = useMemo(() => {
    return data.filter(item => activeLevels.has(item.level));
  }, [data, activeLevels]);

  const [index, setIndex] = useState(initialIndex < filteredData.length ? initialIndex : 0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [showAllDefs, setShowAllDefs] = useState(false);
  const [showSource, setShowSource] = useState(false);
  
  // Gesture State for Main Card
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [exitDirection, setExitDirection] = useState<'left' | 'right' | null>(null);
  const startX = useRef<number | null>(null);
  const isSwipeGesture = useRef(false);

  // Scrubber State
  const [isScrubbing, setIsScrubbing] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);

  // Gesture State for Traffic Lights
  const lightStartX = useRef<number | null>(null);
  const lastLightUpdateX = useRef<number | null>(null);

  const currentCard = filteredData[index];
  const nextCard = filteredData[index + 1]; 

  // Save progress whenever index changes
  useEffect(() => {
    onSaveProgress(index);
  }, [index, onSaveProgress]);

  // Adjust index if filtered data changes size
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
    setIsRevealed(prev => !prev);
  }, []);

  const toggleShowAllDefs = () => {
      setShowAllDefs(prev => !prev);
  };

  // -- Card Gesture Handlers --

  const handleTouchStart = (e: React.TouchEvent) => {
    if (exitDirection) return; 
    startX.current = e.touches[0].clientX;
    setIsDragging(false);
    isSwipeGesture.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || exitDirection) return;
    const currentX = e.touches[0].clientX;
    const delta = currentX - startX.current;
    
    // Deadzone check (10px)
    if (!isDragging) {
        if (Math.abs(delta) > 10) {
            setIsDragging(true);
            isSwipeGesture.current = true;
        }
    }

    if (isDragging) {
        setDragX(delta);
    }
  };

  const handleTouchEnd = () => {
    if (startX.current === null || exitDirection) return;
    
    if (isDragging) {
        const threshold = 60;

        if (dragX < -threshold) {
            if (index < filteredData.length - 1) triggerSwipeAnimation('left');
            else setDragX(0);
        } else if (dragX > threshold) {
            if (index > 0) triggerSwipeAnimation('right');
            else setDragX(0);
        } else {
            setDragX(0);
        }
    }
    
    setIsDragging(false);
    startX.current = null;
  };

  const handleCardClick = (e: React.MouseEvent) => {
      if (isSwipeGesture.current) {
          isSwipeGesture.current = false;
          return;
      }
      toggleReveal();
  };

  // -- Scrubber Logic --
  const handleScrub = (clientX: number) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newIndex = Math.floor(pct * (filteredData.length - 1));
    setIndex(newIndex);
    setIsRevealed(false);
  };

  const handleScrubStart = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsScrubbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    handleScrub(e.clientX);
  };

  const handleScrubMove = (e: React.PointerEvent) => {
    if (isScrubbing) handleScrub(e.clientX);
  };

  const handleScrubEnd = (e: React.PointerEvent) => {
    setIsScrubbing(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };


  // -- Keyboard Controls --
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Filters
      if (e.key === '`' || e.key === '~' || e.code === 'Backquote') toggleFilter(0);
      if (e.key === '1') toggleFilter(1);
      if (e.key === '2') toggleFilter(2);
      if (e.key === '3') toggleFilter(3);

      // Toolbars
      if (e.key === '4') setShowSource(prev => !prev);
      if (e.key === '5') toggleShowAllDefs();
      if (e.key === '6') { setIndex(0); onShuffle(); }
      if (e.key === '7') { setIndex(0); onRestore(); }

      if (e.code === 'Space') {
        e.preventDefault(); 
        toggleReveal();
      } else if (e.code === 'ArrowRight') {
        if (index < filteredData.length - 1) handleNextData();
      } else if (e.code === 'ArrowLeft') {
        if (index > 0) handlePrevData();
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        if (currentCard && currentCard.level < 3) {
            onUpdateLevel(currentCard.id, currentCard.level + 1);
        }
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (currentCard && currentCard.level > 0) {
            onUpdateLevel(currentCard.id, currentCard.level - 1);
        }
      } else if (e.code === 'Escape') {
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleReveal, handleNextData, handlePrevData, onExit, index, filteredData.length, currentCard, onUpdateLevel]);


  // -- Styles --
  const getSwipeStyle = () => {
    const rotate = dragX * 0.1; // Reduced rotation
    if (exitDirection === 'left') return { transform: `translate3d(-120vw, 0, 0) rotate(-15deg)`, opacity: 0, transition: 'all 0.2s ease-in' };
    if (exitDirection === 'right') return { transform: `translate3d(120vw, 0, 0) rotate(15deg)`, opacity: 0, transition: 'all 0.2s ease-in' };
    return { 
      transform: `translate3d(${dragX}px, 0, 0) rotate(${rotate}deg)`, 
      transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
      opacity: 1
    };
  };

  // Progress Bar Styles
  const progressStyle = { 
    width: `${filteredData.length > 0 ? ((index + 1) / filteredData.length) * 100 : 0}%`,
    transition: isScrubbing ? 'none' : 'width 0.2s ease-out' 
  };
  
  const thumbStyle = {
      left: `${filteredData.length > 0 ? ((index + 1) / filteredData.length) * 100 : 0}%`,
      transition: isScrubbing ? 'none' : 'left 0.2s ease-out'
  };

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
          </div>
      );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-2xl mx-auto h-full px-2 md:px-4 touch-none select-none py-2 md:py-6 animate-game-pop-in">
      
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
                                ? 'bg-[#3e4044] text-gray-200 border border-monkey-sub/50' 
                                : 'bg-transparent text-monkey-sub hover:text-gray-300 border border-monkey-sub/20'
                        }`}
                    >
                        {level}
                    </button>
                )
            })}
        </div>
        <div className="flex gap-2">
            <button
                onClick={() => setShowSource(!showSource)}
                className={`p-2 transition-colors ${showSource ? 'text-monkey-text bg-monkey-sub/20 rounded' : 'text-monkey-sub hover:text-monkey-main'}`}
                title="Toggle Source File (4)"
            >
                <FileBadge size={18} />
            </button>
            <button 
                onClick={toggleShowAllDefs} 
                className={`p-2 transition-colors ${showAllDefs ? 'text-monkey-text bg-monkey-sub/20 rounded' : 'text-monkey-sub hover:text-monkey-main'}`} 
                title={showAllDefs ? "Hide Translations (5)" : "Always Show Translations (5)"}
            >
                {showAllDefs ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button onClick={() => { setIndex(0); onShuffle(); }} className="p-2 text-monkey-sub hover:text-monkey-main transition-colors" title="Shuffle (6)"><Shuffle size={18} /></button>
            <button onClick={() => { setIndex(0); onRestore(); }} className="p-2 text-monkey-sub hover:text-monkey-main transition-colors" title="Restore Order (7)"><RotateCcw size={18} /></button>
        </div>
      </div>

      {/* Stats */}
      <div className="w-full flex justify-between text-monkey-sub text-xs mb-2 font-mono">
        <span>{index + 1} / {filteredData.length}</span>
      </div>
      
      {/* Interactive Progress Bar */}
      <div 
        ref={progressBarRef}
        className="w-full h-4 relative flex items-center mb-4 cursor-pointer group touch-none select-none py-2" 
        onPointerDown={handleScrubStart}
        onPointerMove={handleScrubMove}
        onPointerUp={handleScrubEnd}
        onPointerLeave={handleScrubEnd}
      >
        <div className={`w-full bg-monkey-sub/30 rounded-full transition-all duration-200 ${isScrubbing ? 'h-2' : 'h-1 group-hover:h-2'}`}></div>
        <div 
          className={`absolute left-0 bg-monkey-main rounded-full ${isScrubbing ? 'h-2' : 'h-1 group-hover:h-2'}`}
          style={progressStyle}
        />
        <div 
            className={`absolute w-4 h-4 bg-white rounded-full transform -translate-x-1/2 pointer-events-none transition-opacity duration-150 ${isScrubbing ? 'scale-100 opacity-100' : 'scale-0 opacity-0'}`}
            style={thumbStyle}
        />
        <div 
             className={`absolute -top-8 px-2 py-1 bg-monkey-bg border border-monkey-main text-monkey-main text-xs rounded transform -translate-x-1/2 transition-opacity duration-150 pointer-events-none ${isScrubbing ? 'opacity-100' : 'opacity-0'}`}
             style={thumbStyle}
        >
            {index + 1}
        </div>
      </div>

      {/* Scene */}
      <div className="w-full relative flex-grow min-h-[40vh] md:h-96 md:flex-grow-0 flex items-center justify-center perspective-1000">
        
        {/* Background Card (Next) - Fixed Scale */}
        {nextCard && (
          <div 
            className="absolute w-full h-full z-0 pointer-events-none"
          >
             <div 
                className="w-full h-full bg-[#2c2e31] border border-monkey-sub/20 rounded-xl flex flex-col items-center justify-center p-6 md:p-8 relative"
             >
                {/* Traffic Lights (Visual Only) */}
                <div className="absolute top-4 left-4 p-4 -ml-4 -mt-4 flex gap-1 z-30">
                    {[1, 2, 3].map(l => (
                         <div 
                            key={l}
                            className={`w-3 h-3 rounded-full border border-monkey-sub/50 transition-transform ${nextCard.level >= l ? (nextCard.level === 3 ? 'bg-green-500 border-green-500' : 'bg-monkey-main border-monkey-main') : 'bg-transparent'}`}
                         ></div>
                    ))}
                </div>

                {/* Source Badge (Visual Only) */}
                {showSource && nextCard.sourceId && (
                     <div className="absolute top-4 right-4 text-[10px] bg-monkey-sub/10 text-monkey-sub px-2 py-1 rounded max-w-[40%] truncate">
                         {onGetSourceName(nextCard.sourceId)}
                     </div>
                )}

                {/* Content */}
                <div className="flex flex-col items-center justify-center mb-6">
                    <span className="text-monkey-sub text-xs uppercase tracking-widest mb-4 opacity-50">Word</span>
                    <h2 className="text-3xl md:text-5xl font-bold text-monkey-main break-words max-w-full text-center">{nextCard.word}</h2>
                </div>
                
                 {/* Definition Layer (Redacted Style) */}
                 <div className="flex flex-col items-center justify-center w-full px-2 md:px-6">
                    <p className="text-lg md:text-xl leading-relaxed max-h-[40vh] md:max-h-40 overflow-hidden custom-scrollbar text-center text-transparent">
                        <span 
                            className={`rounded px-1 select-none ${showAllDefs ? 'bg-transparent text-gray-200' : 'bg-[#3f4145] text-transparent'}`}
                        >
                            {nextCard.definition}
                        </span>
                    </p>
                </div>
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
            <div 
                className="w-full h-full relative bg-[#2c2e31] border border-monkey-sub/20 rounded-xl overflow-hidden cursor-pointer group" 
                onClick={handleCardClick}
            >
                
                {/* Traffic Light Grading */}
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

                {/* Source Badge */}
                {showSource && currentCard.sourceId && (
                     <div className="absolute top-4 right-4 text-[10px] bg-monkey-sub/10 text-monkey-sub px-2 py-1 rounded max-w-[40%] truncate z-20">
                         {onGetSourceName(currentCard.sourceId)}
                     </div>
                )}

                {/* Content Container */}
                <div className="relative w-full h-full flex flex-col items-center justify-center p-6 md:p-8 text-center">
                    
                    {/* English Word */}
                    <div className="flex flex-col items-center justify-center mb-6">
                        <span className="text-monkey-sub text-xs uppercase tracking-widest mb-4 opacity-50">Word</span>
                        <h2 className="text-3xl md:text-5xl font-bold text-monkey-main break-words max-w-full">{currentCard.word}</h2>
                    </div>

                    {/* Definition Layer (Redacted Style) */}
                     <div className="flex flex-col items-center justify-center w-full px-2 md:px-6">
                        <p className="text-lg md:text-xl leading-relaxed max-h-[40vh] md:max-h-40 overflow-y-auto custom-scrollbar text-center">
                            <span 
                              className={`
                                rounded px-1
                                ${isRevealed || showAllDefs
                                  ? 'bg-transparent text-gray-200' 
                                  : 'bg-[#3f4145] text-transparent select-none' 
                                }
                              `}
                            >
                                {currentCard.definition}
                            </span>
                        </p>
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

        {/* Reveal Button - Wide with Hollow Circle */}
        <button 
          onClick={(e) => { e.stopPropagation(); toggleReveal(); }}
          className="flex items-center justify-center w-24 h-16 rounded-xl bg-monkey-sub/10 text-monkey-text hover:bg-monkey-sub/20 transition-all active:scale-95 border border-monkey-sub/10"
        >
          <div className="w-4 h-4 rounded-full border-2 border-monkey-text bg-transparent"></div>
        </button>

        <button 
          onClick={handleNextData}
          disabled={index === filteredData.length - 1}
          className="flex items-center gap-2 px-4 py-3 md:px-6 rounded-lg border border-monkey-sub/20 text-monkey-sub hover:text-monkey-text hover:border-monkey-text disabled:opacity-30 transition-all active:scale-95"
        >
          <span className="hidden md:inline">Next</span> <ArrowRight size={18} />
        </button>
      </div>

      {/* Keyboard Legend */}
      <div className="mt-4 text-[10px] text-monkey-sub/30 flex gap-4 pointer-events-none hidden md:flex">
          <span>Space: Flip</span>
          <span>↑/↓: Level</span>
          <span>←/→: Nav</span>
          <span>Esc: Exit</span>
      </div>
    </div>
  );
};