import React, { useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { parsePdf, parseTxt, parseDocx } from './services/pdfProcessor';
import { VocabularyItem, GameMode, GameProgress, ForgeSaveData, SourceFile } from './types';
import { FlashcardMode } from './components/FlashcardMode';
import { QuizMode } from './components/QuizMode';
import { MatchingMode } from './components/MatchingMode';
import { WordListMode } from './components/WordListMode';
import { MatrixRain } from './components/MatrixRain';
import { TimerWidget } from './components/TimerWidget';
import { FileUp, BookOpen, BrainCircuit, Gamepad2, AlertCircle, Flame, ListChecks, Save, Trash2, CheckSquare, Square, ChevronDown, ChevronRight, FileText, Pencil, Check, X, FileStack, CopyPlus, Replace, AlertTriangle } from 'lucide-react';

const App = () => {
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);
  const [vocab, setVocab] = useState<VocabularyItem[]>([]);
  const [sources, setSources] = useState<SourceFile[]>([]); // New: Track source files
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<GameProgress>({});
  
  // UI State for Source Manager
  const [isSourceManagerOpen, setIsSourceManagerOpen] = useState(false);
  const [isSourceManagerClosing, setIsSourceManagerClosing] = useState(false);
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Import Conflict Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<ForgeSaveData | null>(null);
  const [isClosingModal, setIsClosingModal] = useState(false);
  
  // Delete Confirmation State
  const [sourceToDelete, setSourceToDelete] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isClosingDeleteModal, setIsClosingDeleteModal] = useState(false);
  
  // Gesture State for Global Edge Swipe
  const touchStartX = useRef<number | null>(null);

  // Computed Active Vocabulary based on enabled sources
  const activeVocab = useMemo(() => {
    if (sources.length === 0) return vocab; // Fallback for legacy state
    const enabledSourceIds = new Set(sources.filter(s => s.enabled).map(s => s.id));
    return vocab.filter(item => !item.sourceId || enabledSourceIds.has(item.sourceId));
  }, [vocab, sources]);

  const allSourcesEnabled = useMemo(() => sources.length > 0 && sources.every(s => s.enabled), [sources]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    const files: File[] = target.files ? Array.from(target.files) : [];
    
    // Reset input value immediately so same files can be selected again if needed
    target.value = '';

    if (files.length === 0) return;

    setLoading(true);
    setError(null);

    // Special Handling for Single Restore File (.forge / .json)
    // We only support restoring state from a single file at a time.
    if (files.length === 1) {
        const file = files[0];
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.forge') || lowerName.endsWith('.json')) {
            try {
                const text = await file.text();
                const saveData = JSON.parse(text) as ForgeSaveData;
                if (saveData.vocab && Array.isArray(saveData.vocab)) {
                    // If we have existing data, prompt for Merge vs Overwrite
                    if (vocab.length > 0) {
                        setPendingSaveData(saveData);
                        setShowImportModal(true);
                        setIsClosingModal(false);
                    } else {
                        // Empty state: direct load
                        loadSaveData(saveData, false);
                    }
                } else {
                    throw new Error("Invalid save file format");
                }
            } catch (err: any) {
                console.error(err);
                setError("Failed to parse save file. The file might be corrupted.");
            }
            setLoading(false);
            return;
        }
    }

    // Batch Document Processing
    const newSources: SourceFile[] = [];
    const newVocabItems: VocabularyItem[] = [];
    const errorMessages: string[] = [];

    try {
        for (const file of files) {
            const fileName = file.name;
            const lowerName = fileName.toLowerCase();
            const fileType = file.type;
            
            // Skip .forge/.json in batch mode to avoid confusion, or handle as error
            if (lowerName.endsWith('.forge') || lowerName.endsWith('.json')) {
                continue; 
            }

            try {
                let extracted: VocabularyItem[] = [];

                if (fileType === 'application/pdf' || lowerName.endsWith('.pdf')) {
                    extracted = await parsePdf(file);
                } else if (fileType === 'text/plain' || lowerName.endsWith('.txt')) {
                    extracted = await parseTxt(file);
                } else if (
                    fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
                    lowerName.endsWith('.docx')
                ) {
                    extracted = await parseDocx(file);
                } else {
                    errorMessages.push(`${fileName}: Unsupported type`);
                    continue;
                }

                if (extracted.length < 5) {
                    errorMessages.push(`${fileName}: Too few words found`);
                    continue;
                }

                // Create new Source
                const newSourceId = generateId();
                const newSource: SourceFile = {
                    id: newSourceId,
                    name: fileName,
                    enabled: true,
                    dateAdded: Date.now(),
                    wordCount: extracted.length
                };

                // Tag new words with sourceId
                const taggedWords = extracted.map(item => ({
                    ...item,
                    sourceId: newSourceId
                }));

                newSources.push(newSource);
                newVocabItems.push(...taggedWords);

            } catch (err: any) {
                console.error(`Error parsing ${fileName}:`, err);
                errorMessages.push(`${fileName}: ${err.message || 'Parse error'}`);
            }
        }

        // Batch Update State
        if (newSources.length > 0) {
            setSources(prev => [...prev, ...newSources]);
            setVocab(prev => [...prev, ...newVocabItems]);
        }

        // Handle Errors
        if (errorMessages.length > 0) {
            // If we successfully imported some files but failed others
            if (newSources.length > 0) {
                setError(`Imported ${newSources.length} files. Failed: ${errorMessages.slice(0, 2).join(', ')}${errorMessages.length > 2 ? '...' : ''}`);
            } else {
                setError(`All imports failed: ${errorMessages.slice(0, 2).join(', ')}`);
            }
        }

    } catch (err: any) {
        console.error(err);
        setError("Unexpected error during batch upload.");
    } finally {
        setLoading(false);
    }
  };

  const loadSaveData = (saveData: ForgeSaveData, isMerge: boolean) => {
      // 1. Prepare Incoming Sources
      let incomingSources = saveData.sources || [];
      let incomingVocab = saveData.vocab;

      // Migration for legacy save files (no sources)
      if (incomingSources.length === 0 && incomingVocab.length > 0) {
          const legacySource: SourceFile = {
              id: 'legacy_import_' + Date.now(),
              name: 'Imported Data',
              enabled: true,
              dateAdded: Date.now(),
              wordCount: incomingVocab.length
          };
          incomingSources = [legacySource];
          incomingVocab = incomingVocab.map(v => ({ ...v, sourceId: legacySource.id }));
      }

      if (isMerge) {
          // MERGE LOGIC
          // 1. Merge Sources (Prevent ID collisions, although IDs should be unique)
          const existingSourceIds = new Set(sources.map(s => s.id));
          const newSources = incomingSources.filter(s => !existingSourceIds.has(s.id));
          
          // 2. Merge Vocab
          const existingVocabIds = new Set(vocab.map(v => v.id));
          const newVocab = incomingVocab.filter(v => !existingVocabIds.has(v.id));

          setSources(prev => [...prev, ...newSources]);
          setVocab(prev => [...prev, ...newVocab]);
          
          // Note: We currently DO NOT merge progress (quiz scores etc) because it's complex.
          // We keep the current session's progress.
      } else {
          // OVERWRITE LOGIC
          setVocab(incomingVocab);
          setSources(incomingSources);
          setProgress(saveData.progress || {});
      }
  };

  const handleImportChoice = (choice: 'merge' | 'overwrite') => {
      if (pendingSaveData) {
          loadSaveData(pendingSaveData, choice === 'merge');
      }
      handleCloseImportModal();
  };

  const handleCloseImportModal = () => {
      setIsClosingModal(true);
      setTimeout(() => {
          setShowImportModal(false);
          setIsClosingModal(false);
          setPendingSaveData(null);
      }, 400);
  };

  const handleExportProgress = () => {
    if (vocab.length === 0) return;
    
    const data: ForgeSaveData = {
      version: '1.1', // Bump version for source support
      timestamp: Date.now(),
      vocab,
      sources,
      progress
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `word-forge-${new Date().toISOString().split('T')[0]}.forge`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Source Management ---
  const toggleSourceManager = () => {
      if (isSourceManagerOpen) {
          setIsSourceManagerClosing(true);
          setTimeout(() => {
              setIsSourceManagerOpen(false);
              setIsSourceManagerClosing(false);
          }, 250); // Match animation duration
      } else {
          setIsSourceManagerOpen(true);
      }
  };

  const toggleSource = (id: string) => {
      setSources(prev => prev.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const toggleAllSources = () => {
      const allEnabled = sources.every(s => s.enabled);
      setSources(prev => prev.map(s => ({ ...s, enabled: !allEnabled })));
  };

  // Request Delete Logic
  const requestDeleteSource = (id: string) => {
      setSourceToDelete(id);
      setShowDeleteConfirm(true);
      setIsClosingDeleteModal(false);
  };

  const confirmDeleteSource = () => {
      if (sourceToDelete) {
          // 1. Remove from sources
          setSources(prev => prev.filter(s => s.id !== sourceToDelete));
          // 2. Remove words belonging to this source
          setVocab(prev => prev.filter(v => v.sourceId !== sourceToDelete));
          setSourceToDelete(null);
      }
      closeDeleteModal();
  };

  const closeDeleteModal = () => {
      setIsClosingDeleteModal(true);
      setTimeout(() => {
          setShowDeleteConfirm(false);
          setIsClosingDeleteModal(false);
          setSourceToDelete(null);
      }, 400);
  };

  const renameSource = (id: string, newName: string) => {
      if (!newName.trim()) return;
      setSources(prev => prev.map(s => s.id === id ? { ...s, name: newName.trim() } : s));
      setEditingSourceId(null);
  };

  const getSourceName = useCallback((id?: string | null) => {
      if (!id) return undefined;
      return sources.find(s => s.id === id)?.name;
  }, [sources]);


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
                  data={activeVocab} 
                  initialIndex={progress.flashcard?.index}
                  onExit={resetGame} 
                  onUpdateLevel={handleLevelUpdate} 
                  onShuffle={handleShuffle} 
                  onRestore={handleRestore}
                  onSaveProgress={saveFlashcardProgress}
                  onGetSourceName={getSourceName}
               />;
    }
    if (mode === GameMode.QUIZ) {
        return <QuizMode 
                  data={activeVocab} 
                  initialState={progress.quiz}
                  onExit={resetGame} 
                  onShuffle={handleShuffle} 
                  onRestore={handleRestore}
                  onSaveProgress={saveQuizProgress}
                  onGetSourceName={getSourceName}
               />;
    }
    if (mode === GameMode.MATCHING) {
        return <MatchingMode 
                  data={activeVocab} 
                  initialRound={progress.matching?.round}
                  onExit={resetGame} 
                  onShuffle={handleShuffle} 
                  onRestore={handleRestore} 
                  onSaveProgress={saveMatchingProgress}
               />;
    }
    if (mode === GameMode.WORD_LIST) return <WordListMode data={activeVocab} onExit={resetGame} onUpdateLevel={handleLevelUpdate} onResetLevels={() => handleResetLevels('', 0)} onShuffle={handleShuffle} onRestore={handleRestore} onGetSourceName={getSourceName} />;

    // MENU
    return (
      <div className="flex flex-col items-center justify-center min-h-full w-full max-w-4xl mx-auto px-4 md:px-0 overflow-y-auto custom-scrollbar z-10 relative">
        
        {vocab.length === 0 ? (
          <div className="w-full max-w-xl p-6 md:p-10 border-2 border-dashed border-monkey-sub/30 rounded-xl hover:border-monkey-main/50 transition-colors bg-[#2c2e31]/80 backdrop-blur-sm group flex-shrink-0 animate-pop-in">
            <label className="flex flex-col items-center cursor-pointer">
              <FileUp size={48} className="text-monkey-sub group-hover:text-monkey-main transition-colors mb-4 duration-300" />
              <span className="text-lg md:text-xl font-bold text-monkey-text mb-2 text-center">Upload Files / Load Progress</span>
              <span className="text-xs md:text-sm text-monkey-sub text-center px-4">Supported: PDF, DOCX, TXT, .FORGE (Batch supported)</span>
              <input type="file" multiple className="hidden" accept=".pdf,.txt,.docx,.forge,.json,application/json,application/octet-stream,text/json" onChange={handleFileUpload} />
            </label>
            {error && (
              <div className="mt-6 flex items-center gap-2 text-monkey-error bg-monkey-error/10 p-3 rounded text-sm animate-shake">
                <AlertCircle size={16} className="shrink-0" /> {error}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full flex-shrink-0 pb-10">
            {/* Stats / Workspace Header */}
            <div className="flex flex-col gap-2 mb-6 px-4 bg-[#2c2e31]/50 backdrop-blur rounded p-2 animate-fade-in-up">
              
              <div className="flex justify-between items-center border-b border-monkey-sub/10 pb-2">
                <div 
                    className="flex items-center gap-2 cursor-pointer group mr-4 select-none"
                    onClick={toggleSourceManager}
                >
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="font-mono text-sm">
                        <span className="text-monkey-main">{activeVocab.length}<span> active</span></span>
                        <span className="text-monkey-sub mx-1">/</span>
                        <span className="text-monkey-sub">{vocab.length}<span className="hidden md:inline"> total</span></span>
                    </span>
                    <ChevronRight size={14} className={`text-monkey-sub transition-transform duration-300 ${isSourceManagerOpen && !isSourceManagerClosing ? 'rotate-90' : ''}`} />
                </div>
                
                <div className="flex items-center gap-4 md:gap-6">
                  <button 
                      onClick={handleExportProgress} 
                      className="text-xs text-monkey-sub hover:text-monkey-main flex items-center gap-1 transition-colors"
                      title="Save current progress"
                  >
                      <Save size={14} />
                      <span className="hidden sm:inline">Save</span>
                  </button>

                  <div className="w-px h-4 bg-monkey-sub/20"></div>

                  <label className="text-xs text-monkey-sub hover:text-monkey-text cursor-pointer hover:underline flex items-center gap-1 transition-colors">
                      <FileUp size={14} />
                      <span className="hidden sm:inline">Add/Replace</span>
                      <input type="file" multiple className="hidden" accept=".pdf,.txt,.docx,.forge,.json,application/json,application/octet-stream,text/json" onChange={handleFileUpload} />
                  </label>
                </div>
              </div>

              {/* Source Manager Panel */}
              {(isSourceManagerOpen || isSourceManagerClosing) && (
                  <div className={`bg-[#252628] rounded border border-monkey-sub/20 origin-top overflow-hidden ${isSourceManagerClosing ? 'animate-collapse-vertical' : 'animate-expand-vertical'}`}>
                      <div className="flex items-center gap-2 mb-1 px-2 pt-2 pb-1 border-b border-monkey-sub/10">
                          <button 
                            onClick={(e) => { e.stopPropagation(); toggleAllSources(); }} 
                            className="text-monkey-sub hover:text-monkey-main transition-colors"
                            title={allSourcesEnabled ? "Deselect All" : "Select All"}
                          >
                              {allSourcesEnabled ? <CheckSquare size={16} /> : <Square size={16} />}
                          </button>
                          <span className="text-xs text-monkey-sub uppercase tracking-wider">Source Files</span>
                      </div>
                      <div className="flex flex-col gap-1 max-h-40 overflow-y-auto custom-scrollbar p-1">
                          {sources.map(source => (
                              <div key={source.id} className="flex justify-between items-center p-2 rounded hover:bg-[#323437] transition-colors group/item">
                                  {editingSourceId === source.id ? (
                                      <div className="flex items-center gap-2 flex-1 mr-2">
                                          <input 
                                              type="text" 
                                              value={editName}
                                              onChange={(e) => setEditName(e.target.value)}
                                              className="bg-[#323437] text-monkey-text px-2 py-1 rounded text-xs w-full border border-monkey-main outline-none"
                                              autoFocus
                                              onKeyDown={(e) => {
                                                  if (e.key === 'Enter') renameSource(source.id, editName);
                                                  if (e.key === 'Escape') setEditingSourceId(null);
                                              }}
                                              onClick={(e) => e.stopPropagation()}
                                          />
                                          <div className="flex items-center gap-3">
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); renameSource(source.id, editName); }}
                                                className="p-1.5 hover:bg-green-500/10 rounded transition-colors"
                                            >
                                                <Check size={16} className="text-green-500 hover:text-green-400"/>
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setEditingSourceId(null); }}
                                                className="p-1.5 hover:bg-monkey-error/10 rounded transition-colors"
                                            >
                                                <X size={16} className="text-monkey-error hover:text-red-400"/>
                                            </button>
                                          </div>
                                      </div>
                                  ) : (
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                        <button onClick={() => toggleSource(source.id)} className="text-monkey-text hover:text-monkey-main">
                                            {source.enabled ? <CheckSquare size={16} /> : <Square size={16} />}
                                        </button>
                                        <FileText size={14} className="text-monkey-sub shrink-0" />
                                        <span className={`truncate ${!source.enabled && 'text-monkey-sub line-through opacity-50'}`}>{source.name}</span>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setEditingSourceId(source.id); setEditName(source.name); }}
                                            className="opacity-0 group-hover/item:opacity-100 text-monkey-sub hover:text-monkey-text transition-opacity p-1"
                                            title="Rename"
                                        >
                                            <Pencil size={12} />
                                        </button>
                                        <span className="text-xs text-monkey-sub bg-monkey-sub/10 px-1 rounded ml-auto">{source.wordCount}</span>
                                    </div>
                                  )}
                                  
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); requestDeleteSource(source.id); }} 
                                    className="p-1 text-monkey-sub hover:text-monkey-error transition-colors ml-2"
                                    title="Remove File"
                                  >
                                      <Trash2 size={14} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {error && (
                <div className="flex items-center gap-2 text-monkey-error bg-monkey-error/10 p-2 rounded text-xs animate-shake mt-2">
                  <AlertCircle size={14} className="shrink-0" /> {error}
                </div>
              )}
            </div>
            
            {/* Game Modes */}
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
  const isMenu = mode === GameMode.MENU;
  const navClasses = `
    flex justify-between items-center z-50 transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
    max-w-6xl mx-auto flex-shrink-0
    ${isMenu ? 'w-[95%] mt-2 mb-6 px-6 py-3 rounded-2xl bg-[#2c2e31]/80 backdrop-blur-md border border-monkey-sub/20 shadow-xl' : 'w-full mt-2 mb-2 px-6 py-2 rounded-none bg-transparent border border-transparent shadow-none'}
  `;

  return (
    <div 
      className="fixed inset-0 w-full h-full bg-monkey-bg text-monkey-text font-mono selection:bg-monkey-main selection:text-monkey-bg flex flex-col overflow-hidden"
      onTouchStart={handleGlobalTouchStart}
      onTouchEnd={handleGlobalTouchEnd}
    >
      {/* Background Effect - Rendered at root to ensure full coverage */}
      {mode === GameMode.MENU && <MatrixRain />}

      {/* Dynamic Top Bar */}
      <nav className={navClasses}>
        <div className="flex items-center gap-3 cursor-pointer group" onClick={handleLogoClick}>
            <Flame className={`text-monkey-main transition-transform duration-300 ${rebootAnim ? 'animate-spin' : 'group-hover:scale-110'}`} size={24} />
            <span className={`font-bold text-xl tracking-tight text-monkey-text group-hover:text-white transition-all ${rebootAnim ? 'opacity-50' : 'opacity-100'}`}>词炼</span>
        </div>
        
        {/* Timer Widget Integration */}
        <TimerWidget />
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto relative flex flex-col px-4 md:px-6">
        {renderContent()}
      </main>

      {mode === GameMode.MENU && (
        <footer className="mt-auto md:mt-4 text-center text-xs text-monkey-sub/30 pb-4 pt-2 md:pt-0 flex-shrink-0 z-10">
            &copy; 2026 Word Forge. Workspace Edition.
        </footer>
      )}

      {/* Forge Import Conflict Modal */}
      {showImportModal && createPortal(
        <div 
            className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isClosingModal ? 'opacity-0' : 'opacity-100'}`}
            onClick={(e) => { e.stopPropagation(); handleCloseImportModal(); }}
        >
            <div 
                className={`bg-[#2c2e31] border border-monkey-sub/30 p-6 rounded-xl max-w-sm w-full mx-4 ${isClosingModal ? 'animate-spring-out' : 'animate-spring-in'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 text-monkey-main mb-4">
                    <FileStack size={24} />
                    <h3 className="text-xl font-bold">Import Conflict</h3>
                </div>
                <p className="text-monkey-sub mb-6 text-sm">
                    You have existing words in your workspace. How would you like to handle the incoming Forge file?
                </p>
                <div className="flex flex-col gap-3">
                    <button 
                        onClick={() => handleImportChoice('merge')}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded bg-[#323437] border border-monkey-sub/20 text-monkey-text hover:border-monkey-main hover:text-monkey-main transition-colors group"
                    >
                        <CopyPlus size={18} className="text-monkey-sub group-hover:text-monkey-main" />
                        <span className="font-bold">Merge with current</span>
                    </button>
                    <button 
                        onClick={() => handleImportChoice('overwrite')}
                        className="flex items-center justify-center gap-2 px-4 py-3 rounded bg-monkey-error/10 border border-monkey-error/30 text-monkey-error hover:bg-monkey-error hover:text-white transition-colors group"
                    >
                        <Replace size={18} />
                        <span className="font-bold">Overwrite everything</span>
                    </button>
                    <button 
                        onClick={handleCloseImportModal}
                        className="text-monkey-sub hover:text-monkey-text text-sm mt-2 underline decoration-monkey-sub/30"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div 
            className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isClosingDeleteModal ? 'opacity-0' : 'opacity-100'}`}
            onClick={(e) => { e.stopPropagation(); closeDeleteModal(); }}
        >
            <div 
                className={`bg-[#2c2e31] border border-monkey-sub/30 p-6 rounded-xl max-w-sm w-full mx-4 ${isClosingDeleteModal ? 'animate-spring-out' : 'animate-spring-in'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3 text-monkey-error mb-4">
                    <AlertTriangle size={24} />
                    <h3 className="text-xl font-bold">Delete File?</h3>
                </div>
                <p className="text-monkey-sub mb-6 text-sm">
                    Are you sure you want to remove <span className="text-monkey-text font-bold">"{getSourceName(sourceToDelete)}"</span>? All associated words and progress will be lost.
                </p>
                <div className="flex justify-end gap-3">
                    <button 
                        onClick={closeDeleteModal}
                        className="px-4 py-2 rounded text-monkey-sub hover:text-monkey-text hover:bg-monkey-sub/10 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={confirmDeleteSource}
                        className="px-4 py-2 rounded bg-monkey-error text-white hover:bg-red-600 transition-colors font-bold"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>,
        document.body
      )}
    </div>
  );
};

const MenuCard = ({ title, desc, icon, onClick, delay }: { title: string, desc: string, icon: React.ReactNode, onClick: () => void, delay: number }) => (
  <button 
    onClick={onClick}
    style={{ animationDelay: `${delay}ms` }}
    className="flex flex-row md:flex-col items-center md:text-center p-4 md:p-6 rounded-xl bg-[#2c2e31]/80 backdrop-blur-md border border-monkey-sub/20 hover:border-monkey-main hover:-translate-y-1 transition-all duration-300 group text-left md:justify-center gap-4 md:gap-0 animate-pop-in opacity-0 fill-mode-forwards"
  >
    <div className="md:mb-4 text-monkey-sub group-hover:text-monkey-main transition-colors duration-300 transform group-hover:scale-110 shrink-0">{icon}</div>
    <div>
        <h3 className="text-lg font-bold mb-1 text-monkey-text group-hover:text-white">{title}</h3>
        <p className="text-xs text-monkey-sub">{desc}</p>
    </div>
  </button>
);

export default App;