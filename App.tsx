import React, { useState, useCallback, useRef } from 'react';
import { parsePdf, parseTxt, parseDocx } from './services/pdfProcessor';
import { VocabularyItem, GameMode, GameProgress } from './types';
import { FlashcardMode } from './components/FlashcardMode';
import { QuizMode } from './components/QuizMode';
import { MatchingMode } from './components/MatchingMode';
import { WordListMode } from './components/WordListMode';
import { MatrixRain } from './components/MatrixRain';
import { TimerWidget } from './components/TimerWidget';
import { FileUp, BookOpen, BrainCircuit, Gamepad2, AlertCircle, Flame, ListChecks } from 'lucide-react';

const App = () => {
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);
  const [vocab, setVocab] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<GameProgress>({});
  
  // Gesture State for Global Edge Swipe
  const touchStartX = useRef<number | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      let extracted: VocabularyItem[] = [];
      
      const fileType = file.type;
      const fileName = file.name.toLowerCase();

      if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        extracted = await parsePdf(file);
      } else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
        extracted = await parseTxt(file);
      } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
        fileName.endsWith('.docx')
      ) {
        extracted = await parseDocx(file);
      } else {
        throw new Error("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
      }

      if (extracted.length < 5) {
        setError("Extract failed: Found fewer than 5 words. Please check file format.");
        setVocab([]);
      } else {
        setVocab(extracted);
        // Reset progress on new file
        setProgress({});
      }
    } catch (err) {
      console.error(err);
      setError("Failed to parse file.");
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const resetGame = useCallback(() => {
    setMode(GameMode.MENU);
  }, []);

  // -- Persistence Handlers --
  const saveFlashcardProgress = useCallback((index: number) => {
    setProgress(prev => ({ ...prev, flashcard: { index } }));
  }, []);

  const saveQuizProgress = useCallback((state: { currentIndex: number; score: number; answeredState: Record<number, number | null> }) => {
    setProgress(prev => ({ ...prev, quiz: state }));
  }, []);

  const saveMatchingProgress = useCallback((round: number) => {
    setProgress(prev => ({ ...prev, matching: { round } }));
  }, []);


  const handleLevelUpdate = useCallback((id: string, newLevel: number) => {
    setVocab(prev => prev.map(item => 
        item.id === id ? { ...item, level: Math.max(0, Math.min(3, newLevel)) } : item
    ));
  }, []);

  const handleResetLevels = useCallback((id: string, newLevel: number) => {
    setVocab(prev => prev.map(item => ({ ...item, level: 0 })));
  }, []);

  const handleShuffle = useCallback(() => {
    setVocab(prev => {
        const shuffled = [...prev];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    });
  }, []);

  const handleRestore = useCallback(() => {
    setVocab(prev => [...prev].sort((a, b) => a.originalIndex - b.originalIndex));
  }, []);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full animate-pulse z-10">
           <div className="relative">
             <div className="w-16 h-16 border-4 border-monkey-sub/30 rounded-full"></div>
             <div className="absolute top-0 left-0 w-16 h-16 border-4 border-monkey-main border-t-transparent rounded-full animate-spin"></div>
             <Flame className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-monkey-main" size={24} />
           </div>
           <p className="text-monkey-main font-mono mt-4 tracking-widest">FORGING...</p>
        </div>
      );
    }

    if (mode === GameMode.FLASHCARD) {
        return <FlashcardMode 
                  data={vocab} 
                  initialIndex={progress.flashcard?.index}
                  onExit={resetGame} 
                  onUpdateLevel={handleLevelUpdate} 
                  onShuffle={handleShuffle} 
                  onRestore={handleRestore}
                  onSaveProgress={saveFlashcardProgress}
               />;
    }
    if (mode === GameMode.QUIZ) {
        return <QuizMode 
                  data={vocab} 
                  initialState={progress.quiz}
                  onExit={resetGame} 
                  onShuffle={handleShuffle} 
                  onRestore={handleRestore}
                  onSaveProgress={saveQuizProgress}
               />;
    }
    if (mode === GameMode.MATCHING) {
        return <MatchingMode 
                  data={vocab} 
                  initialRound={progress.matching?.round}
                  onExit={resetGame} 
                  onShuffle={handleShuffle} 
                  onRestore={handleRestore} 
                  onSaveProgress={saveMatchingProgress}
               />;
    }
    if (mode === GameMode.WORD_LIST) return <WordListMode data={vocab} onExit={resetGame} onUpdateLevel={handleLevelUpdate} onResetLevels={() => handleResetLevels('', 0)} onShuffle={handleShuffle} onRestore={handleRestore} />;

    // MENU
    return (
      <div className="flex flex-col items-center justify-center min-h-full w-full max-w-4xl mx-auto px-4 md:px-0 overflow-y-auto custom-scrollbar z-10 relative">
        <MatrixRain />
        
        {vocab.length === 0 ? (
          <div className="w-full max-w-xl p-6 md:p-10 border-2 border-dashed border-monkey-sub/30 rounded-xl hover:border-monkey-main/50 transition-colors bg-[#2c2e31]/80 backdrop-blur-sm group flex-shrink-0 animate-pop-in">
            <label className="flex flex-col items-center cursor-pointer">
              <FileUp size={48} className="text-monkey-sub group-hover:text-monkey-main transition-colors mb-4 duration-300" />
              <span className="text-lg md:text-xl font-bold text-monkey-text mb-2 text-center">Upload File</span>
              <span className="text-xs md:text-sm text-monkey-sub text-center px-4">Supported: PDF, DOCX, TXT</span>
              <input type="file" className="hidden" accept=".pdf,.txt,.docx" onChange={handleFileUpload} />
            </label>
            {error && (
              <div className="mt-6 flex items-center gap-2 text-monkey-error bg-monkey-error/10 p-3 rounded text-sm animate-shake">
                <AlertCircle size={16} className="shrink-0" /> {error}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full flex-shrink-0 pb-10">
            <div className="flex justify-between items-center mb-6 px-4 border-b border-monkey-sub/10 pb-2 bg-[#2c2e31]/50 backdrop-blur rounded p-2 animate-fade-in-up">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-monkey-main font-mono text-sm">Loaded {vocab.length} words</span>
              </div>
              <label className="text-xs text-monkey-sub hover:text-monkey-text cursor-pointer hover:underline flex items-center gap-1 transition-colors">
                <FileUp size={12} />
                <span className="hidden sm:inline">Replace File</span>
                <span className="sm:hidden">Replace</span>
                <input type="file" className="hidden" accept=".pdf,.txt,.docx" onChange={handleFileUpload} />
              </label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <MenuCard 
                icon={<BookOpen size={24} />}
                title="Flashcards" 
                desc="Flip-card study" 
                delay={100}
                onClick={() => setMode(GameMode.FLASHCARD)} 
              />
              <MenuCard 
                icon={<BrainCircuit size={24} />}
                title="Quiz" 
                desc="4-choice test" 
                delay={200}
                onClick={() => setMode(GameMode.QUIZ)} 
              />
              <MenuCard 
                icon={<Gamepad2 size={24} />}
                title="Matching" 
                desc="Connect pairs" 
                delay={300}
                onClick={() => setMode(GameMode.MATCHING)} 
              />
              <MenuCard 
                icon={<ListChecks size={24} />}
                title="Word List" 
                desc="View & Mark" 
                delay={400}
                onClick={() => setMode(GameMode.WORD_LIST)} 
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Global Touch Handlers for Edge Swipe Back
  const handleGlobalTouchStart = (e: React.TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
  };

  const handleGlobalTouchEnd = (e: React.TouchEvent) => {
      if (touchStartX.current === null) return;
      
      const touchEndX = e.changedTouches[0].clientX;
      const deltaX = touchEndX - touchStartX.current;
      
      // Left edge swipe logic
      // 1. Start must be within left 30px
      // 2. Drag must be > 100px to right
      // 3. Must not be in MENU mode
      if (mode !== GameMode.MENU && touchStartX.current < 40 && deltaX > 100) {
          resetGame();
      }
      touchStartX.current = null;
  };

  const [rebootAnim, setRebootAnim] = useState(false);
  const handleLogoClick = () => {
    setRebootAnim(true);
    setTimeout(() => setRebootAnim(false), 500);
    resetGame();
  }

  // Dynamic Navbar Classes
  const navClasses = mode === GameMode.MENU 
    ? "w-[95%] max-w-6xl mx-auto flex justify-between items-center mt-2 mb-6 rounded-2xl bg-[#2c2e31]/80 backdrop-blur-md border border-monkey-sub/20 shadow-xl px-6 py-3 flex-shrink-0 z-50 transition-all duration-300"
    : "w-full max-w-6xl mx-auto flex justify-between items-center mt-2 mb-2 px-6 py-2 flex-shrink-0 z-50 bg-transparent transition-all duration-300";

  return (
    <div 
      className="fixed inset-0 w-full h-full bg-monkey-bg text-monkey-text font-mono selection:bg-monkey-main selection:text-monkey-bg flex flex-col overflow-hidden"
      onTouchStart={handleGlobalTouchStart}
      onTouchEnd={handleGlobalTouchEnd}
    >
      {/* Dynamic Top Bar */}
      <nav className={navClasses}>
        <div className="flex items-center gap-3 cursor-pointer group" onClick={handleLogoClick}>
            <Flame className={`text-monkey-main transition-transform duration-300 ${rebootAnim ? 'animate-spin' : 'group-hover:scale-110'}`} size={24} />
            <span className={`font-bold text-xl tracking-tight text-monkey-text group-hover:text-white transition-all ${rebootAnim ? 'opacity-50' : 'opacity-100'}`}>词炼</span>
        </div>
        
        {/* Timer Widget Integration */}
        <TimerWidget />
      </nav>

      {/* Main Content Area using Flexbox for proper internal scrolling */}
      <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto relative flex flex-col px-4 md:px-6">
        {renderContent()}
      </main>

      {mode === GameMode.MENU && (
        <footer className="mt-auto md:mt-4 text-center text-xs text-monkey-sub/30 pb-4 pt-2 md:pt-0 flex-shrink-0 z-10">
            &copy; 2026 Word Forge. Performance Edition.
        </footer>
      )}
    </div>
  );
};

const MenuCard = ({ title, desc, icon, onClick, delay }: { title: string, desc: string, icon: React.ReactNode, onClick: () => void, delay: number }) => (
  <button 
    onClick={onClick}
    style={{ animationDelay: `${delay}ms` }}
    className="flex flex-row md:flex-col items-center md:text-center p-4 md:p-6 rounded-xl bg-[#2c2e31]/80 backdrop-blur-md border border-monkey-sub/20 hover:border-monkey-main hover:-translate-y-1 transition-all duration-300 group shadow-lg hover:shadow-monkey-main/10 text-left md:justify-center gap-4 md:gap-0 animate-pop-in opacity-0 fill-mode-forwards"
  >
    <div className="md:mb-4 text-monkey-sub group-hover:text-monkey-main transition-colors duration-300 transform group-hover:scale-110 shrink-0">{icon}</div>
    <div>
        <h3 className="text-lg font-bold mb-1 text-monkey-text group-hover:text-white">{title}</h3>
        <p className="text-xs text-monkey-sub">{desc}</p>
    </div>
  </button>
);

export default App;