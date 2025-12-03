import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { VocabularyItem } from '../types';
import { CheckCircle, XCircle } from 'lucide-react';

interface Props {
  data: VocabularyItem[];
  onExit: () => void;
}

export const QuizMode: React.FC<Props> = ({ data, onExit }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // Create a randomized subset for the quiz if data is too large, or just use all
  const quizItems = useMemo(() => data, [data]); 
  
  const currentItem = quizItems[currentIndex];

  // Generate options
  const options = useMemo(() => {
    if (!currentItem) return [];
    
    const wrongOptions = data
      .filter(item => item.id !== currentItem.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);
    
    const all = [currentItem, ...wrongOptions].sort(() => 0.5 - Math.random());
    return all;
  }, [currentItem, data]);

  const handleAnswer = useCallback((optionIndex: number) => {
    if (selectedOption !== null || isAnimating) return; // Prevent double click

    setSelectedOption(optionIndex);
    const isCorrect = options[optionIndex].id === currentItem.id;

    if (isCorrect) {
      setScore(s => s + 1);
    }

    setIsAnimating(true);

    // Auto advance
    setTimeout(() => {
      if (currentIndex < quizItems.length - 1) {
        setCurrentIndex(prev => prev + 1);
        setSelectedOption(null);
        setIsAnimating(false);
      } else {
        // End of quiz
        // Could show result screen here, for now just stay or loop?
        // Let's reset for infinite practice or show done.
        setIsAnimating(false);
      }
    }, 1200);
  }, [currentIndex, currentItem, options, quizItems.length, selectedOption, isAnimating]);

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '4') {
        handleAnswer(parseInt(e.key) - 1);
      } else if (e.code === 'Escape') {
        onExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleAnswer, onExit]);

  // Result Screen
  if (currentIndex >= quizItems.length - 1 && selectedOption !== null && !isAnimating) {
     return (
        <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
             <h2 className="text-4xl font-bold text-monkey-main mb-6">测试完成</h2>
             <p className="text-2xl text-monkey-text mb-8">最终得分: <span className="text-monkey-main">{score}</span> / {quizItems.length}</p>
             <button onClick={onExit} className="px-8 py-3 bg-monkey-main text-monkey-bg font-bold rounded hover:opacity-90 transition">返回菜单</button>
        </div>
     )
  }

  if (!currentItem) return null;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center h-full pt-10">
      
      {/* Header */}
      <div className="w-full flex justify-between items-end border-b border-monkey-sub/20 pb-4 mb-8">
        <div>
          <span className="text-xs text-monkey-sub uppercase block mb-1">Question</span>
          <span className="text-xl font-mono text-monkey-main">{currentIndex + 1} <span className="text-monkey-sub">/ {quizItems.length}</span></span>
        </div>
        <div className="text-right">
             <span className="text-xs text-monkey-sub uppercase block mb-1">Score</span>
             <span className="text-xl font-mono text-monkey-text">{score}</span>
        </div>
      </div>

      {/* Question */}
      <div className="mb-10 text-center">
        <h1 className="text-5xl font-bold text-monkey-text mb-2">{currentItem.word}</h1>
        <p className="text-monkey-sub italic text-sm">选择正确的释义</p>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        {options.map((opt, idx) => {
          const isSelected = selectedOption === idx;
          const isCorrect = opt.id === currentItem.id;
          const showResult = selectedOption !== null;

          let btnClass = "relative p-6 rounded-lg text-left border-2 transition-all duration-200 group ";
          
          if (showResult) {
            if (isCorrect) {
              btnClass += "border-green-500 bg-green-500/10 text-green-400"; // Correct answer always green
            } else if (isSelected && !isCorrect) {
              btnClass += "border-monkey-error bg-monkey-error/10 text-monkey-error"; // Wrong selection
            } else {
              btnClass += "border-monkey-sub/10 opacity-50"; // Others
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

      <div className="mt-auto pb-10 text-monkey-sub/40 text-xs font-mono">
         Use number keys [1-4] to select
      </div>
    </div>
  );
};
