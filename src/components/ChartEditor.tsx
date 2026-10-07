import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Lock,
  Smartphone,
  Check,
  Music,
  ArrowRightLeft,
  Hand,
  Clock,
  Zap,
} from 'lucide-react';
import { Song, Chart, Note, DifficultyLevel } from '../types';
import { shouldRestoreDraft } from '../lib/chartSyncPolicy';
import { audioEngine } from '../lib/audioEngine';
import { StorageService } from '../services/storageService';
import { AudioService } from '../services/audioService';
import { generateAutoChart, detectBpmAndPeaks } from '../lib/beatDetector';
import { EditorHeader } from './editor/EditorHeader';
import { EditorTransport } from './editor/EditorTransport';
import { EditorSequencerCanvas, EditorToolMode } from './editor/EditorSequencerCanvas';
import { EditorRangeModal } from './editor/EditorRangeModal';
import { EditorMoreHub } from './editor/more/EditorMoreHub';

interface ChartEditorProps {
  songs: Song[];
  activeSongId?: string;
  activeDifficulty?: DifficultyLevel;
  audioBuffers: Record<string, AudioBuffer>;
  onTestPlay: (song: Song, chart: Chart) => void;
  onSaveChart: (songId: string, difficulty: DifficultyLevel, updatedChart: Chart) => void;
  onBackToLibrary?: () => void;
  onAddDifficulty?: (songId: string, diffName: string) => void;
  onRenameDifficulty?: (songId: string, oldDiff: string, newDiff: string) => void;
  onDeleteDifficulty?: (songId: string, diffName: string) => void;
  onReorderDifficulties?: (songId: string, newOrder: string[]) => void;
  onDuplicateDifficulty?: (songId: string, sourceDiffName: string, newDiffName: string) => void;
  onDuplicateSong?: (songId: string) => void;
  onRelinkSongAudio?: (songId: string, audioFile: File) => Promise<void>;
  onImportChartJson?: (songId: string, jsonString: string) => Promise<void>;
}

