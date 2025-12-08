import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { VocabularyItem, Bubble } from '../types';
import { Shuffle, RotateCcw, X, ArrowLeft, ArrowRight, List } from 'lucide-react';

interface Props {
  data: VocabularyItem[];
  initialRound?: number;
  initialBubbles?: Bubble[];
  initialActiveLevels?: number[];
  jumpToId?: string | null;
  onExit: () => void;
  onShuffle: () => void;
  onRestore: () => void;
  onSaveProgress: (round: number, bubbles: Bubble[], activeLevels: number[]) => void;
  onUpdateLevel: (id: string, level: number) => void;
}

const ITEMS_PER_ROUND = 6; 

export const MatchingMode: React.FC<Props> = ({ 
  data, 
  initialRound = 0, 
  initialBubbles, 
  initialActiveLevels,
  jumpToId,
  onExit, 
  onShuffle, 
  onRestore, 
  onSaveProgress, 
  onUpdateLevel 
}) => {
  // Filter Logic - Initialize from saved state or default to all
  const [activeLevels, setActiveLevels] = useState<Set<number>>(() => {
    return initialActiveLevels ? new Set(initialActiveLevels) : new Set([0, 1, 2, 3]);
  });
  
  const filteredData = useMemo(() => {
    return data.filter(item => activeLevels.has(item.level));
  }, [data, activeLevels]);

  const [round, setRound] = useState(initialRound);
  
  // Use a function to initialize state so we can consume initialBubbles only if they match the round/logic
  const [bubbles, setBubbles] = useState<Bubble[]>(() => {
      if (initialBubbles && initialBubbles.length > 0) {
          return initialBubbles;
      }
      return [];
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isWait, setIsWait] = useState(false);
  
  // Animation State: Controls whether entrance animations are staggered (initial load) or sync (error recovery)
  const [isRoundLoading, setIsRoundLoading] = useState(true);

  // Track completed rounds in this session to show stamps
  // Initialize based on current round so we don't lose history on reload
  const [completedRounds, setCompletedRounds] = useState<Set<number>>(() => {
      const s = new Set<number>();
      for (let i = 0; i < initialRound; i++) {
          s.add(i);
      }
      // Fix: If the loaded state is fully matched, mark it as completed immediately
      if (initialBubbles && initialBubbles.length > 0 && initialBubbles.every(b => b.matched)) {
          s.add(initialRound);
      }
      return s;
  });

  // Force refresh for shuffle/restore
  const [resetVersion, setResetVersion] = useState(0);
  
  // Inspection State
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const [isClosingInspector, setIsClosingInspector] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  
  // Round List Modal State
  const [showRoundList, setShowRoundList] = useState(false);
  const [isClosingList, setIsClosingList] = useState(false);
  const [listSelectedIndex, setListSelectedIndex] = useState(0);
  
  // Round Jump Editing State
  const [isEditingRound, setIsEditingRound] = useState(false);
  const [editRoundInput, setEditRoundInput] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // KEYBOARD CURSOR SYSTEM
  const [cursorIndex, setCursorIndex] = useState(0);
  const [usingKeyboard, setUsingKeyboard] = useState(false);
  
  // Gesture State for Traffic Lights
  const lightStartX = useRef<number | null>(null);
  const lastLightUpdateX = useRef<number | null>(null);

  const totalRounds = Math.ceil(filteredData.length / ITEMS_PER_ROUND);

  // Derive inspectedItem from LIVE data
  const inspectedItem = useMemo(() => {
      if (!inspectedId) return null;
      return filteredData.find(i => i.id === inspectedId) || null;
  }, [filteredData, inspectedId]);

  // Derive current round items for the list view
  const currentRoundItems = useMemo(() => {
      const start = round * ITEMS_PER_ROUND;
      const end = start + ITEMS_PER_ROUND;
      return filteredData.slice(start, end);
  }, [filteredData, round]);

  // Jump to specific word if requested
  useEffect(() => {
    if (jumpToId && filteredData.length > 0) {
        const targetIndex = filteredData.findIndex(item => item.id === jumpToId);
        if (targetIndex !== -1) {
            const targetRound = Math.floor(targetIndex / ITEMS_PER_ROUND);
            setRound(targetRound);
            setBubbles([]); // Force regen
            setResetVersion(v => v + 1); // FORCE REGEN: Ensure bubbles regenerate even if state update batching makes bubbles look non-empty
            setSelectedId(null);
            setCursorIndex(0);
        }
    }
  }, [jumpToId, filteredData]);

  // Persist Progress (Round + Bubble State + Filter State)
  useEffect(() => {
    if (bubbles.length > 0) {
        onSaveProgress(round, bubbles, Array.from(activeLevels));
    }
  }, [round, bubbles, activeLevels, onSaveProgress]);

  // Adjust round if filtered data shrinks
  useEffect(() => {
      if (round >= totalRounds && totalRounds > 0) {
          setRound(0);
          setBubbles([]); // Force regeneration
      }
  }, [totalRounds, round]);

  // Auto-advance logic: Watches for 100% completion
  // This handles both live completion AND restoring a completed save file
  useEffect(() => {
      if (bubbles.length > 0 && bubbles.every(b => b.matched)) {
           // Mark as passed locally for UI
           setCompletedRounds(prev => {
               const next = new Set(prev);
               next.add(round);
               return next;
           });
           
           const timer = setTimeout(() => {
               if (round < totalRounds - 1) {
                   setRound(r => r + 1);
                   setBubbles([]); // Force regen
                   setCursorIndex(0);
               } else {
                   // End of all rounds
               }
           }, 1000);
           return () => clearTimeout(timer);
      }
  }, [bubbles, round, totalRounds]);

  // Focus input when editing round
  useEffect(() => {
    if (isEditingRound && editInputRef.current) {
        editInputRef.current.focus();
        editInputRef.current.select();
    }
  }, [isEditingRound]);

  // Turn off staggering after initial load
  useEffect(() => {
      if (isRoundLoading) {
          const timer = setTimeout(() => setIsRoundLoading(false), 1000);
          return () => clearTimeout(timer);
      }
  }, [isRoundLoading]);

  const restart = () => {
      setRound(0);
      setBubbles([]); // Clear bubbles to force regeneration
      setSelectedId(null);
      setCompletedRounds(new Set());
      setCursorIndex(0);
  };

  const toggleFilter = (level: number) => {
      setActiveLevels(prev => {
          const next = new Set(prev);
          if (next.has(level)) next.delete(level);
          else next.add(level);
          return next.size === 0 ? prev : next;
      });
      restart();
  };

  const handleNext = useCallback(() => {
    if (round < totalRounds - 1) {
        setRound(r => r + 1);
        setBubbles([]); // Force regeneration for new round
        setSelectedId(null);
        setCursorIndex(0);
    }
  }, [round, totalRounds]);

  const handlePrev = useCallback(() => {
      if (round > 0) {
          setRound(r => r - 1);
          setBubbles([]); // Force regeneration
          setSelectedId(null);
          setCursorIndex(0);
      }
  }, [round]);

  // Round Jump Handler
  const handleRoundTextClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditRoundInput((round + 1).toString());
      setIsEditingRound(true);
  };

  const handleRoundJumpSubmit = () => {
      const val = parseInt(editRoundInput);
      if (!isNaN(val) && val >= 1 && val <= totalRounds) {
          setRound(val - 1);
          setBubbles([]); // Regenerate
          setResetVersion(v => v + 1);
          setSelectedId(null);
          setCursorIndex(0);
      }
      setIsEditingRound(false);
  };

  const handleRoundInputKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') handleRoundJumpSubmit();
      if (e.key === 'Escape') setIsEditingRound(false);
  };

  // Detect input method to toggle usingKeyboard state
  useEffect(() => {
      const handleUserInteraction = (e: Event) => {
          if (e.type === 'keydown') {
             // We set usingKeyboard in specific handlers usually, but global listener is fine for activation
          } else if (e.type === 'mousemove') {
             setUsingKeyboard(false);
          }
      };
      
      window.addEventListener('mousemove', handleUserInteraction);
      window.addEventListener('keydown', handleUserInteraction);
      
      return () => {
          window.removeEventListener('mousemove', handleUserInteraction);
          window.removeEventListener('keydown', handleUserInteraction);
      };
  }, []);

  // Scroll selected item into view in list mode
  useEffect(() => {
      if (showRoundList && usingKeyboard) {
          const el = document.getElementById(`round-list-item-${listSelectedIndex}`);
          if (el) {
              el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
      }
  }, [listSelectedIndex, showRoundList, usingKeyboard]);

  // Reset selection when list opens
  useEffect(() => {
      if (showRoundList) {
          setListSelectedIndex(0);
      }
  }, [showRoundList]);

  // Regenerate bubbles only when needed (empty state or version change)
  useEffect(() => {
    if (filteredData.length === 0) return;
    
    // If bubbles exist and match current round context, don't regenerate unless forced
    if (bubbles.length > 0 && resetVersion === 0) {
        return;
    }
    
    const start = round * ITEMS_PER_ROUND;
    const end = start + ITEMS_PER_ROUND;
    const slice = filteredData.slice(start, end);

    if (slice.length === 0) return;

    const wordBubbles: Bubble[] = slice.map(item => ({
      id: item.id,
      uid: item.id + '-w',
      text: item.word,
      type: 'word',
      matched: false,
      status: 'default'
    }));

    const defBubbles: Bubble[] = slice.map(item => {
      let defText = item.definition; 
      if (defText.length > 50) {
          defText = defText.substring(0, 48) + '..';
      }
      return {
        id: item.id,
        uid: item.id + '-d',
        text: defText,
        type: 'def',
        matched: false,
        status: 'default'
      };
    });

    const combined = [...wordBubbles, ...defBubbles].sort(() => Math.random() - 0.5);
    setBubbles(combined);
    setIsRoundLoading(true); // Enable staggering for new round
    setSelectedId(null);
    setCursorIndex(0);
    
    if (resetVersion > 0) setResetVersion(0);

  }, [round, activeLevels, resetVersion, filteredData]); 

  const handleSelect = useCallback((uid: string) => {
    if (isWait || inspectedId || showRoundList) return;
    
    const clicked = bubbles.find(b => b.uid === uid);
    if (!clicked || clicked.matched) return;

    // Remove automatic keyboard mode on click
    // setUsingKeyboard(true);

    if (selectedId === uid) {
      setBubbles(prev => prev.map(b => b.uid === uid ? { ...b, status: 'default' } : b));
      setSelectedId(null);
      return;
    }

    if (!selectedId) {
      setSelectedId(uid);
      setBubbles(prev => prev.map(b => b.uid === uid ? { ...b, status: 'selected' } : b));
      return;
    }

    const first = bubbles.find(b => b.uid === selectedId);
    if (!first) return;

    if (first.id === clicked.id) {
      // MATCH SUCCESS
      setBubbles(prev => prev.map(b => 
        (b.uid === first.uid || b.uid === clicked.uid) 
          ? { ...b, status: 'success', matched: true } 
          : b
      ));
      setSelectedId(null);
      // NOTE: Completion check moved to useEffect to support restoration from save
    } else {
      setIsWait(true);
      // Set to WRONG (triggers Shake)
      setBubbles(prev => prev.map(b => 
        (b.uid === first.uid || b.uid === clicked.uid) 
          ? { ...b, status: 'wrong' } 
          : b
      ));

      setTimeout(() => {
        // Directly reset to default after shake
        setBubbles(prev => prev.map(b => 
          (b.uid === first.uid || b.uid === clicked.uid) 
            ? { ...b, status: 'default' } 
            : b
        ));
        setSelectedId(null);
        setIsWait(false);
      }, 500); 
    }
  }, [bubbles, selectedId, isWait, inspectedId, showRoundList]);

  // --- Modal Control ---
  const handleCloseInspector = () => {
    // Backdrop animation is handled by parent container's opacity
    setIsClosingInspector(true);
    setTimeout(() => {
        setInspectedId(null);
        setIsClosingInspector(false);
    }, 400); // Wait for spring-out
  };

  const handleCloseList = () => {
    setIsClosingList(true);
    setTimeout(() => {
        setShowRoundList(false);
        setIsClosingList(false);
    }, 400); // Wait for spring-out
  };

  // --- Long Press Logic ---
  const handleTouchStart = (id: string) => {
      longPressTimer.current = window.setTimeout(() => {
          setInspectedId(id);
      }, 500);
  };

  const handleTouchEnd = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

  // --- Traffic Light Logic ---
  const handleLevelClick = (e: React.MouseEvent, id: string, level: number) => {
      e.stopPropagation();
      onUpdateLevel(id, level);
  };

  const handleLightTouchStart = (e: React.TouchEvent) => {
      e.stopPropagation();
      lightStartX.current = e.touches[0].clientX;
      lastLightUpdateX.current = e.touches[0].clientX;
  };

  const handleLightTouchMove = (e: React.TouchEvent, item: VocabularyItem) => {
      e.stopPropagation();
      if (lastLightUpdateX.current === null) return;

      const currentX = e.touches[0].clientX;
      const diff = currentX - lastLightUpdateX.current;
      const THRESHOLD = 10; 

      if (Math.abs(diff) > THRESHOLD) {
          if (diff > 0) {
              if (item.level < 3) {
                  onUpdateLevel(item.id, item.level + 1);
                  lastLightUpdateX.current = currentX;
              }
          } else {
              if (item.level > 0) {
                  onUpdateLevel(item.id, item.level - 1);
                  lastLightUpdateX.current = currentX;
              }
          }
      }
  };

  const handleLightTouchEnd = () => {
      lightStartX.current = null;
      lastLightUpdateX.current = null;
  }

  // Helper to determine columns for grid navigation
  const getCols = () => {
    if (typeof window === 'undefined') return 2;
    if (window.innerWidth >= 1024) return 4;
    if (window.innerWidth >= 768) return 3;
    return 2;
  };

  // Helper for dynamic font sizing (Ensuring no wrap but readable)
  const getWordFontSize = (text: string) => {
      const len = text.length;
      // Desktop: Start big (2xl), shrink to XL/LG for very long words
      const desktop = len < 10 ? "md:text-2xl" : len < 16 ? "md:text-xl" : "md:text-lg";
      // Mobile: Start normal (lg), shrink to base for very long words
      const mobile = len < 10 ? "text-lg" : "text-base";
      
      return `${mobile} ${desktop}`;
  };

  // --- Keyboard Handler ---
  useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
          if (e.code === 'Escape') {
              if (isEditingRound) {
                  setIsEditingRound(false);
              } else if (inspectedId) {
                  handleCloseInspector();
              } else if (showRoundList) {
                  handleCloseList();
              } else {
                  onExit();
              }
              return;
          }

          if (isEditingRound) return;

          // Filters (~123)
          if (e.key === '`' || e.key === '~' || e.code === 'Backquote') toggleFilter(0);
          if (e.key === '1') toggleFilter(1);
          if (e.key === '2') toggleFilter(2);
          if (e.key === '3') toggleFilter(3);

          // Toolbar (456)
          if (e.key === '4') setShowRoundList(true);
          if (e.key === '5') { setResetVersion(v => v + 1); setBubbles([]); onShuffle(); }
          if (e.key === '6') { setResetVersion(v => v + 1); setBubbles([]); onRestore(); }

          // 1. INSPECTOR MODE
          if (inspectedId && inspectedItem) {
              setUsingKeyboard(true);
              if (e.code === 'ArrowUp' || e.code === 'ArrowRight') {
                 e.preventDefault();
                 if (inspectedItem.level < 3) onUpdateLevel(inspectedItem.id, inspectedItem.level + 1);
              } else if (e.code === 'ArrowDown' || e.code === 'ArrowLeft') {
                 e.preventDefault();
                 if (inspectedItem.level > 0) onUpdateLevel(inspectedItem.id, inspectedItem.level - 1);
              }
              // Shift to close
              if (e.key === 'Shift') {
                  e.preventDefault();
                  handleCloseInspector();
              }
              // Removed Enter Key Closing
              return;
          }

          // 2. LIST MODE
          if (showRoundList) {
              setUsingKeyboard(true);
              if (e.code === 'ArrowDown') {
                  e.preventDefault();
                  setListSelectedIndex(prev => Math.min(prev + 1, currentRoundItems.length - 1));
              } else if (e.code === 'ArrowUp') {
                  e.preventDefault();
                  setListSelectedIndex(prev => Math.max(prev - 1, 0));
              } else if (e.code === 'ArrowLeft') {
                  e.preventDefault();
                  const item = currentRoundItems[listSelectedIndex];
                  if (item && item.level > 0) onUpdateLevel(item.id, item.level - 1);
              } else if (e.code === 'ArrowRight') {
                  e.preventDefault();
                  const item = currentRoundItems[listSelectedIndex];
                  if (item && item.level < 3) onUpdateLevel(item.id, item.level + 1);
              } else if (e.code === 'Space') {
                  e.preventDefault();
                  handleCloseList();
              }
              return;
          }

          // 3. MAIN GRID MODE
          // Pagination - Comma/Period (Including Chinese)
          if (e.key === ',' || e.key === '，' || e.key === '<') {
              setUsingKeyboard(true);
              handlePrev();
              return;
          }
          if (e.key === '.' || e.key === '。' || e.key === '>') {
              setUsingKeyboard(true);
              handleNext();
              return;
          }

          // Global Shortcut: Space for List
          if (e.code === 'Space') {
              e.preventDefault();
              setUsingKeyboard(true);
              setShowRoundList(true);
              return;
          }

          // Grid Navigation
          const cols = getCols();
          if (e.code === 'ArrowRight') {
              e.preventDefault();
              setUsingKeyboard(true);
              setCursorIndex(prev => (prev + 1) % bubbles.length);
          } else if (e.code === 'ArrowLeft') {
              e.preventDefault();
              setUsingKeyboard(true);
              setCursorIndex(prev => (prev - 1 + bubbles.length) % bubbles.length);
          } else if (e.code === 'ArrowDown') {
              e.preventDefault();
              setUsingKeyboard(true);
              setCursorIndex(prev => Math.min(prev + cols, bubbles.length - 1));
          } else if (e.code === 'ArrowUp') {
              e.preventDefault();
              setUsingKeyboard(true);
              setCursorIndex(prev => Math.max(prev - cols, 0));
          } else if (e.code === 'Enter') {
              e.preventDefault();
              setUsingKeyboard(true);
              // Enter: Select (Swapped back)
              if (bubbles[cursorIndex]) {
                  handleSelect(bubbles[cursorIndex].uid);
              }
          } else if (e.key === 'Shift') {
              e.preventDefault();
              if (e.repeat) return;
              setUsingKeyboard(true);
              // Shift: Inspect (Swapped back)
              if (bubbles[cursorIndex]) {
                  setInspectedId(bubbles[cursorIndex].id);
              }
          }
      };

      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
  }, [bubbles, cursorIndex, inspectedId, inspectedItem, showRoundList, listSelectedIndex, currentRoundItems, onUpdateLevel, handlePrev, handleNext, onExit, handleSelect, isEditingRound]);

  if (filteredData.length === 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-center animate-game-pop-in">
              <h2 className="text-2xl font-bold text-monkey-sub mb-4">No words to match</h2>
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

  return (
    <div 
        className="w-full max-w-[1800px] mx-auto flex flex-col h-full pt-2 md:pt-4 px-2 md:px-6 animate-game-pop-in relative"
        onClick={() => setUsingKeyboard(false)}
    >
      
      {/* Top Bar - Fixed height */}
      <div className="flex justify-between items-center mb-2 md:mb-6 select-none relative z-10 shrink-0 pt-4 md:pt-0">
        {/* Title Container - Adjusted to items-center for vertical alignment */}
        <div className="flex items-center gap-2 relative min-w-0">
            {isEditingRound ? (
                 <div className="flex items-center gap-2">
                     <span className="text-monkey-main font-mono text-xl">Round</span>
                     <input 
                        ref={editInputRef}
                        type="number"
                        min="1"
                        max={totalRounds}
                        value={editRoundInput}
                        onChange={(e) => setEditRoundInput(e.target.value)}
                        onBlur={handleRoundJumpSubmit}
                        onKeyDown={handleRoundInputKeyDown}
                        onClick={(e) => e.stopPropagation()}
                        className="w-16 bg-[#3e4044] border border-monkey-main text-white font-mono text-xl text-center rounded focus:outline-none"
                     />
                     <span className="text-monkey-sub text-base">/ {totalRounds}</span>
                 </div>
            ) : (
                <h2 
                    className="text-xl md:text-2xl font-bold text-monkey-main flex items-center gap-2 whitespace-nowrap cursor-pointer hover:text-white transition-colors"
                    onClick={handleRoundTextClick}
                    title="Click to jump to round"
                >
                    <span className="font-mono">Round {round + 1}</span>
                    <span className="text-monkey-sub text-base">/ {totalRounds}</span>
                </h2>
            )}

            {/* PASSED Badge - Moved higher on mobile (-top-6) */}
            {completedRounds.has(round) && (
                <div className="absolute -top-6 left-0 md:static md:top-auto md:left-auto text-[10px] md:text-xs font-bold bg-green-500/20 text-green-500 px-2 py-0.5 rounded border border-green-500/50 animate-pop-in whitespace-nowrap md:ml-3 md:-translate-y-0.5">
                    PASSED
                </div>
            )}
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
             {/* Filter Toggles */}
             <div className="flex gap-1 md:gap-2">
                {[0, 1, 2, 3].map(l => (
                    <button 
                        key={l} 
                        onClick={(e) => { e.stopPropagation(); toggleFilter(l); }} 
                        className={`w-6 h-6 md:w-8 md:h-8 rounded flex items-center justify-center text-[10px] md:text-sm font-bold transition-all ${activeLevels.has(l) ? 'bg-[#3e4044] text-gray-200 border border-monkey-sub/50' : 'bg-transparent text-monkey-sub border border-monkey-sub/20'}`}
                    >
                        {l}
                    </button>
                ))}
             </div>

             <div className="w-px h-6 bg-monkey-sub/20 mx-0.5 md:mx-1 hidden md:block"></div>

             <div className="flex gap-1 md:gap-2">
                <button
                    onClick={(e) => { e.stopPropagation(); setShowRoundList(true); }}
                    className={`w-7 h-7 md:w-auto md:h-auto p-1 md:p-2 transition-colors flex items-center justify-center ${showRoundList ? 'text-monkey-text bg-monkey-sub/20 rounded' : 'text-monkey-sub hover:text-monkey-main'}`}
                    title="View Round List (4)"
                >
                    <List size={18} className="md:w-5 md:h-5" />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); setResetVersion(v => v + 1); setBubbles([]); onShuffle(); }} 
                    className="w-7 h-7 md:w-auto md:h-auto p-1 md:p-2 text-monkey-sub hover:text-monkey-main transition-colors flex items-center justify-center" 
                    title="Shuffle (5)"
                >
                    <Shuffle size={18} className="md:w-5 md:h-5" />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); setResetVersion(v => v + 1); setBubbles([]); onRestore(); }} 
                    className="w-7 h-7 md:w-auto md:h-auto p-1 md:p-2 text-monkey-sub hover:text-monkey-main transition-colors flex items-center justify-center" 
                    title="Restore Order (6)"
                >
                    <RotateCcw size={18} className="md:w-5 md:h-5" />
                </button>
            </div>
        </div>
      </div>

      {/* Grid Container */}
      <div 
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4 w-full mb-4 overflow-y-auto custom-scrollbar p-4 md:p-6 flex-grow"
        style={{ gridAutoRows: '1fr' }} 
      >
        {bubbles.map((item, index) => {
          const isWord = item.type === 'word';
          
          // WRAPPER DIV: Handles Layout + Entrance Animation
          let outerClass = "relative flex items-center justify-center ";
          
          if (item.status === 'default') {
               outerClass += " animate-pop-in ";
          }
          
          if (item.status === 'selected' || (usingKeyboard && index === cursorIndex)) {
            outerClass += " z-50 ";
          } else {
            outerClass += " z-10 ";
          }

          // INNER DIV: Handles Visuals + Interaction Transforms
          let innerClass = "w-full h-full flex items-center justify-center text-center shadow-sm rounded-xl border-2 cursor-pointer select-none ";
          innerClass += " transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.4)] "; // Snappy spring -> Slower
          innerClass += " p-2 "; // Reduced internal padding

          // State Styles
          if (item.status === 'selected') {
            // SELECTED: Yellow Background, Dark Text, Magnified 1.05x
            innerClass += " bg-monkey-main border-monkey-main text-[#323437] scale-105 shadow-2xl origin-center ";
          } else if (item.status === 'wrong') {
            // WRONG: Red Shake
            innerClass += " bg-monkey-error/10 border-monkey-error text-monkey-error animate-shake "; 
          } else if (item.status === 'recovering') {
             // RECOVERING (Deprecated visually, but kept for type safety)
             innerClass += " bg-[#2c2e31] border-monkey-sub/20 text-monkey-sub ";
          } else if (item.status === 'success') {
            // MATCHED - Animation handles opacity fade to ghost
            innerClass += " animate-merge-success "; 
          } else {
             // DEFAULT
             innerClass += " bg-[#2c2e31] border-monkey-sub/20 hover:border-monkey-sub/50 active:scale-95 ";
             if (isWord) {
                innerClass += " text-monkey-main "; 
             } else {
                innerClass += " text-monkey-text ";
             }
          }

          // Keyboard Highlighting (Ring) - UPDATED: Thinner ring
          if (usingKeyboard && index === cursorIndex) {
              innerClass += " ring-2 ring-monkey-main ring-offset-2 ring-offset-[#323437] ";
          }

          // Typography
          if (isWord) {
             // Dynamic Sizing for Words + No Wrap
             innerClass += ` font-black tracking-wide whitespace-nowrap ${getWordFontSize(item.text)} `; 
          } else {
             innerClass += " text-sm md:text-lg font-bold leading-snug ";
          }

          return (
            <div
              key={item.uid}
              className={outerClass}
              // Only apply stagger delay if we are in the initial loading phase of the round
              style={item.status === 'default' && isRoundLoading ? { animationDelay: `${index * 30}ms` } : {}}
              onClick={(e) => {
                  e.stopPropagation();
                  setCursorIndex(index);
                  // setUsingKeyboard(true); // Removed to prevent keyboard ring on mouse click
                  handleSelect(item.uid);
              }}
              onTouchStart={() => handleTouchStart(item.id)}
              onTouchEnd={handleTouchEnd}
              onMouseDown={() => handleTouchStart(item.id)}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
            >
              {/* Content Wrapper */}
              <div className={innerClass}>
                <span className={`break-words max-w-full pointer-events-none px-1`}>
                    {item.text}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Navigation */}
      <div className="w-full flex justify-between mt-auto mb-4 z-10 shrink-0">
          <button 
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            disabled={round === 0}
            className="flex items-center gap-2 px-4 py-3 md:px-6 rounded text-monkey-sub hover:text-monkey-main hover:bg-monkey-sub/10 disabled:opacity-30 transition-colors select-none"
          >
              <ArrowLeft size={20} /> <span className="hidden md:inline">Prev</span>
          </button>

          <div></div>

          <button 
                onClick={(e) => { e.stopPropagation(); handleNext(); }}
                disabled={round === totalRounds - 1}
                className="flex items-center gap-2 px-4 py-3 md:px-6 rounded text-monkey-sub hover:text-monkey-main hover:bg-monkey-sub/10 disabled:opacity-30 transition-colors select-none"
            >
                <span className="hidden md:inline">Next</span> <ArrowRight size={20} />
            </button>
      </div>

      {/* Inspector Overlay */}
      {inspectedId && inspectedItem && createPortal(
          <div 
             className={`fixed inset-0 z-[9999] flex items-center justify-center flex-col transition-opacity duration-300 ${isClosingInspector ? 'opacity-0' : 'opacity-100'}`}
          >
             {/* Backdrop Wrapper for opacity fade */}
             <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isClosingInspector ? 'opacity-0' : 'opacity-100'}`} onClick={handleCloseInspector}></div>

              {/* Content Card */}
              <div 
                className={`relative bg-[#2c2e31] rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl transform flex flex-col items-center text-center z-10 ${isClosingInspector ? 'animate-spring-out' : 'animate-spring-in'}`}
                onClick={(e) => e.stopPropagation()}
              >
                  <button 
                    onClick={handleCloseInspector}
                    className="absolute top-4 right-4 text-monkey-sub hover:text-monkey-text"
                  >
                      <X size={24} />
                  </button>

                  <div className="text-xs text-monkey-sub uppercase tracking-widest mb-2">Word Card</div>
                  <h2 className="text-4xl font-bold text-monkey-main mb-6 select-text">{inspectedItem.word}</h2>
                  <p className="text-xl text-gray-200 mb-8 leading-relaxed font-medium select-text">{inspectedItem.definition}</p>

                  <div 
                    className="flex gap-4 p-2 cursor-ew-resize touch-none"
                    onTouchStart={handleLightTouchStart}
                    onTouchMove={(e) => handleLightTouchMove(e, inspectedItem)}
                    onTouchEnd={handleLightTouchEnd}
                  >
                        {[1, 2, 3].map(l => (
                            <div 
                                key={l}
                                onClick={(e) => handleLevelClick(e, inspectedItem.id, l)}
                                className={`w-5 h-5 rounded-full border border-monkey-sub/50 cursor-pointer transition-transform ${inspectedItem.level >= l ? (inspectedItem.level === 3 ? 'bg-green-500 border-green-500' : 'bg-monkey-main border-monkey-main') : 'bg-transparent'}`}
                            ></div>
                        ))}
                  </div>
                  <div className="mt-4 text-[10px] text-monkey-sub/50">Swipe lights or use Arrow keys to grade</div>
              </div>
          </div>,
          document.body
      )}

      {/* Round List Modal */}
      {showRoundList && createPortal(
          <div 
             className={`fixed inset-0 z-[9999] flex items-center justify-center flex-col transition-opacity duration-300 ${isClosingList ? 'opacity-0' : 'opacity-100'}`}
          >
             {/* Backdrop Wrapper for opacity fade */}
             <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isClosingList ? 'opacity-0' : 'opacity-100'}`} onClick={handleCloseList}></div>

              {/* Content Card */}
              <div 
                className={`relative bg-[#2c2e31] border border-monkey-sub/30 rounded-xl max-w-lg w-full mx-4 shadow-2xl flex flex-col max-h-[80vh] z-10 ${isClosingList ? 'animate-spring-out' : 'animate-spring-in'}`}
                onClick={(e) => e.stopPropagation()}
              >
                  <div className="flex justify-between items-center p-4 border-b border-monkey-sub/20 bg-[#2c2e31] rounded-t-xl">
                      <h3 className="font-bold text-monkey-text">Current Round Words</h3>
                      <button onClick={handleCloseList} className="text-monkey-sub hover:text-monkey-text">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="overflow-y-auto custom-scrollbar p-2">
                      {currentRoundItems.map((item, idx) => (
                          <div 
                            id={`round-list-item-${idx}`}
                            key={item.id} 
                            onClick={(e) => {
                                e.stopPropagation();
                                setListSelectedIndex(idx);
                                setUsingKeyboard(true);
                            }}
                            className={`flex justify-between items-center p-3 rounded mb-1 transition-colors cursor-pointer ${usingKeyboard && idx === listSelectedIndex ? 'bg-monkey-main/10 border border-monkey-main/30' : 'hover:bg-[#323437] border border-transparent'}`}
                          >
                              <div className="flex-1 mr-4">
                                  <div className="font-bold text-monkey-main text-lg select-text">{item.word}</div>
                                  <div className="text-sm text-monkey-sub truncate font-medium select-text">{item.definition}</div>
                              </div>
                              
                              <div 
                                className="flex gap-1.5 p-2 cursor-ew-resize touch-none"
                                onTouchStart={handleLightTouchStart}
                                onTouchMove={(e) => handleLightTouchMove(e, item)}
                                onTouchEnd={handleLightTouchEnd}
                              >
                                    {[1, 2, 3].map(l => (
                                        <div 
                                            key={l}
                                            onClick={(e) => handleLevelClick(e, item.id, l)}
                                            className={`w-3 h-3 rounded-full border border-monkey-sub/50 cursor-pointer ${item.level >= l ? (item.level === 3 ? 'bg-green-500 border-green-500' : 'bg-monkey-main border-monkey-main') : 'bg-transparent'}`}
                                        ></div>
                                    ))}
                              </div>
                          </div>
                      ))}
                  </div>

                  <div className="p-3 border-t border-monkey-sub/20 bg-[#2c2e31] rounded-b-xl text-center text-[10px] text-monkey-sub/50">
                      Use ↑/↓ to navigate, ←/→ to grade
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* Keyboard Legend - Hidden on Mobile (Fix 2) */}
      <div className="mt-2 text-[10px] text-monkey-sub/30 gap-4 pointer-events-none pb-4 md:pb-0 overflow-x-auto whitespace-nowrap shrink-0 hidden md:flex">
          <span>Arrows: Move</span>
          <span>Enter: Select</span>
          <span>Shift: Inspect</span>
          <span>, / .: Page</span>
          <span>Space: List</span>
          <span>Esc: Exit</span>
      </div>
    </div>
  );
};