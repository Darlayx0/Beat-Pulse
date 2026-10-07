import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Pause, RotateCcw, ArrowLeft, Settings, Volume2, Loader2 } from 'lucide-react';
import { Song, Chart, Note, GameSettings, GameStats, JudgementType } from '../types';
import { audioEngine } from '../lib/audioEngine';

function safeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w <= 0 || h <= 0) return;
  const safeR = Math.max(0, Math.min(r, w / 2, h / 2));
  if (typeof ctx.roundRect === 'function') {
    try {
      ctx.roundRect(x, y, w, h, safeR);
      return;
    } catch (e) {
      // Fallback
    }
  }
  ctx.rect(x, y, w, h);
}

interface RhythmGameProps {
  song: Song;
  chart: Chart;
  settings: GameSettings;
  audioBuffer: AudioBuffer | null;
  isTestPlay?: boolean;
  startFromTime?: number;
  onFinishGame: (stats: GameStats) => void;
  onExitGame: () => void;
  isExternalPaused?: boolean;
  onOpenSettings?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
}

interface Shockwave {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  color: string;
  life: number;
}

export const RhythmGame: React.FC<RhythmGameProps> = ({
  song,
  chart,
  settings,
  audioBuffer,
  isTestPlay = false,
  startFromTime = 0,
  onFinishGame,
  onExitGame,
  isExternalPaused = false,
  onOpenSettings,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);

  const [isPausedInternal, setIsPausedInternal] = useState(false);
  const isPaused = isPausedInternal || isExternalPaused;

  const [countdown, setCountdown] = useState<number | null>(3);
  const [activeLanes, setActiveLanes] = useState<boolean[]>([false, false, false, false]);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 400, height: 650 });

  // Milestone combo message banner state
  const [comboMilestone, setComboMilestone] = useState<string | null>(null);

  // YouTube live buffering & audio activation state
  const [isYtBuffering, setIsYtBuffering] = useState(false);
  const [ytBlockedPrompt, setYtBlockedPrompt] = useState(false);

  useEffect(() => {
    if (!song.youtubeVideoId) return;

    const unsub = audioEngine.addYouTubeListener((state) => {
      setIsYtBuffering(state === 'buffering');
      if (state === 'playing') {
        setYtBlockedPrompt(false);
      }
    });

    return () => {
      unsub();
    };
  }, [song.youtubeVideoId]);

  // Check if YouTube audio is paused/blocked by browser autoplay policy after countdown
  useEffect(() => {
    if (!song.youtubeVideoId || countdown !== null) return;
    const timer = setTimeout(() => {
      if (audioEngine.getIsPlaying() && !audioEngine.isYouTubePlaying()) {
        setYtBlockedPrompt(true);
      }
    }, 1400);
    return () => clearTimeout(timer);
  }, [song.youtubeVideoId, countdown]);

  // Time & Pause tracking refs for audio offset start delay
  const gameStartTimeRef = useRef<number | null>(null);
  const bgmStartedRef = useRef<boolean>(false);
  const pauseStartTimestampRef = useRef<number | null>(null);
  const accumulatedPauseDurationRef = useRef<number>(0);

  // Particles & Shockwaves refs
  const particlesRef = useRef<Particle[]>([]);
  const shockwavesRef = useRef<Shockwave[]>([]);

  // Chronologically sorted notes ref for O(1) performance (Defensively filtered & validated)
  const sortedNotesRef = useRef<Note[]>([]);
  useEffect(() => {
    const rawNotes = Array.isArray(chart?.notes) ? chart.notes : [];
    sortedNotesRef.current = rawNotes
      .filter((n) => n && typeof n.time === 'number' && !isNaN(n.time) && isFinite(n.time))
      .map((n, idx) => ({
        id: n.id || `n_${idx}`,
        lane: typeof n.lane === 'number' && !isNaN(n.lane) ? Math.max(0, Math.min(3, Math.floor(n.lane))) : 0,
        time: Number(n.time),
        duration: typeof n.duration === 'number' && !isNaN(n.duration) && n.duration > 0 ? Number(n.duration) : undefined,
      }))
      .sort((a, b) => a.time - b.time);
  }, [chart?.notes]);

  // Realtime game stats in ref
  const statsRef = useRef<GameStats>({
    score: 0,
    maxCombo: 0,
    currentCombo: 0,
    perfectCount: 0,
    greatCount: 0,
    goodCount: 0,
    missCount: 0,
    accuracy: 100,
    totalNotes: Array.isArray(chart?.notes) ? chart.notes.length : 0,
    processedNotes: 0,
    health: 100,
    timingOffsets: [],
  });

  // Reactive state for HUD - updated ONLY when stats change to avoid 60fps React re-render lag
  const [hudStats, setHudStats] = useState({
    score: 0,
    combo: 0,
    accuracy: 100,
    health: 100,
  });

  // Track state of hit notes
  const hitNoteIdsRef = useRef<Set<string>>(new Set());

  // Track active hold notes per lane
  const activeHoldNotesRef = useRef<
    Map<
      number,
      {
        note: Note;
        startJudgement: JudgementType;
        startTime: number;
        endTime: number;
        lastTickTime: number;
      }
    >
  >(new Map());

  // Progress bar ref for 60fps zero-overhead top progress updates
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  // Recent judgement splash animations with dynamic combo
  const recentJudgementRef = useRef<{ type: JudgementType; offsetMs: number; time: number; combo: number } | null>(null);

  // Total Clean Game State Reset on Mount / Song / Chart / startFromTime change
  useEffect(() => {
    hitNoteIdsRef.current.clear();
    activeHoldNotesRef.current.clear();
    particlesRef.current = [];
    shockwavesRef.current = [];
    recentJudgementRef.current = null;
    bgmStartedRef.current = false;
    gameStartTimeRef.current = null;
    pauseStartTimestampRef.current = null;
    accumulatedPauseDurationRef.current = 0;

    statsRef.current = {
      score: 0,
      maxCombo: 0,
      currentCombo: 0,
      perfectCount: 0,
      greatCount: 0,
      goodCount: 0,
      missCount: 0,
      accuracy: 100,
      totalNotes: Array.isArray(chart?.notes) ? chart.notes.length : 0,
      processedNotes: 0,
      health: 100,
      timingOffsets: [],
    };

    setHudStats({
      score: 0,
      combo: 0,
      accuracy: 100,
      health: 100,
    });
    setComboMilestone(null);
    setIsPausedInternal(false);
    setCountdown(3);

    // If starting test play from playhead position, pre-mark prior notes as processed/hit
    if (startFromTime > 0 && Array.isArray(chart?.notes)) {
      chart.notes.forEach((n, idx) => {
        if (n && typeof n.time === 'number' && n.time < startFromTime - 0.05) {
          hitNoteIdsRef.current.add(n.id || `n_${idx}`);
        }
      });
    }
  }, [song?.id, chart?.difficulty, startFromTime]);

  // Keybindings map
  const keyMapRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const kb = settings?.keyBindings || { lane0: 'KeyD', lane1: 'KeyF', lane2: 'KeyJ', lane3: 'KeyK' };
    keyMapRef.current = {
      [kb.lane0 || 'KeyD']: 0,
      [kb.lane1 || 'KeyF']: 1,
      [kb.lane2 || 'KeyJ']: 2,
      [kb.lane3 || 'KeyK']: 3,
    };
  }, [settings?.keyBindings]);

  // Load BGM into audio engine
  useEffect(() => {
    if (audioBuffer) {
      if (!song.youtubeVideoId) {
        audioEngine.loadBuffer(audioBuffer);
      } else {
        audioEngine.setFallbackBuffer(audioBuffer);
      }
      audioEngine.setVolumes(settings.bgmVolume, settings.sfxVolume);
    }
  }, [audioBuffer, song.youtubeVideoId, settings.bgmVolume, settings.sfxVolume]);

  // Cleanup BGM strictly on unmount
  useEffect(() => {
    return () => {
      audioEngine.stopBGM();
    };
  }, []);

  // Track pause duration to maintain exact delay synchronization
  useEffect(() => {
    if (isPaused) {
      if (pauseStartTimestampRef.current === null) {
        pauseStartTimestampRef.current = performance.now();
      }
    } else {
      if (pauseStartTimestampRef.current !== null) {
        accumulatedPauseDurationRef.current += performance.now() - pauseStartTimestampRef.current;
        pauseStartTimestampRef.current = null;
      }
    }
  }, [isPaused]);

  // Handle external pause state changes
  useEffect(() => {
    if (isExternalPaused) {
      audioEngine.pauseBGM();
    } else if (!isPausedInternal && countdown === null) {
      if (bgmStartedRef.current) {
        audioEngine.playBGM();
      }
    }
  }, [isExternalPaused, isPausedInternal, countdown]);

  // Handle Tab Visibility Change (auto pause when tab is hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !isPausedInternal) {
        setIsPausedInternal(true);
        audioEngine.pauseBGM();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPausedInternal]);

  // Handle Resize for Responsive Canvas
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setCanvasDimensions({
          width: Math.max(320, rect.width),
          height: Math.max(480, rect.height),
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Countdown timer before music starts
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      if (countdown === 3 && song.youtubeVideoId) {
        const chartOffset = chart.offset || 0;
        const initialAudioPos = Math.max(0, startFromTime + (chartOffset < 0 ? -chartOffset : 0));
        audioEngine.prepareYouTubeForCountdown(initialAudioPos);
      }
      const timer = setTimeout(() => setCountdown(countdown - 1), 600);
      return () => clearTimeout(timer);
    } else {
      setCountdown(null);
      gameStartTimeRef.current = performance.now();
      accumulatedPauseDurationRef.current = 0;
      pauseStartTimestampRef.current = null;
      bgmStartedRef.current = false;

      const chartOffset = chart.offset || 0;
      const initialAudioPos = Math.max(0, startFromTime + (chartOffset < 0 ? -chartOffset : 0));

      if (chartOffset <= 0 || startFromTime > 0) {
        if (!isExternalPaused) {
          audioEngine.playBGM(initialAudioPos);
          bgmStartedRef.current = true;
        }
      }
    }
  }, [countdown, isExternalPaused, chart.offset, startFromTime, song.youtubeVideoId]);

  // Calculate synchronized game time considering audio offset start delay
  const getGameCurrentTime = useCallback((): number => {
    if (gameStartTimeRef.current === null) return 0;
    const chartOffset = chart.offset || 0;

    if (chartOffset > 0 && !bgmStartedRef.current) {
      // Still in initial delay period (e.g., +1000ms delay)
      const currentPauseTime = pauseStartTimestampRef.current !== null ? performance.now() - pauseStartTimestampRef.current : 0;
      const elapsedSec = (performance.now() - gameStartTimeRef.current - accumulatedPauseDurationRef.current - currentPauseTime) / 1000;

      if (elapsedSec >= chartOffset) {
        // Initial delay has finished! Start audio from 0.0s
        if (!isPaused && !isExternalPaused) {
          audioEngine.playBGM(0);
          bgmStartedRef.current = true;
        }
        return chartOffset + audioEngine.getCurrentTime();
      }
      return Math.max(0, elapsedSec);
    }

    // Audio has started or offset <= 0
    const audioTime = audioEngine.getCurrentTime();
    return Math.max(0, audioTime + chartOffset);
  }, [chart.offset, isExternalPaused, isPaused]);

  // Trigger Haptic Vibration on Mobile
  const triggerHaptic = useCallback((pattern: number | number[] = 15) => {
    if (settings.hapticFeedback && typeof window !== 'undefined' && window.navigator?.vibrate) {
      try {
        window.navigator.vibrate(pattern);
      } catch (e) {
        // Ignore unsupported
      }
    }
  }, [settings.hapticFeedback]);

  // Spawn visual hit particles & shockwaves (Capped for performance)
  const spawnHitEffects = useCallback((x: number, y: number, color: string) => {
    // Shockwave ring
    if (shockwavesRef.current.length < 10) {
      shockwavesRef.current.push({
        x,
        y,
        radius: 12,
        maxRadius: 42,
        color,
        life: 1.0,
      });
    }

    // Particle burst (Capped to max 24 particles)
    if (particlesRef.current.length < 24) {
      for (let i = 0; i < 8; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.5 + Math.random() * 4;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1,
          color,
          size: 3 + Math.random() * 3,
          life: 1.0,
        });
      }
    }
  }, []);

  // Sync state to HUD - Event driven, NOT called inside 60fps render loop
  const syncHud = useCallback(() => {
    const stats = statsRef.current;
    setHudStats({
      score: stats.score,
      combo: stats.currentCombo,
      accuracy: stats.accuracy,
      health: stats.health,
    });
  }, []);

  // Register Note Judgement
  const registerJudgement = useCallback(
    (type: JudgementType, offsetMs: number) => {
      const stats = statsRef.current;
      stats.processedNotes++;

      if (type === 'PERFECT') {
        stats.score += 1000 + Math.min(stats.currentCombo, 100) * 12;
        stats.perfectCount++;
        stats.currentCombo++;
        stats.health = Math.min(100, stats.health + 3);
        audioEngine.playHitsound('perfect');
        triggerHaptic(20);
      } else if (type === 'GREAT') {
        stats.score += 700 + Math.min(stats.currentCombo, 100) * 6;
        stats.greatCount++;
        stats.currentCombo++;
        stats.health = Math.min(100, stats.health + 2);
        audioEngine.playHitsound('tap');
        triggerHaptic(15);
      } else if (type === 'GOOD') {
        stats.score += 400;
        stats.goodCount++;
        // GOOD maintains combo (doesn't break, doesn't increment)
        stats.health = Math.min(100, stats.health + 1);
        audioEngine.playHitsound('tap');
      } else {
        // MISS
        stats.missCount++;
        stats.currentCombo = 0;
        stats.health = Math.max(0, stats.health - 8);
        triggerHaptic([30, 30]);
      }

      if (stats.currentCombo > stats.maxCombo) {
        stats.maxCombo = stats.currentCombo;
      }

      // Combo milestones
      if (stats.currentCombo > 0 && stats.currentCombo % 25 === 0) {
        setComboMilestone(`${stats.currentCombo} COMBO STREAK! 🔥`);
        setTimeout(() => setComboMilestone(null), 1200);
      }

      // Calculate accuracy
      const totalPossibleScore = stats.processedNotes * 1000;
      const currentEarnedScore =
        stats.perfectCount * 1000 + stats.greatCount * 700 + stats.goodCount * 400;
      stats.accuracy = totalPossibleScore > 0 ? (currentEarnedScore / totalPossibleScore) * 100 : 100;

      if (type !== 'MISS') {
        stats.timingOffsets.push(offsetMs);
      }

      recentJudgementRef.current = {
        type,
        offsetMs,
        time: performance.now(),
        combo: stats.currentCombo,
      };

      // Sync React state ONCE per hit event
      syncHud();
    },
    [triggerHaptic, syncHud]
  );

  const handleKeyPressLane = useCallback(
    (lane: number) => {
      audioEngine.resumeIfBlocked();
      if (isPaused || countdown !== null) return;

      const currentGameTime = getGameCurrentTime();
      const adjustedTime = currentGameTime - settings.audioOffsetMs / 1000;

      // Find closest unhit note using chronologically sorted list (O(1) search)
      let closestNote: Note | null = null;
      let minDiff = Infinity;

      const notes = sortedNotesRef.current;
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        const diffMs = (note.time - adjustedTime) * 1000;

        // Skip notes too far in the past
        if (diffMs < -200) continue;
        // Early break when notes are too far in the future
        if (diffMs > 200) break;

        if (note.lane === lane && !hitNoteIdsRef.current.has(note.id)) {
          if (Math.abs(diffMs) < Math.abs(minDiff)) {
            minDiff = diffMs;
            closestNote = note;
          }
        }
      }

      const laneColors = ['#0284c7', '#4f46e5', '#7c3aed', '#db2777'];
      const laneX = (lane + 0.5) * (canvasDimensions.width / 4);
      // Position hit bar comfortably for fullscreen mobile touch & desktop play
      const hitBarY = canvasDimensions.height - 95;

      if (closestNote) {
        hitNoteIdsRef.current.add(closestNote.id);
        const absDiff = Math.abs(minDiff);
        let judge: JudgementType = 'MISS';

        if (absDiff <= 45) {
          judge = 'PERFECT';
          registerJudgement('PERFECT', minDiff);
          spawnHitEffects(laneX, hitBarY, '#f59e0b');
        } else if (absDiff <= 95) {
          judge = 'GREAT';
          registerJudgement('GREAT', minDiff);
          spawnHitEffects(laneX, hitBarY, laneColors[lane]);
        } else if (absDiff <= 180) {
          judge = 'GOOD';
          registerJudgement('GOOD', minDiff);
          spawnHitEffects(laneX, hitBarY, '#10b981');
        } else {
          judge = 'MISS';
          registerJudgement('MISS', minDiff);
        }

        // If hold note and not a miss, start tracking active hold note
        if (closestNote.duration && closestNote.duration > 0 && judge !== 'MISS') {
          activeHoldNotesRef.current.set(lane, {
            note: closestNote,
            startJudgement: judge,
            startTime: closestNote.time,
            endTime: closestNote.time + closestNote.duration,
            lastTickTime: adjustedTime,
          });
        }
      } else {
        audioEngine.playHitsound('tap');
      }
    },
    [
      canvasDimensions.height,
      canvasDimensions.width,
      countdown,
      getGameCurrentTime,
      isPaused,
      registerJudgement,
      settings.audioOffsetMs,
      settings.touchControlMode,
      spawnHitEffects,
    ]
  );

  // Handle Lane Release for Hold Notes (Lepas tepat di titik akhir untuk feedback & combo)
  const handleKeyReleaseLane = useCallback(
    (lane: number) => {
      if (isPaused || countdown !== null) return;
      const hold = activeHoldNotesRef.current.get(lane);
      if (!hold) return;

      const currentGameTime = getGameCurrentTime();
      const adjustedTime = currentGameTime - settings.audioOffsetMs / 1000;
      const diffMs = (adjustedTime - hold.endTime) * 1000;

      const laneColors = ['#0284c7', '#4f46e5', '#7c3aed', '#db2777'];
      const laneX = (lane + 0.5) * (canvasDimensions.width / 4);
      const hitBarY = canvasDimensions.height - 95;

      activeHoldNotesRef.current.delete(lane);

      // Release Judgement: Released too early before reaching the end point, or on time, or late
      if (diffMs < -180) {
        // Released too early -> MISS
        registerJudgement('MISS', diffMs);
        spawnHitEffects(laneX, hitBarY, '#ef4444');
      } else if (Math.abs(diffMs) <= 65) {
        // Perfect release timing
        registerJudgement('PERFECT', diffMs);
        spawnHitEffects(laneX, hitBarY, '#f59e0b');
        audioEngine.playHitsound('holdEnd');
      } else if (Math.abs(diffMs) <= 130) {
        // Great release timing
        registerJudgement('GREAT', diffMs);
        spawnHitEffects(laneX, hitBarY, laneColors[lane]);
        audioEngine.playHitsound('holdEnd');
      } else if (Math.abs(diffMs) <= 220) {
        // Good release timing
        registerJudgement('GOOD', diffMs);
        spawnHitEffects(laneX, hitBarY, '#10b981');
        audioEngine.playHitsound('tap');
      } else {
        // Released too late after end point -> MISS
        registerJudgement('MISS', diffMs);
        spawnHitEffects(laneX, hitBarY, '#ef4444');
      }
    },
    [
      canvasDimensions.height,
      canvasDimensions.width,
      countdown,
      getGameCurrentTime,
      isPaused,
      registerJudgement,
      settings.audioOffsetMs,
      settings.touchControlMode,
      spawnHitEffects,
    ]
  );

  // Multi-Touch Handlers for Direct Screen Touch Controls
  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (isPaused || countdown !== null) return;
      e.preventDefault();

      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const laneWidth = rect.width / 4;

      const active = [false, false, false, false];

      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const touchX = touch.clientX - rect.left;
        const lane = Math.min(3, Math.max(0, Math.floor(touchX / laneWidth)));
        active[lane] = true;
      }

      for (let l = 0; l < 4; l++) {
        if (active[l] && !activeLanes[l]) {
          handleKeyPressLane(l);
        }
      }
      setActiveLanes(active);
    },
    [activeLanes, countdown, handleKeyPressLane, isPaused]
  );

  const handleTouchMoveEnd = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const laneWidth = rect.width / 4;

      const active = [false, false, false, false];
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const touchX = touch.clientX - rect.left;
        const lane = Math.min(3, Math.max(0, Math.floor(touchX / laneWidth)));
        active[lane] = true;
      }

      // Detect lanes that were released
      for (let l = 0; l < 4; l++) {
        if (!active[l] && activeLanes[l]) {
          handleKeyReleaseLane(l);
        }
      }

      setActiveLanes(active);
    },
    [activeLanes, handleKeyReleaseLane]
  );

  // Keyboard Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === 'Escape' || e.code === 'KeyP') {
        setIsPausedInternal((prev) => {
          const next = !prev;
          if (next) audioEngine.pauseBGM();
          else if (countdown === null && !isExternalPaused) audioEngine.playBGM();
          return next;
        });
        return;
      }

      const lane = keyMapRef.current[e.code];
      if (lane !== undefined) {
        setActiveLanes((prev) => {
          const next = [...prev];
          next[lane] = true;
          return next;
        });
        handleKeyPressLane(lane);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const lane = keyMapRef.current[e.code];
      if (lane !== undefined) {
        setActiveLanes((prev) => {
          const next = [...prev];
          next[lane] = false;
          return next;
        });
        handleKeyReleaseLane(lane);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyPressLane, handleKeyReleaseLane, countdown, isExternalPaused]);

  // Optimized Render Loop on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: Boolean(song.youtubeVideoId) });
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasDimensions.width * dpr;
    canvas.height = canvasDimensions.height * dpr;

    // Dynamic note skin themes
    const skinThemes = {
      cyber: {
        colors: ['#0284c7', '#4f46e5', '#7c3aed', '#db2777'],
        lights: [
          'rgba(2, 132, 199, 0.08)',
          'rgba(79, 70, 229, 0.08)',
          'rgba(124, 58, 237, 0.08)',
          'rgba(219, 39, 119, 0.08)',
        ],
      },
      neon: {
        colors: ['#06b6d4', '#8b5cf6', '#d946ef', '#f43f5e'],
        lights: [
          'rgba(6, 182, 212, 0.08)',
          'rgba(139, 92, 246, 0.08)',
          'rgba(217, 70, 239, 0.08)',
          'rgba(244, 63, 94, 0.08)',
        ],
      },
      pastel: {
        colors: ['#10b981', '#14b8a6', '#06b6d4', '#6366f1'],
        lights: [
          'rgba(16, 185, 129, 0.08)',
          'rgba(20, 184, 166, 0.08)',
          'rgba(6, 182, 212, 0.08)',
          'rgba(99, 102, 241, 0.08)',
        ],
      },
      classic: {
        colors: ['#f59e0b', '#ea580c', '#e11d48', '#9333ea'],
        lights: [
          'rgba(245, 158, 11, 0.08)',
          'rgba(234, 88, 12, 0.08)',
          'rgba(225, 29, 72, 0.08)',
          'rgba(147, 51, 234, 0.08)',
        ],
      },
    };

    const currentSkin = skinThemes[settings.noteSkin || 'cyber'] || skinThemes.cyber;
    const laneColors = currentSkin.colors;
    const laneLightBg = currentSkin.lights;

    const render = () => {
      ctx.save();
      ctx.scale(dpr, dpr);

      const width = canvasDimensions.width;
      const height = canvasDimensions.height;

      // Clear Canvas with clean, sophisticated light aesthetic (No dark theme)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      const laneWidth = width / 4;
      // Position hit bar comfortably for fullscreen mobile touch & desktop play
      const hitBarY = height - 95;

      for (let i = 0; i < 4; i++) {
        const x = i * laneWidth;

        // Subtle alternating lane background
        if (i % 2 === 1) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(x, 0, laneWidth, height);
        }

        // Active lane press light beam
        if (activeLanes[i]) {
          ctx.fillStyle = laneLightBg[i];
          ctx.fillRect(x, 0, laneWidth, hitBarY);
        }

        // Crisp lane dividing lines
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Draw Hit Target Line
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, hitBarY);
      ctx.lineTo(width, hitBarY);
      ctx.stroke();

      // Hit Bar Target Circles (Pure light theme receptors)
      for (let i = 0; i < 4; i++) {
        const cx = i * laneWidth + laneWidth / 2;

        ctx.fillStyle = activeLanes[i] ? laneColors[i] : '#ffffff';
        ctx.strokeStyle = activeLanes[i] ? '#4338ca' : '#cbd5e1';
        ctx.lineWidth = activeLanes[i] ? 3.5 : 2;

        ctx.beginPath();
        ctx.arc(cx, hitBarY, activeLanes[i] ? 21 : 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = activeLanes[i] ? '#ffffff' : laneColors[i];
        ctx.beginPath();
        ctx.arc(cx, hitBarY, activeLanes[i] ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();
      }

      const currentGameTime = getGameCurrentTime();
      const adjustedTime = currentGameTime - (settings?.audioOffsetMs || 0) / 1000;
      const scrollSpeedFactor = (settings?.scrollSpeed || 2.2) * 540;

      // AutoPlay Logic for Tap & Hold Notes
      if (settings.autoPlay && !isPaused) {
        const notes = sortedNotesRef.current;
        for (let i = 0; i < notes.length; i++) {
          const note = notes[i];
          const hasDuration = note.duration && note.duration > 0;

          if (!hitNoteIdsRef.current.has(note.id) && adjustedTime >= note.time) {
            hitNoteIdsRef.current.add(note.id);
            registerJudgement('PERFECT', 0);
            spawnHitEffects((note.lane + 0.5) * laneWidth, hitBarY, '#f59e0b');

            if (hasDuration) {
              activeHoldNotesRef.current.set(note.lane, {
                note,
                startJudgement: 'PERFECT',
                startTime: note.time,
                endTime: note.time + note.duration!,
                lastTickTime: adjustedTime,
              });
            }
          }
        }
      }

      // Active Hold Notes Processing & Particle Sparks
      activeHoldNotesRef.current.forEach((hold, lane) => {
        const laneX = (lane + 0.5) * laneWidth;

        // Spawn hold spark particles
        if (adjustedTime - hold.lastTickTime >= 0.08) {
          hold.lastTickTime = adjustedTime;
          spawnHitEffects(laneX, hitBarY, laneColors[lane]);
        }

        // Auto-complete in AutoPlay mode or check late release timeout in manual play
        if (settings.autoPlay) {
          if (adjustedTime >= hold.endTime) {
            activeHoldNotesRef.current.delete(lane);
            registerJudgement('PERFECT', 0);
            spawnHitEffects(laneX, hitBarY, '#f59e0b');
            audioEngine.playHitsound('holdEnd');
          }
        } else if (adjustedTime >= hold.endTime + 0.22) {
          // Player failed to release key in time (held too long past end point) -> Late Release MISS
          activeHoldNotesRef.current.delete(lane);
          registerJudgement('MISS', 220);
          spawnHitEffects(laneX, hitBarY, '#ef4444');
        }
      });

      // High Performance Note Rendering using Chronological Array Iteration
      const notes = sortedNotesRef.current;
      for (let i = 0; i < notes.length; i++) {
        const note = notes[i];
        const isCurrentlyHeld = activeHoldNotesRef.current.has(note.lane) && activeHoldNotesRef.current.get(note.lane)?.note.id === note.id;
        const timeDiff = note.time - adjustedTime;

        // Break early for notes far in the future (sorted array optimization)
        if (timeDiff > 2.5 && !isCurrentlyHeld) break;

        const noteY = isCurrentlyHeld ? hitBarY : hitBarY - timeDiff * scrollSpeedFactor;
        const isHold = note.duration && note.duration > 0;

        // Auto Miss checking for tap notes or unstarted hold notes
        if (
          !hitNoteIdsRef.current.has(note.id) &&
          timeDiff < -0.18 &&
          !settings.autoPlay
        ) {
          hitNoteIdsRef.current.add(note.id);
          registerJudgement('MISS', -190);
          continue;
        }

        const shouldRender = (!hitNoteIdsRef.current.has(note.id) || isCurrentlyHeld);

        if (shouldRender) {
          const laneX = note.lane * laneWidth;
          const noteWidth = laneWidth - 12;
          const noteHeight = 22;
          const xPos = laneX + 6;

          // Render Hold Note Body & Diamond End Cap
          if (isHold) {
            const endDiff = (note.time + note.duration!) - adjustedTime;
            const tailTopY = hitBarY - endDiff * scrollSpeedFactor;
            const currentHeadY = isCurrentlyHeld ? hitBarY : noteY;
            const holdBodyHeight = Math.max(0, currentHeadY - tailTopY);

            if (holdBodyHeight > 0 && tailTopY < height + 60 && currentHeadY > -60) {
              // 1. Hold Trail Glowing Gradient Body
              const trailGrad = ctx.createLinearGradient(0, tailTopY, 0, currentHeadY);
              trailGrad.addColorStop(0, laneColors[note.lane] + '33');
              trailGrad.addColorStop(0.5, laneColors[note.lane] + '77');
              trailGrad.addColorStop(1, laneColors[note.lane] + (isCurrentlyHeld ? 'cc' : '99'));

              ctx.fillStyle = trailGrad;
              ctx.beginPath();
              safeRoundRect(ctx, xPos + 8, tailTopY, noteWidth - 16, holdBodyHeight, 6);
              ctx.fill();

              // 2. Neon Side Rails
              ctx.strokeStyle = laneColors[note.lane];
              ctx.lineWidth = isCurrentlyHeld ? 3 : 2;
              ctx.beginPath();
              ctx.moveTo(xPos + 8, tailTopY);
              ctx.lineTo(xPos + 8, currentHeadY);
              ctx.moveTo(xPos + noteWidth - 8, tailTopY);
              ctx.lineTo(xPos + noteWidth - 8, currentHeadY);
              ctx.stroke();

              // 3. Inner Energy Stream Line
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1.5;
              ctx.setLineDash([8, 6]);
              ctx.beginPath();
              ctx.moveTo(laneX + laneWidth / 2, tailTopY);
              ctx.lineTo(laneX + laneWidth / 2, currentHeadY);
              ctx.stroke();
              ctx.setLineDash([]);

              // 4. Release Diamond End Cap
              const diamondSize = 13;
              const diamondY = tailTopY;
              const diamondX = laneX + laneWidth / 2;

              ctx.save();
              ctx.translate(diamondX, diamondY);
              ctx.rotate(Math.PI / 4);

              // Diamond background
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(-diamondSize / 2, -diamondSize / 2, diamondSize, diamondSize);

              // Diamond neon border
              ctx.strokeStyle = laneColors[note.lane];
              ctx.lineWidth = 2.5;
              ctx.strokeRect(-diamondSize / 2, -diamondSize / 2, diamondSize, diamondSize);
              ctx.restore();

              // Diamond inner core dot
              ctx.fillStyle = laneColors[note.lane];
              ctx.beginPath();
              ctx.arc(diamondX, diamondY, 3, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Main Tap / Hold Head Note Pill
          if (noteY > -60 && noteY < height + 60) {
            ctx.fillStyle = laneColors[note.lane];
            ctx.beginPath();
            safeRoundRect(ctx, xPos, noteY - noteHeight / 2, noteWidth, noteHeight, 11);
            ctx.fill();

            // Inner highlight line
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.8;
            ctx.beginPath();
            safeRoundRect(ctx, xPos + 2.5, noteY - noteHeight / 2 + 2, noteWidth - 5, noteHeight - 4, 8);
            ctx.stroke();

            // Center glow dot
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(xPos + noteWidth / 2, noteY, 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Update & Render Shockwave Rings
      shockwavesRef.current.forEach((sw) => {
        sw.radius += 2.5;
        sw.life -= 0.05;
        if (sw.life > 0) {
          ctx.save();
          ctx.globalAlpha = sw.life;
          ctx.strokeStyle = sw.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      });
      shockwavesRef.current = shockwavesRef.current.filter((sw) => sw.life > 0);

      // Update & Render Particle Burst Effects
      particlesRef.current.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.035;

        if (p.life > 0) {
          ctx.save();
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
      particlesRef.current = particlesRef.current.filter((p) => p.life > 0);

      // Draw Floating Judgement Feedback Text with Combo
      const recent = recentJudgementRef.current;
      if (recent && performance.now() - recent.time < 700) {
        const elapsed = performance.now() - recent.time;
        const progress = elapsed / 700;
        const alpha = Math.max(0, 1 - progress);
        const scale = 1 + Math.sin(progress * Math.PI) * 0.22;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(width / 2, hitBarY - 75);
        ctx.scale(scale, scale);

        ctx.font = '900 26px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';

        if (recent.type === 'PERFECT') ctx.fillStyle = '#d97706';
        else if (recent.type === 'GREAT') ctx.fillStyle = '#4f46e5';
        else if (recent.type === 'GOOD') ctx.fillStyle = '#059669';
        else ctx.fillStyle = '#e11d48';

        ctx.fillText(recent.type, 0, 0);

        // Display combo together with feedback note
        if (recent.combo > 0) {
          ctx.font = '900 18px monospace, system-ui';
          ctx.fillStyle = '#4338ca';
          ctx.fillText(`${recent.combo} COMBO`, 0, 22);

          if (recent.type !== 'MISS') {
            ctx.font = 'bold 10px monospace';
            ctx.fillStyle = '#64748b';
            const sideText = recent.offsetMs > 0 ? `+${Math.round(recent.offsetMs)}ms LATE` : `${Math.round(recent.offsetMs)}ms EARLY`;
            ctx.fillText(sideText, 0, 36);
          }
        } else if (recent.type !== 'MISS') {
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = '#64748b';
          const sideText = recent.offsetMs > 0 ? `+${Math.round(recent.offsetMs)}ms LATE` : `${Math.round(recent.offsetMs)}ms EARLY`;
          ctx.fillText(sideText, 0, 18);
        }
        ctx.restore();
      }

      // Render Visual Song End Barrier ("AKHIR LAGU") & Update Top Song Progress Bar
      const ytDuration = song.youtubeVideoId ? audioEngine.getYouTubeDuration() : 0;
      const effectiveSongDuration = song.duration && song.duration > 0 ? song.duration : (ytDuration > 0 ? ytDuration : audioBuffer?.duration || 60);
      const songProgressRatio = Math.max(0, Math.min(1, adjustedTime / effectiveSongDuration));
      if (progressBarRef.current) {
        progressBarRef.current.style.width = `${(songProgressRatio * 100).toFixed(2)}%`;
      }

      const songEndDiff = effectiveSongDuration - adjustedTime;
      const songEndY = hitBarY - songEndDiff * scrollSpeedFactor;

      if (songEndY > -60 && songEndY < height + 60) {
        ctx.save();
        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.moveTo(0, songEndY);
        ctx.lineTo(width, songEndY);
        ctx.stroke();

        ctx.font = '900 11px system-ui, sans-serif';
        ctx.fillStyle = '#e11d48';
        ctx.textAlign = 'right';
        ctx.fillText('🏁 BATAS AKHIR LAGU', width - 12, songEndY - 6);
        ctx.restore();
      }

      ctx.restore();

      // Check if Health Depleted (Failed / Game Over)
      if (statsRef.current.health <= 0) {
        audioEngine.stopBGM();
        onFinishGame(statsRef.current);
        return;
      }

      // Check if Song Completed Successfully Based on Song Duration (not chart note count)
      const isSongDurationFinished = currentGameTime >= effectiveSongDuration - 0.1;
      const isAudioEnded = audioBuffer ? (currentGameTime - (chart.offset || 0)) >= audioBuffer.duration - 0.2 : false;

      if (currentGameTime > 0.8 && (isSongDurationFinished || isAudioEnded)) {
        audioEngine.stopBGM();
        onFinishGame(statsRef.current);
        return;
      }

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(requestRef.current);
  }, [
    activeLanes,
    audioBuffer,
    canvasDimensions.height,
    canvasDimensions.width,
    chart.notes.length,
    chart.offset,
    getGameCurrentTime,
    isPaused,
    onFinishGame,
    registerJudgement,
    settings.autoPlay,
    settings.audioOffsetMs,
    settings.scrollSpeed,
    settings.noteSkin,
    settings.touchControlMode,
    spawnHitEffects,
  ]);

  const handleExitClick = () => {
    audioEngine.stopBGM();
    onExitGame();
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMoveEnd}
      onTouchEnd={handleTouchMoveEnd}
      onTouchCancel={handleTouchMoveEnd}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full max-w-lg mx-auto h-[100dvh] flex flex-col justify-between overflow-hidden border-x border-slate-200/90 shadow-2xl shadow-slate-200/60 touch-none select-none bg-white text-slate-900"
    >
      {/* Top Song Playback Progress Bar - Bergerak dari pojok kiri atas sampai kanan atas layar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200/80 z-30 overflow-hidden pointer-events-none">
        <div
          ref={progressBarRef}
          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-75 ease-linear w-0"
        />
      </div>

      {/* Floating In-Game Header HUD - Transparan dengan Gradasi Putih ke Transparan dari Atas ke Bawah */}
      <div className="absolute top-0 left-0 right-0 z-20 pt-3 pb-10 px-3 sm:px-4 bg-gradient-to-b from-white via-white/85 to-transparent pointer-events-none select-none flex items-center justify-between">
        {/* Left: Pause Button + Song Title & Difficulty (Rata kiri menempel bagian kanan tombol pause) */}
        <div className="flex items-center gap-2.5 pointer-events-auto min-w-0">
          <button
            id="btn-game-pause"
            onClick={() => {
              setIsPausedInternal(true);
              audioEngine.pauseBGM();
            }}
            className="w-10 h-10 min-w-[40px] min-h-[40px] flex items-center justify-center bg-white/90 hover:bg-white text-slate-700 hover:text-indigo-600 rounded-xl transition-all border border-slate-200/90 shadow-xs active:scale-95 cursor-pointer backdrop-blur-xs shrink-0"
            title="Pause Permainan"
            aria-label="Pause Permainan"
          >
            <Pause className="w-4 h-4 fill-current" />
          </button>

          <div className="flex flex-col justify-center min-w-0 max-w-[150px] sm:max-w-[210px]">
            <div className="text-xs sm:text-sm font-black text-slate-900 truncate tracking-tight leading-tight">
              {song.title}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50/90 border border-indigo-100 text-[10px] font-mono font-bold text-indigo-700 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span>{chart.difficulty}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Score & Persentase + Nyawa Player Persegi Sudut Melingkar */}
        <div className="flex items-center gap-2.5 pointer-events-auto shrink-0">
          <div className="flex flex-col items-end">
            <div className="text-base sm:text-lg font-black font-mono tracking-tight text-slate-900 leading-none tabular-nums">
              {(hudStats?.score ?? 0).toLocaleString()}
            </div>
            <div className="text-[11px] font-bold font-mono text-slate-500 tabular-nums mt-0.5">
              {(hudStats?.accuracy ?? 100).toFixed(1)}%
            </div>
          </div>

          {/* Player Health Box (Persegi dengan sudut melingkar dan persentase di tengahnya) */}
          <div
            className={`relative w-10 h-10 rounded-xl border flex flex-col items-center justify-center backdrop-blur-xs transition-colors shadow-xs ${
              hudStats.health < 30
                ? 'bg-rose-50/95 border-rose-300 text-rose-700 animate-pulse'
                : hudStats.health < 60
                ? 'bg-amber-50/95 border-amber-300 text-amber-700'
                : 'bg-emerald-50/90 border-emerald-300 text-emerald-700'
            }`}
            title="Nyawa Pemain"
          >
            <span className="text-[11px] font-black font-mono tracking-tight tabular-nums">
              {Math.round(hudStats.health)}%
            </span>
          </div>
        </div>
      </div>

      {/* Combo Milestone Banner Popup */}
      {comboMilestone && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 bg-indigo-600 text-white font-extrabold text-xs sm:text-sm rounded-full shadow-lg border border-indigo-400 animate-bounce">
          {comboMilestone}
        </div>
      )}

      {/* Countdown Splash Overlay */}
      {countdown !== null && (
        <div className="absolute inset-0 z-30 bg-white/95 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="text-6xl sm:text-7xl font-black text-indigo-600 animate-ping">
            {countdown > 0 ? countdown : 'MULAI!'}
          </div>
        </div>
      )}

      {/* Pause Menu Overlay - Refined Light Aesthetic */}
      {isPausedInternal && (
        <div className="absolute inset-0 z-40 bg-slate-900/30 backdrop-blur-sm flex flex-col items-center justify-center p-6 space-y-4 animate-in fade-in duration-200">
          <div className="bg-white border border-slate-200/90 rounded-3xl p-6 w-full max-w-xs shadow-2xl text-center space-y-4">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Permainan Di-Pause</h2>
              <p className="text-xs text-slate-500 mt-0.5">Musik telah dihentikan sementara</p>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
              <button
                id="btn-resume-game"
                onClick={() => {
                  setIsPausedInternal(false);
                  if (countdown === null && !isExternalPaused) {
                    audioEngine.playBGM();
                  }
                }}
                className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xs cursor-pointer"
              >
                Lanjutkan Bermain
              </button>

              {onOpenSettings && (
                <button
                  id="btn-game-settings"
                  onClick={() => {
                    onOpenSettings();
                  }}
                  className="py-3 px-4 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-600" />
                  Pengaturan
                </button>
              )}

              <button
                id="btn-restart-game"
                onClick={() => {
                  audioEngine.stopBGM();
                  setIsPausedInternal(false);
                  hitNoteIdsRef.current.clear();
                  statsRef.current = {
                    score: 0,
                    maxCombo: 0,
                    currentCombo: 0,
                    perfectCount: 0,
                    greatCount: 0,
                    goodCount: 0,
                    missCount: 0,
                    accuracy: 100,
                    totalNotes: chart.notes.length,
                    processedNotes: 0,
                    health: 100,
                    timingOffsets: [],
                  };
                  syncHud();
                  setCountdown(3);
                }}
                className="py-3 px-4 bg-slate-50 hover:bg-slate-100 text-slate-800 font-semibold text-xs rounded-xl border border-slate-200 flex items-center justify-center gap-2 active:scale-95 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600" />
                Ulangi Dari Awal
              </button>

              <button
                id="btn-exit-game"
                onClick={handleExitClick}
                className="py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs rounded-xl border border-rose-200 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {isTestPlay ? 'Kembali ke Editor' : 'Kembali ke Main Menu'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Gameplay Canvas Container - Fullscreen gameplay across entire screen */}
      <div className="flex-1 w-full h-full relative overflow-hidden">
        {/* Buffering Indicator - Clean Light Pill */}
        {isYtBuffering && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 px-3.5 py-1.5 bg-white/95 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200/90 flex items-center gap-2 shadow-md backdrop-blur-sm pointer-events-none animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            <span>Memuat audio YouTube...</span>
          </div>
        )}

        {/* Audio Unlock Prompt if blocked by browser autoplay */}
        {ytBlockedPrompt && (
          <button
            id="btn-unlock-yt-audio"
            onClick={() => {
              audioEngine.resumeIfBlocked();
              setYtBlockedPrompt(false);
            }}
            className="absolute top-24 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full shadow-lg flex items-center gap-2 animate-bounce cursor-pointer border border-indigo-500 active:scale-95 transition-all select-none"
          >
            <Volume2 className="w-4 h-4" />
            <span>Ketuk untuk Putar Audio</span>
          </button>
        )}

        <canvas
          ref={canvasRef}
          className="w-full h-full block relative z-10"
        />
      </div>
    </div>
  );
};
