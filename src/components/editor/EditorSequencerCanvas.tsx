import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  MousePointer,
  Circle,
  Clock,
  Eraser,
  Layers,
  Sparkles,
  Sliders,
  Activity,
  Gauge,
  Volume2,
  Lock,
  CheckCircle2,
  Zap,
  Hand,
  Wand2,
  Copy,
  Scissors,
  ArrowRight,
  Repeat,
  ArrowLeftRight,
  Check,
  Trash2,
} from 'lucide-react';
import { Note } from '../../types';
import { audioEngine } from '../../lib/audioEngine';
import { detectBpmAndPeaks, BeatAnalysisResult } from '../../lib/beatDetector';
import { EditorMobilePad } from './EditorMobilePad';

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

export type EditorToolMode = 'pan' | 'tap' | 'hold' | 'select' | 'range' | 'eraser';
export type StudioInterval = 1 | 2 | 4 | 8 | 16 | 3 | 6; // 1 = 1 Beat, 2 = 1/2 Beat, 4 = 1/4 Beat, 8 = 1/8 Beat, 16 = 1/16 Beat, 3 = 1/3 Triplet, 6 = 1/6 Triplet

interface EditorSequencerCanvasProps {
  bpm: number;
  offset: number;
  currentTime: number;
  duration: number;
  notes: Note[];
  snapDivision: number;
  zoomScale: number;
  audioBuffer: AudioBuffer | null;
  selectedNoteIds: string[];
  clipboardNotes: Note[];
  historyIndex: number;
  historyLength: number;
  isPreset: boolean;
  isLocked?: boolean;
  toolMode?: EditorToolMode;
  holdDuration?: number;
  showTapPads?: boolean;
  canvasHeightMode?: 'normal' | 'large';
  enableHitsounds?: boolean;
  enableMetronome?: boolean;
  isPlaying?: boolean;
  onSnapDivisionChange?: (snap: number) => void;
  onTogglePlay?: () => void;
  onSetToolMode?: (mode: EditorToolMode) => void;
  onHoldDurationChange?: (dur: number) => void;
  onPlaceNote: (lane: number, time: number, explicitDuration?: number) => void;
  onUpdateNotes: (newNotes: Note[]) => void;
  onSelectNotes: (ids: string[]) => void;
  onCopySelected: () => void;
  onPasteNotes: () => void;
  onDeleteSelected: () => void;
  onSeek: (time: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onStepPlayhead: (direction: -1 | 1) => void;
  onJumpToPrevNote: () => void;
  onJumpToNextNote: () => void;
  onZoomChange: (delta: number) => void;
  onOpenGlobalShift?: () => void;
  onOpenRangeModal?: () => void;
  isRangeModalOpen?: boolean;
  onUpdateBpm?: (newBpm: number) => void;
  onUpdateOffset?: (newOffset: number) => void;
  onToggleHitsounds?: () => void;
  onToggleMetronome?: () => void;
  onTapTempo?: () => void;
}

export const EditorSequencerCanvas: React.FC<EditorSequencerCanvasProps> = ({
  bpm,
  offset,
  currentTime,
  duration,
  notes,
  snapDivision,
  zoomScale,
  audioBuffer,
  selectedNoteIds,
  clipboardNotes,
  historyIndex,
  historyLength,
  isPreset,
  isLocked = false,
  toolMode: controlledToolMode,
  holdDuration: controlledHoldDuration,
  canvasHeightMode = 'normal',
  enableHitsounds = true,
  enableMetronome = false,
  isPlaying = false,
  onSnapDivisionChange,
  onTogglePlay,
  onSetToolMode,
  onHoldDurationChange,
  onPlaceNote,
  onUpdateNotes,
  onSelectNotes,
  onCopySelected,
  onPasteNotes,
  onDeleteSelected,
  onSeek,
  onUndo,
  onRedo,
  onStepPlayhead,
  onJumpToPrevNote,
  onJumpToNextNote,
  onZoomChange,
  onOpenGlobalShift,
  onOpenRangeModal,
  isRangeModalOpen = false,
  onUpdateBpm,
  onUpdateOffset,
  onToggleHitsounds,
  onToggleMetronome,
  onTapTempo,
}) => {
  const [internalToolMode, setInternalToolMode] = useState<EditorToolMode>('tap');
  const toolMode = controlledToolMode !== undefined ? controlledToolMode : internalToolMode;
  const setToolMode = (mode: EditorToolMode) => {
    if (onSetToolMode) onSetToolMode(mode);
    else setInternalToolMode(mode);
  };

  const [internalHoldDuration, setInternalHoldDuration] = useState<number>(0.5);
  const holdDuration = controlledHoldDuration !== undefined ? controlledHoldDuration : internalHoldDuration;
  const setHoldDuration = (dur: number) => {
    if (onHoldDurationChange) onHoldDurationChange(dur);
    else setInternalHoldDuration(dur);
  };

  // Studio Rhythmic Placement & Step Record States
  const [studioInterval, setInternalStudioInterval] = useState<StudioInterval>(
    (snapDivision as StudioInterval) || 4
  );
  const setStudioInterval = (interval: StudioInterval) => {
    setInternalStudioInterval(interval);
    if (onSnapDivisionChange) onSnapDivisionChange(interval);
  };
  const [stepRecordMode, setStepRecordMode] = useState<boolean>(false);
  const [showRhythmPhrases, setShowRhythmPhrases] = useState<boolean>(false);

  // Mouse hover ghost preview coordinates
  const [hoverGuide, setHoverGuide] = useState<{
    lane: number;
    time: number;
    rawX: number;
    rawY: number;
  } | null>(null);

  // Drag selection state
  const [isDragSelecting, setIsDragSelecting] = useState<boolean>(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrentPos, setDragCurrentPos] = useState<{ x: number; y: number } | null>(null);

  // Hold note tail resizing state
  const [draggedHoldNoteId, setDraggedHoldNoteId] = useState<string | null>(null);

  // Panning state
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStartX, setPanStartX] = useState<number>(0);
  const [panStartTime, setPanStartTime] = useState<number>(0);

