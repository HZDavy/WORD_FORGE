import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, RotateCcw, Timer, Watch, Coffee, X } from 'lucide-react';

type TimerMode = 'STOPWATCH' | 'TIMER' | 'POMODORO';
type PomoState = 'STUDY' | 'REST';

const formatTime = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

export const TimerWidget: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const [mode, setMode] = useState<TimerMode>('STOPWATCH');
  const [isRunning, setIsRunning] = useState(false);
  
  // Stopwatch
  const [stopwatchTime, setStopwatchTime] = useState(0);

  // Timer
  const [timerDuration, setTimerDuration] = useState(5 * 60 * 1000); 
  const [timerRemaining, setTimerRemaining] = useState(5 * 60 * 1000);
  
  // Pomodoro
  const [pomoStudyTime, setPomoStudyTime] = useState(25 * 60 * 1000);
  const [pomoRestTime, setPomoRestTime] = useState(5 * 60 * 1000);
  const [pomoState, setPomoState] = useState<PomoState>('STUDY');
  const [pomoRemaining, setPomoRemaining] = useState(25 * 60 * 1000);
  
  // Editing State
  const [pomoEditTarget, setPomoEditTarget] = useState<PomoState>('STUDY');

  // Alarm
  const [isAlarming, setIsAlarming] = useState(false);

  // Interval
  const intervalRef = useRef<number | null>(null);

  // Dial State
  const containerRef = useRef<HTMLDivElement>(null);
  const lastAngleRef = useRef<number | null>(null);
  const angleAccumulatorRef = useRef(0); 
  const [dialVisualRotation, setDialVisualRotation] = useState(0);

  // Handle open/close with animations
  useEffect(() => {
    if (isOpen) {
        setIsVisible(true);
        setIsClosing(false);
    } else {
        setIsClosing(true);
        const timer = setTimeout(() => {
            setIsVisible(false);
            setIsClosing(false);
        }, 400); // Match spring-out duration
        return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // --- Timer Logic ---
  useEffect(() => {
    if (isRunning) {
      const startTime = Date.now();
      const initialStopwatch = stopwatchTime;
      const initialTimer = timerRemaining;
      const initialPomo = pomoRemaining;

      intervalRef.current = window.setInterval(() => {
        const delta = Date.now() - startTime;

        if (mode === 'STOPWATCH') {
          setStopwatchTime(initialStopwatch + delta);
        } else if (mode === 'TIMER') {
          const next = initialTimer - delta;
          if (next <= 0) {
            setTimerRemaining(0);
            setIsRunning(false);
            triggerAlarm();
          } else {
            setTimerRemaining(next);
          }
        } else if (mode === 'POMODORO') {
          const next = initialPomo - delta;
          if (next <= 0) {
            triggerAlarm();
            // Auto Loop Logic
            const nextState = pomoState === 'STUDY' ? 'REST' : 'STUDY';
            setPomoState(nextState);
            setPomoEditTarget(nextState); // Update UI to show current state
            setPomoRemaining(nextState === 'STUDY' ? pomoStudyTime : pomoRestTime);
          } else {
            setPomoRemaining(next);
          }
        }
      }, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, mode, pomoState, pomoStudyTime, pomoRestTime]);

  const triggerAlarm = () => {
    setIsAlarming(true);
    setTimeout(() => setIsAlarming(false), 5000);
  };

  const handleReset = () => {
      setIsRunning(false);
      setIsAlarming(false);
      if (mode === 'STOPWATCH') {
          setStopwatchTime(0);
      } else if (mode === 'TIMER') {
          setTimerRemaining(timerDuration);
      } else if (mode === 'POMODORO') {
          setPomoState('STUDY');
          setPomoEditTarget('STUDY');
          setPomoRemaining(pomoStudyTime);
      }
  };

  const handlePomoSwitch = (target: PomoState) => {
      setPomoEditTarget(target);
      if (!isRunning) {
          setPomoState(target);
          setPomoRemaining(target === 'STUDY' ? pomoStudyTime : pomoRestTime);
      }
  }

  // --- Rotary Dial Logic ---
  const calculateAngle = (clientX: number, clientY: number) => {
      if (!containerRef.current) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      
      // Center is the Top-Right corner of the screen/container
      const cx = rect.right;
      const cy = rect.top;

      const x = clientX - cx;
      const y = clientY - cy;
      
      // Calculate angle in degrees
      return Math.atan2(y, x) * (180 / Math.PI);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isRunning) return;
    e.preventDefault();
    e.stopPropagation(); 
    
    // Set capture to track dragging even if pointer leaves element
    try {
        (e.target as Element).setPointerCapture(e.pointerId);
    } catch (err) {
        // ignore
    }
    
    lastAngleRef.current = calculateAngle(e.clientX, e.clientY);
    angleAccumulatorRef.current = 0; // Reset accumulator on new drag
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (lastAngleRef.current === null || isRunning) return;
    
    const currentAngle = calculateAngle(e.clientX, e.clientY);
    
    let delta = currentAngle - lastAngleRef.current;
    
    // Handle wrapping
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    // Visual rotation updates immediately
    setDialVisualRotation(prev => prev + delta);
    lastAngleRef.current = currentAngle;

    // Physics & Accumulation
    angleAccumulatorRef.current += delta;

    // Dynamic Speed Logic
    // If delta is large (fast spin), we treat each tick as a Minute
    // If delta is small (slow spin), we treat each tick as a Second
    const rotationSpeed = Math.abs(delta);
    const isFastSpin = rotationSpeed > 10; // Threshold for "Fast" (degrees per event)
    
    const TICK_THRESHOLD = 5; // Degrees per tick

    if (Math.abs(angleAccumulatorRef.current) >= TICK_THRESHOLD) {
        const steps = Math.trunc(angleAccumulatorRef.current / TICK_THRESHOLD);
        
        // Determine unit: 1 minute if fast, 1 second if slow
        const msPerTick = isFastSpin ? 60000 : 1000;
        
        const timeChange = steps * msPerTick;
        
        // Remove consumed angle from accumulator
        angleAccumulatorRef.current -= (steps * TICK_THRESHOLD);

        if (mode === 'TIMER') {
            setTimerDuration(prev => {
                const next = Math.max(0, prev + timeChange);
                setTimerRemaining(next);
                return next;
            });
        } else if (mode === 'POMODORO') {
            if (pomoEditTarget === 'STUDY') {
                setPomoStudyTime(prev => {
                    const next = Math.max(60000, prev + timeChange);
                    if (pomoState === 'STUDY') setPomoRemaining(next);
                    return next;
                });
            } else {
                setPomoRestTime(prev => {
                    const next = Math.max(60000, prev + timeChange);
                    if (pomoState === 'REST') setPomoRemaining(next);
                    return next;
                });
            }
        }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
        if ((e.target as Element).hasPointerCapture(e.pointerId)) {
            (e.target as Element).releasePointerCapture(e.pointerId);
        }
    } catch (err) {
        // ignore
    }
    lastAngleRef.current = null;
    angleAccumulatorRef.current = 0;
  };


  // --- Display Helpers ---
  const getDisplayTime = () => {
    if (mode === 'STOPWATCH') return formatTime(stopwatchTime);
    if (mode === 'TIMER') return formatTime(timerRemaining);
    if (mode === 'POMODORO') return formatTime(pomoRemaining);
    return "00:00";
  };

  const getDialLabel = () => {
      if (mode === 'STOPWATCH') return "CHRONO";
      if (mode === 'TIMER') return "TIMER";
      if (mode === 'POMODORO') return `POMO · ${pomoEditTarget}`;
      return "";
  }

  // Ticks Generation for SVG
  const ticks = useMemo(() => {
    const items = [];
    const radius = 320; 
    const startAngle = 90; 
    const endAngle = 180; 
    const totalTicks = 60;
    
    for (let i = 0; i <= totalTicks; i++) {
        const pct = i / totalTicks;
        const angleDeg = startAngle + pct * (endAngle - startAngle);
        const angleRad = (angleDeg * Math.PI) / 180;
        
        const isMajor = i % 5 === 0;
        const len = isMajor ? 20 : 10;
        
        const cx = 400;
        const cy = 0;
        
        const x1 = cx + (radius - len) * Math.cos(angleRad);
        const y1 = cy + (radius - len) * Math.sin(angleRad);
        const x2 = cx + radius * Math.cos(angleRad);
        const y2 = cy + radius * Math.sin(angleRad);
        
        items.push(
            <line 
                key={i} 
                x1={x1} y1={y1} x2={x2} y2={y2} 
                stroke={isMajor ? "#e2b714" : "#646669"} 
                strokeWidth={isMajor ? 2 : 1} 
                opacity={0.6}
            />
        );
    }
    return items;
  }, []);

  return (
    <>
      {/* Trigger Button - Top Right */}
      <button 
        onClick={() => { setIsOpen(true); setIsAlarming(false); }}
        className={`bg-monkey-sub/10 px-4 py-2 rounded-lg border border-monkey-sub/20 font-mono font-bold flex items-center gap-2 hover:bg-monkey-sub/20 transition-all z-40 ${isAlarming ? 'animate-pulse text-red-500 border-red-500' : 'text-monkey-text'} ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
         {mode === 'POMODORO' && (
            <span className={`text-[10px] uppercase font-bold mr-1 ${pomoState === 'STUDY' ? 'text-monkey-main' : 'text-blue-400'}`}>
                {pomoState === 'STUDY' ? 'Focus' : 'Rest'}
            </span>
        )}
        <span className="text-lg">{getDisplayTime()}</span>
      </button>

      {/* Full Screen Overlay for Interaction (Portaled to Body) */}
      {isVisible && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-hidden touch-none" style={{ touchAction: 'none' }}>
            {/* Backdrop */}
            <div className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`} onClick={() => setIsOpen(false)}></div>
            
            {/* Quarter Circle Menu - Top Right Fixed */}
            <div 
                ref={containerRef}
                className={`absolute top-0 right-0 w-[420px] h-[420px] max-w-[95vw] max-h-[95vw] bg-[#2c2e31] border-l-4 border-b-4 border-monkey-main rounded-bl-[100%] origin-top-right flex items-end justify-start overflow-hidden select-none touch-none ${isClosing ? 'animate-spring-out' : 'animate-spring-in'}`}
                style={{ touchAction: 'none' }}
            >
                {/* --- The Radio Dial (SVG) --- */}
                <svg 
                    className={`absolute inset-0 w-full h-full z-10 touch-none ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-ew-resize active:cursor-grabbing'}`}
                    viewBox="0 0 400 400"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    style={{ touchAction: 'none' }} // CRITICAL: prevents browser scrolling
                >
                    {/* Dial Background Area */}
                    <path d="M 400,0 L 400,400 A 400,400 0 0 1 0,0 Z" fill="#2c2e31" />
                    
                    {/* The Ticks Track */}
                    <g>{ticks}</g>
                    
                    {/* Tuner Indicator Line (Static Ref) */}
                    <line x1="400" y1="0" x2="117" y2="283" stroke="#e2b714" strokeWidth="2" strokeDasharray="4 4" className="opacity-30" />

                    {/* Arrow Pointer Logic */}
                    <g transform="translate(117, 283) rotate(-45)">
                        <path 
                            d="M -6,-8 L 6,0 L -6,8 Z" 
                            fill="#e2b714" 
                            stroke="#e2b714"
                            strokeWidth="2"
                        />
                    </g>
                    
                    {/* Interactive Wheel Texture (Rotating) */}
                    <g transform={`rotate(${dialVisualRotation}, 400, 0)`} style={{ transition: lastAngleRef.current ? 'none' : 'transform 0.5s ease-out' }}>
                        {/* Denser dashed line for visual feedback */}
                        <circle cx="400" cy="0" r="280" fill="none" stroke="#3e4044" strokeWidth="1" strokeDasharray="2 3" opacity="0.5" />
                        <circle cx="400" cy="0" r="340" fill="none" stroke="#e2b714" strokeWidth="2" strokeDasharray="5 20" opacity="0.3" />
                    </g>
                </svg>

                {/* --- Content Overlay --- */}

                {/* Unified Right Column Controls */}
                <div className="absolute right-4 top-4 bottom-8 w-16 flex flex-col items-center justify-between z-[60] pointer-events-auto">
                    {/* Top: Close */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} 
                        className="p-3 text-monkey-sub hover:text-monkey-error transition-colors rounded-full hover:bg-monkey-sub/10 bg-[#2c2e31] border border-monkey-sub/20 mb-4"
                    >
                        <X size={24} />
                    </button>
                    
                    {/* Center: Play/Reset */}
                    <div className="flex flex-col items-center gap-4">
                         <button 
                            onClick={() => setIsRunning(!isRunning)}
                            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 bg-[#2c2e31] z-50 ${isRunning ? 'text-monkey-text border border-monkey-sub/50' : 'text-monkey-main hover:text-white border border-monkey-main'}`}
                            title={isRunning ? "Pause" : "Start"}
                        >
                            {isRunning ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                        </button>

                        <button 
                            onClick={handleReset}
                            className="w-10 h-10 rounded-full border border-monkey-sub/30 bg-[#2c2e31] text-monkey-sub flex items-center justify-center hover:border-monkey-main hover:text-monkey-main hover:bg-monkey-sub/10 transition-all active:scale-90"
                            title="Reset"
                        >
                            <RotateCcw size={18} />
                        </button>
                    </div>

                    <div className="flex-grow"></div>

                    {/* Bottom: Modes */}
                    <div className="flex flex-col gap-3">
                        <button onClick={() => { setMode('STOPWATCH'); setIsRunning(false); }} className={`p-3 rounded-full transition-all border bg-[#2c2e31] ${mode === 'STOPWATCH' ? 'text-monkey-main border-monkey-main' : 'text-monkey-sub border-monkey-sub/20 hover:text-white hover:border-white'}`} title="Stopwatch"><Watch size={20}/></button>
                        <button onClick={() => { setMode('TIMER'); setIsRunning(false); }} className={`p-3 rounded-full transition-all border bg-[#2c2e31] ${mode === 'TIMER' ? 'text-monkey-main border-monkey-main' : 'text-monkey-sub border-monkey-sub/20 hover:text-white hover:border-white'}`} title="Timer"><Timer size={20}/></button>
                        <button onClick={() => { setMode('POMODORO'); setIsRunning(false); }} className={`p-3 rounded-full transition-all border bg-[#2c2e31] ${mode === 'POMODORO' ? 'text-monkey-main border-monkey-main' : 'text-monkey-sub border-monkey-sub/20 hover:text-white hover:border-white'}`} title="Pomodoro"><Coffee size={20}/></button>
                    </div>
                </div>

                {/* Main Digital Display - Positioned relative to center area */}
                <div className="absolute top-[28%] right-[28%] z-40 text-right animate-text-pop pointer-events-none w-48">
                    <div className="text-xs font-bold text-monkey-sub tracking-widest mb-1">{getDialLabel()}</div>
                    <div className="text-5xl font-mono font-bold text-monkey-main tracking-tighter mb-4">
                        {getDisplayTime()}
                    </div>

                    {/* Pomo Edit Toggles */}
                    {mode === 'POMODORO' && !isRunning && (
                         <div className="flex justify-end gap-2 mt-2 pointer-events-auto">
                             <button 
                                onClick={() => handlePomoSwitch('STUDY')}
                                className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full border transition-all ${pomoEditTarget === 'STUDY' ? 'bg-monkey-main text-monkey-bg border-monkey-main' : 'text-monkey-sub border-monkey-sub/30 hover:border-monkey-text hover:text-monkey-text'}`}
                             >
                                 Study
                             </button>
                             <button 
                                onClick={() => handlePomoSwitch('REST')}
                                className={`text-[10px] uppercase font-bold px-3 py-1 rounded-full border transition-all ${pomoEditTarget === 'REST' ? 'bg-blue-400 text-monkey-bg border-blue-400' : 'text-monkey-sub border-monkey-sub/30 hover:border-monkey-text hover:text-monkey-text'}`}
                             >
                                 Rest
                             </button>
                         </div>
                    )}
                </div>

            </div>
        </div>,
        document.body
      )}
    </>
  );
};