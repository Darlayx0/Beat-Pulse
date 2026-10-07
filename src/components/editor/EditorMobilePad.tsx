import React, { useState } from 'react';
import {
  Hand,
  Circle,
  Clock,
  MousePointer,
  Eraser,
  Sparkles,
  Radio,
  Layers,
  Trash2,
  Copy,
  Scissors,
} from 'lucide-react';
import { Note } from '../../types';
import { EditorToolMode, StudioInterval } from './EditorSequencerCanvas';
import { audioEngine } from '../../lib/audioEngine';

interface EditorMobilePadProps {
  bpm: number;
  offset: number;
  currentTime: number;
  duration: number;
  notes: Note[];
  toolMode: EditorToolMode;
  holdDuration: number;
  studioInterval: StudioInterval;
  stepRecordMode: boolean;
  isPreset: boolean;
  isLocked: boolean;
  isPlaying?: boolean;
  isRangeCopyOpen?: boolean;
  onSetToolMode: (mode: EditorToolMode) => void;
  onHoldDurationChange: (dur: number) => void;
  onSetStudioInterval: (interval: StudioInterval) => void;
  onToggleStepRecord: () => void;
  onToggleRangeCopy?: () => void;
  onPlaceNote: (lane: number, time: number, explicitDuration?: number) => void;
  onUpdateNotes?: (notes: Note[]) => void;
  onSeek: (time: number) => void;
  onTogglePlay?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onInsertRhythmPhrase?: (
    type: 'roll_8' | 'downbeats' | 'walk_2' | 'gallop' | 'triplet' | 'vocal_hold_tap'
  ) => void;
}