  // Sync Toast notification
  const [autoSyncSuccess, setAutoSyncSuccess] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const touchStateRef = useRef<{
    clientX: number;
    clientY: number;
    startTime: number;
    isRuler: boolean;
    hasMoved: boolean;
  } | null>(null);

  // Analyze Audio Peaks & Vocal Transients
  const audioAnalysis = useMemo<BeatAnalysisResult | null>(() => {
    if (!audioBuffer) return null;
    try {
      return detectBpmAndPeaks(audioBuffer);
    } catch {
      return null;
    }
  }, [audioBuffer]);

  // Calculations for Step Intervals & Time Snapping
  const beatDuration = 60 / (bpm || 120);

  const getIntervalDuration = useCallback(
    (interval: StudioInterval): number => {
      if (interval === 1) return beatDuration; // 1 Beat (Downbeat)
      if (interval === 2) return beatDuration / 2; // 1/2 Beat
      if (interval === 4) return beatDuration / 4; // 1/4 Beat
      if (interval === 8) return beatDuration / 8; // 1/8 Beat
      if (interval === 16) return beatDuration / 16; // 1/16 Beat
      if (interval === 3) return beatDuration / 3; // Triplet 1/3
      if (interval === 6) return beatDuration / 6; // Triplet 1/6
      return beatDuration / 4;
    },
    [beatDuration]
  );

  const stepIntervalDuration = getIntervalDuration(studioInterval);
  const defaultStepDuration = beatDuration / (snapDivision / 4);

  // Strict BPM Grid Snapping Function (Standard BPM Baku Grid)
  const calculateSnappedTime = useCallback(
    (rawTime: number): number => {
      const gridStep = stepIntervalDuration;
      const gridSnapped = Math.round(rawTime / gridStep) * gridStep;
      return Number(Math.max(0, gridSnapped).toFixed(3));
    },
    [stepIntervalDuration]
  );

  const currentSnappedTime = calculateSnappedTime(currentTime);

  // Auto Sync BPM & Audio Offset
  const handleAutoSyncBpmAndOffset = () => {
    if (!audioBuffer) return;
    try {
      const analysis = detectBpmAndPeaks(audioBuffer);
      if (analysis && analysis.bpm) {
        if (onUpdateBpm) onUpdateBpm(analysis.bpm);
        if (onUpdateOffset) onUpdateOffset(Number(analysis.offset.toFixed(3)));
        setAutoSyncSuccess(
          `BPM disetel ke ${analysis.bpm}, Offset ke ${
            analysis.offset >= 0 ? `+${(analysis.offset * 1000).toFixed(0)}` : (analysis.offset * 1000).toFixed(0)
          } ms`
        );
        audioEngine.playHitsound('perfect');
        setTimeout(() => setAutoSyncSuccess(null), 4000);
      }
    } catch {
      // Safe fallback
    }
  };

  // Studio Quick Rhythm Phrase Inserters (Playhead stays stationary)
  const insertRhythmPhrase = (
    type: 'roll_8' | 'downbeats' | 'walk_2' | 'gallop' | 'triplet' | 'vocal_hold_tap'
  ) => {
    if (isPreset || isLocked) return;
    const startTime = currentSnappedTime;
    const newNotes: Note[] = [...notes];

    if (type === 'roll_8') {
      const step = beatDuration / 2;
      for (let i = 0; i < 4; i++) {
        const t = startTime + i * step;
        newNotes.push({
          id: `studio_roll_${Date.now()}_${i}`,
          lane: i % 4,
          time: Number(t.toFixed(3)),
        });
      }
    } else if (type === 'downbeats') {
      for (let i = 0; i < 4; i++) {
        const t = startTime + i * beatDuration;
        newNotes.push({
          id: `studio_down_${Date.now()}_${i}`,
          lane: i % 2 === 0 ? 1 : 2,
          time: Number(t.toFixed(3)),
        });
      }
    } else if (type === 'walk_2') {
      const step = beatDuration / 2;
      for (let i = 0; i < 4; i++) {
        const t = startTime + i * step;
        newNotes.push({
          id: `studio_walk_${Date.now()}_${i}`,
          lane: i,
          time: Number(t.toFixed(3)),
        });
      }
    } else if (type === 'gallop') {
      const step8 = beatDuration / 2;
      newNotes.push(
        { id: `studio_gal1_${Date.now()}`, lane: 1, time: Number(startTime.toFixed(3)) },
        { id: `studio_gal2_${Date.now()}`, lane: 2, time: Number((startTime + step8 / 2).toFixed(3)) },
        { id: `studio_gal3_${Date.now()}`, lane: 1, time: Number((startTime + step8).toFixed(3)) }
      );
    } else if (type === 'triplet') {
      const step3 = beatDuration / 3;
      for (let i = 0; i < 3; i++) {
        const t = startTime + i * step3;
        newNotes.push({
          id: `studio_trip_${Date.now()}_${i}`,
          lane: i % 2 === 0 ? 0 : 3,
          time: Number(t.toFixed(3)),
        });
      }
    } else if (type === 'vocal_hold_tap') {
      newNotes.push(
        {
          id: `studio_vhold_${Date.now()}`,
          lane: 2,
          time: Number(startTime.toFixed(3)),
          duration: Number(beatDuration.toFixed(3)),
        },
        {
          id: `studio_vtap_${Date.now()}`,
          lane: 1,
          time: Number((startTime + beatDuration + beatDuration / 4).toFixed(3)),
        }
      );
    }

    onUpdateNotes(newNotes);
    audioEngine.playHitsound('perfect');
  };

  // Batch update duration of selected notes
  const handleSetSelectedNotesDuration = (newDuration: number) => {
    if (isPreset || isLocked || selectedNoteIds.length === 0) return;
    const updated = notes.map((n) => {
      if (selectedNoteIds.includes(n.id)) {
        return {
          ...n,
          duration: newDuration > 0 ? Number(newDuration.toFixed(3)) : undefined,
        };
      }
      return n;
    });
    onUpdateNotes(updated);
    audioEngine.playHitsound('perfect');
  };

