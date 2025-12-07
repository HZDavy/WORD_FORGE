
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { VocabularyItem } from '../types';
import { Shuffle, RotateCcw, X, ArrowLeft, ArrowRight, List } from 'lucide-react';

interface Props {
  data: VocabularyItem[];
  initialRound?: number;
  onExit: () => void;
  onShuffle: () => void;
  onRestore: () => void;
  onSaveProgress: (round: number) => void;
  onUpdateLevel: (id: string, level: number) => void;
}

interface Bubble {
  id: string; 
  uid: string; 
  text: string;
  type: 'word' | 'def';
  matched: boolean;
  status: 'default' | 'selected' | 'wrong' | 'success';
}

const ITEMS_PER_ROUND = 6; 

export const MatchingMode: React.FC<Props> = ({ data, initialRound = 0, onExit, onShuffle, onRestore, onSaveProgress, onUpdateLevel }) => {
  // Filter Logic
  const [activeLevels, setActiveLevels] = useState<Set<number>>(new Set([0, 1, 2, 3]));
  
  const filteredData = useMemo(() => {
    return data.filter(item => activeLevels.has(item.level));
  }, [data, activeLevels]);

  const [round, setRound] = useState(initialRound);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isWait, setIsWait] = useState(false);
  
  // Track completed rounds in this session to show stamps
  const [completedRounds, setCompletedRounds] = useState<Set<number>>(new Set());

  // Force refresh for shuffle/restore
  const [resetVersion, setResetVersion] = useState(0);
  
  // Inspection State - Store ID instead of Object to allow reactive updates
  const [inspectedId, setInspectedId] = useState<string | null>(null);
  const longPressTimer = useRef<number | null>(null);
  
  // Round List Modal State
  const [showRoundList, setShowRoundList] = useState(false);
  const [listSelectedIndex, setListSelectedIndex] = useState(0);
  
  // Gesture State for Traffic Lights in Inspector/List
  const lightStartX = useRef<number | null>(null);
  const lastLightUpdateX = useRef<number | null>(null);

  const totalRounds = Math.ceil(filteredData.length / ITEMS_PER_ROUND);

  // Derive inspectedItem from LIVE data to ensure level updates are reflected immediately
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

  useEffect(() => {
    onSaveProgress(round);
  }, [round, onSaveProgress]);

  // Adjust round if filtered data shrinks
  useEffect(() => {
      if (round >= totalRounds && totalRounds > 0) {
          setRound(0);
      }
  }, [totalRounds, round]);

  const restart = () => {
      setRound(0);
      setSelectedId(null);
      setCompletedRounds(new Set());
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
        setSelectedId(null);
    }
  }, [round, totalRounds]);

  const handlePrev = useCallback(() => {
      if (round > 0) {
          setRound(r => r - 1);
          setSelectedId(null);
      }
  }, [round]);

  // Scroll selected item into view in list mode
  useEffect(() => {
      if (showRoundList) {
          const el = document.getElementById(`round-list-item-${listSelectedIndex}`);
          if (el) {
              el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
      }
  }, [listSelectedIndex, showRoundList]);

  // Reset selection when list opens
  useEffect(() => {
      if (showRoundList) {
          setListSelectedIndex(0);
      }
  }, [showRoundList]);

  // Only regenerate bubbles when ROUND, FILTER, or RESET VERSION changes. 
  useEffect(() => {
    if (filteredData.length === 0) return;

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
      if (defText.length > 55) {
          defText = defText.substring(0, 52) + '...';
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
    setSelectedId(null);
  }, [round, activeLevels, resetVersion]); 

  const handleSelect = useCallback((uid: string) => {
    if (isWait || inspectedId || showRoundList) return;
    
    const clicked = bubbles.find(b => b.uid === uid);
    if (!clicked || clicked.matched) return;

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
      setBubbles(prev => prev.map(b => 
        (b.uid === first.uid || b.uid === clicked.uid) 
          ? { ...b, status: 'success', matched: true } 
          : b
      ));
      setSelectedId(null);

      const remaining = bubbles.filter(b => !b.matched && b.id !== clicked.id).length;
      if (remaining === 0) {
        // Mark current round as complete
        setCompletedRounds(prev => new Set(prev).add(round));

        setTimeout(() => {
          if (round < totalRounds - 1) {
            setRound(r => r + 1);
          }
        }, 1000); 
      }
    } else {
      setIsWait(true);
      setBubbles(prev => prev.map(b => 
        (b.uid === first.uid || b.uid === clicked.uid) 
          ? { ...b, status: 'wrong' } 
          : b
      ));

      setTimeout(() => {
        setBubbles(prev => prev.map(b => 
          (b.uid === first.uid || b.uid === clicked.uid) 
            ? { ...b, status: 'default' } 
            : b
        ));
        setSelectedId(null);
        setIsWait(false);
      }, 800);
    }
  }, [bubbles, selectedId, isWait, round, totalRounds, inspectedId, showRoundList]);

  // --- Long Press & Inspection Logic ---
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

  // --- Traffic Light Logic (Shared for Inspector & List) ---
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
              // Right
              if (item.level < 3) {
                  onUpdateLevel(item.id, item.level + 1);
                  lastLightUpdateX.current = currentX;
              }
          } else {
              // Left
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


  useEffect(() => {
      const handleKey = (e: KeyboardEvent) => {
          if (e.code === 'Escape') {
              if (inspectedId) setInspectedId(null);
              else if (showRoundList) setShowRoundList(false);
              else onExit();
          }

          if (e.code === 'Space') {
              e.preventDefault();
              if (!inspectedId) {
                  setShowRoundList(prev => !prev);
              }
          }
          
          if (inspectedItem) {
              if (e.code === 'ArrowUp') {
                 e.preventDefault();
                 if (inspectedItem.level < 3) onUpdateLevel(inspectedItem.id, inspectedItem.level + 1);
              } else if (e.code === 'ArrowDown') {
                 e.preventDefault();
                 if (inspectedItem.level > 0) onUpdateLevel(inspectedItem.id, inspectedItem.level - 1);
              }
          } else if (showRoundList) {
               // LIST MODE KEYBOARD CONTROLS
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
              }
          } else {
              // Navigation controls when not inspecting and not in list mode
              if (e.code === 'ArrowLeft') {
                  handlePrev();
              } else if (e.code === 'ArrowRight') {
                  handleNext();
              }
          }
      }
      window.addEventListener('keydown', handleKey);
      return () => window.removeEventListener('keydown', handleKey);
  }, [onExit, inspectedId, inspectedItem, onUpdateLevel, handlePrev, handleNext, showRoundList, currentRoundItems, listSelectedIndex]);


  if (filteredData.length === 0) {
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

  if (round >= totalRounds && totalRounds > 0) {
      return (
          <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in-up">
              <h2 className="text-4xl font-bold text-monkey-main mb-4">全通关!</h2>
              <p className="mb-8 text-monkey-text">所有词汇配对完成。</p>
              <button onClick={onExit} className="px-6 py-2 border border-monkey-main text-monkey-main hover:bg-monkey-main hover:text-monkey-bg transition font-bold">Back to Menu</button>
          </div>
      )
  }

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col items-center h-full pt-6 animate-game-pop-in">
      <div className="flex justify-between w-full mb-2 border-b border-monkey-sub/20 pb-2 px-4 items-center">
        <div className="flex flex-col gap-1">
            <div className="flex items-center">
                <span className="text-monkey-main font-bold font-mono text-lg">Round {round + 1} / {totalRounds}</span>
                <span className="text-monkey-sub text-sm font-mono ml-4 hidden sm:inline">Select matching pairs</span>
                {completedRounds.has(round) && (
                    <span className="ml-3 border border-monkey-main text-monkey-main px-1.5 py-0.5 text-[10px] md:text-xs rounded font-bold animate-game-pop-in select-none bg-monkey-main/10 transform -rotate-6">
                        PASSED
                    </span>
                )}
            </div>
            {/* Filters */}
            <div className="flex gap-1 mt-1">
                {[0, 1, 2, 3].map(level => {
                    const isActive = activeLevels.has(level);
                    return (
                        <button 
                            key={level} 
                            onClick={() => toggleFilter(level)}
                            className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-all ${
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
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => setShowRoundList(true)}
                className={`p-2 transition-colors ${showRoundList ? 'text-monkey-text bg-monkey-sub/20 rounded' : 'text-monkey-sub hover:text-monkey-main'}`}
                title="View Round List (Space)"
            >
                <List size={18} />
            </button>
            <div className="w-px h-8 bg-monkey-sub/20 mx-1"></div>
            <button onClick={() => { restart(); onShuffle(); setResetVersion(v => v + 1); }} className="p-2 text-monkey-sub hover:text-monkey-main transition-colors" title="Shuffle"><Shuffle size={18} /></button>
            <button onClick={() => { restart(); onRestore(); setResetVersion(v => v + 1); }} className="p-2 text-monkey-sub hover:text-monkey-main transition-colors" title="Restore Order"><RotateCcw size={18} /></button>
        </div>
      </div>

      <div className="relative flex-grow w-full flex flex-col">
          <div className="flex flex-wrap gap-2 md:gap-4 justify-center content-start flex-grow pb-2 pt-2 px-2 md:px-4 overflow-y-auto relative z-10">
            {bubbles.map((b, idx) => {
            const isWord = b.type === 'word';
            let wrapperClass = "relative flex items-center justify-center animate-pop-in max-w-full ";
            
            if (b.status === 'selected' || b.status === 'wrong' || b.status === 'success') {
                wrapperClass += "z-50 ";
            } else {
                wrapperClass += "z-0 ";
            }
            
            if (b.status === 'wrong') {
                wrapperClass += "animate-shake ";
            }
            
            let innerClass = "flex items-center justify-center text-center rounded-lg border-2 cursor-pointer transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] select-none w-full h-full ";
            
            innerClass += "px-4 py-3 md:px-5 md:py-4 ";
            if (isWord) {
                innerClass += "text-base md:text-xl font-bold ";
            } else {
                innerClass += "text-sm md:text-base font-normal leading-relaxed ";
            }

            if (b.status === 'default') {
                innerClass += "scale-100 ";
                if (isWord) {
                    innerClass += "border-monkey-sub/30 text-monkey-main hover:border-monkey-main hover:bg-monkey-bg/50 bg-[#252628] ";
                } else {
                    innerClass += "border-monkey-sub/30 text-gray-200 hover:border-white hover:text-white bg-[#3e4044] ";
                }
            } else if (b.status === 'selected') {
                innerClass += "scale-110 border-monkey-main bg-monkey-main text-monkey-bg ";
            } else if (b.status === 'wrong') {
                innerClass += "scale-110 border-monkey-error bg-monkey-error text-white ";
            } else if (b.status === 'success') {
                innerClass += "animate-merge-success pointer-events-none "; 
            }

            return (
                <div
                key={b.uid}
                onClick={() => handleSelect(b.uid)}
                onTouchStart={() => handleTouchStart(b.id)}
                onTouchEnd={handleTouchEnd}
                onMouseDown={() => handleTouchStart(b.id)}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                className={wrapperClass}
                style={{ 
                    animationDelay: b.status === 'default' ? `${idx * 40}ms` : '0ms'
                }}
                >
                    <div className={innerClass}>
                        {b.text}
                    </div>
                </div>
            )
            })}
          </div>
      </div>

       {/* Navigation Controls */}
      <div className="w-full flex justify-between mt-auto mb-4 px-4 z-20">
          <button 
            onClick={handlePrev} 
            disabled={round === 0}
            className="flex items-center gap-2 px-4 py-3 md:px-6 rounded text-monkey-sub hover:text-monkey-main hover:bg-monkey-sub/10 disabled:opacity-30 transition-colors select-none"
          >
              <ArrowLeft size={20} /> <span className="hidden md:inline">Prev</span>
          </button>

          <button 
                onClick={handleNext}
                disabled={round === totalRounds - 1 && !completedRounds.has(round)} // Only disable if on last round AND not completed. If completed, allow navigation (or finish)
                className={`flex items-center gap-2 px-4 py-3 md:px-6 rounded transition-colors select-none ${round === totalRounds - 1 && completedRounds.has(round) ? 'bg-monkey-main text-monkey-bg font-bold hover:opacity-90' : 'text-monkey-sub hover:text-monkey-main hover:bg-monkey-sub/10 disabled:opacity-30'}`}
            >
                {round === totalRounds - 1 && completedRounds.has(round) ? (
                     <span onClick={onExit}>Finish</span>
                ) : (
                    <>
                    <span className="hidden md:inline">Next</span> <ArrowRight size={20} />
                    </>
                )}
            </button>
      </div>

      {/* INSPECTOR MODAL */}
      {inspectedItem && createPortal(
          <div 
             className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
             onClick={() => setInspectedId(null)}
          >
              <div 
                 className="bg-[#2c2e31] border border-monkey-sub/30 rounded-xl p-8 max-w-md w-full mx-4 relative animate-game-pop-in flex flex-col items-center"
                 onClick={(e) => e.stopPropagation()}
              >
                  <button 
                    onClick={() => setInspectedId(null)}
                    className="absolute top-4 right-4 text-monkey-sub hover:text-monkey-text"
                  >
                      <X size={24} />
                  </button>

                  {/* Traffic Lights */}
                  <div 
                    className="flex gap-2 mb-6 p-4 cursor-ew-resize touch-none"
                    onTouchStart={handleLightTouchStart}
                    onTouchMove={(e) => handleLightTouchMove(e, inspectedItem)}
                    onTouchEnd={handleLightTouchEnd}
                  >
                      {[1, 2, 3].map(l => (
                            <div 
                            key={l}
                            onClick={(e) => handleLevelClick(e, inspectedItem.id, l)}
                            className={`w-6 h-6 rounded-full border-2 border-monkey-sub/50 cursor-pointer transition-transform ${inspectedItem.level >= l ? (inspectedItem.level === 3 ? 'bg-green-500 border-green-500' : 'bg-monkey-main border-monkey-main') : 'bg-transparent'}`}
                            ></div>
                        ))}
                  </div>

                  <h2 className="text-4xl font-bold text-monkey-main mb-4 text-center">{inspectedItem.word}</h2>
                  <p className="text-lg text-gray-200 text-center leading-relaxed">{inspectedItem.definition}</p>
                  
                  <div className="mt-8 text-xs text-monkey-sub/40 font-mono">
                      Swipe lights or use ↑/↓ arrows to grade
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* ROUND LIST MODAL */}
      {showRoundList && createPortal(
          <div 
             className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
             onClick={() => setShowRoundList(false)}
          >
              <div 
                 className="bg-[#2c2e31] border border-monkey-sub/30 rounded-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh] animate-game-pop-in shadow-2xl"
                 onClick={(e) => e.stopPropagation()}
              >
                  {/* Header */}
                  <div className="flex justify-between items-center p-4 border-b border-monkey-sub/20 bg-[#2c2e31] rounded-t-xl">
                      <h3 className="text-xl font-bold text-monkey-text">Round {round + 1} Words</h3>
                      <button 
                        onClick={() => setShowRoundList(false)}
                        className="p-1 text-monkey-sub hover:text-monkey-text rounded-lg hover:bg-monkey-sub/10 transition-colors"
                      >
                          <X size={20} />
                      </button>
                  </div>

                  {/* Scrollable List */}
                  <div className="overflow-y-auto p-4 flex flex-col gap-2 custom-scrollbar">
                      {currentRoundItems.map((item, idx) => (
                          <div 
                            key={item.id} 
                            id={`round-list-item-${idx}`}
                            onClick={() => setListSelectedIndex(idx)}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${idx === listSelectedIndex ? 'bg-monkey-main/10 border-monkey-main ring-1 ring-monkey-main/20' : 'bg-[#323437] border-monkey-sub/10 hover:border-monkey-sub/30'}`}
                          >
                              {/* Word Info */}
                              <div className="flex-1 min-w-0">
                                  <div className={`text-lg font-bold truncate ${idx === listSelectedIndex ? 'text-monkey-main' : 'text-monkey-text'}`}>{item.word}</div>
                                  <div className="text-sm text-monkey-sub leading-snug">{item.definition}</div>
                              </div>

                              {/* Traffic Lights */}
                              <div 
                                className="flex gap-1 p-2 -m-2 cursor-ew-resize touch-none select-none flex-shrink-0"
                                onTouchStart={handleLightTouchStart}
                                onTouchMove={(e) => handleLightTouchMove(e, item)}
                                onTouchEnd={handleLightTouchEnd}
                              >
                                  {[1, 2, 3].map(l => (
                                      <div 
                                          key={l}
                                          onClick={(e) => handleLevelClick(e, item.id, item.level === l ? l - 1 : l)}
                                          className={`w-3 h-3 rounded-full border border-monkey-sub/50 cursor-pointer transition-transform active:scale-90 ${item.level >= l ? (item.level === 3 ? 'bg-green-500 border-green-500' : 'bg-monkey-main border-monkey-main') : 'bg-transparent'}`}
                                      ></div>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </div>
                  
                  <div className="p-3 border-t border-monkey-sub/10 bg-[#2c2e31] rounded-b-xl text-[10px] text-monkey-sub/40 font-mono flex justify-between px-4">
                      <span>↑/↓: Nav</span>
                      <span>←/→: Level</span>
                      <span>Space: Close</span>
                  </div>
              </div>
          </div>,
          document.body
      )}
      
      {/* Keyboard Legend */}
      <div className="mb-2 text-[10px] text-monkey-sub/30 hidden md:block">
          <span>Long Press: Inspect</span>
          <span>Space: Word List</span>
          <span>←/→: Prev/Next</span>
          <span>Esc: Exit</span>
      </div>
    </div>
  );
};
