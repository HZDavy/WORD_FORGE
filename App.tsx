
import React, { useState, useCallback } from 'react';
import { parsePdf } from './services/pdfProcessor';
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
      const extracted = await parsePdf(file);
      if (extracted.length < 5) {
        setError("Extract failed: Found fewer than 5 words. Please check PDF format.");
        setVocab([]);
      } else {
        setVocab(extracted);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to parse PDF file.");
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

  const handleResetLevels = useCallback(() => {
    if (window.confirm("Are you sure you want to extinguish all lights (reset levels to 0)?")) {
        setVocab(prev => prev.map(item => ({ ...item, level: 0 })));
    }
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
        <div className="flex flex-col items-center justify-center h-64 animate-pulse">
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
    if (mode === GameMode.WORD_LIST) return <WordListMode data={vocab} onExit={resetGame} onUpdateLevel={handleLevelUpdate} onResetLevels={handleResetLevels} onShuffle={handleShuffle} onRestore={handleRestore} />;

    // MENU
    return (
      <div className="flex flex-col items-center w-full max-w-4xl mx-auto animate-fade-in-up">
        {/* Stats / Welcome */}
        <div className="text-center mb-12 relative">
           <div className="absolute -top-10 left-1/2 -translate-x-1/2 opacity-10 pointer-events-none">
             <Flame size={120} />
           </div>
           <h1 className="text-7xl font-bold text-monkey-text mb-2 font-mono tracking-tighter flex items-center justify-center gap-4">
             词炼 <span className="text-monkey-main text-2xl align-top bg-monkey-sub/20 px-2 rounded">V7</span>
           </h1>
           <p className="text-monkey-sub font-mono tracking-widest text-sm uppercase">The Ultimate Word Forge</p>
        </div>

        {vocab.length === 0 ? (
          <div className="w-full max-w-xl p-10 border-2 border-dashed border-monkey-sub/30 rounded-xl hover:border-monkey-main/50 transition-colors bg-[#2c2e31] group">
            <label className="flex flex-col items-center cursor-pointer">
              <FileUp size={48} className="text-monkey-sub group-hover:text-monkey-main transition-colors mb-4 duration-300" />
              <span className="text-xl font-bold text-monkey-text mb-2">Upload PDF</span>
              <span className="text-sm text-monkey-sub text-center">Supported: English Vocabulary Lists with Chinese</span>
              <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} />
            </label>
            {error && (
              <div className="mt-6 flex items-center gap-2 text-monkey-error bg-monkey-error/10 p-3 rounded text-sm animate-shake">
                <AlertCircle size={16} /> {error}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full">
            <div className="flex justify-between items-center mb-6 px-4 border-b border-monkey-sub/10 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <span className="text-monkey-main font-mono text-sm">Loaded {vocab.length} words</span>
              </div>
              <label className="text-xs text-monkey-sub hover:text-monkey-text cursor-pointer hover:underline flex items-center gap-1 transition-colors">
                <FileUp size={12} />
                Replace File
                <input type="file" className="hidden" accept="application/pdf" onChange={handleFileUpload} />
              </label>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <MenuCard 
                icon={<BookOpen size={28} />}
                title="Flashcards" 
                desc="Flip-card study" 
                onClick={() => setMode(GameMode.FLASHCARD)} 
              />
              <MenuCard 
                icon={<BrainCircuit size={28} />}
                title="Quiz" 
                desc="4-choice test" 
                onClick={() => setMode(GameMode.QUIZ)} 
              />
              <MenuCard 
                icon={<Gamepad2 size={28} />}
                title="Matching" 
                desc="Connect pairs" 
                onClick={() => setMode(GameMode.MATCHING)} 
              />
              <MenuCard 
                icon={<ListChecks size={28} />}
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
    <div className="min-h-screen bg-monkey-bg text-monkey-text p-6 font-mono selection:bg-monkey-main selection:text-monkey-bg flex flex-col overflow-hidden">
      {/* Top Bar */}
      <nav className="w-full max-w-6xl mx-auto flex justify-between items-center mb-6 border-b border-monkey-sub/20 pb-4">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={resetGame}>
            <Flame className="text-monkey-main group-hover:scale-110 transition-transform duration-300" size={24} />
            <span className="font-bold text-xl tracking-tight text-monkey-text group-hover:text-white transition-colors">词炼</span>
        </div>
        <div className="flex gap-4 text-xs text-monkey-sub font-bold">
            <span className="bg-monkey-sub/10 px-2 py-1 rounded border border-monkey-sub/20">[esc] menu</span>
        </div>
      </nav>

      <main className="flex-grow flex flex-col relative w-full max-w-6xl mx-auto h-[calc(100vh-160px)]">
        {renderContent()}
      </main>

      <footer className="mt-4 text-center text-xs text-monkey-sub/30 pb-2">
        &copy; 2024 Word Forge. Performance Edition.
      </footer>
    </div>
  );
};

const MenuCard = ({ title, desc, icon, onClick }: { title: string, desc: string, icon: React.ReactNode, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="flex flex-col items-center text-center p-6 rounded-xl bg-[#2c2e31] border border-monkey-sub/20 hover:border-monkey-main hover:-translate-y-1 transition-all duration-300 group shadow-lg hover:shadow-monkey-main/10"
  >
    <div className="mb-4 text-monkey-sub group-hover:text-monkey-main transition-colors duration-300 transform group-hover:scale-110">{icon}</div>
    <h3 className="text-lg font-bold mb-1 text-monkey-text group-hover:text-white">{title}</h3>
    <p className="text-xs text-monkey-sub">{desc}</p>
  </button>
);

export default App;
