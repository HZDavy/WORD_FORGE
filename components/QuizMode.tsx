
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { VocabularyItem } from '../types';
import { CheckCircle, XCircle, ArrowRight, ArrowLeft, Shuffle, RotateCcw } from 'lucide-react';

interface Props {
  data: VocabularyItem[];
  onExit: () => void;
  onShuffle: () => void;
  onRestore: () => void;
}

export const QuizMode: React.FC<Props> = ({ data, onExit, onShuffle, onRestore }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answeredState, setAnsweredState] = useState<{ [key: number]: number | null }>({}); 
  const [isAnimating, setIsAnimating] = useState(false);
  
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const quizItems = useMemo(() => data, [data]); 
  
  const currentItem = quizItems[currentIndex];
  const selectedOption = answeredState[currentIndex] ?? null;

  const options = useMemo(() => {
    if (!currentItem) return [];
    
    const wrongOptions = data
      .filter(item => item.id !== currentItem.id)
      .sort(() => 0.5 - Math.random()) 
      .slice(0, 3);
    
    const all = [currentItem, ...wrongOptions].sort(() => 0.5 - Math.random());
    return all;
  }, [currentItem, data, currentIndex]);

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

  if (!currentItem) return null;

  return (
    <div 
      className="w-full max-w-2xl mx-auto flex flex-col items-center h-full pt-10 px-4"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      
      <div className="w-full flex justify-between items-end border-b border-monkey-sub/20 pb-4 mb-8 select-none relative">
        {/* Controls */}
        <div className="absolute -top-10 right-0 flex gap-2">
             <button onClick={handleShuffleClick} className="p-2 text-monkey-sub hover:text-monkey-main transition-colors" title="Shuffle"><Shuffle size={16} /></button>
             <button onClick={handleRestoreClick} className="p-2 text-monkey-sub hover:text-monkey-main transition-colors" title="Restore Order"><RotateCcw size={16} /></button>
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

      <div className="mb-10 text-center select-none">
        <h1 className="text-5xl font-bold text-monkey-text mb-2 break-all">{currentItem.word}</h1>
        <p className="text-monkey-sub italic text-sm">选择正确的释义</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-8">
        {options.map((opt, idx) => {
          const isSelected = selectedOption === idx;
          const isCorrect = opt.id === currentItem.id;
          const showResult = selectedOption !== null;

          let btnClass = "relative p-6 rounded-lg text-left border-2 transition-all duration-200 group ";
          
          if (showResult) {
            if (isCorrect) {
              btnClass += "border-green-500 bg-green-500/10 text-green-400";
            } else if (isSelected && !isCorrect) {
              btnClass += "border-monkey-error bg-monkey-error/10 text-monkey-error";
            } else {
              btnClass += "border-monkey-sub/10 opacity-50";
            }
          } else {
            btnClass += "border-monkey-sub/20 hover:border-monkey-main hover:bg-[#2c2e31] cursor-pointer";
          }

          return (
            <button
              key={idx}
              onClick={() => handleAnswer(idx)}
              disabled={showResult}
              className={btnClass}
            >
              <div className="flex items-start justify-between">
                <span className="text-lg leading-snug">{opt.definition}</span>
                {showResult && isCorrect && <CheckCircle className="text-green-500 shrink-0 ml-2" />}
                {showResult && isSelected && !isCorrect && <XCircle className="text-monkey-error shrink-0 ml-2" />}
              </div>
              <span className={`absolute top-2 right-3 text-xs font-mono font-bold opacity-0 group-hover:opacity-100 ${showResult ? 'hidden' : ''} text-monkey-sub`}>
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
            className="flex items-center gap-2 px-6 py-3 rounded text-monkey-sub hover:text-monkey-main hover:bg-monkey-sub/10 disabled:opacity-30 transition-colors select-none"
          >
              <ArrowLeft size={20} /> Prev
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
                className="flex items-center gap-2 px-6 py-3 rounded text-monkey-sub hover:text-monkey-main hover:bg-monkey-sub/10 disabled:opacity-30 transition-colors select-none"
            >
                Next <ArrowRight size={20} />
            </button>
          )}
      </div>
    </div>
  );
};