  // Step duration of selected notes
  const handleStepSelectedNotesDuration = (delta: number) => {
    if (isPreset || isLocked || selectedNoteIds.length === 0) return;
    const updated = notes.map((n) => {
      if (selectedNoteIds.includes(n.id)) {
        const curDur = n.duration || 0;
        const nextDur = Math.max(0, Number((curDur + delta).toFixed(3)));
        return {
          ...n,
          duration: nextDur > 0 ? nextDur : undefined,
        };
      }
      return n;
    });
    onUpdateNotes(updated);
    audioEngine.playHitsound('tap');
  };

  // Shift selected notes by 1 snap step (forward or backward)
  const handleShiftSelectedNotes = (direction: -1 | 1) => {
    if (isPreset || isLocked || selectedNoteIds.length === 0) return;
    const shiftDelta = direction * stepIntervalDuration;
    const updated = notes.map((n) => {
      if (selectedNoteIds.includes(n.id)) {
        const newTime = Math.max(0, Number((n.time + shiftDelta).toFixed(3)));
        return { ...n, time: newTime };
      }
      return n;
    });
    onUpdateNotes(updated);
    audioEngine.playHitsound('tap');
  };

  // Mirror selected notes across lanes (0<->3, 1<->2)
  const handleMirrorSelectedNotes = () => {
    if (isPreset || isLocked || selectedNoteIds.length === 0) return;
    const updated = notes.map((n) => {
      if (selectedNoteIds.includes(n.id)) {
        return { ...n, lane: 3 - n.lane };
      }
      return n;
    });
    onUpdateNotes(updated);
    audioEngine.playHitsound('perfect');
  };

  // Duplicate selected notes immediately after selection
  const handleDuplicateSelectedNotes = () => {
    if (isPreset || isLocked || selectedNoteIds.length === 0) return;
    const selectedNotes = notes.filter((n) => selectedNoteIds.includes(n.id));
    if (selectedNotes.length === 0) return;
    const minTime = Math.min(...selectedNotes.map((n) => n.time));
    const maxTime = Math.max(...selectedNotes.map((n) => n.time + (n.duration || 0)));
    const length = Math.max(stepIntervalDuration, maxTime - minTime);
    const newDuplicatedNotes = selectedNotes.map((n, idx) => ({
      ...n,
      id: `dup_${Date.now()}_${idx}`,
      time: Number((n.time + length).toFixed(3)),
    }));
    onUpdateNotes([...notes, ...newDuplicatedNotes]);
    onSelectNotes(newDuplicatedNotes.map((n) => n.id));
    audioEngine.playHitsound('perfect');
  };

