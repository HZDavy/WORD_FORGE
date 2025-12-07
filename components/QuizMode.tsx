
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { VocabularyItem } from '../types';
import { CheckCircle, XCircle, ArrowRight, ArrowLeft, Shuffle, RotateCcw, FileBadge } from 'lucide-react';

interface Props {
  data: VocabularyItem[];
  initialState?: { currentIndex: number; score: number; answeredState: Record<number, number | null> };
  onExit: () => void;
  onShuffle: () => void;
  onRestore: () => void;
  onSaveProgress: (state: { currentIndex: number; score: number; answeredState: Record<number, number | null> }) => void;
  onGetSourceName: (id: string) => string | undefined;
}

export const QuizMode: React.FC<Props> = ({ data, initialState, onExit, onShuffle, onRestore, onSaveProgress, onGetSourceName }) => {
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
  
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

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

  const options = useMemo(() => {
    if (!currentItem) return [];
    
    // Pick wrong options from the FULL dataset (data), not just filtered set, to increase difficulty/variety
    const wrongOptions = data
      .filter(item => item.id !== currentItem.id)
      .sort(() => 0.5 - Math.random()) 
      .slice(0, 3);
    
    const all = [currentItem, ...wrongOptions].sort(() => 0.5 - Math.random());
    return all;
  }, [currentItem, data]);

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
    const isCorrect = options[optionIndex].id === currentItem.id;

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
  }, [currentIndex, currentItem, options, quizItems.length, selectedOption, isAnimating]);

  const handleNext = useCallback(() => {
      if (currentIndex < quizItems.length - 1) {
          setCurrentIndex(prev => prev + 1);
      }
  }, [currentIndex, quizItems.length]);

  const handlePrev = useCallback(() => {
      if (currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
      }
  }, [currentIndex]);

  const handleShuffleClick = () => {
      setCurrentIndex(0);
      setAnsweredState({});
      setScore(0);
      onShuffle();
  };
  
  const handleRestoreClick = () => {
      setCurrentIndex(0);
      setAnsweredState({});
      setScore(0);
      onRestore();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4') {
        handleAnswer(parseInt(e.key) - 1);
      } else if (e.code === 'ArrowRight') {
         if (selectedOption !== null) handleNext();
      } else if (e.code === 'ArrowLeft') {
         handlePrev();
      } else if (e.code === 'Escape') {
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAnswer, handleNext, handlePrev, onExit, selectedOption]);

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
      className="w-full max-w-2xl mx-auto flex flex-col items-center h-full pt-4 md:pt-10 px-2 md:px-4 animate-game-pop-in"
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

            {/* Actions */}
            <div className="flex gap-2">
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

      <div className="mb-6 md:mb-10 text-center select-none flex-grow flex flex-col justify-center">
        <h1 className="text-3xl md:text-5xl font-bold text-monkey-text mb-2 break-words">{currentItem.word}</h1>
        {showSource && currentItem.sourceId && (
            <p className="text-xs text-monkey-sub mt-2 bg-monkey-sub/10 px-2 py-1 rounded inline-block self-center">
                {onGetSourceName(currentItem.sourceId)}
            </p>
        )}
        <p className="text-monkey-sub italic text-sm mt-4">选择正确的释义</p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:gap-4 w-full mb-8">
        {options.map((opt, idx) => {
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
              <span className={`absolute top-2 right-3 text-xs font-mono font-bold opacity-0 group-hover:opacity-100 ${showResult ? 'hidden' : ''} text-monkey-sub hidden md:block`}>
                {idx + 1}
              </span>
            </button>
          );
        })}
      </div>

      <div className="w-full flex justify-between mt-auto pb-6 z-10">
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
    </div>
  );
};
