import React, { useState, useCallback } from 'react';
import { parsePdf, parseTxt, parseDocx } from './services/pdfProcessor';
import { VocabularyItem, GameMode } from './types';
import { FlashcardMode } from './components/FlashcardMode';
import { QuizMode } from './components/QuizMode';
import { MatchingMode } from './components/MatchingMode';
import { WordListMode } from './components/WordListMode';
import { FileUp, BookOpen, BrainCircuit, Gamepad2, AlertCircle, Flame, ListChecks } from 'lucide-react';

const App = () => {
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);
  const [vocab, setVocab] = useState<VocabularyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      }
    } catch (err) {
      console.error(err);
      setError("Failed to parse file.");
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  const resetGame = () => {
    setMode(GameMode.MENU);
  };

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
        <div className="flex flex-col items-center justify-center h-full animate-pulse">
           <div className="relative">
             <div className="w-16 h-16 border-4 border-monkey-sub/30 rounded-full"></div>
             <div className="absolute top-0 left-0 w-16 h-16 border-4 border-monkey-main border-t-transparent rounded-full animate-spin"></div>
             <Flame className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-monkey-main" size={24} />
           </div>
           <p className="text-monkey-main font-mono mt-4 tracking-widest">FORGING...</p>
        </div>
      );
    }

    if (mode === GameMode.FLASHCARD) return <FlashcardMode data={vocab} onExit={resetGame} onUpdateLevel={handleLevelUpdate} onShuffle={handleShuffle} onRestore={handleRestore} />;
    if (mode === GameMode.QUIZ) return <QuizMode data={vocab} onExit={resetGame} onShuffle={handleShuffle} onRestore={handleRestore} />;
    if (mode === GameMode.MATCHING) return <MatchingMode data={vocab} onExit={resetGame} onShuffle={handleShuffle} onRestore={handleRestore} />;
    if (mode === GameMode.WORD_LIST) return <WordListMode data={vocab} onExit={resetGame} onUpdateLevel={handleLevelUpdate} onResetLevels={() => handleResetLevels('', 0)} onShuffle={handleShuffle} onRestore={handleRestore} />;

    // MENU
    return (
      <div className="flex flex-col items-center w-full max-w-4xl mx-auto animate-fade-in-up px-4 md:px-0 h-full overflow-y-auto custom-scrollbar">
        {/* Stats / Welcome */}
        <div className="text-center mb-8 md:mb-12 relative mt-4 md:mt-0 flex-shrink-0">
           <div className="absolute -top-6 md:-top-10 left-1/2 -translate-x-1/2 opacity-10 pointer-events-none">
             <Flame className="w-24 h-24 md:w-32 md:h-32" />
           </div>
           <h1 className="text-5xl md:text-7xl font-bold text-monkey-text mb-2 font-mono tracking-tighter flex items-center justify-center gap-2 md:gap-4">
             词炼 <span className="text-monkey-main text-lg md:text-2xl align-top bg-monkey-sub/20 px-2 rounded">V7</span>
           </h1>
           <p className="text-monkey-sub font-mono tracking-widest text-xs md:text-sm uppercase">The Ultimate Word Forge</p>
        </div>

        {vocab.length === 0 ? (
          <div className="w-full max-w-xl p-6 md:p-10 border-2 border-dashed border-monkey-sub/30 rounded-xl hover:border-monkey-main/50 transition-colors bg-[#2c2e31] group flex-shrink-0">
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
            <div className="flex justify-between items-center mb-6 px-4 border-b border-monkey-sub/10 pb-2">
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
                onClick={() => setMode(GameMode.FLASHCARD)} 
              />
              <MenuCard 
                icon={<BrainCircuit size={24} />}
                title="Quiz" 
                desc="4-choice test" 
                onClick={() => setMode(GameMode.QUIZ)} 
              />
              <MenuCard 
                icon={<Gamepad2 size={24} />}
                title="Matching" 
                desc="Connect pairs" 
                onClick={() => setMode(GameMode.MATCHING)} 
              />
              <MenuCard 
                icon={<ListChecks size={24} />}
                title="Word List" 
                desc="View & Mark" 
                onClick={() => setMode(GameMode.WORD_LIST)} 
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-monkey-bg text-monkey-text p-4 md:p-6 font-mono selection:bg-monkey-main selection:text-monkey-bg flex flex-col overflow-hidden">
      {/* Top Bar */}
      <nav className="w-full max-w-6xl mx-auto flex justify-between items-center mb-4 md:mb-6 border-b border-monkey-sub/20 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={resetGame}>
            <Flame className="text-monkey-main group-hover:scale-110 transition-transform duration-300" size={24} />
            <span className="font-bold text-xl tracking-tight text-monkey-text group-hover:text-white transition-colors">词炼</span>
        </div>
        <div className="flex gap-4 text-xs text-monkey-sub font-bold">
            <span className="bg-monkey-sub/10 px-2 py-1 rounded border border-monkey-sub/20">
              <span className="hidden sm:inline">[esc] menu</span>
              <span className="sm:hidden">menu</span>
            </span>
        </div>
      </nav>

      {/* Main Content Area using Flexbox for proper internal scrolling */}
      <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto relative flex flex-col">
        {renderContent()}
      </main>

      <footer className="mt-auto md:mt-4 text-center text-xs text-monkey-sub/30 pb-2 pt-2 md:pt-0 flex-shrink-0">
        &copy; 2026 Word Forge. Performance Edition.
      </footer>
    </div>
  );
};

const MenuCard = ({ title, desc, icon, onClick }: { title: string, desc: string, icon: React.ReactNode, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="flex flex-row md:flex-col items-center md:text-center p-4 md:p-6 rounded-xl bg-[#2c2e31] border border-monkey-sub/20 hover:border-monkey-main hover:-translate-y-1 transition-all duration-300 group shadow-lg hover:shadow-monkey-main/10 text-left md:justify-center gap-4 md:gap-0"
  >
    <div className="md:mb-4 text-monkey-sub group-hover:text-monkey-main transition-colors duration-300 transform group-hover:scale-110 shrink-0">{icon}</div>
    <div>
        <h3 className="text-lg font-bold mb-1 text-monkey-text group-hover:text-white">{title}</h3>
        <p className="text-xs text-monkey-sub">{desc}</p>
    </div>
  </button>
);

export default App;