export const ChartEditor: React.FC<ChartEditorProps> = ({
  songs,
  activeSongId,
  activeDifficulty = 'Medium',
  audioBuffers,
  onTestPlay,
  onSaveChart,
  onBackToLibrary,
  onAddDifficulty,
  onRenameDifficulty,
  onDeleteDifficulty,
  onReorderDifficulties,
  onDuplicateDifficulty,
  onDuplicateSong,
  onRelinkSongAudio,
  onImportChartJson,
}) => {
  const [selectedSongId, setSelectedSongId] = useState<string>(() => {
    if (activeSongId && songs.some((s) => s.id === activeSongId)) {
      return activeSongId;
    }
    return songs[0]?.id || '';
  });

  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>(activeDifficulty);

  // Sync state if activeSongId prop changes from parent
  useEffect(() => {
    if (activeSongId && songs.some((s) => s.id === activeSongId)) {
      setSelectedSongId(activeSongId);
    }
  }, [activeSongId, songs]);

  // Sync state if activeDifficulty prop changes from parent
  useEffect(() => {
    if (activeDifficulty) {
      setSelectedDifficulty(activeDifficulty);
    }
  }, [activeDifficulty]);

  const song = songs.find((s) => s.id === selectedSongId) || songs[0];

  // Ensure selectedDifficulty exists in the active song's charts
  useEffect(() => {
    if (song && song.charts) {
      const availableDiffs = Object.keys(song.charts);
      if (availableDiffs.length > 0 && !availableDiffs.includes(selectedDifficulty)) {
        setSelectedDifficulty(availableDiffs[0]);
      }
    }
  }, [song, selectedDifficulty]);

  const [internalAudioBuffer, setInternalAudioBuffer] = useState<AudioBuffer | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState<boolean>(false);
  const [customDuration, setCustomDuration] = useState<number | null>(null);

  const audioBufferFromProps = song ? audioBuffers[song.id] : null;
  const audioBuffer = audioBufferFromProps || internalAudioBuffer;

  // Effective song duration helper
  const effectiveDuration =
    customDuration ||
    audioBuffer?.duration ||
    (song?.duration && song.duration > 0 ? song.duration : 0) ||
    (song?.charts &&
    Object.values(song.charts).some((c: Chart | undefined) => (c?.notes?.length ?? 0) > 0)
      ? Math.max(
          ...Object.values(song.charts).flatMap((c: Chart | undefined) =>
            (c?.notes || []).map((n) => n.time + (n.duration || 0))
          )
        ) + 5
      : 60);

  // Editor Core Timing & Chart State
  const [bpm, setBpm] = useState<number>(song?.bpm || 120);
  const [offset, setOffset] = useState<number>(song?.charts?.[selectedDifficulty]?.offset || 0);
  const [notes, setNotes] = useState<Note[]>(song?.charts?.[selectedDifficulty]?.notes || []);

  // Fullscreen "More" Hub State (Menggantikan sistem tab dengan 1 tab workspace linimasa)
  const [isMoreHubOpen, setIsMoreHubOpen] = useState<boolean>(false);

  // History Stack for Undo / Redo
  const [history, setHistory] = useState<Note[][]>([song?.charts?.[selectedDifficulty]?.notes || []]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Tools, Modes & Hold Length
  const [toolMode, setToolMode] = useState<EditorToolMode>('tap');
  const [holdDuration, setHoldDuration] = useState<number>(0.5);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isRangeModalOpen, setIsRangeModalOpen] = useState<boolean>(false);

  // View & Playback State
  const [snapDivision, setSnapDivision] = useState<number>(4); // 4 = 1/4 beat snap
  const [zoomScale, setZoomScale] = useState<number>(90); // pixels per second
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [canvasHeightMode, setCanvasHeightMode] = useState<'normal' | 'large'>('normal');

  // Selection & Clipboard
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [clipboardNotes, setClipboardNotes] = useState<Note[]>([]);
  const [tapTempoTimes, setTapTempoTimes] = useState<number[]>([]);

  // Audio Monitoring
  const [enableHitsounds, setEnableHitsounds] = useState<boolean>(true);
  const [enableMetronome, setEnableMetronome] = useState<boolean>(false);
  const lastHitsoundTimeRef = useRef<number>(-1);
  const lastMetronomeBeatRef = useRef<number>(-1);
  const currentTimeRef = useRef<number>(0);

  const handleUpdateDuration = (newDur: number) => {
    setCustomDuration(newDur);
    if (song) {
      song.duration = newDur;
    }
    setIsDirty(true);
  };

  // Modals
  const [saveMode, setSaveMode] = useState<'auto' | 'manual'>(() => {
    return (localStorage.getItem('BEATPULSE_EDITOR_SAVE_MODE') as 'auto' | 'manual') || 'auto';
  });

  const animFrameRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // History Undo / Redo with synchronized refs
  const historyRef = useRef<Note[][]>([[]]);
  const historyIndexRef = useRef<number>(0);
  const lastLoadedKeyRef = useRef<string>('');
  const lastSavedHistoryIndexRef = useRef<number>(0);
  const savedNotesSnapshotRef = useRef<string>('[]');
  const [historyToast, setHistoryToast] = useState<{ text: string; type: 'undo' | 'redo' } | null>(null);

  // Sync state when song or difficulty changes
  useEffect(() => {
    if (song) {
      const currentKey = `${song.id}_${selectedDifficulty}`;
      // Prevent resetting history or clearing notes when song object is updated via save/auto-save
      if (lastLoadedKeyRef.current === currentKey) {
        return;
      }
      lastLoadedKeyRef.current = currentKey;

      setBpm(song.bpm);
      const existingChart = song.charts[selectedDifficulty];
      let initialNotes = existingChart ? [...existingChart.notes] : [];
      let initialOffset = existingChart?.offset || 0;
      let initialBpm = song.bpm;

      // Check for local draft backup
      try {
        const draftKey = `BEATPULSE_CHART_DRAFT_${song.id}_${selectedDifficulty}`;
        const draftRaw = localStorage.getItem(draftKey);
        if (draftRaw) {
          const draft = JSON.parse(draftRaw);
          if (draft && Array.isArray(draft.notes) && draft.notes.length > 0) {
            // Restore only drafts newer than the saved or synchronized song.
            if (shouldRestoreDraft(draft.timestamp || 0, song, existingChart?.createdAt || 0)) {
              initialNotes = draft.notes;
              if (draft.bpm) initialBpm = draft.bpm;
              if (draft.offset !== undefined) initialOffset = draft.offset;
            }
          }
        }
      } catch (e) {
        // Ignore draft parse error
      }

      const sortedInitial = [...initialNotes].sort((a, b) => a.time - b.time);
      setBpm(initialBpm);
      setOffset(initialOffset);
      setNotes(sortedInitial);
      setHistory([sortedInitial]);
      setHistoryIndex(0);
      historyRef.current = [sortedInitial];
      historyIndexRef.current = 0;
      lastSavedHistoryIndexRef.current = 0;
      savedNotesSnapshotRef.current = JSON.stringify(sortedInitial);
      setSelectedNoteIds([]);
      setIsDirty(false);
      setHoldDuration(Number((60 / (initialBpm || 120)).toFixed(2)));

      // Restore last timeline position if saved
      try {
        const savedTime = localStorage.getItem(`BEATPULSE_EDITOR_TIME_${song.id}`);
        if (savedTime) {
          const parsed = parseFloat(savedTime);
          if (!isNaN(parsed) && parsed >= 0) {
            setCurrentTime(parsed);
            currentTimeRef.current = parsed;
          }
        }
      } catch {}
    }
  }, [selectedSongId, selectedDifficulty, song]);

  // Persist current timeline position debounced
  useEffect(() => {
    if (!song) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(`BEATPULSE_EDITOR_TIME_${song.id}`, currentTime.toString());
      } catch {}
    }, 400);
    return () => clearTimeout(timer);
  }, [currentTime, song]);

  const handleSetSaveMode = useCallback((mode: 'auto' | 'manual') => {
    setSaveMode(mode);
    try {
      localStorage.setItem('BEATPULSE_EDITOR_SAVE_MODE', mode);
    } catch {
      // Ignore quota error
    }
  }, []);

  // Continuous Debounced Auto-Save to GameState and Permanent Storage (Only when saveMode === 'auto')
  useEffect(() => {
    if (!song || !isDirty || saveMode !== 'auto') return;

    const autoSaveTimer = setTimeout(() => {
      const updatedChart: Chart = {
        id: song.charts?.[selectedDifficulty]?.id || `chart_${song.id}_${selectedDifficulty}`,
        songId: song.id,
        difficulty: selectedDifficulty,
        bpm,
        offset,
        notes,
        creator: 'Custom Editor',
        createdAt: song.charts?.[selectedDifficulty]?.createdAt || Date.now(),
      };
      onSaveChart(song.id, selectedDifficulty, updatedChart);
      lastSavedHistoryIndexRef.current = historyIndexRef.current;
      savedNotesSnapshotRef.current = JSON.stringify(notes);
      setIsDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 1500);
    }, 1200);

    return () => clearTimeout(autoSaveTimer);
  }, [song, selectedDifficulty, bpm, offset, notes, isDirty, saveMode, onSaveChart]);

  // Flush save on window unload or page hide
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (song && isDirty) {
        const updatedChart: Chart = {
          id: song.charts?.[selectedDifficulty]?.id || `chart_${song.id}_${selectedDifficulty}`,
          songId: song.id,
          difficulty: selectedDifficulty,
          bpm,
          offset,
          notes,
          creator: 'Custom Editor',
          createdAt: song.charts?.[selectedDifficulty]?.createdAt || Date.now(),
        };
        onSaveChart(song.id, selectedDifficulty, updatedChart);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [song, isDirty, selectedDifficulty, bpm, offset, notes, onSaveChart]);

  // Redundant Real-time Draft Auto-Save to localStorage
  useEffect(() => {
    if (!song) return;
    const timeout = setTimeout(() => {
      try {
        const draftKey = `BEATPULSE_CHART_DRAFT_${song.id}_${selectedDifficulty}`;
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            songId: song.id,
            difficulty: selectedDifficulty,
            bpm,
            offset,
            notes,
            timestamp: Date.now(),
          })
        );
      } catch (e) {
        // Ignore quota warning on draft
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [song?.id, selectedDifficulty, bpm, offset, notes]);

  // Sync audio buffer into audioEngine with active song isolation and lazy decoding
  useEffect(() => {
    if (!song) return;

    let isMounted = true;

    // Immediately stop any lingering previous audio and reset engine buffer
    audioEngine.stopBGM();
    audioEngine.clearActiveBuffer();
    setIsPlaying(false);

    const setupSongAudio = async () => {
      // 1. If song is a Preset song
      if (song.isPreset) {
        let buf = audioBufferFromProps;
        if (!buf) {
          const style = song.id.includes('serene')
            ? 'calm'
            : song.id.includes('cyber')
            ? 'cyber'
            : 'synthwave';
          buf = AudioService.createSynthAudio(song.bpm, song.duration, style);
        }
        if (isMounted && buf) {
          setInternalAudioBuffer(buf);
          audioEngine.loadBuffer(buf);
          audioEngine.setPlaybackRate(playbackSpeed);
        }
        return;
      }

      // 2. If YouTube track
      if (song.youtubeVideoId) {
        if (audioBufferFromProps) {
          audioEngine.setFallbackBuffer(audioBufferFromProps);
        }
        audioEngine.loadYouTubeTrack(song.youtubeVideoId);
        return;
      }

      // 3. Custom Imported Song -> Always fetch real Audio Blob from IndexedDB & decode
      setIsLoadingAudio(true);
      try {
        let decoded: AudioBuffer | null = null;
        const blob = await StorageService.getAudioBlob(song.id);
        if (blob && isMounted) {
          try {
            decoded = await AudioService.decodeAudioBlob(blob);
          } catch (decodeErr) {
            console.warn('Gagal mendekode audio blob untuk editor, mengaktifkan audio synth:', decodeErr);
          }
        }

        if (!decoded && audioBufferFromProps) {
          decoded = audioBufferFromProps;
        }

        if (!decoded) {
          console.info('[ChartEditor] Mengaktifkan audio synthesizer fallback untuk editor.');
          decoded = AudioService.createSynthAudio(song.bpm || 120, song.duration || 60, 'synthwave');
        }

        if (isMounted && decoded) {
          setInternalAudioBuffer(decoded);
          audioEngine.loadBuffer(decoded);
          audioEngine.setPlaybackRate(playbackSpeed);
        }
      } catch (err) {
        console.warn('Gagal memuat audio blob untuk editor, mengaktifkan audio darurat:', err);
        if (isMounted) {
          const fallback = AudioService.createSynthAudio(song.bpm || 120, song.duration || 60, 'synthwave');
          setInternalAudioBuffer(fallback);
          audioEngine.loadBuffer(fallback);
          audioEngine.setPlaybackRate(playbackSpeed);
        }
      } finally {
        if (isMounted) {
          setIsLoadingAudio(false);
        }
      }
    };

    setupSongAudio();

    return () => {
      isMounted = false;
      audioEngine.stopBGM();
      audioEngine.clearActiveBuffer();
    };
  }, [song?.id, audioBufferFromProps, playbackSpeed]);

  // Helper to commit new note array to history
  const updateNotesWithHistory = useCallback(
    (newNotes: Note[]) => {
      if (isLocked) return;
      const sorted = [...newNotes].sort((a, b) => a.time - b.time);

      const curHist = historyRef.current;
      const curIdx = historyIndexRef.current;

      // Check if identical to the current history state to avoid useless history entries
      const currentList = curHist[curIdx];
      if (currentList && currentList.length === sorted.length) {
        let isIdentical = true;
        for (let i = 0; i < sorted.length; i++) {
          if (
            currentList[i].id !== sorted[i].id ||
            currentList[i].lane !== sorted[i].lane ||
            Math.abs(currentList[i].time - sorted[i].time) > 0.0005 ||
            (currentList[i].duration || 0) !== (sorted[i].duration || 0)
          ) {
            isIdentical = false;
            break;
          }
        }
        if (isIdentical) {
          setNotes(sorted);
          return;
        }
      }

      let newHistory = curHist.slice(0, curIdx + 1);
      // Keep up to 60 history states for robust long sessions
      if (newHistory.length >= 60) {
        newHistory = newHistory.slice(newHistory.length - 59);
      }
      newHistory.push(sorted);
      const newIdx = newHistory.length - 1;

      historyRef.current = newHistory;
      historyIndexRef.current = newIdx;
      setHistory(newHistory);
      setHistoryIndex(newIdx);
      setNotes(sorted);
      setIsDirty(true);
    },
    [isLocked]
  );

  const undo = useCallback(() => {
    if (isLocked) return;
    const curIdx = historyIndexRef.current;
    const curHist = historyRef.current;
    if (curIdx > 0) {
      const prevIdx = curIdx - 1;
      const prevNotes = curHist[prevIdx];
      historyIndexRef.current = prevIdx;
      setHistoryIndex(prevIdx);
      setNotes(prevNotes);
      
      const matchesSaved = prevIdx === lastSavedHistoryIndexRef.current || JSON.stringify(prevNotes) === savedNotesSnapshotRef.current;
      setIsDirty(!matchesSaved);

      setHistoryToast({
        text: `↩️ Undo: Kembali ke langkah ${prevIdx} (${prevNotes.length} note)`,
        type: 'undo',
      });
      setTimeout(() => setHistoryToast((t) => (t?.type === 'undo' ? null : t)), 1600);
      audioEngine.playHitsound('tap');
    }
  }, [isLocked]);

  const redo = useCallback(() => {
    if (isLocked) return;
    const curIdx = historyIndexRef.current;
    const curHist = historyRef.current;
    if (curIdx < curHist.length - 1) {
      const nextIdx = curIdx + 1;
      const nextNotes = curHist[nextIdx];
      historyIndexRef.current = nextIdx;
      setHistoryIndex(nextIdx);
      setNotes(nextNotes);

      const matchesSaved = nextIdx === lastSavedHistoryIndexRef.current || JSON.stringify(nextNotes) === savedNotesSnapshotRef.current;
      setIsDirty(!matchesSaved);

      setHistoryToast({
        text: `↪️ Redo: Maju ke langkah ${nextIdx} (${nextNotes.length} note)`,
        type: 'redo',
      });
      setTimeout(() => setHistoryToast((t) => (t?.type === 'redo' ? null : t)), 1600);
      audioEngine.playHitsound('tap');
    }
  }, [isLocked]);

  // Synchronize currentTimeRef with state
  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  // Audio Time Update & Realtime Hitsound / Metronome Loop
  useEffect(() => {
    let lastTime = performance.now();

    const updateLoop = () => {
      if (isPlaying) {
        const now = performance.now();
        const delta = (now - lastTime) / 1000;
        lastTime = now;

        let time = currentTimeRef.current;
        const audioPos = time - offset;

        if (audioPos < 0) {
          // Delay period before audio starts (positive offset)
          time = Math.max(0, time + delta * playbackSpeed);
          if (time >= offset) {
            audioEngine.playBGM(Math.max(0, time - offset), playbackSpeed);
          }
        } else {
          // Audio active period
          if (!audioEngine.getIsPlaying()) {
            audioEngine.playBGM(Math.max(0, audioPos), playbackSpeed);
          }
          time = audioEngine.getCurrentTime() + offset;
        }

        currentTimeRef.current = time;
        setCurrentTime(time);

        const duration = effectiveDuration;
        if (time >= duration) {
          setIsPlaying(false);
          audioEngine.pauseBGM();
        }

        // Trigger Editor Hitsounds for notes crossing playhead
        if (enableHitsounds) {
          notes.forEach((n) => {
            if (n.time >= lastHitsoundTimeRef.current && n.time <= time) {
              audioEngine.playHitsound(n.duration ? 'hold' : 'tap');
            }
            if (n.duration && n.duration > 0) {
              const holdEndTime = n.time + n.duration;
              if (holdEndTime >= lastHitsoundTimeRef.current && holdEndTime <= time) {
                audioEngine.playHitsound('holdEnd');
              }
            }
          });
        }
        lastHitsoundTimeRef.current = time;

        // Trigger Metronome ticks
        if (enableMetronome) {
          const beatSec = 60 / bpm;
          const currentBeat = Math.floor(time / beatSec);
          if (currentBeat > lastMetronomeBeatRef.current && currentBeat >= 0) {
            audioEngine.playMetronomeTick(currentBeat % 4 === 0);
            lastMetronomeBeatRef.current = currentBeat;
          }
        }
      } else {
        lastTime = performance.now();
      }
      animFrameRef.current = requestAnimationFrame(updateLoop);
    };

    animFrameRef.current = requestAnimationFrame(updateLoop);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isPlaying, song, notes, enableHitsounds, enableMetronome, bpm, offset, playbackSpeed]);

  // Toggle Playback
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      audioEngine.pauseBGM();
      setIsPlaying(false);
    } else {
      lastHitsoundTimeRef.current = currentTime;
      lastMetronomeBeatRef.current = Math.floor(currentTime / (60 / bpm));

      const audioPos = currentTime - offset;
      if (audioPos >= 0) {
        audioEngine.playBGM(audioPos, playbackSpeed);
      } else {
        audioEngine.pauseBGM(); // Start in delay period
      }
      setIsPlaying(true);
    }
  }, [isPlaying, currentTime, playbackSpeed, offset, bpm]);

  // Seek audio helper
  const handleSeek = useCallback(
    (newTime: number) => {
      const clampedTime = Math.max(0, Math.min(effectiveDuration, newTime));
      currentTimeRef.current = clampedTime;
      setCurrentTime(clampedTime);
      lastHitsoundTimeRef.current = clampedTime;

      const audioPos = clampedTime - offset;
      if (audioPos >= 0) {
        audioEngine.seek(audioPos);
      } else {
        audioEngine.pauseBGM();
      }
    },
    [effectiveDuration, offset]
  );

  // Step playhead by snap division (exact snapped note distance grid)
  const handleStepPlayhead = useCallback(
    (direction: -1 | 1) => {
      const beatSec = 60 / (bpm || 120);
      let stepDur = beatSec / 4;
      if (snapDivision === 1) stepDur = beatSec;
      else if (snapDivision === 2) stepDur = beatSec / 2;
      else if (snapDivision === 4) stepDur = beatSec / 4;
      else if (snapDivision === 8) stepDur = beatSec / 8;
      else if (snapDivision === 16) stepDur = beatSec / 16;
      else if (snapDivision === 3) stepDur = beatSec / 3;
      else if (snapDivision === 6) stepDur = beatSec / 6;
      else stepDur = beatSec / (snapDivision / 4);

      const currentBeatRel = currentTime / stepDur;
      
      let targetIndex: number;
      if (direction > 0) {
        targetIndex = Math.floor(currentBeatRel + 0.005) + 1;
      } else {
        targetIndex = Math.ceil(currentBeatRel - 0.005) - 1;
      }
      
      const targetTime = Math.max(0, Math.min(effectiveDuration, targetIndex * stepDur));
      handleSeek(Number(targetTime.toFixed(3)));
    },
    [bpm, snapDivision, currentTime, offset, effectiveDuration, handleSeek]
  );

  // Jump to prev/next notes
  const jumpToPrevNote = useCallback(() => {
    const prev = [...notes].reverse().find((n) => n.time < currentTime - 0.03);
    if (prev) handleSeek(prev.time);
  }, [notes, currentTime, handleSeek]);

  const jumpToNextNote = useCallback(() => {
    const next = notes.find((n) => n.time > currentTime + 0.03);
    if (next) handleSeek(next.time);
  }, [notes, currentTime, handleSeek]);

  // Place note at time with optional hold duration
  const handlePlaceNote = useCallback(
    (lane: number, timeInSec: number, explicitDuration?: number) => {
      if (song?.isPreset || isLocked) return;
      const placeTime = Number(timeInSec.toFixed(3));
      const tolerance = 0.045; // 45ms exact touch/click duplicate tolerance

      const existingIdx = notes.findIndex(
        (n) => n.lane === lane && Math.abs(n.time - placeTime) < tolerance
      );

      if (existingIdx >= 0) {
        const existingNote = notes[existingIdx];
        const hasExplicitDur = explicitDuration !== undefined;
        const newDur = explicitDuration && explicitDuration > 0 ? Number(explicitDuration.toFixed(3)) : undefined;

        // If explicitDuration is passed and differs from existing duration: UPDATE the note!
        if (hasExplicitDur && newDur !== existingNote.duration) {
          const updated = notes.map((n, idx) =>
            idx === existingIdx ? { ...n, duration: newDur } : n
          );
          updateNotesWithHistory(updated);
          audioEngine.playHitsound('perfect');
        } else if ((!existingNote.duration && newDur) || (existingNote.duration && !newDur)) {
          // Tap <-> Hold conversion
          const updated = notes.map((n, idx) =>
            idx === existingIdx ? { ...n, duration: newDur } : n
          );
          updateNotesWithHistory(updated);
          audioEngine.playHitsound('perfect');
        } else {
          // Toggle delete if clicking identical note with identical type/duration
          const remaining = notes.filter((_, idx) => idx !== existingIdx);
          updateNotesWithHistory(remaining);
          audioEngine.playHitsound('tap');
        }
      } else {
        const newNote: Note = {
          id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          lane,
          time: placeTime,
          duration: explicitDuration && explicitDuration > 0 ? Number(explicitDuration.toFixed(3)) : undefined,
        };
        updateNotesWithHistory([...notes, newNote]);
        audioEngine.playHitsound('perfect');
      }
    },
    [notes, song?.isPreset, isLocked, updateNotesWithHistory]
  );

  // Copy & Paste Notes
  const handleCopySelected = useCallback(() => {
    if (selectedNoteIds.length === 0) return;
    const selectedNotes = notes.filter((n) => selectedNoteIds.includes(n.id));
    setClipboardNotes(selectedNotes);
  }, [notes, selectedNoteIds]);

  const handlePasteNotes = useCallback(() => {
    if (clipboardNotes.length === 0 || song?.isPreset || isLocked) return;
    const earliestTime = Math.min(...clipboardNotes.map((n) => n.time));
    const timeShift = currentTime - earliestTime;

    const newNotes = clipboardNotes.map((n) => ({
      ...n,
      id: `paste_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      time: Number(Math.max(0, n.time + timeShift).toFixed(3)),
    }));

    updateNotesWithHistory([...notes, ...newNotes]);
    setSelectedNoteIds(newNotes.map((n) => n.id));
    audioEngine.playHitsound('perfect');
  }, [clipboardNotes, currentTime, notes, song?.isPreset, isLocked, updateNotesWithHistory]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedNoteIds.length === 0 || song?.isPreset || isLocked) return;
    const remaining = notes.filter((n) => !selectedNoteIds.includes(n.id));
    updateNotesWithHistory(remaining);
    setSelectedNoteIds([]);
    audioEngine.playHitsound('tap');
  }, [notes, selectedNoteIds, song?.isPreset, isLocked, updateNotesWithHistory]);

  // Global Shift All Notes
  const handleShiftAllNotes = useCallback(
    (timeShift: number) => {
      if (song?.isPreset || isLocked || notes.length === 0) return;
      const shifted = notes.map((n) => ({
        ...n,
        time: Number(Math.max(0, n.time + timeShift).toFixed(3)),
      }));
      updateNotesWithHistory(shifted);
      audioEngine.playHitsound('perfect');
    },
    [song?.isPreset, isLocked, notes, updateNotesWithHistory]
  );

  // Align First Note to Current Playhead
  const handleAlignFirstNoteToPlayhead = useCallback(() => {
    if (song?.isPreset || isLocked || notes.length === 0) return;
    const firstTime = Math.min(...notes.map((n) => n.time));
    const shift = currentTime - firstTime;
    handleShiftAllNotes(shift);
  }, [song?.isPreset, isLocked, notes, currentTime, handleShiftAllNotes]);

  // Align First Note to First Audio Peak
  const handleAlignFirstNoteToFirstPeak = useCallback(() => {
    if (song?.isPreset || isLocked || !audioBuffer || notes.length === 0) return;
    const beatAnalysis = detectBpmAndPeaks(audioBuffer);
    const firstPeakTime = beatAnalysis.peaks[0]?.time ?? beatAnalysis.offset ?? 0;
    const firstNoteTime = Math.min(...notes.map((n) => n.time));
    const shift = firstPeakTime - firstNoteTime;
    handleShiftAllNotes(shift);
  }, [song?.isPreset, isLocked, audioBuffer, notes, handleShiftAllNotes]);

  // Nudge selected notes lane
  const handleNudgeSelectedNotesLane = useCallback(
    (deltaLane: -1 | 1) => {
      if (selectedNoteIds.length === 0 || song?.isPreset || isLocked) return;
      const selected = notes.filter((n) => selectedNoteIds.includes(n.id));
      const minLane = Math.min(...selected.map((n) => n.lane));
      const maxLane = Math.max(...selected.map((n) => n.lane));

      if (deltaLane === -1 && minLane <= 0) return;
      if (deltaLane === 1 && maxLane >= 3) return;

      const updated = notes.map((n) => {
        if (selectedNoteIds.includes(n.id)) {
          return { ...n, lane: n.lane + deltaLane };
        }
        return n;
      });

      updateNotesWithHistory(updated);
      audioEngine.playHitsound('perfect');
    },
    [selectedNoteIds, song?.isPreset, isLocked, notes, updateNotesWithHistory]
  );

  // Nudge selected notes time
  const handleNudgeSelectedNotesTime = useCallback(
    (direction: -1 | 1, isMultiplier = false) => {
      if (selectedNoteIds.length === 0 || song?.isPreset || isLocked) return;
      const stepDur = ((60 / bpm) / (snapDivision / 4)) * (isMultiplier ? 4 : 1);
      const delta = direction * stepDur;

      const updated = notes.map((n) => {
        if (selectedNoteIds.includes(n.id)) {
          return {
            ...n,
            time: Math.max(0, Number((n.time + delta).toFixed(3))),
          };
        }
        return n;
      });

      updateNotesWithHistory(updated);
      audioEngine.playHitsound('tap');
    },
    [selectedNoteIds, song?.isPreset, isLocked, bpm, snapDivision, notes, updateNotesWithHistory]
  );

  // Duplicate selected notes
  const handleDuplicateSelected = useCallback(() => {
    if (selectedNoteIds.length === 0 || song?.isPreset || isLocked) return;
    const stepDur = (60 / bpm) / (snapDivision / 4);
    const selected = notes.filter((n) => selectedNoteIds.includes(n.id));
    const newNotes = selected.map((n) => ({
      ...n,
      id: `dup_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      time: Number((n.time + stepDur).toFixed(3)),
    }));
    updateNotesWithHistory([...notes, ...newNotes]);
    setSelectedNoteIds(newNotes.map((n) => n.id));
    audioEngine.playHitsound('perfect');
  }, [selectedNoteIds, song?.isPreset, isLocked, bpm, snapDivision, notes, updateNotesWithHistory]);

  // Keyboard Shortcuts Handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd && e.code === 'KeyZ') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (isCtrlOrCmd && e.code === 'KeyY') {
        e.preventDefault();
        redo();
      } else if (isCtrlOrCmd && e.code === 'KeyC') {
        e.preventDefault();
        handleCopySelected();
      } else if (isCtrlOrCmd && e.code === 'KeyV') {
        e.preventDefault();
        handlePasteNotes();
      } else if (isCtrlOrCmd && e.code === 'KeyD') {
        e.preventDefault();
        handleDuplicateSelected();
      } else if (isCtrlOrCmd && e.code === 'KeyA') {
        e.preventDefault();
        setSelectedNoteIds(notes.map((n) => n.id));
      } else if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyH') {
        e.preventDefault();
        setToolMode('pan');
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        setToolMode('range');
      } else if (e.code === 'KeyV') {
        e.preventDefault();
        setToolMode('select');
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        setToolMode('eraser');
      } else if (e.code === 'KeyQ') {
        e.preventDefault();
        jumpToPrevNote();
      } else if (e.code === 'KeyW') {
        e.preventDefault();
        jumpToNextNote();
      } else if (e.code === 'BracketLeft') {
        e.preventDefault();
        setHoldDuration((d) => Math.max(0.1, Number((d - 0.1).toFixed(2))));
      } else if (e.code === 'BracketRight') {
        e.preventDefault();
        setHoldDuration((d) => Math.min(5.0, Number((d + 0.1).toFixed(2))));
      } else if (e.code === 'ArrowUp' && selectedNoteIds.length > 0) {
        e.preventDefault();
        handleNudgeSelectedNotesLane(-1);
      } else if (e.code === 'ArrowDown' && selectedNoteIds.length > 0) {
        e.preventDefault();
        handleNudgeSelectedNotesLane(1);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (selectedNoteIds.length > 0 && (e.altKey || isCtrlOrCmd)) {
          handleNudgeSelectedNotesTime(-1, e.shiftKey);
        } else {
          handleStepPlayhead(-1);
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (selectedNoteIds.length > 0 && (e.altKey || isCtrlOrCmd)) {
          handleNudgeSelectedNotesTime(1, e.shiftKey);
        } else {
          handleStepPlayhead(1);
        }
      } else if (['Digit1', 'Digit2', 'Digit3', 'Digit4', 'KeyD', 'KeyF', 'KeyJ', 'KeyK'].includes(e.code)) {
        let lane = -1;
        if (e.code === 'Digit1' || e.code === 'KeyD') lane = 0;
        else if (e.code === 'Digit2' || e.code === 'KeyF') lane = 1;
        else if (e.code === 'Digit3' || e.code === 'KeyJ') lane = 2;
        else if (e.code === 'Digit4' || e.code === 'KeyK') lane = 3;
        if (lane >= 0 && lane < 4) {
          e.preventDefault();
          const dur = toolMode === 'hold' ? holdDuration : undefined;
          handlePlaceNote(lane, currentTime, dur);
        }
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        if (selectedNoteIds.length > 0) {
          handleDeleteSelected();
        } else {
          const stepDur = (60 / bpm) / (snapDivision / 4);
          const remaining = notes.filter((n) => Math.abs(n.time - currentTime) > stepDur / 2);
          updateNotesWithHistory(remaining);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlay,
    currentTime,
    bpm,
    notes,
    selectedNoteIds,
    snapDivision,
    toolMode,
    holdDuration,
    undo,
    redo,
    handleCopySelected,
    handlePasteNotes,
    handleDuplicateSelected,
    handleDeleteSelected,
    handlePlaceNote,
    handleSeek,
    jumpToPrevNote,
    jumpToNextNote,
    handleNudgeSelectedNotesLane,
    handleNudgeSelectedNotesTime,
    updateNotesWithHistory,
  ]);

  // Tap Tempo
  const handleTapTempo = () => {
    const now = performance.now() / 1000;
    const recent = tapTempoTimes.filter((t) => now - t < 3.0);
    const updated = [...recent, now];
    setTapTempoTimes(updated);

    if (updated.length >= 3) {
      const intervals = [];
      for (let i = 1; i < updated.length; i++) {
        intervals.push(updated[i] - updated[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      if (avgInterval > 0) {
        const calculatedBpm = Math.round(60 / avgInterval);
        if (calculatedBpm >= 60 && calculatedBpm <= 240) {
          setBpm(calculatedBpm);
          setIsDirty(true);
        }
      }
    }
  };

  // Auto Beat Generator
  const handleAutoGenerate = (density: DifficultyLevel) => {
    if (!song || !audioBuffer || isLocked) return;
    const beatAnalysis = detectBpmAndPeaks(audioBuffer);
    const autoChart = generateAutoChart(song.id, song.duration, beatAnalysis, density);
    updateNotesWithHistory(autoChart.notes);
    setBpm(beatAnalysis.bpm);
    setOffset(beatAnalysis.offset);
  };

  // Quantize All Notes
  const handleQuantizeNotes = () => {
    if (isLocked) return;
    const beatDur = 60 / bpm;
    const stepDur = beatDur / (snapDivision / 4);
    const quantized = notes.map((n) => {
      const snappedTime = Number(
        (Math.round(n.time / stepDur) * stepDur).toFixed(3)
      );
      return { ...n, time: Math.max(0, snappedTime) };
    });
    updateNotesWithHistory(quantized);
  };

  // Mirror Lanes
  const handleMirrorChart = () => {
    if (isLocked) return;
    const mirrored = notes.map((n) => ({
      ...n,
      lane: 3 - n.lane,
    }));
    updateNotesWithHistory(mirrored);
  };

  // Save Chart
  const handleSave = async () => {
    if (!song) return;
    const updatedChart: Chart = {
      id: song.charts?.[selectedDifficulty]?.id || `chart_${song.id}_${selectedDifficulty}`,
      songId: song.id,
      difficulty: selectedDifficulty,
      bpm,
      offset,
      notes,
      creator: 'Custom Editor',
      createdAt: Date.now(),
    };

    onSaveChart(song.id, selectedDifficulty, updatedChart);
    lastSavedHistoryIndexRef.current = historyIndexRef.current;
    savedNotesSnapshotRef.current = JSON.stringify(notes);
    setIsDirty(false);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  // Test Play
  const handleTestPlay = () => {
    if (!song) return;
    const chartObj: Chart = {
      id: `test_${Date.now()}`,
      songId: song.id,
      difficulty: selectedDifficulty,
      bpm,
      offset,
      notes,
      creator: 'Editor Test',
      createdAt: Date.now(),
    };
    onTestPlay(song, chartObj);
  };

  // Export JSON
  const handleExportChart = () => {
    const exportData = {
      songTitle: song?.title,
      songArtist: song?.artist,
      difficulty: selectedDifficulty,
      bpm,
      offset,
      notes,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${song?.title || 'chart'}_${selectedDifficulty}.json`;
    a.click();
  };

  // Import JSON Chart
  const handleImportChartJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isLocked) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.bpm) setBpm(json.bpm);
        if (json.offset !== undefined) setOffset(json.offset);
        if (Array.isArray(json.notes)) updateNotesWithHistory(json.notes);
      } catch {
        alert('File JSON chart tidak valid.');
      }
    };
    reader.readAsText(file);
  };

  const handleBackToLibrary = () => {
    if (song && !song.isPreset && isDirty) {
      handleSave();
    }
    if (onBackToLibrary) {
      onBackToLibrary();
    }
  };

  if (!song) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 p-6 text-center space-y-4">
        <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 max-w-md w-full space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-indigo-950 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto">
            <Music className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-black text-white">Tidak Ada Lagu Terpilih</h2>
            <p className="text-slate-400 text-xs">Pilih lagu dari perpustakaan untuk membuka editor chart.</p>
          </div>
          {onBackToLibrary && (
            <button
              onClick={onBackToLibrary}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              Kembali ke Perpustakaan
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-slate-50 text-slate-900 pb-28">
      <div className="max-w-5xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-5 space-y-4 flex-1 flex flex-col items-center">
        {/* Hidden JSON File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleImportChartJSON}
        />

        {/* Preset Locked Notice Banner */}
        {song?.isPreset && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div>
                <span className="font-bold text-amber-800">Preset Track (Read-Only)</span>
                <p className="text-amber-700 text-xs">
                  Chart lagu bawaan terkunci. Tekan "Test Main" untuk mencoba memainkan chart ini.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-block px-2 py-0.5 bg-amber-100 text-amber-800 font-mono font-bold text-xs rounded-lg border border-amber-300">
              Read Only
            </span>
          </div>
        )}

        {/* 1. Systematic Top Header Bar */}
        <EditorHeader
          songs={songs}
          selectedSongId={selectedSongId}
          selectedDifficulty={selectedDifficulty}
          bpm={bpm}
          notesCount={notes.length}
          currentTime={currentTime}
          isDirty={isDirty}
          saveSuccess={saveSuccess}
          saveMode={saveMode}
          isLocked={isLocked}
          onToggleLock={() => setIsLocked((l) => !l)}
          onSelectSong={setSelectedSongId}
          onSelectDifficulty={setSelectedDifficulty}
          onSave={handleSave}
          onTestPlay={handleTestPlay}
          onBackToLibrary={handleBackToLibrary}
          onOpenMoreHub={() => setIsMoreHubOpen(true)}
        />

        {/* Undo / Redo Toast Visual HUD Notification */}
        {historyToast && (
          <div
            className={`w-full p-2.5 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 border ${
              historyToast.type === 'undo'
                ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-amber-500/10'
                : 'bg-sky-50 border-sky-300 text-sky-900 shadow-sky-500/10'
            }`}
          >
            <span>{historyToast.text}</span>
            <span className="text-[10px] font-mono opacity-70">
              Langkah {historyIndex} / {Math.max(0, history.length - 1)}
            </span>
          </div>
        )}

        {/* 2. SINGLE-TAB DEDICATED WORKSPACE (STUDIO LINIMASA, TRANSPORT, DAN PAD) */}
        <main className="w-full space-y-3.5 pb-8 animate-in fade-in duration-150">
          {/* Main Transport Scrubber - Clean 1-Baris */}
          <EditorTransport
            currentTime={currentTime}
            duration={effectiveDuration}
            bpm={bpm}
            offset={offset}
            isPlaying={isPlaying}
            zoomScale={zoomScale}
            snapDivision={snapDivision}
            enableHitsounds={enableHitsounds}
            enableMetronome={enableMetronome}
            onTogglePlay={togglePlay}
            onSeek={handleSeek}
            onStepPlayhead={handleStepPlayhead}
            onJumpToPrevNote={jumpToPrevNote}
            onJumpToNextNote={jumpToNextNote}
            onToggleHitsounds={() => setEnableHitsounds(!enableHitsounds)}
            onToggleMetronome={() => setEnableMetronome(!enableMetronome)}
            onUndo={undo}
            onRedo={redo}
            historyIndex={historyIndex}
            historyLength={history.length}
            isLocked={isLocked}
            isPreset={!!song?.isPreset}
            canvasHeightMode={canvasHeightMode}
            onToggleCanvasHeightMode={() => setCanvasHeightMode((m) => (m === 'normal' ? 'large' : 'normal'))}
            onChangeZoom={(delta) => setZoomScale((z) => Math.min(240, Math.max(40, z + delta)))}
            onResetZoom={() => setZoomScale(90)}
          />

          {/* Bilah Alat Rentang Inline Ditampilkan Langsung di Atas Chart */}
          {isRangeModalOpen && (
            <EditorRangeModal
              isOpen={isRangeModalOpen}
              onClose={() => setIsRangeModalOpen(false)}
              notes={notes}
              currentTime={currentTime}
              duration={effectiveDuration}
              bpm={bpm}
              isLocked={isLocked}
              isPreset={!!song?.isPreset}
              onUpdateNotes={updateNotesWithHistory}
              onSelectNotes={setSelectedNoteIds}
              onCopySelected={handleCopySelected}
            />
          )}

          {/* 4-Lane Sequencer Canvas with Integrated 4-Lane Pad & Bottom Calibration */}
          <EditorSequencerCanvas
            bpm={bpm}
            offset={offset}
            currentTime={currentTime}
            duration={song?.duration || 0}
            notes={notes}
            snapDivision={snapDivision}
            zoomScale={zoomScale}
            audioBuffer={audioBuffer}
            selectedNoteIds={selectedNoteIds}
            clipboardNotes={clipboardNotes}
            historyIndex={historyIndex}
            historyLength={history.length}
            isPreset={!!song?.isPreset}
            isLocked={isLocked}
            toolMode={toolMode}
            holdDuration={holdDuration}
            showTapPads={true}
            canvasHeightMode={canvasHeightMode}
            enableHitsounds={enableHitsounds}
            enableMetronome={enableMetronome}
            isPlaying={isPlaying}
            onSnapDivisionChange={setSnapDivision}
            onTogglePlay={togglePlay}
            onUpdateBpm={(newBpm) => {
              setBpm(newBpm);
              setIsDirty(true);
            }}
            onUpdateOffset={(newOffset) => {
              setOffset(newOffset);
              setIsDirty(true);
            }}
            onToggleHitsounds={() => setEnableHitsounds(!enableHitsounds)}
            onToggleMetronome={() => setEnableMetronome(!enableMetronome)}
            onTapTempo={handleTapTempo}
            onSetToolMode={setToolMode}
            onHoldDurationChange={setHoldDuration}
            onPlaceNote={handlePlaceNote}
            onUpdateNotes={updateNotesWithHistory}
            onSelectNotes={setSelectedNoteIds}
            onCopySelected={handleCopySelected}
            onPasteNotes={handlePasteNotes}
            onDeleteSelected={handleDeleteSelected}
            onSeek={handleSeek}
            onUndo={undo}
            onRedo={redo}
            onStepPlayhead={handleStepPlayhead}
            onJumpToPrevNote={jumpToPrevNote}
            onJumpToNextNote={jumpToNextNote}
            onZoomChange={(delta) => setZoomScale((z) => Math.min(240, Math.max(40, z + delta)))}
            isRangeModalOpen={isRangeModalOpen}
            onOpenRangeModal={() => setIsRangeModalOpen(true)}
          />
        </main>
      </div>

      {/* 3. FULL-SCREEN MORE HUB & 8 SUB-PAGES MEDIATOR */}
      <EditorMoreHub
        isOpen={isMoreHubOpen}
        onClose={() => setIsMoreHubOpen(false)}
        songs={songs}
        selectedSongId={selectedSongId}
        selectedDifficulty={selectedDifficulty}
        bpm={bpm}
        offset={offset}
        duration={effectiveDuration}
        currentTime={currentTime}
        notes={notes}
        isLocked={isLocked}
        isPreset={!!song?.isPreset}
        audioBuffer={audioBuffer}
        enableHitsounds={enableHitsounds}
        enableMetronome={enableMetronome}
        saveMode={saveMode}
        onSelectSong={setSelectedSongId}
        onSelectDifficulty={setSelectedDifficulty}
        onUpdateBpm={(newBpm) => {
          setBpm(newBpm);
          setIsDirty(true);
        }}
        onUpdateOffset={(newOffset) => {
          setOffset(newOffset);
          setIsDirty(true);
        }}
        onUpdateDuration={handleUpdateDuration}
        onUpdateNotes={updateNotesWithHistory}
        onToggleHitsounds={() => setEnableHitsounds(!enableHitsounds)}
        onToggleMetronome={() => setEnableMetronome(!enableMetronome)}
        onChangeSaveMode={handleSetSaveMode}
        onExportJSON={handleExportChart}
        onTriggerImportJSON={() => fileInputRef.current?.click()}
        onImportChartJson={onImportChartJson}
        onRelinkSongAudio={onRelinkSongAudio}
        onAddDifficulty={onAddDifficulty}
        onRenameDifficulty={onRenameDifficulty}
        onDeleteDifficulty={onDeleteDifficulty}
        onReorderDifficulties={onReorderDifficulties}
        onDuplicateDifficulty={onDuplicateDifficulty}
      />
    </div>
  );
};