export const EditorMobilePad: React.FC<EditorMobilePadProps> = ({
  bpm,
  offset,
  currentTime,
  duration,
  notes,
  toolMode,
  holdDuration,
  studioInterval,
  stepRecordMode,
  isPreset,
  isLocked,
  isPlaying = false,
  isRangeCopyOpen = false,
  onSetToolMode,
  onHoldDurationChange,
  onSetStudioInterval,
  onToggleStepRecord,
  onToggleRangeCopy,
  onPlaceNote,
  onUpdateNotes,
  onSeek,
  onTogglePlay,
  onInsertRhythmPhrase,
}) => {
  const [activeLanePress, setActiveLanePress] = useState<number | null>(null);
  const [showRhythmPhrases, setShowRhythmPhrases] = useState<boolean>(false);

  const beatDuration = 60 / (bpm || 120);

  // Safely update hold note duration without risking deletion
  const handleUpdateHoldDuration = (noteId: string, newDuration: number) => {
    if (isPreset || isLocked) return;
    const safeDur = Math.max(0.01, Number(newDuration.toFixed(3)));
    if (onUpdateNotes) {
      const updated = notes.map((n) => (n.id === noteId ? { ...n, duration: safeDur } : n));
      onUpdateNotes(updated);
      audioEngine.playHitsound('perfect');
    } else {
      const targetNote = notes.find((n) => n.id === noteId);
      if (targetNote) {
        onPlaceNote(targetNote.lane, targetNote.time, safeDur);
      }
    }
  };

  // Explicitly delete a single note
  const handleDeleteSingleNote = (noteId: string) => {
    if (isPreset || isLocked) return;
    if (onUpdateNotes) {
      const updated = notes.filter((n) => n.id !== noteId);
      onUpdateNotes(updated);
      audioEngine.playHitsound('tap');
    } else {
      const targetNote = notes.find((n) => n.id === noteId);
      if (targetNote) {
        onPlaceNote(targetNote.lane, targetNote.time);
      }
    }
  };

  // Calculate step interval duration (Garis Nada)
  const getIntervalDuration = (interval: StudioInterval): number => {
    if (interval === 1) return beatDuration;
    if (interval === 2) return beatDuration / 2;
    if (interval === 4) return beatDuration / 4;
    if (interval === 8) return beatDuration / 8;
    if (interval === 16) return beatDuration / 16;
    if (interval === 3) return beatDuration / 3;
    if (interval === 6) return beatDuration / 6;
    return beatDuration / 4;
  };

  const stepIntervalDuration = getIntervalDuration(studioInterval);

  // Helper formatting hold length in Beat & Bar units based on garis nada
  const formatHoldDurationLabel = (durSec: number): string => {
    const beats = durSec / (beatDuration || 0.5);
    if (Math.abs(beats - Math.round(beats)) < 0.02) {
      const b = Math.round(beats);
      if (b >= 4 && b % 4 === 0) {
        return `${b}b (${b / 4} Bar)`;
      }
      return `${b} Beat`;
    }
    if (Math.abs(beats - 0.5) < 0.02) return '1/2 Beat';
    if (Math.abs(beats - 0.25) < 0.02) return '1/4 Beat';
    if (Math.abs(beats - 0.75) < 0.02) return '3/4 Beat';
    if (Math.abs(beats - 1.5) < 0.02) return '1.5 Beat';
    return `${beats.toFixed(2)} Beat`;
  };

  // Helper for concise pad badge
  const formatHoldShortLabel = (durSec: number): string => {
    const beats = durSec / (beatDuration || 0.5);
    if (Math.abs(beats - Math.round(beats)) < 0.02) {
      const b = Math.round(beats);
      if (b >= 4 && b % 4 === 0) {
        return `${b / 4} Bar`;
      }
      return `${b}b`;
    }
    if (Math.abs(beats - 0.5) < 0.02) return '1/2b';
    if (Math.abs(beats - 0.25) < 0.02) return '1/4b';
    return `${beats.toFixed(1)}b`;
  };

  // Step playhead navigation (persis sama melangkah dari garis nada ke garis nada)
  const handleStepNavigation = (direction: -1 | 1) => {
    triggerHaptic(12);
    const stepDur = stepIntervalDuration;
    const currentBeatRel = currentTime / stepDur;
    let targetIndex: number;
    if (direction > 0) {
      targetIndex = Math.floor(currentBeatRel + 0.005) + 1;
    } else {
      targetIndex = Math.ceil(currentBeatRel - 0.005) - 1;
    }
    const newTime = Math.max(
      0,
      Math.min(duration || 300, targetIndex * stepDur)
    );
    onSeek(Number(newTime.toFixed(3)));
  };

  // Format interval label helper
  const formatIntervalLabel = (interval: StudioInterval): string => {
    if (interval === 1) return '1 Beat';
    if (interval === 2) return '1/2 Beat';
    if (interval === 4) return '1/4 Beat';
    if (interval === 8) return '1/8 Beat';
    if (interval === 16) return '1/16 Beat';
    if (interval === 3) return '1/3 Triplet';
    if (interval === 6) return '1/6 Triplet';
    return `${interval}`;
  };

  // Hold note length presets (dari ketukan pendek hingga bar panjang 1 Bar, 2 Bar, 4 Bar, 8 Bar)
  const holdPresets = [
    { label: '1/4 Beat', short: '1/4b', beats: 0.25 },
    { label: '1/2 Beat', short: '1/2b', beats: 0.5 },
    { label: '3/4 Beat', short: '3/4b', beats: 0.75 },
    { label: '1 Beat', short: '1b', beats: 1 },
    { label: '1.5 Beat', short: '1.5b', beats: 1.5 },
    { label: '2 Beat (1/2 Bar)', short: '2b', beats: 2 },
    { label: '3 Beat', short: '3b', beats: 3 },
    { label: '1 Bar (4 Beat)', short: '1 Bar', beats: 4 },
    { label: '1.5 Bar (6 Beat)', short: '1.5 Bar', beats: 6 },
    { label: '2 Bar (8 Beat)', short: '2 Bar', beats: 8 },
    { label: '3 Bar (12 Beat)', short: '3 Bar', beats: 12 },
    { label: '4 Bar (16 Beat)', short: '4 Bar', beats: 16 },
    { label: '6 Bar (24 Beat)', short: '6 Bar', beats: 24 },
    { label: '8 Bar (32 Beat)', short: '8 Bar', beats: 32 },
  ];

  // Calculate snapped playhead time
  const currentSnappedTime = React.useMemo(() => {
    const gridStep = stepIntervalDuration;
    const gridSnapped = Math.round(currentTime / gridStep) * gridStep;
    return Number(Math.max(0, gridSnapped).toFixed(3));
  }, [currentTime, stepIntervalDuration]);

  // Check which lanes currently have a note at the playhead
  const tolerance = 0.048;
  const existingNotesAtPlayhead = [0, 1, 2, 3].map((lane) =>
    notes.find((n) => n.lane === lane && Math.abs(n.time - currentSnappedTime) < tolerance)
  );

  // Detect any active hold note that intersects or encompasses current playhead
  const activeHoldNotesAtPlayhead = React.useMemo(() => {
    return notes.filter((n) => {
      if (!n.duration || n.duration <= 0) return false;
      return (
        currentTime >= n.time - 0.06 &&
        currentTime <= n.time + n.duration + 0.06
      );
    });
  }, [notes, currentTime]);

  const hasAnyNoteAtCurrentTime = existingNotesAtPlayhead.some((n) => !!n);

  // Trigger Haptic Feedback safely on mobile
  const triggerHaptic = (ms = 15) => {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(ms);
      }
    } catch {
      // safe fallback
    }
  };

  // Handle Pad Touch / Click
  const handlePadPress = (lane: number) => {
    if (isPreset || isLocked) return;

    setActiveLanePress(lane);
    setTimeout(() => setActiveLanePress(null), 180);
    triggerHaptic(18);

    const targetTime = isPlaying ? Number(currentTime.toFixed(3)) : currentSnappedTime;
    const explicitDur = toolMode === 'hold' ? holdDuration : undefined;

    // Place note at target time without shifting the playhead
    onPlaceNote(lane, targetTime, explicitDur);
  };

  // Delete all notes at current playhead
  const handleDeleteAtCurrentTime = () => {
    if (isPreset || isLocked) return;
    triggerHaptic(25);
    audioEngine.playHitsound('tap');
    existingNotesAtPlayhead.forEach((n) => {
      if (n) {
        onPlaceNote(n.lane, n.time);
      }
    });
  };

  // Lane button styles configuration
  const laneConfig = [
    {
      id: 0,
      name: 'Jalur 1',
      key: 'D',
      color: 'sky',
      bgIdle: 'bg-sky-50 hover:bg-sky-100 text-sky-900 border-sky-200',
      bgActive: 'bg-sky-600 text-white border-sky-400 shadow-md shadow-sky-600/30 scale-95',
      bgOccupied: 'bg-sky-100 text-sky-950 border-sky-400 ring-2 ring-sky-400/50',
    },
    {
      id: 1,
      name: 'Jalur 2',
      key: 'F',
      color: 'indigo',
      bgIdle: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-indigo-200',
      bgActive: 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-600/30 scale-95',
      bgOccupied: 'bg-indigo-100 text-indigo-950 border-indigo-400 ring-2 ring-indigo-400/50',
    },
    {
      id: 2,
      name: 'Jalur 3',
      key: 'J',
      color: 'purple',
      bgIdle: 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-200',
      bgActive: 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30 scale-95',
      bgOccupied: 'bg-purple-100 text-purple-950 border-purple-400 ring-2 ring-purple-400/50',
    },
    {
      id: 3,
      name: 'Jalur 4',
      key: 'K',
      color: 'pink',
      bgIdle: 'bg-pink-50 hover:bg-pink-100 text-pink-900 border-pink-200',
      bgActive: 'bg-pink-600 text-white border-pink-400 shadow-md shadow-pink-600/30 scale-95',
      bgOccupied: 'bg-pink-100 text-pink-950 border-pink-400 ring-2 ring-pink-400/50',
    },
  ];

  return (
    <div className="w-full max-w-full bg-white/95 backdrop-blur-2xl border border-slate-200 rounded-2xl sm:rounded-3xl p-2.5 sm:p-3.5 shadow-sm space-y-2.5 select-none box-border overflow-hidden ring-1 ring-slate-950/5">
      {/* 1. MASTER TOOLBAR (ALAT BILAH: PAN, TAP, HOLD, PILIH, HAPUS + HOLD DURATION STEPPER) */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 bg-slate-100 p-1 sm:p-1.5 rounded-2xl border border-slate-200">
        {/* Tool Mode Segmented Control */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-full py-0.5">
          <button
            type="button"
            onClick={() => onSetToolMode('pan')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap min-h-[34px] ${
              toolMode === 'pan'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Mode Alur Waktu Bebas (Pan/Scrub, Pintas: H)"
          >
            <Hand className="w-3.5 h-3.5 shrink-0" />
            <span>Pan</span>
          </button>

          <button
            type="button"
            onClick={() => onSetToolMode('tap')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap min-h-[34px] ${
              toolMode === 'tap'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Mode Pasang Tap Note (Pintas: 1)"
          >
            <Circle className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>Tap</span>
          </button>

          <button
            type="button"
            onClick={() => onSetToolMode('hold')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap min-h-[34px] ${
              toolMode === 'hold'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Mode Pasang Hold Note (Pintas: 2)"
          >
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span>Hold</span>
          </button>

          <button
            type="button"
            onClick={() => onSetToolMode('select')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap min-h-[34px] ${
              toolMode === 'select'
                ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Mode Kotak Seleksi (Pintas: V)"
          >
            <MousePointer className="w-3.5 h-3.5 shrink-0" />
            <span>Pilih</span>
          </button>

          <button
            type="button"
            onClick={() => onSetToolMode('eraser')}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap min-h-[34px] ${
              toolMode === 'eraser'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Mode Penghapus Note (Pintas: E)"
          >
            <Eraser className="w-3.5 h-3.5 shrink-0" />
            <span>Hapus</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onSetToolMode('range');
              if (onToggleRangeCopy) onToggleRangeCopy();
            }}
            className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer whitespace-nowrap min-h-[34px] ${
              toolMode === 'range' || isRangeCopyOpen
                ? 'bg-indigo-600 text-white shadow-xs font-black'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Mode Rentang Waktu & Salin/Tempel/Potong (Pintas: R)"
          >
            <Scissors className="w-3.5 h-3.5 shrink-0 text-white" />
            <span>Rentang</span>
          </button>
        </div>

        {/* Hold Duration Configurator Berbasis Garis Nada (Tampil jika mode Hold aktif) */}
        {toolMode === 'hold' && (
          <div className="flex flex-wrap items-center gap-1.5 bg-purple-50 border border-purple-200 px-2 py-1.5 rounded-2xl text-purple-900 shadow-xs">
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-[11px] font-black text-purple-900 font-mono whitespace-nowrap">
                Hold: {formatHoldDurationLabel(holdDuration)}
              </span>
            </div>

            {/* Step +/- patuh jarak nada aktif */}
            <div className="flex items-center gap-1 border-l border-purple-200 pl-1.5">
              <button
                type="button"
                onClick={() => {
                  const newDur = Math.max(
                    stepIntervalDuration,
                    Number((holdDuration - stepIntervalDuration).toFixed(3))
                  );
                  onHoldDurationChange(newDur);
                }}
                className="px-2 py-0.5 rounded-lg bg-white hover:bg-purple-100 text-purple-900 font-black text-xs cursor-pointer border border-purple-200 active:scale-95 flex items-center gap-0.5 shadow-xs"
                title={`Kurangi 1 Jarak Nada (${formatIntervalLabel(studioInterval)})`}
              >
                <span>-</span>
                <span className="text-[9px] font-mono text-purple-700">Jarak</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const newDur = Number((holdDuration + stepIntervalDuration).toFixed(3));
                  onHoldDurationChange(newDur);
                }}
                className="px-2 py-0.5 rounded-lg bg-white hover:bg-purple-100 text-purple-900 font-black text-xs cursor-pointer border border-purple-200 active:scale-95 flex items-center gap-0.5 shadow-xs"
                title={`Tambah 1 Jarak Nada (${formatIntervalLabel(studioInterval)})`}
              >
                <span>+</span>
                <span className="text-[9px] font-mono text-purple-700">Jarak</span>
              </button>
            </div>

            {/* Extended Comprehensive Hold Presets */}
            <div className="flex items-center gap-1 border-l border-purple-200 pl-1.5 overflow-x-auto max-w-full sm:max-w-none py-0.5 no-scrollbar">
              <span className="text-[10px] text-purple-700 font-bold whitespace-nowrap">Preset:</span>
              {holdPresets.map((p) => {
                const targetSec = Number((p.beats * beatDuration).toFixed(3));
                const isSelected = Math.abs(holdDuration - targetSec) < 0.03;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => onHoldDurationChange(targetSec)}
                    className={`px-1.5 py-0.5 rounded-lg text-[10px] font-mono font-bold cursor-pointer transition-all whitespace-nowrap ${
                      isSelected
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white text-purple-800 border border-purple-200 hover:bg-purple-100'
                    }`}
                    title={`Set panjang hold: ${p.label} (${targetSec}s)`}
                  >
                    {p.short || p.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Real-time Hold Note Adjustment at Playhead */}
      {activeHoldNotesAtPlayhead.length > 0 && (
        <div className="p-2.5 bg-purple-50/80 border border-purple-200 rounded-2xl flex flex-col gap-2 shadow-xs animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-600 animate-ping" />
              <span className="text-xs font-black text-purple-950 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                <span>Pengatur Hold Note Real-time di Playhead ({formatIntervalLabel(studioInterval)})</span>
              </span>
            </div>
            <span className="text-[10px] text-purple-700 font-mono font-bold">
              Posisi Playhead: {currentTime.toFixed(3)}s
            </span>
          </div>

          <div className="space-y-2">
            {activeHoldNotesAtPlayhead.map((n) => {
              const laneName = laneConfig[n.lane]?.name || `Jalur ${n.lane + 1}`;
              const curBeats = (n.duration! / beatDuration).toFixed(2);
              const endTime = n.time + n.duration!;
              const canSnapToPlayhead = currentTime > n.time + 0.02;

              return (
                <div
                  key={n.id}
                  className="p-2 bg-white rounded-xl border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-900 font-black text-[11px]">
                      {laneName}
                    </span>
                    <span className="text-[11px] font-mono text-slate-700">
                      Mulai: <b className="text-slate-900">{n.time.toFixed(3)}s</b> ➔ Akhir: <b className="text-slate-900">{endTime.toFixed(3)}s</b>
                    </span>
                    <span className="text-[10px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-mono">
                      Durasi: {n.duration!.toFixed(3)}s ({curBeats} Beat)
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* Tombol Cerdas: Tarik Titik Akhir ke Playhead */}
                    {canSnapToPlayhead && (
                      <button
                        type="button"
                        onClick={() => {
                          const targetDur = Math.max(
                            stepIntervalDuration,
                            Number((currentSnappedTime - n.time).toFixed(3))
                          );
                          handleUpdateHoldDuration(n.id, targetDur);
                        }}
                        className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-xs"
                        title="Potong / Perpanjang titik akhir hold tepat di posisi playhead saat ini"
                      >
                        <Sparkles className="w-3 h-3 fill-current" />
                        <span>Kunci Akhir ke Playhead</span>
                      </button>
                    )}

                    {/* Stepper +/- Patuh Jarak Nada */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const newDur = Math.max(
                            stepIntervalDuration,
                            Number((n.duration! - stepIntervalDuration).toFixed(3))
                          );
                          handleUpdateHoldDuration(n.id, newDur);
                        }}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-purple-900 font-black text-xs flex items-center justify-center cursor-pointer border border-purple-200 active:scale-95"
                        title={`Kurangi 1 Jarak Nada (${formatIntervalLabel(studioInterval)})`}
                      >
                        - Jarak
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const newDur = Number((n.duration! + stepIntervalDuration).toFixed(3));
                          handleUpdateHoldDuration(n.id, newDur);
                        }}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-purple-900 font-black text-xs flex items-center justify-center cursor-pointer border border-purple-200 active:scale-95"
                        title={`Tambah 1 Jarak Nada (${formatIntervalLabel(studioInterval)})`}
                      >
                        + Jarak
                      </button>
                    </div>

                    {/* Quick Presets */}
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                      {[
                        { label: '1/4b', beats: 0.25 },
                        { label: '1/2b', beats: 0.5 },
                        { label: '1b', beats: 1 },
                        { label: '2b', beats: 2 },
                        { label: '1 Bar', beats: 4 },
                        { label: '2 Bar', beats: 8 },
                        { label: '4 Bar', beats: 16 },
                      ].map((preset) => (
                        <button
                          key={preset.label}
                          type="button"
                          onClick={() =>
                            handleUpdateHoldDuration(
                              n.id,
                              Number((preset.beats * beatDuration).toFixed(3))
                            )
                          }
                          className="px-1.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 text-[10px] font-mono font-bold cursor-pointer transition-all border border-purple-200 active:scale-95"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>

                    {/* Tombol Hapus Spesifik Hold Note */}
                    <button
                      type="button"
                      onClick={() => handleDeleteSingleNote(n.id)}
                      className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] font-bold cursor-pointer transition-all border border-rose-200 active:scale-95 flex items-center gap-1"
                      title="Hapus Hold Note Ini"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. DEDICATED VIRTUAL 4-LANE ARCADE PAD (TEPAT DI BAWAH ALAT BILAH) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-sky-600" />
            <span>Pad Ketuk Virtual 4 Jalur</span>
          </span>
          <span className="text-[11px] font-mono text-slate-500">
            Waktu Snapped: <strong className="text-indigo-700">{currentSnappedTime.toFixed(3)}s</strong>
          </span>
        </div>

        {/* 4 Arcade Pads */}
        <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
          {laneConfig.map((lane) => {
            const isPressed = activeLanePress === lane.id;
            const occupiedNote = existingNotesAtPlayhead[lane.id];
            const hasNote = !!occupiedNote;

            return (
              <button
                key={lane.id}
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  handlePadPress(lane.id);
                }}
                onContextMenu={(e) => e.preventDefault()}
                className={`relative h-14 sm:h-16 rounded-xl sm:rounded-2xl border transition-all flex flex-col items-center justify-between p-1 sm:p-1.5 cursor-pointer touch-manipulation select-none active:scale-95 ${
                  isPressed
                    ? lane.bgActive
                    : hasNote
                    ? lane.bgOccupied
                    : lane.bgIdle
                } shadow-xs`}
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                {/* Lane Header badge */}
                <div className="w-full flex items-center justify-between">
                  <span className="text-[9px] font-mono font-black opacity-90">
                    {lane.key}
                  </span>
                  {hasNote && (
                    <span className="text-[7.5px] font-black uppercase px-1 py-0.2 rounded bg-amber-400 text-slate-950 animate-bounce">
                      {occupiedNote?.duration ? 'Hold' : 'Ada'}
                    </span>
                  )}
                </div>

                {/* Lane Center Graphic Indicator */}
                <div className="flex items-center justify-center gap-1">
                  <div
                    className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center transition-all ${
                      isPressed
                        ? 'scale-110 bg-white text-slate-950 shadow-md'
                        : hasNote
                        ? 'bg-white/40'
                        : 'bg-black/10'
                    }`}
                  >
                    {toolMode === 'hold' ? (
                      <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    ) : (
                      <Circle
                        className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${hasNote || isPressed ? 'fill-current' : ''}`}
                      />
                    )}
                  </div>
                  <span className="text-[10.5px] sm:text-xs font-black tracking-wide">
                    {lane.name}
                  </span>
                </div>

                {/* Bottom Touch Hint */}
                <div className="w-full text-center">
                  <span className="text-[8px] sm:text-[8.5px] font-mono opacity-80">
                    {hasNote
                      ? 'Ganti'
                      : toolMode === 'hold'
                      ? `+Hold ${formatHoldShortLabel(holdDuration)}`
                      : '+Tap'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. JARAK NADA STUDIO (LEBIH KECIL, RAPAT, BAKU & TRIPLET SEBARIS, TOMBOL AUTO-MAJU & FRASA DIPERKECIL) */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 p-1.5 sm:p-2 bg-slate-50 rounded-2xl border border-slate-200 text-[11px]">
        {/* Single Row Unified Intervals: Baku + Triplet */}
        <div className="flex items-center gap-1 bg-white px-1.5 py-0.5 rounded-xl border border-slate-200 overflow-x-auto no-scrollbar max-w-full shadow-xs">
          <span className="text-[10px] font-bold text-slate-500 font-mono flex items-center gap-0.5 pr-0.5 shrink-0">
            <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
            <span>Jarak:</span>
          </span>

          {/* Baku Subdivisions */}
          {[
            { val: 1, short: '1/1' },
            { val: 2, short: '1/2' },
            { val: 4, short: '1/4' },
            { val: 8, short: '1/8' },
            { val: 16, short: '1/16' },
          ].map((iv) => (
            <button
              key={iv.val}
              type="button"
              onClick={() => onSetStudioInterval(iv.val as StudioInterval)}
              className={`px-1.5 sm:px-2 py-0.5 rounded text-[10.5px] font-mono font-bold transition-all cursor-pointer shrink-0 ${
                studioInterval === iv.val
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title={`Jarak langkah ${iv.short} Beat`}
            >
              {iv.short}
            </button>
          ))}

          {/* Divider */}
          <span className="text-slate-300 px-0.5 font-mono">|</span>

          {/* Triplet Subdivisions */}
          {[
            { val: 3, short: '1/3T' },
            { val: 6, short: '1/6T' },
          ].map((iv) => (
            <button
              key={iv.val}
              type="button"
              onClick={() => onSetStudioInterval(iv.val as StudioInterval)}
              className={`px-1.5 sm:px-2 py-0.5 rounded text-[10.5px] font-mono font-bold transition-all cursor-pointer shrink-0 ${
                studioInterval === iv.val
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'text-cyan-700 hover:text-cyan-900'
              }`}
              title={`Jarak langkah Triplet ${iv.short}`}
            >
              {iv.short}
            </button>
          ))}
        </div>

        {/* Step Record & Rhythm Phrases Toggles (Compact) */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleStepRecord}
            className={`px-2 py-1 rounded-xl font-bold text-[10.5px] flex items-center gap-1 transition-all cursor-pointer border shadow-xs ${
              stepRecordMode
                ? 'bg-rose-600 text-white border-rose-500 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
            title="Auto-Advance: Majukan playhead otomatis setelah menaruh note"
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${stepRecordMode ? 'bg-white animate-ping' : 'bg-rose-500'}`}
            />
            <span className="font-mono">Auto-Maju: {stepRecordMode ? 'ON' : 'OFF'}</span>
          </button>

          {onInsertRhythmPhrase && (
            <button
              type="button"
              onClick={() => setShowRhythmPhrases(!showRhythmPhrases)}
              className={`px-2 py-1 rounded-xl font-bold text-[10.5px] flex items-center gap-1 transition-all cursor-pointer border shadow-xs ${
                showRhythmPhrases
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3 h-3 text-amber-500" />
              <span>Frasa</span>
            </button>
          )}

          {onToggleRangeCopy && (
            <button
              type="button"
              onClick={onToggleRangeCopy}
              className={`px-2 py-1 rounded-xl font-bold text-[10.5px] flex items-center gap-1 transition-all cursor-pointer border shadow-xs ${
                isRangeCopyOpen
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
              title="Buka Jendela Rentang Waktu (Salin, Tempel, Hapus, Potong)"
            >
              <Scissors className="w-3 h-3 text-indigo-600 shrink-0" />
              <span>Rentang</span>
            </button>
          )}
        </div>
      </div>

      {/* Quick Rhythm Phrases Drawer */}
      {showRhythmPhrases && onInsertRhythmPhrase && (
        <div className="p-2.5 bg-white rounded-2xl border border-slate-200 space-y-1.5 animate-in fade-in shadow-xs">
          <span className="text-[10.5px] font-bold text-indigo-900 block">
            Suntikkan Rangkaian Ritme Cepat di Playhead:
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5">
            <button
              type="button"
              disabled={isPreset || isLocked}
              onClick={() => onInsertRhythmPhrase('roll_8')}
              className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all text-xs cursor-pointer group disabled:opacity-40"
            >
              <span className="font-bold text-sky-700 block text-[11px] group-hover:text-sky-900">Roll 1/8 (4x)</span>
              <span className="text-[9px] text-slate-500 block">Stream 4 lane</span>
            </button>

            <button
              type="button"
              disabled={isPreset || isLocked}
              onClick={() => onInsertRhythmPhrase('downbeats')}
              className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all text-xs cursor-pointer group disabled:opacity-40"
            >
              <span className="font-bold text-emerald-700 block text-[11px] group-hover:text-emerald-900">Downbeat 1/1</span>
              <span className="text-[9px] text-slate-500 block">4x on-beat</span>
            </button>

            <button
              type="button"
              disabled={isPreset || isLocked}
              onClick={() => onInsertRhythmPhrase('walk_2')}
              className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all text-xs cursor-pointer group disabled:opacity-40"
            >
              <span className="font-bold text-purple-700 block text-[11px] group-hover:text-purple-900">Melodic 1/2</span>
              <span className="text-[9px] text-slate-500 block">Tangga 1/2b</span>
            </button>

            <button
              type="button"
              disabled={isPreset || isLocked}
              onClick={() => onInsertRhythmPhrase('gallop')}
              className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all text-xs cursor-pointer group disabled:opacity-40"
            >
              <span className="font-bold text-amber-700 block text-[11px] group-hover:text-amber-900">Gallop Groove</span>
              <span className="text-[9px] text-slate-500 block">1/8 + 1/8 + 1/4</span>
            </button>

            <button
              type="button"
              disabled={isPreset || isLocked}
              onClick={() => onInsertRhythmPhrase('triplet')}
              className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all text-xs cursor-pointer group disabled:opacity-40"
            >
              <span className="font-bold text-pink-700 block text-[11px] group-hover:text-pink-900">Triplet 1/3</span>
              <span className="text-[9px] text-slate-500 block">3x triplet</span>
            </button>

            <button
              type="button"
              disabled={isPreset || isLocked}
              onClick={() => onInsertRhythmPhrase('vocal_hold_tap')}
              className="p-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left transition-all text-xs cursor-pointer group disabled:opacity-40"
            >
              <span className="font-bold text-cyan-700 block text-[11px] group-hover:text-cyan-900">Hold + Tap</span>
              <span className="text-[9px] text-slate-500 block">Hold 1b + tap</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