  // High-DPI Canvas Rendering with Dynamic Studio Interval Guides & Dedicated Bottom Time Ruler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth || 1000;
    const displayHeight = canvasHeightMode === 'large' ? 240 : 180;

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
    }

    ctx.save();
    ctx.scale(dpr, dpr);

    const width = displayWidth;
    const height = displayHeight;
    const rulerHeight = 26; // Tinggi bilah linimasa durasi waktu di bagian bawah canvas chart
    const lanesAreaHeight = height - rulerHeight;
    const laneHeight = lanesAreaHeight / 4;

    // 1. Light Studio Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. Draw Lane Tracks & Guides (0 to lanesAreaHeight)
    const laneColors = ['#0284c7', '#6366f1', '#9333ea', '#db2777'];
    const laneBgGradients = [
      'rgba(2, 132, 199, 0.04)',
      'rgba(99, 102, 241, 0.04)',
      'rgba(147, 51, 234, 0.04)',
      'rgba(219, 39, 119, 0.04)',
    ];

    for (let l = 0; l < 4; l++) {
      ctx.fillStyle = laneBgGradients[l];
      ctx.fillRect(0, l * laneHeight, width, laneHeight);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, l * laneHeight);
      ctx.lineTo(width, l * laneHeight);
      ctx.stroke();

      // Lane Label Badge
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(6, l * laneHeight + 6, 28, 16);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(6, l * laneHeight + 6, 28, 16);
      ctx.fillStyle = laneColors[l];
      ctx.font = 'bold 10px monospace';
      ctx.fillText(`L${l + 1}`, 13, l * laneHeight + 18);
    }

    const viewDuration = width / zoomScale;
    const startTime = Math.max(0, currentTime - viewDuration * 0.2);

    // 3. Audio Waveform Display
    if (audioBuffer) {
      const waveform = audioEngine.extractWaveform(audioBuffer, Math.floor(width / 2.2));
      const samplesCount = waveform.length;

      const waveGrad = ctx.createLinearGradient(0, lanesAreaHeight * 0.1, 0, lanesAreaHeight * 0.9);
      waveGrad.addColorStop(0, 'rgba(147, 51, 234, 0.25)');
      waveGrad.addColorStop(0.5, 'rgba(2, 132, 199, 0.32)');
      waveGrad.addColorStop(1, 'rgba(99, 102, 241, 0.25)');

      ctx.fillStyle = waveGrad;
      for (let i = 0; i < samplesCount; i++) {
        const sampleTime = (i / samplesCount) * audioBuffer.duration;
        const chartSampleTime = sampleTime + offset;
        const x = (chartSampleTime - startTime) * zoomScale;
        if (x >= -4 && x <= width + 4) {
          const rawAmp = waveform[i];
          const amp = Math.max(2, rawAmp * (lanesAreaHeight * 0.82));
          const y = lanesAreaHeight / 2 - amp / 2;
          ctx.beginPath();
          safeRoundRect(ctx, x, y, 2.5, amp, 1.2);
          ctx.fill();
        }
      }

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, lanesAreaHeight / 2);
      ctx.lineTo(width, lanesAreaHeight / 2);
      ctx.stroke();
    }

    // 4. Studio Interval Grid Lines (Garis Penempatan Berdasarkan Jarak Terpilih)
    const isTriplet = studioInterval === 3 || studioInterval === 6;
    const intervalStep = stepIntervalDuration;
    const startStep = Math.floor(startTime / intervalStep);
    const endStep = Math.ceil((startTime + viewDuration) / intervalStep);

    for (let s = startStep; s <= endStep; s++) {
      const stepTime = s * intervalStep;
      const x = (stepTime - startTime) * zoomScale;

      if (x >= 0 && x <= width) {
        // Calculate beat and bar boundary
        const beatNum = stepTime / beatDuration;
        const isExactBeat = Math.abs(beatNum - Math.round(beatNum)) < 0.005;
        const roundedBeat = Math.round(beatNum);
        const isMeasure = isExactBeat && roundedBeat % 4 === 0;

        if (isMeasure) {
          ctx.strokeStyle = 'rgba(79, 70, 229, 0.85)';
          ctx.lineWidth = 2;
          ctx.setLineDash([]);
        } else if (isExactBeat) {
          ctx.strokeStyle = 'rgba(100, 116, 139, 0.5)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([]);
        } else if (isTriplet) {
          ctx.strokeStyle = 'rgba(8, 145, 178, 0.55)'; // Distinct cyan for triplets
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 2]);
        } else {
          ctx.strokeStyle =
            studioInterval >= 8 ? 'rgba(203, 213, 225, 0.85)' : 'rgba(148, 163, 184, 0.55)';
          ctx.lineWidth = 0.8;
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, lanesAreaHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // Measure Bar Header
        if (isMeasure) {
          const measureNumber = Math.floor(roundedBeat / 4) + 1;
          ctx.fillStyle = '#4f46e5';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`M${measureNumber}`, x + 3, 11);
        }
      }
    }

    // 5. Draw Ghost Note Hover Indicator on Canvas (Only in lanes area)
    if (hoverGuide && (toolMode === 'tap' || toolMode === 'hold') && hoverGuide.rawY < lanesAreaHeight) {
      const ghostX = (hoverGuide.time - startTime) * zoomScale;
      const ghostY = hoverGuide.lane * laneHeight;
      const ghostColor = laneColors[hoverGuide.lane] || '#6366f1';

      if (ghostX >= -30 && ghostX <= width + 30) {
        if (toolMode === 'hold' && holdDuration > 0) {
          const tailWidth = Math.max(12, holdDuration * zoomScale);
          const tailY = ghostY + laneHeight * 0.18;
          const tailHeight = laneHeight * 0.64;

          ctx.fillStyle = 'rgba(147, 51, 234, 0.15)';
          ctx.beginPath();
          safeRoundRect(ctx, ghostX, tailY, tailWidth, tailHeight, 6);
          ctx.fill();

          ctx.strokeStyle = '#9333ea';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 2]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        const headW = 16;
        const headH = laneHeight * 0.76;
        const headX = ghostX - headW / 2;
        const headY = ghostY + (laneHeight - headH) / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.beginPath();
        safeRoundRect(ctx, headX, headY, headW, headH, 5);
        ctx.fill();

        ctx.strokeStyle = ghostColor;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // 6. Draw Sequencer Notes
    notes.forEach((note) => {
      const noteX = (note.time - startTime) * zoomScale;
      const noteY = note.lane * laneHeight;
      const isSelected = selectedNoteIds.includes(note.id);
      const laneColor = laneColors[note.lane] || '#6366f1';

      // Check if playhead is currently crossing this note (Hit Animation)
      const isCurrentlyCrossed = Math.abs(currentTime - note.time) < 0.07;
      const isInsideHoldTime =
        note.duration &&
        note.duration > 0 &&
        currentTime >= note.time - 0.03 &&
        currentTime <= note.time + note.duration + 0.03;

      // Hold Note Tail
      if (note.duration && note.duration > 0) {
        const tailWidth = Math.max(12, note.duration * zoomScale);
        const tailY = noteY + laneHeight * 0.16;
        const tailHeight = laneHeight * 0.68;

        if (noteX + tailWidth >= -30 && noteX <= width + 30) {
          // Hold Tail Body Gradient
          ctx.fillStyle = isSelected
            ? 'rgba(245, 158, 11, 0.35)'
            : isInsideHoldTime
            ? `${laneColor}55`
            : `${laneColor}25`;
          ctx.beginPath();
          safeRoundRect(ctx, noteX, tailY, tailWidth, tailHeight, 6);
          ctx.fill();

          // Hold Tail Border
          ctx.strokeStyle = isSelected ? '#d97706' : isInsideHoldTime ? '#0f172a' : laneColor;
          ctx.lineWidth = isSelected ? 2.5 : isInsideHoldTime ? 2 : 1.5;
          ctx.stroke();

          // Inner energy stream line
          ctx.strokeStyle = isInsideHoldTime ? '#0f172a' : `${laneColor}aa`;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(noteX + 8, tailY + tailHeight / 2);
          ctx.lineTo(noteX + tailWidth - 8, tailY + tailHeight / 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // End Handle / Crystal Release Diamond Cap
          const handleX = noteX + tailWidth;
          const endCapSize = 7;
          const isEndCrossed = Math.abs(currentTime - (note.time + note.duration)) < 0.07;

          // Animated Hit Flash Ripple at Hold End Point
          if (isEndCrossed) {
            ctx.save();
            ctx.fillStyle = 'rgba(2, 132, 199, 0.35)';
            ctx.beginPath();
            ctx.arc(handleX, noteY + laneHeight / 2, laneHeight * 0.55, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = '#0284c7';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(handleX, noteY + laneHeight / 2, laneHeight * 0.7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
          }
          
          // Vertical Release Notch Line
          ctx.strokeStyle = isSelected ? '#d97706' : isEndCrossed ? '#0284c7' : '#64748b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(handleX, noteY + 2);
          ctx.lineTo(handleX, noteY + laneHeight - 2);
          ctx.stroke();

          // Release Diamond Marker
          ctx.fillStyle = isSelected ? '#d97706' : isEndCrossed ? '#0284c7' : '#ffffff';
          ctx.beginPath();
          ctx.moveTo(handleX, tailY + tailHeight / 2 - (isEndCrossed ? endCapSize + 3 : endCapSize));
          ctx.lineTo(handleX + (isEndCrossed ? endCapSize + 3 : endCapSize), tailY + tailHeight / 2);
          ctx.lineTo(handleX, tailY + tailHeight / 2 + (isEndCrossed ? endCapSize + 3 : endCapSize));
          ctx.lineTo(handleX - (isEndCrossed ? endCapSize + 3 : endCapSize), tailY + tailHeight / 2);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = laneColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Duration Label text on hold tail if wide enough
          if (tailWidth > 45) {
            const beatLen = (note.duration / beatDuration).toFixed(1);
            ctx.fillStyle = isInsideHoldTime ? '#0f172a' : '#334155';
            ctx.font = 'bold 9px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`${note.duration.toFixed(2)}s (${beatLen}b)`, noteX + 12, tailY + tailHeight / 2 + 3);
          }
        }
      }

      // Note Head
      if (noteX >= -30 && noteX <= width + 30) {
        const headW = 18;
        const headH = laneHeight * 0.78;
        const headX = noteX - headW / 2;
        const headY = noteY + (laneHeight - headH) / 2;

        // Animated Hit Flash Ripple when playhead crosses note
        if (isCurrentlyCrossed) {
          ctx.save();
          ctx.fillStyle = 'rgba(2, 132, 199, 0.25)';
          ctx.beginPath();
          ctx.arc(noteX, noteY + laneHeight / 2, laneHeight * 0.55, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#0284c7';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(noteX, noteY + laneHeight / 2, laneHeight * 0.65, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        ctx.fillStyle = isSelected ? '#f59e0b' : isCurrentlyCrossed ? '#ffffff' : laneColor;
        ctx.beginPath();
        safeRoundRect(ctx, headX, headY, headW, headH, 6);
        ctx.fill();

        ctx.strokeStyle = isCurrentlyCrossed ? '#f59e0b' : '#ffffff';
        ctx.lineWidth = isCurrentlyCrossed ? 2 : 1.5;
        ctx.stroke();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        safeRoundRect(ctx, headX + 2, headY + 2, headW - 4, headH / 3, 3);
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = '#d97706';
          ctx.lineWidth = 2;
          ctx.strokeRect(headX - 2, headY - 2, headW + 4, headH + 4);
        }
      }
    });

    // 7. Red Playhead Indicator across lanes
    const playheadX = (currentTime - startTime) * zoomScale;
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, lanesAreaHeight);
    ctx.stroke();

    ctx.fillStyle = '#dc2626';
    ctx.beginPath();
    ctx.moveTo(playheadX - 6, 0);
    ctx.lineTo(playheadX + 6, 0);
    ctx.lineTo(playheadX, 9);
    ctx.closePath();
    ctx.fill();

    // 7b. Batas Akhir Lagu (Visual Song End Barrier on Timeline)
    if (duration > 0) {
      const songEndX = (duration - startTime) * zoomScale;
      if (songEndX >= -80 && songEndX <= width + 80) {
        ctx.save();
        // Red barrier shaded overlay after song end
        if (songEndX < width) {
          ctx.fillStyle = 'rgba(225, 29, 72, 0.08)';
          ctx.fillRect(Math.max(0, songEndX), 0, width - Math.max(0, songEndX), lanesAreaHeight);
        }

        // Luminous dashed boundary line
        ctx.strokeStyle = '#e11d48';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(songEndX, 0);
        ctx.lineTo(songEndX, lanesAreaHeight);
        ctx.stroke();
        ctx.setLineDash([]);

        // Badge at top of song end
        const endBadgeW = 96;
        const endBadgeH = 16;
        const endBadgeX = Math.max(2, Math.min(width - endBadgeW - 2, songEndX - endBadgeW / 2));
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        safeRoundRect(ctx, endBadgeX, 2, endBadgeW, endBadgeH, 4);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8.5px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`🏁 AKHIR: ${duration.toFixed(1)}s`, endBadgeX + endBadgeW / 2, 13);
        ctx.restore();
      }
    }

    // 8. DEDICATED BOTTOM TIME RULER & DURATION DISPLAY (DI DALAM CHART)
    // Background strip for bottom time ruler
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, lanesAreaHeight, width, rulerHeight);

    // Top border separator of ruler
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, lanesAreaHeight);
    ctx.lineTo(width, lanesAreaHeight);
    ctx.stroke();

    // Time division stepping based on zoom
    let secStep = 1.0;
    if (zoomScale < 40) secStep = 5.0;
    else if (zoomScale < 70) secStep = 2.0;
    else if (zoomScale > 150) secStep = 0.5;

    const startSec = Math.floor(startTime / secStep) * secStep;
    const endSec = Math.ceil((startTime + viewDuration) / secStep) * secStep;

    for (let t = startSec; t <= endSec; t += secStep) {
      if (t < 0) continue;
      const x = (t - startTime) * zoomScale;
      if (x >= 0 && x <= width) {
        // Tick marker line
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, lanesAreaHeight);
        ctx.lineTo(x, lanesAreaHeight + 6);
        ctx.stroke();

        // Sub-tick markers
        if (secStep >= 1.0 && zoomScale >= 60) {
          const halfX = (t + secStep / 2 - startTime) * zoomScale;
          if (halfX >= 0 && halfX <= width) {
            ctx.beginPath();
            ctx.moveTo(halfX, lanesAreaHeight);
            ctx.lineTo(halfX, lanesAreaHeight + 3);
            ctx.stroke();
          }
        }

        // Timecode text (MM:SS or MM:SS.s)
        const mins = Math.floor(t / 60);
        const secs = Math.floor(t % 60);
        const frac = Math.floor((t % 1) * 10);
        const timeLabel =
          secStep < 1 || frac > 0
            ? `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${frac}`
            : `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(timeLabel, x, lanesAreaHeight + 18);
      }
    }

    // Playhead Point & Live Timestamp Badge at Bottom Ruler
    if (playheadX >= -10 && playheadX <= width + 10) {
      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(playheadX - 5, height);
      ctx.lineTo(playheadX + 5, height);
      ctx.lineTo(playheadX, lanesAreaHeight);
      ctx.closePath();
      ctx.fill();

      // Timestamp Badge (MM:SS.ms)
      const curMins = Math.floor(currentTime / 60);
      const curSecs = Math.floor(currentTime % 60);
      const curMs = Math.floor((currentTime % 1) * 100);
      const curBadgeText = `${curMins.toString().padStart(2, '0')}:${curSecs.toString().padStart(2, '0')}.${curMs.toString().padStart(2, '0')}`;

      ctx.font = 'bold 9px monospace';
      const badgeTextWidth = ctx.measureText(curBadgeText).width;
      const badgeW = badgeTextWidth + 8;
      const badgeH = 14;
      const badgeX = Math.max(2, Math.min(width - badgeW - 2, playheadX - badgeW / 2));
      const badgeY = lanesAreaHeight + (rulerHeight - badgeH) / 2;

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      safeRoundRect(ctx, badgeX, badgeY, badgeW, badgeH, 3);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(curBadgeText, badgeX + badgeW / 2, badgeY + 10);
    }

    // 8b. Song End Marker on Bottom Ruler
    if (duration > 0) {
      const songEndX = (duration - startTime) * zoomScale;
      if (songEndX >= -40 && songEndX <= width + 40) {
        ctx.save();
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.moveTo(songEndX - 4, lanesAreaHeight);
        ctx.lineTo(songEndX + 4, lanesAreaHeight);
        ctx.lineTo(songEndX, lanesAreaHeight + 8);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 9. Drag Selection Rectangle
    if (isDragSelecting && dragStartPos && dragCurrentPos) {
      const sx = Math.min(dragStartPos.x, dragCurrentPos.x);
      const sy = Math.min(dragStartPos.y, dragCurrentPos.y);
      const sw = Math.abs(dragCurrentPos.x - dragStartPos.x);
      const sh = Math.abs(dragCurrentPos.y - dragStartPos.y);

      ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
      ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(sx, sy, sw, sh);
      ctx.setLineDash([]);
    }

    ctx.restore();
  }, [
    bpm,
    offset,
    currentTime,
    notes,
    snapDivision,
    zoomScale,
    audioBuffer,
    audioAnalysis,
    selectedNoteIds,
    toolMode,
    holdDuration,
    canvasHeightMode,
    isDragSelecting,
    dragStartPos,
    dragCurrentPos,
    defaultStepDuration,
    stepIntervalDuration,
    studioInterval,
    hoverGuide,
    beatDuration,
  ]);

  // Mouse & Touch Interactions on Canvas
  const getTimeAndLaneFromCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const rulerHeight = 26;
    const lanesAreaHeight = Math.max(10, rect.height - rulerHeight);
    const laneHeight = lanesAreaHeight / 4;
    const isRulerArea = y >= lanesAreaHeight;
    const lane = Math.min(3, Math.max(0, Math.floor(y / laneHeight)));

    const viewDuration = rect.width / zoomScale;
    const startTime = Math.max(0, currentTime - viewDuration * 0.2);
    const clickedRawTime = startTime + x / zoomScale;
    const clickedTime = calculateSnappedTime(clickedRawTime);

    return { x, y, lane, isRulerArea, clickedTime, clickedRawTime };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getTimeAndLaneFromCoords(e.clientX, e.clientY);
    if (!coords) return;

    // Direct Seek / Scrub when clicking on bottom time ruler
    if (coords.isRulerArea) {
      onSeek(Math.max(0, Math.min(duration || 300, Number(coords.clickedRawTime.toFixed(3)))));
      return;
    }

    if (toolMode === 'range') {
      if (onOpenRangeModal) onOpenRangeModal();
      return;
    }

    if (toolMode === 'pan' || e.button === 1 || e.altKey) {
      setIsPanning(true);
      setPanStartX(e.clientX);
      setPanStartTime(currentTime);
      return;
    }

    // Check if user clicked on the end-cap handle of an existing hold note to resize it
    const holdEndHandleClicked = notes.find((n) => {
      if (!n.duration || n.duration <= 0) return false;
      if (n.lane !== coords.lane) return false;
      const tailTime = n.time + n.duration;
      return Math.abs(tailTime - coords.clickedRawTime) < 18 / zoomScale;
    });

    if (holdEndHandleClicked) {
      setDraggedHoldNoteId(holdEndHandleClicked.id);
      return;
    }

    if (toolMode === 'select') {
      setIsDragSelecting(true);
      setDragStartPos({ x: coords.x, y: coords.y });
      setDragCurrentPos({ x: coords.x, y: coords.y });
      return;
    }

    if (toolMode === 'eraser') {
      const clickedNote = notes.find(
        (n) => n.lane === coords.lane && Math.abs(n.time - coords.clickedTime) < 0.15
      );
      if (clickedNote) {
        onUpdateNotes(notes.filter((n) => n.id !== clickedNote.id));
        audioEngine.playHitsound('tap');
      }
      return;
    }

    // Tap / Hold note placement (Playhead position remains strictly unchanged)
    const explicitDur = toolMode === 'hold' ? holdDuration : undefined;
    onPlaceNote(coords.lane, coords.clickedTime, explicitDur);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getTimeAndLaneFromCoords(e.clientX, e.clientY);
    if (coords) {
      if (coords.isRulerArea) {
        setHoverGuide(null);
      } else {
        setHoverGuide({
          lane: coords.lane,
          time: coords.clickedTime,
          rawX: coords.x,
          rawY: coords.y,
        });
      }
    }

    // Drag-scrubbing on bottom time ruler
    if (e.buttons === 1 && coords && coords.isRulerArea && !isPanning && !draggedHoldNoteId && !isDragSelecting && toolMode !== 'range') {
      onSeek(Math.max(0, Math.min(duration || 300, Number(coords.clickedRawTime.toFixed(3)))));
      return;
    }

    if (isPanning) {
      const deltaX = e.clientX - panStartX;
      const deltaTime = -(deltaX / zoomScale);
      onSeek(Math.max(0, Math.min(duration || 100, panStartTime + deltaTime)));
      return;
    }

    if (draggedHoldNoteId) {
      if (coords) {
        const targetNote = notes.find((n) => n.id === draggedHoldNoteId);
        if (targetNote) {
          const snappedDuration = Math.max(
            stepIntervalDuration,
            Number((coords.clickedTime - targetNote.time).toFixed(3))
          );
          if (snappedDuration !== targetNote.duration) {
            onUpdateNotes(
              notes.map((n) =>
                n.id === draggedHoldNoteId ? { ...n, duration: snappedDuration } : n
              )
            );
          }
        }
      }
      return;
    }

    if (isDragSelecting && dragStartPos) {
      if (coords) {
        setDragCurrentPos({ x: coords.x, y: coords.y });
      }
    }
  };

  const handleMouseLeave = () => {
    setHoverGuide(null);
    if (isPanning) setIsPanning(false);
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }

    if (draggedHoldNoteId) {
      setDraggedHoldNoteId(null);
    }

    if (isDragSelecting && dragStartPos && dragCurrentPos) {
      setIsDragSelecting(false);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const laneHeight = rect.height / 4;
      const viewDuration = rect.width / zoomScale;
      const startTime = Math.max(0, currentTime - viewDuration * 0.2);

      const minX = Math.min(dragStartPos.x, dragCurrentPos.x);
      const maxX = Math.max(dragStartPos.x, dragCurrentPos.x);
      const minY = Math.min(dragStartPos.y, dragCurrentPos.y);
      const maxY = Math.max(dragStartPos.y, dragCurrentPos.y);

      const minTime = startTime + minX / zoomScale;
      const maxTime = startTime + maxX / zoomScale;
      const minLane = Math.floor(minY / laneHeight);
      const maxLane = Math.floor(maxY / laneHeight);

      const selected = notes
        .filter(
          (n) =>
            n.lane >= minLane &&
            n.lane <= maxLane &&
            n.time >= minTime - 0.05 &&
            n.time <= maxTime + 0.05
        )
        .map((n) => n.id);

      onSelectNotes(selected);
      setDragStartPos(null);
      setDragCurrentPos(null);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onZoomChange(e.deltaY > 0 ? -15 : 15);
    } else {
      e.preventDefault();
      const scrollStep = 60 / (bpm || 120) / (snapDivision / 4);
      onSeek(Math.max(0, Math.min(duration || 100, currentTime + (e.deltaY > 0 ? scrollStep : -scrollStep))));
    }
  };

  // Touch handlers for mobile devices (High-accuracy single tap & smooth pan discrimination)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const coords = getTimeAndLaneFromCoords(touch.clientX, touch.clientY);
      if (coords) {
        touchStateRef.current = {
          clientX: touch.clientX,
          clientY: touch.clientY,
          startTime: currentTime,
          isRuler: coords.isRulerArea,
          hasMoved: false,
        };

        if (toolMode === 'range') {
          if (onOpenRangeModal) onOpenRangeModal();
          return;
        }

        // Instant seek on ruler area
        if (coords.isRulerArea) {
          onSeek(Math.max(0, Math.min(duration || 300, Number(coords.clickedRawTime.toFixed(3)))));
        }
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && touchStateRef.current) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStateRef.current.clientX;
      const deltaY = touch.clientY - touchStateRef.current.clientY;
      const dist = Math.hypot(deltaX, deltaY);

      if (dist > 10) {
        touchStateRef.current.hasMoved = true;
      }

      const coords = getTimeAndLaneFromCoords(touch.clientX, touch.clientY);

      if (coords && (coords.isRulerArea || touchStateRef.current.isRuler)) {
        onSeek(Math.max(0, Math.min(duration || 300, Number(coords.clickedRawTime.toFixed(3)))));
        return;
      }

      if (toolMode === 'pan' || (dist > 12 && toolMode !== 'eraser' && toolMode !== 'range')) {
        const deltaTime = -(deltaX / zoomScale);
        onSeek(Math.max(0, Math.min(duration || 100, touchStateRef.current.startTime + deltaTime)));
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchStateRef.current) {
      const { clientX, clientY, isRuler, hasMoved } = touchStateRef.current;
      touchStateRef.current = null;

      // Clean single tap on canvas lanes without scrolling
      if (!isRuler && !hasMoved) {
        const coords = getTimeAndLaneFromCoords(clientX, clientY);
        if (coords && !coords.isRulerArea) {
          if (toolMode === 'tap' || toolMode === 'hold') {
            const explicitDur = toolMode === 'hold' ? holdDuration : undefined;
            onPlaceNote(coords.lane, coords.clickedTime, explicitDur);
          } else if (toolMode === 'eraser') {
            const tolerance = 0.05;
            const clickedNote = notes.find(
              (n) => n.lane === coords.lane && Math.abs(n.time - coords.clickedTime) < tolerance
            );
            if (clickedNote) {
              onUpdateNotes(notes.filter((n) => n.id !== clickedNote.id));
              audioEngine.playHitsound('tap');
            }
          } else if (toolMode === 'select') {
            const tolerance = 0.05;
            const clickedNote = notes.find(
              (n) => n.lane === coords.lane && Math.abs(n.time - coords.clickedTime) < tolerance
            );
            if (clickedNote) {
              if (selectedNoteIds.includes(clickedNote.id)) {
                onSelectNotes(selectedNoteIds.filter((id) => id !== clickedNote.id));
              } else {
                onSelectNotes([...selectedNoteIds, clickedNote.id]);
              }
            }
          }
        }
      }
    }
  };

  const getCanvasCursorClass = () => {
    if (toolMode === 'pan') return 'cursor-grab active:cursor-grabbing';
    if (toolMode === 'select') return 'cursor-crosshair';
    if (toolMode === 'eraser') return 'cursor-not-allowed';
    return 'cursor-crosshair';
  };

  return (
    <div className="w-full space-y-3.5 select-none">
      {/* 1. 4-Lane Canvas Viewport with Embedded Bottom Time Ruler */}
      <div className="relative w-full overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-950/5">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          className={`w-full h-auto block touch-none select-none ${getCanvasCursorClass()}`}
        />
      </div>

      {/* 2. Upgraded Mobile-Responsive Selection Toolbar */}
      {selectedNoteIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 p-2 sm:p-2.5 bg-gradient-to-r from-amber-50 via-white to-amber-50 border border-amber-300 rounded-2xl shadow-sm text-xs text-amber-900 animate-in fade-in">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <MousePointer className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{selectedNoteIds.length} Note Dipilih</span>
            </div>
            <button
              onClick={() => onSelectNotes([])}
              className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer sm:hidden"
            >
              Batal
            </button>
          </div>

          {/* Quick Note Operations: Geser Langkah, Cermin, Gandakan */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-amber-200 shadow-xs overflow-x-auto no-scrollbar">
            <button
              onClick={() => handleShiftSelectedNotes(-1)}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
              title="Geser Mundur 1 Jarak Nada"
            >
              <span>◀ Geser</span>
            </button>
            <button
              onClick={() => handleShiftSelectedNotes(1)}
              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center gap-0.5 cursor-pointer whitespace-nowrap"
              title="Geser Maju 1 Jarak Nada"
            >
              <span>Geser ▶</span>
            </button>
            <button
              onClick={handleMirrorSelectedNotes}
              className="px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold text-[11px] cursor-pointer whitespace-nowrap"
              title="Cermin Jalur Note (0↔3, 1↔2)"
            >
              ⇄ Cermin
            </button>
            <button
              onClick={handleDuplicateSelectedNotes}
              className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] cursor-pointer whitespace-nowrap shadow-xs"
              title="Gandakan Rangkaian Note"
            >
              + Gandakan
            </button>
          </div>

          {/* Duration Configurator for Selection */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-purple-200 shadow-xs overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-bold text-purple-900 whitespace-nowrap pl-1">Durasi:</span>
            <button
              onClick={() => handleSetSelectedNotesDuration(0)}
              className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold cursor-pointer whitespace-nowrap"
            >
              Tap
            </button>
            <button
              onClick={() => handleStepSelectedNotesDuration(-stepIntervalDuration)}
              className="w-5 h-5 rounded bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold flex items-center justify-center text-xs cursor-pointer"
            >
              -
            </button>
            <button
              onClick={() => handleStepSelectedNotesDuration(stepIntervalDuration)}
              className="w-5 h-5 rounded bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold flex items-center justify-center text-xs cursor-pointer"
            >
              +
            </button>
            {[
              { label: '1b', beats: 1 },
              { label: '2b', beats: 2 },
              { label: '1 Bar', beats: 4 },
              { label: '2 Bar', beats: 8 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => handleSetSelectedNotesDuration(Number((beatDuration * p.beats).toFixed(3)))}
                className="px-1.5 py-0.5 rounded bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-[10px] font-mono font-bold cursor-pointer whitespace-nowrap"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Action Buttons: Copy, Delete, Cancel */}
          <div className="flex items-center gap-1.5 justify-end">
            <button
              onClick={onCopySelected}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs cursor-pointer shadow-xs"
            >
              Salin
            </button>
            <button
              onClick={onDeleteSelected}
              className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs cursor-pointer shadow-xs"
            >
              Hapus
            </button>
            <button
              onClick={() => onSelectNotes([])}
              className="hidden sm:block px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 font-bold text-xs cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* 3. Lock Mode Notice */}
      {isLocked && (
        <div className="flex items-center justify-between p-2.5 bg-rose-50 border border-rose-200 rounded-2xl sm:rounded-3xl text-xs text-rose-800 shadow-xs">
          <span className="flex items-center gap-1.5 font-bold text-rose-900">
            <Lock className="w-4 h-4 text-rose-600" />
            <span>Mode Kunci Aktif: Alur waktu bebas digeser tanpa risiko mengubah isi chart.</span>
          </span>
          <span className="text-[11px] text-rose-600 font-medium">Buka kunci di menu bawah untuk mengedit</span>
        </div>
      )}

      {/* 4. MASTER UNIFIED STUDIO DECK & VIRTUAL 4-LANE PAD */}
      <EditorMobilePad
        bpm={bpm}
        offset={offset}
        currentTime={currentTime}
        duration={duration}
        notes={notes}
        toolMode={toolMode}
        holdDuration={holdDuration}
        studioInterval={studioInterval}
        stepRecordMode={stepRecordMode}
        isPreset={isPreset}
        isLocked={isLocked}
        isPlaying={isPlaying}
        isRangeCopyOpen={isRangeModalOpen}
        onSetToolMode={(mode) => {
          if (mode === 'range') {
            onOpenRangeModal?.();
          }
          setToolMode(mode);
        }}
        onHoldDurationChange={setHoldDuration}
        onSetStudioInterval={setStudioInterval}
        onToggleStepRecord={() => setStepRecordMode(!stepRecordMode)}
        onToggleRangeCopy={() => onOpenRangeModal?.()}
        onPlaceNote={onPlaceNote}
        onUpdateNotes={onUpdateNotes}
        onSeek={onSeek}
        onTogglePlay={onTogglePlay}
        onUndo={onUndo}
        onRedo={onRedo}
        onInsertRhythmPhrase={insertRhythmPhrase}
      />
    </div>
  );
};
