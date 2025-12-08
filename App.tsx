import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { parsePdf, parseTxt, parseDocx } from './services/pdfProcessor';
import { VocabularyItem, GameMode, GameProgress, ForgeSaveData, SourceFile, Bubble } from './types';
import { FlashcardMode } from './components/FlashcardMode';
import { QuizMode } from './components/QuizMode';
import { MatchingMode } from './components/MatchingMode';
import { WordListMode } from './components/WordListMode';
import { MatrixRain } from './components/MatrixRain';
import { TimerWidget } from './components/TimerWidget';
import { FileUp, BookOpen, BrainCircuit, Gamepad2, AlertCircle, Flame, ListChecks, Save, Trash2, CheckSquare, Square, ChevronDown, ChevronUp, ChevronRight, FileText, Pencil, Check, X, FileStack, CopyPlus, Replace, AlertTriangle, Search, Eraser, ArrowDownUp, MoreHorizontal, Target } from 'lucide-react';

const App = () => {
  const [mode, setMode] = useState<GameMode>(GameMode.MENU);
  const [vocab, setVocab] = useState<VocabularyItem[]>([]);
  const [sources, setSources] = useState<SourceFile[]>([]); // New: Track source files
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<GameProgress>({});
  
  // Data Versioning to force re-mount of components on load
  const [gameSessionId, setGameSessionId] = useState(0);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchCursor, setSearchCursor] = useState(0);
  const [activeSearchMenuId, setActiveSearchMenuId] = useState<string | null>(null);

  // Jump Navigation State
  const [jumpToId, setJumpToId] = useState<string | null>(null);

  // Keyboard Interaction State
  const [usingKeyboard, setUsingKeyboard] = useState(false);
  const [menuCursor, setMenuCursor] = useState(0);
  
  // Refs for programmatic clicks
  const headerFileInputRef = useRef<HTMLInputElement>(null);
  const emptyStateFileInputRef = useRef<HTMLInputElement>(null);

  // UI State for Source Manager
  const [isSourceManagerOpen, setIsSourceManagerOpen] = useState(false);
  const [isSourceManagerClosing, setIsSourceManagerClosing] = useState(false);
  const [isAnimCentered, setIsAnimCentered] = useState(true); // Control vertical position
  const [isSortMode, setIsSortMode] = useState(false); // New: Sort mode toggle
  const [sourceListCursor, setSourceListCursor] = useState(0); // Keyboard cursor for source list
  
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

  // Gesture State for Search Result Swiping
  const searchLightSwipeStartX = useRef<number | null>(null);
  const searchLastLightUpdateX = useRef<number | null>(null);

  // Computed Active Vocabulary based on enabled sources
  const activeVocab = useMemo(() => {
    if (sources.length === 0) return vocab; // Fallback for legacy state
    const enabledSourceIds = new Set(sources.filter(s => s.enabled).map(s => s.id));
    return vocab.filter(item => !item.sourceId || enabledSourceIds.has(item.sourceId));
  }, [vocab, sources]);

  const allSourcesEnabled = useMemo(() => sources.length > 0 && sources.every(s => s.enabled), [sources]);

  // Reset centering when vocab becomes empty (e.g. clear all)
  useEffect(() => {
      if (vocab.length === 0) setIsAnimCentered(true);
  }, [vocab.length]);

  // Reset search cursor when query changes
  useEffect(() => {
      setSearchCursor(0);
      setActiveSearchMenuId(null);
  }, [searchQuery]);

  // Global Keyboard Detection
  useEffect(() => {
      const handleUserInteraction = (e: Event) => {
          if (e.type === 'keydown') {
             setUsingKeyboard(true);
          } else if (e.type === 'mousemove') {
             // Only disable keyboard mode on mouse movement, not clicks (clicks are handled separately)
             setUsingKeyboard(false);
          }
      };

      window.addEventListener('keydown', handleUserInteraction);
      window.addEventListener('mousemove', handleUserInteraction);

      return () => {
          window.removeEventListener('keydown', handleUserInteraction);
          window.removeEventListener('mousemove', handleUserInteraction);
      }
  }, []);

  // Search Logic (Updated for Bilingual Search)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQuery = searchQuery.toLowerCase();
    return activeVocab
      .filter(item => 
          item.word.toLowerCase().includes(lowerQuery) || 
          item.definition.toLowerCase().includes(lowerQuery)
      )
      .slice(0, 50); // Limit results for performance
  }, [searchQuery, activeVocab]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Helper to Sort Vocab based on Source File Order + Original Index
  const sortVocabBySourceOrder = useCallback((currentVocab: VocabularyItem[], currentSources: SourceFile[]) => {
      const sourceRank = new Map(currentSources.map((s, i) => [s.id, i]));
      return [...currentVocab].sort((a, b) => {
          // 1. Primary Sort: Source Order in the list
          const rankA = sourceRank.get(a.sourceId || '') ?? 99999;
          const rankB = sourceRank.get(b.sourceId || '') ?? 99999;
          
          if (rankA !== rankB) return rankA - rankB;
          
          // 2. Secondary Sort: Original internal order (page order)
          return a.originalIndex - b.originalIndex;
      });
  }, []);

  const handleLevelUpdate = useCallback((id: string, newLevel: number) => {
    setVocab(prev => prev.map(item => 
        item.id === id ? { ...item, level: Math.max(0, Math.min(3, newLevel)) } : item
    ));
  }, []);

  // --- Keyboard Handling for Menu & Search ---
  const getMenuCols = () => {
      if (typeof window === 'undefined') return 1;
      if (window.innerWidth >= 1024) return 4;
      if (window.innerWidth >= 768) return 2;
      return 1;
  };

  useEffect(() => {
      if (mode !== GameMode.MENU) return;

      const handleKeyDown = (e: KeyboardEvent) => {
          // 1. Search Navigation
          if (searchQuery && searchResults.length > 0) {
             if (e.code === 'ArrowDown') {
                 e.preventDefault();
                 setSearchCursor(prev => Math.min(prev + 1, searchResults.length - 1));
             } else if (e.code === 'ArrowUp') {
                 e.preventDefault();
                 setSearchCursor(prev => Math.max(prev - 1, 0));
             } else if (e.code === 'ArrowRight') {
                 e.preventDefault();
                 const item = searchResults[searchCursor];
                 if (item && item.level < 3) handleLevelUpdate(item.id, item.level + 1);
             } else if (e.code === 'ArrowLeft') {
                 e.preventDefault();
                 const item = searchResults[searchCursor];
                 if (item && item.level > 0) handleLevelUpdate(item.id, item.level - 1);
             } else if (e.code === 'Escape') {
                 setSearchQuery('');
             } else if (e.code === 'Space' && document.activeElement !== searchInputRef.current) {
                 e.preventDefault();
                 searchInputRef.current?.focus();
             }
             return;
          }

          // 2. Source Manager Navigation (When Open)
          if (isSourceManagerOpen && !isSourceManagerClosing) {
             if (e.code === 'ArrowDown') {
                 e.preventDefault();
                 setSourceListCursor(prev => Math.min(prev + 1, sources.length - 1));
             } else if (e.code === 'ArrowUp') {
                 e.preventDefault();
                 setSourceListCursor(prev => Math.max(prev - 1, 0));
             } else if (e.code === 'Enter') {
                 e.preventDefault();
                 const source = sources[sourceListCursor];
                 if (source) toggleSource(source.id);
             } else if (e.code === 'Space') {
                 e.preventDefault();
                 toggleAllSources();
             } else if (e.code === 'Escape' || e.key === '`' || e.key === '~' || e.code === 'Backquote') {
                 e.preventDefault();
                 toggleSourceManager();
             }
             return;
          }

          // 3. Global Shortcuts (Menu Mode)
          
          // Toggle Source Manager
          if (e.key === '`' || e.key === '~' || e.code === 'Backquote') {
              e.preventDefault();
              toggleSourceManager();
              return;
          }

          // Save / Export
          if (e.key === '1') {
              e.preventDefault();
              handleExportProgress();
              return;
          }

          // Add / Upload
          if (e.key === '2') {
              e.preventDefault();
              headerFileInputRef.current?.click();
              return;
          }

          // Empty State Interactions
          if (vocab.length === 0) {
             if (e.code === 'Space' || e.code === 'Enter') {
                 e.preventDefault();
                 emptyStateFileInputRef.current?.click();
             }
             return;
          }
          
          // 4. Main Menu Grid Navigation
          // (only if no active search results or search is empty)
          if (!searchQuery) {
              const menuItemsCount = 4;
              const cols = getMenuCols();

              if (e.code === 'ArrowRight') {
                  e.preventDefault();
                  setMenuCursor(prev => Math.min(prev + 1, menuItemsCount - 1));
              } else if (e.code === 'ArrowLeft') {
                  e.preventDefault();
                  setMenuCursor(prev => Math.max(prev - 1, 0));
              } else if (e.code === 'ArrowDown') {
                  e.preventDefault();
                  setMenuCursor(prev => Math.min(prev + cols, menuItemsCount - 1));
              } else if (e.code === 'ArrowUp') {
                  e.preventDefault();
                  setMenuCursor(prev => Math.max(prev - cols, 0));
              } else if (e.code === 'Enter') {
                  e.preventDefault();
                  if (menuCursor === 0) setMode(GameMode.FLASHCARD);
                  if (menuCursor === 1) setMode(GameMode.QUIZ);
                  if (menuCursor === 2) setMode(GameMode.MATCHING);
                  if (menuCursor === 3) setMode(GameMode.WORD_LIST);
              } else if (e.code === 'Space') {
                 e.preventDefault();
                 searchInputRef.current?.focus();
              }
          }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, searchQuery, searchResults, searchCursor, menuCursor, handleLevelUpdate, isSourceManagerOpen, isSourceManagerClosing, sources, sourceListCursor]);

  // Scroll search item into view
  useEffect(() => {
      if (searchQuery && usingKeyboard) {
          const el = document.getElementById(`search-result-${searchCursor}`);
          if (el) {
              el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
      }
  }, [searchCursor, searchQuery, usingKeyboard]);

  // Scroll source list item into view
  useEffect(() => {
      if (isSourceManagerOpen && usingKeyboard) {
          const el = document.getElementById(`source-item-${sourceListCursor}`);
          if (el) {
              el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
      }
  }, [sourceListCursor, isSourceManagerOpen, usingKeyboard]);

  // Reset source cursor when manager opens
  useEffect(() => {
      if (isSourceManagerOpen) setSourceListCursor(0);
  }, [isSourceManagerOpen]);


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
            setGameSessionId(prev => prev + 1); // FORCE UPDATE to refresh components
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
          if (newSources.length > 0 || newVocab.length > 0) {
              setGameSessionId(prev => prev + 1); // Refresh if new data added
          }
      } else {
          // OVERWRITE LOGIC
          setVocab(incomingVocab);
          setSources(incomingSources);
          setProgress(saveData.progress || {});
          setGameSessionId(prev => prev + 1); // FORCE UPDATE to re-mount game components with new progress
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
          // Close Sequence: 1. Collapse Grid, 2. Move Down
          setIsSourceManagerClosing(true);
          setTimeout(() => {
              setIsSourceManagerOpen(false);
              setIsSourceManagerClosing(false);
              setIsAnimCentered(true); // Return to center
              setIsSortMode(false); // Reset sort mode on close
          }, 300); // 300ms matches animation duration
      } else {
          // Open Sequence: 1. Move Up, 2. Expand Grid
          setIsAnimCentered(false); // Move to top
          setTimeout(() => {
              setIsSourceManagerOpen(true); // Expand drawer
          }, 300); // Wait for move to complete
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
  
  // Sorting Logic (Up/Down)
  const moveSourceUp = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (index <= 0) return;
    
    // Create new array manually to get immediate state for vocab sort
    const newSources = [...sources];
    [newSources[index - 1], newSources[index]] = [newSources[index], newSources[index - 1]];
    
    setSources(newSources);
    // Also re-sort vocabulary to match new file order immediately
    setVocab(prev => sortVocabBySourceOrder(prev, newSources));
  };

  const moveSourceDown = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (index >= sources.length - 1) return;
    
    // Create new array manually to get immediate state for vocab sort
    const newSources = [...sources];
    [newSources[index], newSources[index + 1]] = [newSources[index + 1], newSources[index]];
    
    setSources(newSources);
    // Also re-sort vocabulary to match new file order immediately
    setVocab(prev => sortVocabBySourceOrder(prev, newSources));
  };

  const resetGame = useCallback(() => {
    setMode(GameMode.MENU);
    setJumpToId(null);
  }, []);

  // -- Persistence Handlers --
  const saveFlashcardProgress = useCallback((index: number, activeLevels: number[]) => {
    setProgress(prev => ({ ...prev, flashcard: { index, activeLevels } }));
  }, []);

  const saveQuizProgress = useCallback((state: { currentIndex: number; score: number; answeredState: Record<number, number | null>; activeLevels: number[] }) => {
    setProgress(prev => ({ ...prev, quiz: state }));
  }, []);

  // Updated to save bubbles state
  const saveMatchingProgress = useCallback((round: number, bubbles: Bubble[], activeLevels: number[]) => {
    setProgress(prev => ({ ...prev, matching: { round, bubbles, activeLevels } }));
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
    // Uses the helper to sort strictly by File List Order -> Internal Index
    setVocab(prev => sortVocabBySourceOrder(prev, sources));
  }, [sources, sortVocabBySourceOrder]);

  // --- Search Result Swipe Handlers ---
  const handleSearchLightSwipeStart = (e: React.TouchEvent, item: VocabularyItem) => {
      e.stopPropagation();
      searchLightSwipeStartX.current = e.touches[0].clientX;
      searchLastLightUpdateX.current = e.touches[0].clientX;
  };

  const handleSearchLightSwipeMove = (e: React.TouchEvent, item: VocabularyItem) => {
      e.stopPropagation();
      if (searchLastLightUpdateX.current === null) return;
      const currentX = e.touches[0].clientX;
      const diff = currentX - searchLastLightUpdateX.current;
      const THRESHOLD = 10; 

      if (Math.abs(diff) > THRESHOLD) {
          if (diff > 0) {
              // Right Swipe -> Increase
              if (item.level < 3) {
                  handleLevelUpdate(item.id, item.level + 1);
                  searchLastLightUpdateX.current = currentX;
              }
          } else {
              // Left Swipe -> Decrease
              if (item.level > 0) {
                  handleLevelUpdate(item.id, item.level - 1);
                  searchLastLightUpdateX.current = currentX;
              }
          }
      }
  };

  const handleSearchLightSwipeEnd = () => {
      searchLightSwipeStartX.current = null;
      searchLastLightUpdateX.current = null;
  };

  // --- Jump To Mode Logic ---
  const handleJumpToWord = (item: VocabularyItem, targetMode: GameMode) => {
      setJumpToId(item.id);
      setMode(targetMode);
      setSearchQuery(''); // Close search
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full animate-pulse z-10">
           <div className="relative">
             <div className="w-16 h-16 border-4 border-monkey-sub/30 rounded-full"></div>
             <div className="absolute top-0 left-0 w-16 h-16 border-4 border-monkey-main border-t-transparent rounded-full animate-spin"></div>
             {/* WordForge Icon Replacement in Loading */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-monkey-main">
                <BrainCircuit size={24} />
             </div>
           </div>
           <p className="text-monkey-main font-mono mt-4 tracking-widest">FORGING...</p>
        </div>
      );
    }

    if (mode === GameMode.FLASHCARD) {
        return <FlashcardMode 
                  key={`flashcard-${gameSessionId}`}
                  data={activeVocab} 
                  initialIndex={progress.flashcard?.index}
                  initialActiveLevels={progress.flashcard?.activeLevels}
                  jumpToId={jumpToId}
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
                  key={`quiz-${gameSessionId}`}
                  data={activeVocab} 
                  initialState={progress.quiz}
                  jumpToId={jumpToId}
                  onExit={resetGame} 
                  onShuffle={handleShuffle} 
                  onRestore={handleRestore}
                  onSaveProgress={saveQuizProgress}
                  onGetSourceName={getSourceName}
                  onUpdateLevel={handleLevelUpdate}
               />;
    }
    if (mode === GameMode.MATCHING) {
        return <MatchingMode 
                  key={`matching-${gameSessionId}`}
                  data={activeVocab} 
                  initialRound={progress.matching?.round}
                  initialBubbles={progress.matching?.bubbles}
                  initialActiveLevels={progress.matching?.activeLevels}
                  jumpToId={jumpToId}
                  onExit={resetGame} 
                  onShuffle={handleShuffle} 
                  onRestore={handleRestore} 
                  onSaveProgress={saveMatchingProgress}
                  onUpdateLevel={handleLevelUpdate}
               />;
    }
    if (mode === GameMode.WORD_LIST) return <WordListMode key={`wordlist-${gameSessionId}`} data={activeVocab} jumpToId={jumpToId} onExit={resetGame} onUpdateLevel={handleLevelUpdate} onResetLevels={() => handleResetLevels('', 0)} onShuffle={handleShuffle} onRestore={handleRestore} onGetSourceName={getSourceName} />;

    // MENU
    return (
      <div 
        className="flex flex-col h-full w-full mx-auto z-10 relative"
      >
        
        {vocab.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-4 max-w-4xl mx-auto w-full">
              <div className="w-full max-w-xl p-6 md:p-10 border-2 border-dashed border-monkey-sub/30 rounded-xl hover:border-monkey-main/50 transition-colors bg-[#2c2e31]/80 backdrop-blur-sm group flex-shrink-0 animate-pop-in">
                <label className="flex flex-col items-center cursor-pointer">
                  <FileUp size={48} className="text-monkey-sub group-hover:text-monkey-main transition-colors mb-4 duration-300" />
                  <span className="text-lg md:text-xl font-bold text-monkey-text mb-2 text-center">Upload Files / Load Progress</span>
                  <span className="text-xs md:text-sm text-monkey-sub text-center px-4">Supported: PDF, DOCX, TXT, .FORGE (Batch supported)</span>
                  <input ref={emptyStateFileInputRef} type="file" multiple className="hidden" accept=".pdf,.txt,.docx,.forge,.json,application/json,application/octet-stream,text/json" onChange={handleFileUpload} />
                </label>
                {error && (
                  <div className="mt-6 relative flex items-center gap-2 text-monkey-error bg-monkey-error/10 p-3 pr-10 rounded text-sm animate-shake">
                    <AlertCircle size={16} className="shrink-0" /> 
                    <span>{error}</span>
                    <button 
                      onClick={() => setError(null)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-monkey-error/20 rounded-md transition-colors text-monkey-error hover:text-red-400"
                      title="Dismiss Error"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>
          </div>
        ) : (
          <>
            {/* Top Flexible Spacer */}
            <div className={`transition-[flex-grow] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] min-h-0 ${isAnimCentered ? 'flex-grow' : 'flex-grow-0'}`} />

            {/* Content Container Wrapper to handle centering animation on the group */}
            <div className={`flex flex-col w-full transition-[flex-grow] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${isAnimCentered ? 'shrink min-h-0' : 'flex-grow min-h-0'}`}>
                
                {/* Header Area */}
                <div className={`w-full shrink-0 z-40 mb-0`}>
                    <div 
                        className={`flex flex-col gap-2 px-4 py-3 bg-[#2c2e31]/95 backdrop-blur-xl shadow-sm transition-all duration-300 max-w-4xl mx-auto ${
                            (isSourceManagerOpen || isSourceManagerClosing) 
                                ? 'rounded-t-xl border-t border-x border-monkey-sub/20 border-b-transparent' 
                                : 'rounded-xl border border-monkey-sub/10'
                        }`}
                    >
                    <div className="flex justify-between items-center">
                        <div 
                            className="flex items-center gap-2 cursor-pointer group mr-4 select-none"
                            onClick={toggleSourceManager}
                            title="Shortcut: ` (Backtick)"
                        >
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                            <span className="font-mono text-sm">
                                <span className="text-monkey-main">{activeVocab.length}<span className="md:inline"> active</span></span>
                                <span className="text-monkey-sub mx-1">/</span>
                                <span className="text-monkey-sub">{vocab.length}<span className="text-monkey-sub"> total</span></span>
                            </span>
                            <ChevronRight size={14} className={`text-monkey-sub transition-transform duration-300 ${isSourceManagerOpen && !isSourceManagerClosing ? 'rotate-90' : ''}`} />
                        </div>
                        
                        <div className="flex items-center gap-4 md:gap-4">
                        <button 
                            onClick={handleExportProgress} 
                            className="text-xs text-monkey-sub hover:text-monkey-main flex items-center gap-1 transition-colors"
                            title="Save current progress (1)"
                        >
                            <Save size={14} />
                            <span className="hidden sm:inline">Save</span>
                        </button>

                        <div className="w-px h-4 bg-monkey-sub/20"></div>

                        <label className="text-xs text-monkey-sub hover:text-monkey-text cursor-pointer hover:underline flex items-center gap-1 transition-colors" title="Add/Replace Files (2)">
                            <FileUp size={14} />
                            <span className="hidden sm:inline">Add/Replace</span>
                            <input ref={headerFileInputRef} type="file" multiple className="hidden" accept=".pdf,.txt,.docx,.forge,.json,application/json,application/octet-stream,text/json" onChange={handleFileUpload} />
                        </label>
                        </div>
                    </div>

                    {/* Error Notification */}
                    {error && (
                        <div className="relative flex items-center gap-2 text-monkey-error bg-monkey-error/10 p-2 pr-8 rounded text-xs animate-shake mt-1">
                        <AlertCircle size={14} className="shrink-0" /> 
                        <span>{error}</span>
                        <button 
                            onClick={() => setError(null)}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 hover:bg-monkey-error/20 rounded transition-colors text-monkey-error hover:text-red-400"
                        >
                            <X size={12} />
                        </button>
                        </div>
                    )}
                    </div>
                </div>

                {/* CONTROLS AREA (NON-SCROLLING, Z-INDEX HIGH) */}
                {/* This section holds the Source Manager and Search Bar. It does not scroll. */}
                {/* This prevents the search dropdown from being clipped by overflow:hidden/auto of the content body */}
                <div className="w-full shrink-0 z-30 relative">
                     <div className="max-w-4xl mx-auto">
                        {/* Source Manager Panel */}
                        {(isSourceManagerOpen || isSourceManagerClosing) && (
                            <div className={`grid mx-0 origin-top overflow-hidden ${isSourceManagerClosing ? 'animate-collapse-grid' : 'animate-expand-grid'}`}>
                                <div className="min-h-0">
                                    {/* VISUAL WRAPPER */}
                                    <div className={`bg-[#2c2e31] rounded-b-xl border-x border-b border-monkey-sub/20 overflow-hidden`}>
                                        <div className="flex items-center justify-between mb-1 px-4 pt-4 pb-2 border-b border-monkey-sub/10 bg-[#2c2e31]">
                                            <div className="flex items-center gap-2">
                                                <button 
                                                onClick={(e) => { e.stopPropagation(); toggleAllSources(); }} 
                                                className="text-monkey-sub hover:text-monkey-main transition-colors"
                                                title={allSourcesEnabled ? "Deselect All (Space)" : "Select All (Space)"}
                                                >
                                                    {allSourcesEnabled ? <CheckSquare size={16} /> : <Square size={16} />}
                                                </button>
                                                <span className="text-xs text-monkey-sub uppercase tracking-wider">Source Files</span>
                                            </div>
                                            <button 
                                                onClick={() => setIsSortMode(!isSortMode)}
                                                className={`p-1.5 rounded transition-all ${isSortMode ? 'bg-monkey-main text-monkey-bg' : 'text-monkey-sub hover:bg-monkey-sub/10'}`}
                                                title="Toggle Sort Mode"
                                            >
                                                <ArrowDownUp size={16} />
                                            </button>
                                        </div>
                                        <div className="flex flex-col gap-1 max-h-[60vh] overflow-y-auto custom-scrollbar p-2">
                                            {sources.map((source, index) => (
                                                <div 
                                                    id={`source-item-${index}`}
                                                    key={source.id} 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSourceListCursor(index);
                                                        setUsingKeyboard(true);
                                                    }}
                                                    className={`flex justify-between items-center p-2 rounded transition-all group/item select-none ${usingKeyboard && index === sourceListCursor ? 'bg-monkey-main/10 border border-monkey-main/30' : 'hover:bg-[#323437] border border-transparent'}`}
                                                >
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
                                                    <div className="flex items-center flex-1 min-w-0">
                                                        {/* Animated Sorting Controls */}
                                                        <div className={`flex items-center gap-1 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex-shrink-0 ${isSortMode ? 'max-w-[4.5rem] opacity-100 mr-2' : 'max-w-0 opacity-0'}`}>
                                                            <button 
                                                                onClick={(e) => moveSourceUp(e, index)}
                                                                disabled={index === 0 || !isSortMode}
                                                                className="p-2 bg-monkey-sub/10 hover:bg-monkey-main hover:text-monkey-bg rounded text-monkey-sub disabled:opacity-20 transition-colors"
                                                                title="Move Up"
                                                            >
                                                                <ChevronUp size={16} />
                                                            </button>
                                                            <button 
                                                                onClick={(e) => moveSourceDown(e, index)}
                                                                disabled={index === sources.length - 1 || !isSortMode}
                                                                className="p-2 bg-monkey-sub/10 hover:bg-monkey-main hover:text-monkey-bg rounded text-monkey-sub disabled:opacity-20 transition-colors"
                                                                title="Move Down"
                                                            >
                                                                <ChevronDown size={16} />
                                                            </button>
                                                        </div>
                                                        
                                                        {/* Selection Controls - Hide in Sort Mode */}
                                                        <div className={`flex items-center gap-2 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] flex-shrink-0 ${!isSortMode ? 'max-w-[3rem] opacity-100 mr-2' : 'max-w-0 opacity-0'}`}>
                                                            <button onClick={() => toggleSource(source.id)} className="text-monkey-text hover:text-monkey-main">
                                                                {source.enabled ? <CheckSquare size={16} /> : <Square size={16} />}
                                                            </button>
                                                            <FileText size={14} className="text-monkey-sub shrink-0" />
                                                        </div>

                                                        <span className={`truncate ${!source.enabled && 'text-monkey-sub line-through opacity-50'}`}>{source.name}</span>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setEditingSourceId(source.id); setEditName(source.name); }}
                                                            className="opacity-0 group-hover/item:opacity-100 text-monkey-sub hover:text-monkey-text transition-opacity p-1 ml-2"
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
                                </div>
                            </div>
                        )}

                        {/* SEARCH BAR (Sticky/Fixed relative to content) */}
                        <div className={`w-full mb-6 animate-fade-in-up relative z-30 transition-[margin] duration-300 ${isSourceManagerOpen && !isSourceManagerClosing ? 'mt-0' : 'mt-4'}`} style={{ animationDelay: '50ms' }}>
                            <div className="relative group">
                                <Search className="absolute left-4 top-1/2 -translate-x-0 -translate-y-1/2 text-monkey-sub group-focus-within:text-monkey-main transition-colors" size={18} />
                                <input 
                                    ref={searchInputRef}
                                    type="text" 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search English words or Chinese definitions... (Space)"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className="w-full bg-[#2c2e31]/50 border border-monkey-sub/20 rounded-xl py-3 pl-12 pr-10 text-monkey-text outline-none ring-0 appearance-none focus:border-monkey-main/50 focus:bg-[#2c2e31] transition-colors placeholder:text-monkey-sub/50"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-monkey-sub hover:text-monkey-text"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                                
                                {/* Search Results Dropdown - Absolute to overlay content */}
                                {searchQuery && (
                                    <div className="absolute top-full left-0 w-full mt-2 bg-[#2c2e31] border border-monkey-sub/20 rounded-xl shadow-2xl max-h-[45vh] overflow-y-auto custom-scrollbar z-50 overscroll-contain">
                                        {searchResults.length > 0 ? (
                                            searchResults.map((item, idx) => (
                                                <div 
                                                    id={`search-result-${idx}`}
                                                    key={item.id} 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSearchCursor(idx);
                                                        setUsingKeyboard(true);
                                                    }}
                                                    className={`p-3 border-b border-monkey-sub/10 last:border-0 hover:bg-[#323437] transition-all duration-200 relative group/result ${usingKeyboard && idx === searchCursor ? 'bg-monkey-main/10' : ''}`}
                                                >
                                                    <div className="flex justify-between items-start mb-1 pr-8">
                                                        <span className="font-bold text-monkey-main select-all">{item.word}</span>
                                                        
                                                        {/* Interactive Traffic Lights in Search */}
                                                        <div 
                                                            className="flex gap-1 p-2 -m-2 translate-y-2 cursor-ew-resize touch-none select-none"
                                                            onTouchStart={(e) => handleSearchLightSwipeStart(e, item)}
                                                            onTouchMove={(e) => handleSearchLightSwipeMove(e, item)}
                                                            onTouchEnd={handleSearchLightSwipeEnd}
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            {[1, 2, 3].map(l => (
                                                                <div 
                                                                    key={l} 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        // Click to set level directly. If clicking current level, reduce by 1 (toggle off)
                                                                        const nextLevel = item.level === l ? l - 1 : l;
                                                                        handleLevelUpdate(item.id, nextLevel);
                                                                    }}
                                                                    className={`w-3 h-3 rounded-full border border-monkey-sub/30 cursor-pointer transition-transform active:scale-90 ${item.level >= l ? (item.level === 3 ? 'bg-green-500 border-green-500' : 'bg-monkey-main border-monkey-main') : 'bg-transparent'}`}
                                                                ></div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="text-sm text-monkey-sub leading-snug">{item.definition}</div>
                                                    {item.sourceId && (
                                                        <div className="text-[10px] text-monkey-sub/40 mt-1 truncate">
                                                            {getSourceName(item.sourceId)}
                                                        </div>
                                                    )}

                                                    {/* Quick Action Button */}
                                                    <div className="absolute top-2 right-2">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveSearchMenuId(activeSearchMenuId === item.id ? null : item.id);
                                                            }}
                                                            className={`p-1 rounded hover:bg-monkey-sub/20 text-monkey-sub hover:text-monkey-text transition-colors ${activeSearchMenuId === item.id ? 'bg-monkey-sub/20 text-monkey-text' : ''}`}
                                                            title="Jump to Game"
                                                        >
                                                            <MoreHorizontal size={16} />
                                                        </button>
                                                        
                                                        {/* Collapsible Game Mode Menu */}
                                                        {activeSearchMenuId === item.id && (
                                                            <div className="absolute right-0 top-full mt-1 bg-[#2c2e31] border border-monkey-sub/30 rounded-lg shadow-xl z-[60] flex flex-row overflow-hidden animate-spring-in origin-top-right">
                                                                <button onClick={(e) => { e.stopPropagation(); handleJumpToWord(item, GameMode.FLASHCARD); }} className="p-2 hover:bg-[#3e4044] text-monkey-sub hover:text-monkey-main flex flex-col items-center gap-1 min-w-[3rem]" title="Flashcards">
                                                                    <BookOpen size={16} />
                                                                    <span className="text-[10px] font-bold">练</span>
                                                                </button>
                                                                <div className="w-px bg-monkey-sub/20 my-1"></div>
                                                                <button onClick={(e) => { e.stopPropagation(); handleJumpToWord(item, GameMode.QUIZ); }} className="p-2 hover:bg-[#3e4044] text-monkey-sub hover:text-monkey-main flex flex-col items-center gap-1 min-w-[3rem]" title="Quiz">
                                                                    <BrainCircuit size={16} />
                                                                    <span className="text-[10px] font-bold">测</span>
                                                                </button>
                                                                <div className="w-px bg-monkey-sub/20 my-1"></div>
                                                                <button onClick={(e) => { e.stopPropagation(); handleJumpToWord(item, GameMode.MATCHING); }} className="p-2 hover:bg-[#3e4044] text-monkey-sub hover:text-monkey-main flex flex-col items-center gap-1 min-w-[3rem]" title="Matching">
                                                                    <Gamepad2 size={16} />
                                                                    <span className="text-[10px] font-bold">连</span>
                                                                </button>
                                                                <div className="w-px bg-monkey-sub/20 my-1"></div>
                                                                <button onClick={(e) => { e.stopPropagation(); handleJumpToWord(item, GameMode.WORD_LIST); }} className="p-2 hover:bg-[#3e4044] text-monkey-sub hover:text-monkey-main flex flex-col items-center gap-1 min-w-[3rem]" title="Word List">
                                                                    <ListChecks size={16} />
                                                                    <span className="text-[10px] font-bold">看</span>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="p-4 text-center text-monkey-sub text-sm">
                                                No words or definitions found matching "{searchQuery}"
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                     </div>
                </div>

                {/* Content Body (SCROLLABLE) */}
                <div 
                    className={`overflow-y-auto overflow-x-hidden custom-scrollbar pb-4 w-full ${isAnimCentered ? 'shrink' : 'flex-grow'}`}
                >
                    <div className="max-w-4xl mx-auto">
                        
                        {/* Game Modes Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                            <MenuCard 
                            icon={<BookOpen size={24} />}
                            title="Flashcards" 
                            desc="Flip-card study" 
                            delay={100}
                            onClick={() => setMode(GameMode.FLASHCARD)} 
                            isSelected={usingKeyboard && !searchQuery && menuCursor === 0}
                            />
                            <MenuCard 
                            icon={<BrainCircuit size={24} />}
                            title="Quiz" 
                            desc="4-choice test" 
                            delay={200}
                            onClick={() => setMode(GameMode.QUIZ)} 
                            isSelected={usingKeyboard && !searchQuery && menuCursor === 1}
                            />
                            <MenuCard 
                            icon={<Gamepad2 size={24} />}
                            title="Matching" 
                            desc="Connect pairs" 
                            delay={300}
                            onClick={() => setMode(GameMode.MATCHING)} 
                            isSelected={usingKeyboard && !searchQuery && menuCursor === 2}
                            />
                            <MenuCard 
                            icon={<ListChecks size={24} />}
                            title="Word List" 
                            desc="View & Mark" 
                            delay={400}
                            onClick={() => setMode(GameMode.WORD_LIST)} 
                            isSelected={usingKeyboard && !searchQuery && menuCursor === 3}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Flexible Spacer */}
            <div className={`transition-[flex-grow] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] min-h-0 ${isAnimCentered ? 'flex-grow' : 'flex-grow-0'}`} />
          </>
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
    flex justify-between items-center z-50 transition-[width,margin,padding,border-radius,background-color,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
    max-w-6xl mx-auto flex-shrink-0
    ${isMenu ? 'w-[95%] mt-2 mb-6 px-6 py-3 rounded-2xl bg-[#2c2e31]/80 backdrop-blur-md border border-monkey-sub/20 shadow-xl' : 'w-full mt-2 mb-2 px-6 py-2 rounded-none bg-transparent border border-transparent shadow-none'}
  `;

  return (
    <div 
      className="fixed inset-0 w-full h-full bg-monkey-bg text-monkey-text font-mono selection:bg-monkey-main selection:text-monkey-bg flex flex-col overflow-hidden"
      onTouchStart={handleGlobalTouchStart}
      onTouchEnd={handleGlobalTouchEnd}
      onClick={() => setUsingKeyboard(false)}
    >
      {/* Background Effect - Rendered at root to ensure full coverage */}
      {mode === GameMode.MENU && <MatrixRain />}

      {/* Dynamic Top Bar */}
      <nav className={navClasses}>
        <div className="flex items-center gap-3 cursor-pointer group" onClick={handleLogoClick}>
             {/* Re-using Flame here as per imports, assuming WordForgeIcon was handled in a previous step not visible in this file content fully or just using standard icons for now */}
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

// Simplified MenuCard using exact hover styles for keyboard selection
const MenuCard = ({ title, desc, icon, onClick, delay, isSelected }: { title: string, desc: string, icon: React.ReactNode, onClick: () => void, delay: number, isSelected?: boolean }) => (
  <button 
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    style={{ animationDelay: `${delay}ms` }}
    className={`flex flex-row md:flex-col items-center md:text-center p-4 md:p-6 rounded-xl backdrop-blur-md border transition-all duration-300 group text-left md:justify-center gap-4 md:gap-0 animate-pop-in opacity-0 fill-mode-forwards 
    bg-[#2c2e31]/80 border-monkey-sub/20 hover:border-monkey-main hover:-translate-y-1 
    ${isSelected ? 'border-monkey-main -translate-y-1' : ''}`}
  >
    <div className={`md:mb-4 transition-colors duration-300 transform shrink-0 ${isSelected ? 'text-monkey-main scale-110' : 'text-monkey-sub group-hover:text-monkey-main group-hover:scale-110'}`}>{icon}</div>
    <div>
        <h3 className={`text-lg font-bold mb-1 transition-colors ${isSelected ? 'text-white' : 'text-monkey-text group-hover:text-white'}`}>{title}</h3>
        <p className="text-xs text-monkey-sub">{desc}</p>
    </div>
  </button>
);

export default App;