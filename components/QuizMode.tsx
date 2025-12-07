
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { VocabularyItem } from '../types';
import { CheckCircle, XCircle, ArrowRight, ArrowLeft, Shuffle, RotateCcw, FileBadge, Sliders } from 'lucide-react';

interface Props {
  data: VocabularyItem[];
  initialState?: { currentIndex: number; score: number; answeredState: Record<number, number | null> };
  onExit: () => void;
  onShuffle: () => void;
  onRestore: () => void;
  onSaveProgress: (state: { currentIndex: number; score: number; answeredState: Record<number, number | null> }) => void;
  onGetSourceName: (id: string) => string | undefined;
  onUpdateLevel: (id: string, level: number) => void;
}

export const QuizMode: React.FC<Props> = ({ data, initialState, onExit, onShuffle, onRestore, onSaveProgress, onGetSourceName, onUpdateLevel }) => {
  // Filter Logic
  const [activeLevels, setActiveLevels] = useState<Set<number>>(new Set([0, 1, 2, 3]));
  
  const quizItems = useMemo(() => {
    return data.filter(item => activeLevels.has(item.level));
  }, [data, activeLevels]);

  const [currentIndex, setCurrentIndex] = useState(initialState?.currentIndex || 0);
  const [score, setScore] = useState(initialState?.score || 0);
  const [answeredState, setAnsweredState] = useState<{ [key: number]: number | null }>(initialState?.answeredState || {}); 
  const [isAnimating, setIsAnimating] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [showGrading, setShowGrading] = useState(false);
  
  // Stable Options State
  const [currentOptions, setCurrentOptions] = useState<VocabularyItem[]>([]);

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Gesture State for Traffic Lights
  const lightStartX = useRef<number | null>(null);
  const lastLightUpdateX = useRef<number | null>(null);
  
  // Long press for main word
  const longPressTimer = useRef<number | null>(null);

  const currentItem = quizItems[currentIndex];
  const selectedOption = answeredState[currentIndex] ?? null;

  // Reset index if it goes out of bounds when filtering changes
  useEffect(() => {
      if (currentIndex >= quizItems.length && quizItems.length > 0) {
          setCurrentIndex(0);
          setAnsweredState({});
      }
  }, [quizItems.length, currentIndex]);

  // Save progress on change
  useEffect(() => {
    onSaveProgress({ currentIndex, score, answeredState });
  }, [currentIndex, score, answeredState, onSaveProgress]);

  // Generate Stable Options only when currentItem ID changes
  useEffect(() => {
    if (!currentItem) {
        setCurrentOptions([]);
        return;
    }

    // Pick wrong options from the FULL dataset (data), not just filtered set
    const wrongOptions = data
      .filter(item => item.id !== currentItem.id)
      .sort(() => 0.5 - Math.random()) 
      .slice(0, 3);
    
    const all = [currentItem, ...wrongOptions].sort(() => 0.5 - Math.random());
    setCurrentOptions(all);
  }, [currentItem?.id]); // Only regenerate if the Question ID changes. Ignore data updates (level changes).

  const toggleFilter = (level: number) => {
      setActiveLevels(prev => {
          const next = new Set(prev);
          if (next.has(level)) next.delete(level);
          else next.add(level);
          return next.size === 0 ? prev : next;
      });
      setCurrentIndex(0);
      setAnsweredState({});
      setScore(0);
  };

  const handleAnswer = useCallback((optionIndex: number) => {
    if (selectedOption !== null || isAnimating) return; 

    setAnsweredState(prev => ({ ...prev, [currentIndex]: optionIndex }));
    const isCorrect = currentOptions[optionIndex].id === currentItem.id;

    if (isCorrect) {
      setScore(s => s + 1);
      setIsAnimating(true);
      setTimeout(() => {
        if (currentIndex < quizItems.length - 1) {
          setCurrentIndex(prev => prev + 1);
        }
        setIsAnimating(false);
      }, 1000);
    } 
  }, [currentIndex, currentItem, currentOptions, quizItems.length, selectedOption, isAnimating]);

  const handleNext = useCallback(() => {
      if (currentIndex < quizItems.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setShowGrading(false);
      }
  }, [currentIndex, quizItems.length]);

  const handlePrev = useCallback(() => {
      if (currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
          setShowGrading(false);
      }
  }, [currentIndex]);

  const handleShuffleClick = () => {
      setCurrentIndex(0);
      setAnsweredState({});
      setScore(0);
      setShowGrading(false);
      onShuffle();
  };
  
  const handleRestoreClick = () => {
      setCurrentIndex(0);
      setAnsweredState({});
      setScore(0);
      setShowGrading(false);
      onRestore();
  };

  // --- Traffic Light Logic ---
  const handleLevelClick = (e: React.MouseEvent, level: number) => {
      e.stopPropagation();
      if (currentItem) onUpdateLevel(currentItem.id, level);
  };

  const handleLightTouchStart = (e: React.TouchEvent) => {
      e.stopPropagation();
      lightStartX.current = e.touches[0].clientX;
      lastLightUpdateX.current = e.touches[0].clientX;
  };

  const handleLightTouchMove = (e: React.TouchEvent) => {
      e.stopPropagation();
      if (lastLightUpdateX.current === null || !currentItem) return;

      const currentX = e.touches[0].clientX;
      const diff = currentX - lastLightUpdateX.current;
      const THRESHOLD = 10; 

      if (Math.abs(diff) > THRESHOLD) {
          if (diff > 0) {
              // Moved Right
              if (currentItem.level < 3) {
                  onUpdateLevel(currentItem.id, currentItem.level + 1);
                  lastLightUpdateX.current = currentX; // Reset anchor
              }
          } else {
              // Moved Left
              if (currentItem.level > 0) {
                  onUpdateLevel(currentItem.id, currentItem.level - 1);
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

  // --- Word Long Press ---
  const handleWordTouchStart = () => {
      longPressTimer.current = window.setTimeout(() => {
          setShowGrading(true);
      }, 500);
  };
  
  const handleWordTouchEnd = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };


  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4') {
        handleAnswer(parseInt(e.key) - 1);
      } else if (e.code === 'ArrowRight') {
         handleNext();
      } else if (e.code === 'ArrowLeft') {
         handlePrev();
      } else if (e.code === 'Escape') {
        onExit();
      } else if (e.code === 'Space') {
        e.preventDefault();
        setShowGrading(prev => !prev);
      } else if (e.code === 'ArrowUp' && showGrading) {
        e.preventDefault();
        if (currentItem && currentItem.level < 3) onUpdateLevel(currentItem.id, currentItem.level + 1);
      } else if (e.code === 'ArrowDown' && showGrading) {
        e.preventDefault();
        if (currentItem && currentItem.level > 0) onUpdateLevel(currentItem.id, currentItem.level - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAnswer, handleNext, handlePrev, onExit, selectedOption, showGrading, currentItem, onUpdateLevel]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    if (distance > 50) handleNext();
    else if (distance < -50) handlePrev();
    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (quizItems.length === 0) {
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

  if (!currentItem) return null;

  return (
    <div 
      className="w-full max-w-2xl mx-auto flex flex-col items-center h-full pt-12 md:pt-16 px-2 md:px-4 animate-game-pop-in"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      
      <div className="w-full flex justify-between items-end border-b border-monkey-sub/20 pb-2 md:pb-4 mb-4 md:mb-8 select-none relative">
        {/* Controls */}
        <div className="absolute -top-10 md:-top-12 left-0 right-0 flex justify-between items-center">
            {/* Filters */}
            <div className="flex gap-1">
                {[0, 1, 2, 3].map(level => {
                    const isActive = activeLevels.has(level);
                    return (
                        <button 
                            key={level} 
                            onClick={() => toggleFilter(level)}
                            className={`w-7 h-7 rounded flex items-center justify-center text-xs font-bold transition-all ${
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

            {/* Actions */}
            <div className="flex gap-2">
                 <button
                    onClick={() => setShowGrading(!showGrading)}
                    className={`p-2 transition-colors ${showGrading ? 'text-monkey-text bg-monkey-sub/20 rounded' : 'text-monkey-sub hover:text-monkey-main'}`}
                    title="Toggle Grading (Space)"
                 >
                    <Sliders size={16} />
                 </button>
                 <button
                    onClick={() => setShowSource(!showSource)}
                    className={`p-2 transition-colors ${showSource ? 'text-monkey-text bg-monkey-sub/20 rounded' : 'text-monkey-sub hover:text-monkey-main'}`}
                    title="Toggle Source File"
                 >
                    <FileBadge size={16} />
                 </button>
                 <button onClick={handleShuffleClick} className="p-2 text-monkey-sub hover:text-monkey-main transition-colors" title="Shuffle"><Shuffle size={16} /></button>
                 <button onClick={handleRestoreClick} className="p-2 text-monkey-sub hover:text-monkey-main transition-colors" title="Restore Order"><RotateCcw size={16} /></button>
            </div>
        </div>

        <div>
          <span className="text-xs text-monkey-sub uppercase block mb-1">Question</span>
          <span className="text-xl font-mono text-monkey-main">{currentIndex + 1} <span className="text-monkey-sub">/ {quizItems.length}</span></span>
        </div>
        <div className="text-right">
             <span className="text-xs text-monkey-sub uppercase block mb-1">Score</span>
             <span className="text-xl font-mono text-monkey-text">{score}</span>
        </div>
      </div>

      <div className="mb-6 md:mb-10 text-center select-none flex-grow flex flex-col justify-center w-full items-center relative">
        <div 
            onTouchStart={handleWordTouchStart}
            onTouchEnd={handleWordTouchEnd}
            onMouseDown={handleWordTouchStart} // For Desktop mouse long press
            onMouseUp={handleWordTouchEnd}
            onMouseLeave={handleWordTouchEnd}
            className="cursor-pointer relative group inline-flex items-center justify-center"
        >
            <h1 className="text-3xl md:text-5xl font-bold text-monkey-text break-words select-none px-2 text-center">{currentItem.word}</h1>
            
            {/* Traffic Light Grading (Simplified) */}
            {showGrading && (
                <div 
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-4 flex flex-row gap-2 items-center justify-center cursor-ew-resize touch-none animate-fade-in z-50"
                    onTouchStart={handleLightTouchStart}
                    onTouchMove={handleLightTouchMove}
                    onTouchEnd={handleLightTouchEnd}
                >
                    {[1, 2, 3].map(l => (
                            <div 
                            key={l}
                            onClick={(e) => handleLevelClick(e, l)}
                            className={`w-3 h-3 md:w-4 md:h-4 rounded-full border border-monkey-sub/50 cursor-pointer transition-transform ${currentItem.level >= l ? (currentItem.level === 3 ? 'bg-green-500 border-green-500' : 'bg-monkey-main border-monkey-main') : 'bg-transparent'}`}
                            ></div>
                    ))}
                </div>
            )}
        </div>

        {showSource && currentItem.sourceId && (
            <p className="text-xs text-monkey-sub mt-4 bg-monkey-sub/10 px-2 py-1 rounded inline-block self-center">
                {onGetSourceName(currentItem.sourceId)}
            </p>
        )}
        <p className="text-monkey-sub italic text-sm mt-8 opacity-50">选择正确的释义</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:gap-4 w-full mb-8">
        {currentOptions.map((opt, idx) => {
          const isSelected = selectedOption === idx;
          const isCorrect = opt.id === currentItem.id;
          const showResult = selectedOption !== null;

          let btnClass = "relative p-4 md:p-6 rounded-lg text-left border-2 transition-all duration-200 group ";
          
          if (showResult) {
            if (isCorrect) {
              btnClass += "border-green-500 bg-green-500/10 text-green-400";
            } else if (isSelected && !isCorrect) {
              btnClass += "border-monkey-error bg-monkey-error/10 text-monkey-error";
            } else {
              btnClass += "border-monkey-sub/10 opacity-50";
            }
          } else {
            btnClass += "border-monkey-sub/20 hover:border-monkey-main hover:bg-[#2c2e31] cursor-pointer active:scale-[0.99]";
          }

          return (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              disabled={showResult}
              className={btnClass}
            >
              <div className="flex items-start justify-between">
                <span className="text-base md:text-lg leading-snug pr-4">{opt.definition}</span>
                {showResult && isCorrect && <CheckCircle className="text-green-500 shrink-0 ml-2" size={20} />}
                {showResult && isSelected && !isCorrect && <XCircle className="text-monkey-error shrink-0 ml-2" size={20} />}
              </div>
              <span className="absolute top-2 right-3 text-[10px] font-mono font-bold text-monkey-sub/30 select-none">
                {idx + 1}
              </span>
            </button>
          );
        })}
      </div>

      <div className="w-full flex justify-between mt-auto mb-4 z-10">
          <button 
            onClick={handlePrev} 
            disabled={currentIndex === 0}
            className="flex items-center gap-2 px-4 py-3 md:px-6 rounded text-monkey-sub hover:text-monkey-main hover:bg-monkey-sub/10 disabled:opacity-30 transition-colors select-none"
          >
              <ArrowLeft size={20} /> <span className="hidden md:inline">Prev</span>
          </button>

          {currentIndex === quizItems.length - 1 && selectedOption !== null ? (
               <button 
               onClick={onExit} 
               className="flex items-center gap-2 px-6 py-3 rounded bg-monkey-main text-monkey-bg font-bold hover:opacity-90 transition-opacity select-none"
             >
                 Finish Quiz
             </button>
          ) : (
            <button 
                onClick={handleNext}
                className="flex items-center gap-2 px-4 py-3 md:px-6 rounded text-monkey-sub hover:text-monkey-main hover:bg-monkey-sub/10 disabled:opacity-30 transition-colors select-none"
            >
                <span className="hidden md:inline">Next</span> <ArrowRight size={20} />
            </button>
          )}
      </div>

      {/* Keyboard Legend */}
      <div className="mb-4 text-[10px] text-monkey-sub/30 flex gap-4 pointer-events-none hidden md:flex">
          <span>1-4: Select</span>
          <span>Space: Grade</span>
          <span>↑/↓: Level</span>
          <span>←/→: Nav</span>
          <span>Esc: Exit</span>
      </div>
    </div>
  );
};
